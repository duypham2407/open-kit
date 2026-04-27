import { listMcpCatalogEntries } from '../../capabilities/mcp-catalog.js';
import { GLOBAL_CAVEAT, McpConfigService } from './mcp-config-service.js';
import { createPromptAdapter, isInteractiveIo, normalizePromptAnswer } from './interactive-prompts.js';
import { redactKnownSecrets } from './redaction.js';

function keyStateLabel(keyState = {}) {
  const entries = Object.entries(keyState);
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([key, value]) => `${key}:${value === 'present_redacted' ? 'present (redacted)' : 'missing'}`).join(', ');
}

function renderScopeResults(scopeResults = {}) {
  return Object.entries(scopeResults).map(([scope, status]) => `${scope}=${status}`).join(', ');
}

function renderHealthResult(io, result) {
  io.stdout.write(`${result.mcpId} [${result.scope}]: ${result.status}${result.reason ? ` (${result.reason})` : ''}\n`);
}

function renderInventory(io, inventory) {
  io.stdout.write('\nBundled MCP inventory (redacted):\n');
  for (const status of inventory.statuses) {
    const labels = [status.lifecycle, status.optional ? 'optional' : null].filter(Boolean).join(', ');
    io.stdout.write(`- ${status.mcpId} (${status.displayName}) | scope=${status.scope} | enabled=${status.enabled ? 'yes' : 'no'} | state=${status.capabilityState} | labels=${labels || 'none'} | keys=${keyStateLabel(status.keyState)}\n`);
  }
}

function renderSummary(io, context) {
  io.stdout.write('\nFinal summary (redacted):\n');
  io.stdout.write(`Final scope: ${context.scope}\n`);
  if (context.cancelled) {
    io.stdout.write('Wizard cancelled after the actions listed below.\n');
  }
  if (context.changes.length === 0 && context.skipped.length === 0 && context.failures.length === 0) {
    io.stdout.write('- No MCP configuration changes were made.\n');
  }
  for (const item of context.changes) {
    io.stdout.write(`- changed ${item.mcpId} ${item.action} (${renderScopeResults(item.scopeResults)})${item.keyState ? `; key=${item.keyState}` : ''}\n`);
  }
  for (const item of context.skipped) {
    io.stdout.write(`- skipped ${item.mcpId ?? 'wizard'} ${item.action}: ${item.reason}\n`);
  }
  for (const item of context.failures) {
    io.stdout.write(`- failed ${item.mcpId ?? 'wizard'} ${item.action}: ${item.reason}\n`);
  }
  for (const conflict of context.conflicts) {
    io.stdout.write(`- conflict ${conflict.scope}/${conflict.mcpId}: ${conflict.reason}\n`);
  }
  for (const caveat of context.caveats) {
    io.stdout.write(`- caveat: ${caveat}\n`);
  }
  io.stdout.write(`Next: openkit configure mcp doctor --scope ${context.scope}\n`);
  io.stdout.write('Next: openkit run\n');
}

function nonTtyMessage(scope) {
  return [
    'openkit configure mcp --interactive requires an interactive terminal and made no changes.',
    'Use existing non-interactive commands for scripts:',
    `  openkit configure mcp list --scope ${scope} --json`,
    `  openkit configure mcp doctor --scope ${scope} --json`,
    `  openkit configure mcp enable <mcp-id> --scope ${scope}`,
    `  openkit configure mcp disable <mcp-id> --scope ${scope}`,
    `  openkit configure mcp set-key <mcp-id> --scope ${scope} --stdin`,
    `  openkit configure mcp unset-key <mcp-id> --scope ${scope}`,
    `  openkit configure mcp test <mcp-id> --scope ${scope} --json`,
  ].join('\n');
}

function hasSecretBinding(mcpId) {
  return (listMcpCatalogEntries().find((entry) => entry.id === mcpId)?.secretBindings ?? []).length > 0;
}

function addActionResult(context, result) {
  context.changes.push(result);
  context.conflicts.push(...(result.conflicts ?? []));
}

async function confirm(promptAdapter, message) {
  const answer = normalizePromptAnswer(await promptAdapter.promptLine(`${message} [yes/no]: `)).toLowerCase();
  return answer === 'yes' || answer === 'y';
}

export async function runMcpInteractiveWizard({ scope = 'openkit', io, env = process.env, promptAdapter = null } = {}) {
  const service = new McpConfigService({ env });
  service.validateScope(scope);

  if (!promptAdapter && !isInteractiveIo(io)) {
    io.stderr.write(`${nonTtyMessage(scope)}\n`);
    return 1;
  }

  const prompts = promptAdapter ?? createPromptAdapter(io);
  const context = {
    scope,
    selectedMcpId: null,
    changes: [],
    skipped: [],
    failures: [],
    conflicts: [],
    caveats: [],
    cancelled: false,
  };
  if (scope === 'global' || scope === 'both') {
    context.caveats.push(GLOBAL_CAVEAT);
  }

  try {
    io.stdout.write('Interactive MCP Setup Wizard\n');
    io.stdout.write(`Scope: ${context.scope}\n`);
    if (context.caveats.length > 0) {
      io.stdout.write(`${GLOBAL_CAVEAT}\n`);
    }

    let running = true;
    while (running) {
      renderInventory(io, service.list({ scope: context.scope }));
      const answer = normalizePromptAnswer(await prompts.promptLine('\nChoose action: change-scope, select, test, repair, refresh, finish, cancel: ')).toLowerCase();

      if (answer === 'finish' || answer === '') {
        break;
      }
      if (answer === 'cancel' || answer === 'quit') {
        context.cancelled = true;
        break;
      }
      if (answer === 'refresh') {
        continue;
      }
      if (answer === 'change-scope') {
        const nextScope = normalizePromptAnswer(await prompts.promptLine('Scope (openkit/global/both): '));
        service.validateScope(nextScope);
        context.scope = nextScope;
        if ((nextScope === 'global' || nextScope === 'both') && !context.caveats.includes(GLOBAL_CAVEAT)) {
          context.caveats.push(GLOBAL_CAVEAT);
          io.stdout.write(`${GLOBAL_CAVEAT}\n`);
        }
        continue;
      }
      if (answer === 'repair') {
        if (await confirm(prompts, 'Repair only the OpenKit secret-store directory/file permissions?')) {
          const result = service.repairSecrets();
          context.changes.push({ action: 'repair-permissions', mcpId: 'secret-store', scopeResults: { local: result.status === 'ok' || result.status === 'limited' ? 'success' : 'failed' }, message: result.status });
          io.stdout.write(`Secret-store repair: ${result.status}\n`);
        }
        continue;
      }
      if (answer === 'test') {
        const results = service.testAll({ scope: context.scope });
        for (const result of results) {
          renderHealthResult(io, result);
        }
        continue;
      }
      if (answer !== 'select') {
        context.skipped.push({ action: 'menu', reason: `unknown action '${answer}'` });
        continue;
      }

      const mcpId = normalizePromptAnswer(await prompts.promptLine('MCP id: '));
      service.requireMcp(mcpId);
      context.selectedMcpId = mcpId;
      const mcpAction = normalizePromptAnswer(await prompts.promptLine('MCP action (enable/disable/set-key/unset-key/test/back): ')).toLowerCase();
      if (mcpAction === 'back') {
        continue;
      }
      if (mcpAction === 'test') {
        const results = [service.test(mcpId, { scope: context.scope })].flat();
        for (const result of results) {
          renderHealthResult(io, result);
        }
        continue;
      }
      if (!['enable', 'disable', 'set-key', 'unset-key'].includes(mcpAction)) {
        context.skipped.push({ action: mcpAction, mcpId, reason: 'unknown MCP action' });
        continue;
      }
      if (!await confirm(prompts, `${mcpAction} ${mcpId} for ${context.scope}?`)) {
        context.skipped.push({ action: mcpAction, mcpId, reason: 'operator declined' });
        continue;
      }

      try {
        if (mcpAction === 'enable') {
          addActionResult(context, service.enable(mcpId, { scope: context.scope }));
        } else if (mcpAction === 'disable') {
          addActionResult(context, service.disable(mcpId, { scope: context.scope }));
        } else if (mcpAction === 'unset-key') {
          addActionResult(context, service.unsetKey(mcpId, { scope: context.scope }));
        } else if (mcpAction === 'set-key') {
          if (!hasSecretBinding(mcpId)) {
            context.skipped.push({ action: 'set-key', mcpId, reason: 'no catalog-defined secret binding' });
            continue;
          }
          const secretState = service.inspectSecrets();
          if (secretState.status === 'unsafe') {
            const shouldRepair = await confirm(prompts, 'Secret store permissions are unsafe. Repair before key write?');
            if (!shouldRepair) {
              context.failures.push({ action: 'set-key', mcpId, reason: 'unsafe secret store; key write skipped' });
              continue;
            }
            const repair = service.repairSecrets();
            if (!['ok', 'limited'].includes(repair.status)) {
              context.failures.push({ action: 'set-key', mcpId, reason: 'secret-store repair failed' });
              continue;
            }
          }
          const secret = await prompts.promptSecret('Enter secret (hidden): ');
          if (!secret) {
            context.skipped.push({ action: 'set-key', mcpId, reason: 'empty secret entry skipped' });
            continue;
          }
          try {
            const result = service.setKey(mcpId, secret, { scope: context.scope });
            addActionResult(context, result);
            io.stdout.write(`${result.envVar}: present (redacted)\n`);
          } catch (error) {
            context.failures.push({ action: 'set-key', mcpId, reason: redactKnownSecrets(error.message, { secrets: [secret] }) });
          }
        }
      } catch (error) {
        context.failures.push({ action: mcpAction, mcpId, reason: error.message });
      }
    }

    renderSummary(io, context);
    return 0;
  } finally {
    prompts.close?.();
  }
}

export { nonTtyMessage };
