import { expandMcpScope } from '../../capabilities/status.js';
import { McpConfigService } from './mcp-config-service.js';
import { runMcpInteractiveWizard } from './interactive-wizard.js';

function parseScope(args) {
  const index = args.indexOf('--scope');
  if (index === -1) {
    return 'openkit';
  }
  const scope = args[index + 1];
  if (!scope || scope.startsWith('--')) {
    throw new Error("Missing value for --scope. Expected one of: openkit, global, both.");
  }
  expandMcpScope(scope);
  return scope;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function readStdin(stdin) {
  if (!stdin || stdin.isTTY) {
    return '';
  }
  return new Promise((resolve) => {
    let content = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      content += chunk;
    });
    stdin.on('end', () => resolve(content.trimEnd()));
  });
}

export function configureMcpHelp() {
  return [
    'Usage: openkit configure mcp [--interactive] <list|doctor|enable|disable|set-key|unset-key|test|custom> [options]',
    '',
    'Options:',
    '  --interactive                 Start the guided, TTY-only MCP setup wizard',
    '  --scope openkit|global|both   Select materialization scope (default: openkit)',
    '  --json                        Emit redacted JSON for list, doctor, or test',
    '  --stdin                       Read set-key value from stdin without echoing it',
    '  --value <value>               Compatibility input path; shell history may retain the value',
    '',
    'Global scope writes placeholder-only entries for direct OpenCode; direct OpenCode launches may need exported env vars.',
    '',
    'Custom MCP commands:',
    '  openkit configure mcp custom list [--scope openkit|global|both] [--json]',
    '  openkit configure mcp custom add-local <custom-id> --cmd <executable> [--arg <arg> ...] [--env ENV=${ENV}] [--enable|--disabled] [--yes] [--json]',
    '  openkit configure mcp custom add-remote <custom-id> --url <url> [--transport http|sse|streamable-http] [--header Header=${ENV}] [--env ENV=${ENV}] [--enable|--disabled] [--yes] [--json]',
    '  openkit configure mcp custom import-global <global-id> [--as <custom-id>] [--scope openkit|global|both] [--enable|--disabled] [--yes] [--json]',
    '  openkit configure mcp custom import-global --select <id1,id2,...> [--scope openkit|global|both] [--enable|--disabled] [--yes] [--json]',
    '  openkit configure mcp custom disable <custom-id> [--scope openkit|global|both] [--json]',
    '  openkit configure mcp custom remove <custom-id> [--scope openkit|global|both|all] [--yes] [--json]',
    '  openkit configure mcp custom doctor [<custom-id>] [--scope openkit|global|both] [--json]',
    '  openkit configure mcp custom test <custom-id> [--scope openkit|global|both] [--yes] [--json]',
  ].join('\n');
}

function writeJsonOrText(io, json, text, args) {
  if (hasFlag(args, '--json')) {
    io.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  } else {
    io.stdout.write(text);
  }
}

function renderStatuses(statuses, scope) {
  const lines = [`Scope: ${scope}`];
  for (const status of statuses) {
    const keys = Object.entries(status.keyState).map(([key, value]) => `${key}:${value === 'present_redacted' ? 'present (redacted)' : 'missing'}`).join(', ') || 'none';
    const labels = [status.kind ?? 'bundled', status.origin].filter(Boolean).join('/');
    const scopeLabel = scope === 'both' && status.scope ? ` [${status.scope}]` : '';
    lines.push(`${status.mcpId}${scopeLabel} | kind=${labels || 'bundled'} | enabled=${status.enabled ? 'yes' : 'no'} | state=${status.capabilityState} | keys=${keys} | lifecycle=${status.lifecycle}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderTestResults(result) {
  return [result].flat().map((item) => `${item.mcpId} [${item.scope}]: ${item.status}${item.reason ? ` (${item.reason})` : ''}`).join('\n') + '\n';
}

function readFlagValue(args, flag, { required = false } = {}) {
  const index = args.indexOf(flag);
  if (index === -1) {
    if (required) {
      throw new Error(`Missing required ${flag} value.`);
    }
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function readRepeatedFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}.`);
    }
    values.push(value);
    index += 1;
  }
  return values;
}

function parseKeyValue(value, label) {
  const separator = String(value).indexOf('=');
  if (separator <= 0) {
    throw new Error(`${label} must use NAME=value syntax.`);
  }
  return [String(value).slice(0, separator), String(value).slice(separator + 1)];
}

function parseKeyValueMap(values, label) {
  return Object.fromEntries(values.map((value) => parseKeyValue(value, label)));
}

function parseCustomScope(args, { allowAll = false } = {}) {
  const scope = readFlagValue(args, '--scope') ?? 'openkit';
  if (allowAll && scope === 'all') {
    return scope;
  }
  expandMcpScope(scope);
  return scope;
}

function parseOptionalCustomId(args) {
  const candidate = args[1];
  return candidate && !candidate.startsWith('--') ? candidate : null;
}

function renderCustomResultText(result) {
  const lines = [`${result.action ?? 'custom'}: ${result.message ?? result.status ?? 'ok'}`];
  if (result.outcome) {
    lines.push(`outcome=${result.outcome}`);
  }
  if (result.scopeResults) {
    lines.push(`scopes=${Object.entries(result.scopeResults).map(([scope, status]) => `${scope}=${status}`).join(', ')}`);
  }
  for (const warning of result.warnings ?? []) {
    lines.push(`warning: ${warning}`);
  }
  for (const conflict of result.conflicts ?? []) {
    lines.push(`conflict ${conflict.scope}/${conflict.mcpId}: ${conflict.reason}`);
  }
  if (result.guidance) {
    lines.push(`guidance: ${result.guidance}`);
  }
  return `${lines.join('\n')}\n`;
}

async function runConfigureMcpCustom(args = [], io, { env = process.env } = {}) {
  const [action, customId] = args;
  const service = new McpConfigService({ env });

  if (!action || action === '--help' || action === '-h') {
    io.stdout.write(`${configureMcpHelp()}\n`);
    return 0;
  }

  if (action === 'list') {
    const scope = parseCustomScope(args);
    const inventory = service.listCustom({ scope });
    const payload = { status: 'ok', scope, secretFile: inventory.secretFile, directOpenCodeCaveat: inventory.directOpenCodeCaveat, customMcps: inventory.statuses };
    writeJsonOrText(io, payload, `${renderStatuses(inventory.statuses, scope)}${inventory.directOpenCodeCaveat ? `${inventory.directOpenCodeCaveat}\n` : ''}`, args);
    return 0;
  }

  if (action === 'add-local') {
    const scope = parseCustomScope(args);
    const command = [readFlagValue(args, '--cmd', { required: true }), ...readRepeatedFlagValues(args, '--arg')];
    const environment = parseKeyValueMap(readRepeatedFlagValues(args, '--env'), '--env');
    const result = service.addLocalCustom(customId, {
      command,
      environment,
      displayName: readFlagValue(args, '--name'),
      scope,
      enable: !hasFlag(args, '--disabled'),
      yes: hasFlag(args, '--yes'),
    });
    writeJsonOrText(io, result, renderCustomResultText(result), args);
    return 0;
  }

  if (action === 'add-remote') {
    const scope = parseCustomScope(args);
    const result = service.addRemoteCustom(customId, {
      url: readFlagValue(args, '--url', { required: true }),
      transport: readFlagValue(args, '--transport') ?? 'streamable-http',
      headers: parseKeyValueMap(readRepeatedFlagValues(args, '--header'), '--header'),
      environment: parseKeyValueMap(readRepeatedFlagValues(args, '--env'), '--env'),
      displayName: readFlagValue(args, '--name'),
      scope,
      enable: !hasFlag(args, '--disabled'),
      yes: hasFlag(args, '--yes'),
    });
    writeJsonOrText(io, result, renderCustomResultText(result), args);
    return 0;
  }

  if (action === 'import-global') {
    const scope = parseCustomScope(args);
    const selected = readFlagValue(args, '--select');
    if (selected) {
      const result = service.importGlobalCustomBatch(selected.split(',').map((value) => value.trim()).filter(Boolean), {
        scope,
        enable: !hasFlag(args, '--disabled'),
        yes: hasFlag(args, '--yes'),
      });
      writeJsonOrText(io, result, renderCustomResultText(result), args);
      return 0;
    }
    const globalId = customId;
    if (!globalId || globalId.startsWith('--')) {
      throw new Error('custom import-global requires <global-id> or --select <id1,id2,...>.');
    }
    const result = service.importGlobalCustom(globalId, {
      customId: readFlagValue(args, '--as') ?? globalId,
      scope,
      enable: !hasFlag(args, '--disabled'),
      yes: hasFlag(args, '--yes'),
    });
    writeJsonOrText(io, result, renderCustomResultText(result), args);
    return 0;
  }

  if (action === 'disable') {
    const scope = parseCustomScope(args);
    const result = service.disableCustom(customId, { scope });
    writeJsonOrText(io, result, renderCustomResultText(result), args);
    return 0;
  }

  if (action === 'remove') {
    const scope = parseCustomScope(args, { allowAll: true });
    const result = service.removeCustom(customId, { scope });
    writeJsonOrText(io, result, renderCustomResultText(result), args);
    return 0;
  }

  if (action === 'doctor') {
    const scope = parseCustomScope(args);
    const doctorCustomId = parseOptionalCustomId(args);
    const inventory = doctorCustomId ? null : service.listCustom({ scope });
    const statuses = doctorCustomId
      ? expandMcpScope(scope).map((targetScope) => service.getCustomStatus(doctorCustomId, { scope: targetScope }))
      : inventory.statuses;
    const payload = { status: 'ok', scope, customMcps: statuses };
    if (inventory) {
      payload.secretFile = inventory.secretFile;
      payload.directOpenCodeCaveat = inventory.directOpenCodeCaveat;
    }
    writeJsonOrText(io, payload, `${renderStatuses(statuses, scope)}${inventory?.directOpenCodeCaveat ? `${inventory.directOpenCodeCaveat}\n` : ''}`, args);
    return 0;
  }

  if (action === 'test') {
    const scope = parseCustomScope(args);
    const result = service.testCustom(customId, { scope });
    writeJsonOrText(io, result, renderTestResults(result), args);
    return 0;
  }

  throw new Error(`Unknown configure mcp custom action '${action}'.`);
}

export async function runConfigureMcp(args = [], io, options = {}) {
  return runConfigureMcpWithOptions(args, io, options);
}

export async function runConfigureMcpWithOptions(args = [], io, { env = process.env, promptAdapter = null } = {}) {
  const [action, mcpId] = args;
  if (!action || action === '--help' || action === '-h') {
    io.stdout.write(`${configureMcpHelp()}\n`);
    return 0;
  }

  if (action === 'custom') {
    return runConfigureMcpCustom(args.slice(1), io, { env });
  }

  const scope = parseScope(args);
  const json = hasFlag(args, '--json');
  const service = new McpConfigService({ env });

  if (hasFlag(args, '--interactive')) {
    if (json) {
      throw new Error('--json cannot be combined with --interactive. Use non-interactive list, doctor, or test for JSON output.');
    }
    return runMcpInteractiveWizard({ scope, io, env, promptAdapter });
  }

  if (action === 'list' || action === 'doctor') {
    const inventory = service.list({ scope });
    const payload = { status: 'ok', scope, secretFile: inventory.secretFile, directOpenCodeCaveat: inventory.directOpenCodeCaveat, mcps: inventory.statuses };
    writeJsonOrText(io, payload, `${renderStatuses(inventory.statuses, scope)}${inventory.directOpenCodeCaveat ? `${inventory.directOpenCodeCaveat}\n` : ''}`, args);
    return 0;
  }

  if (action === 'enable' || action === 'disable') {
    const result = action === 'enable'
      ? service.enable(mcpId, { scope })
      : service.disable(mcpId, { scope });
    io.stdout.write(`${action === 'enable' ? 'enabled' : 'disabled'} ${mcpId} for ${scope}\n`);
    if (Object.values(result.scopeResults).some((status) => status === 'conflict')) {
      io.stderr.write('One or more profile entries have unmanaged conflicts; existing user config was preserved.\n');
    }
    return 0;
  }

  if (action === 'set-key') {
    const envVarIndex = args.indexOf('--env-var');
    let value = null;
    const valueIndex = args.indexOf('--value');
    if (valueIndex !== -1) {
      value = args[valueIndex + 1];
      io.stderr.write('Warning: --value may be retained in shell history; prefer --stdin.\n');
    } else if (hasFlag(args, '--stdin')) {
      value = await readStdin(io.stdin);
    }
    if (!value) {
      throw new Error('set-key requires --stdin or --value for non-interactive use.');
    }
    const result = service.setKey(mcpId, value, { scope, envVar: envVarIndex === -1 ? null : args[envVarIndex + 1] });
    io.stdout.write(`${result.envVar}: present (redacted)\n`);
    return 0;
  }

  if (action === 'unset-key') {
    const envVarIndex = args.indexOf('--env-var');
    const result = service.unsetKey(mcpId, { scope, envVar: envVarIndex === -1 ? null : args[envVarIndex + 1] });
    io.stdout.write(`${result.envVar}: missing\n`);
    return 0;
  }

  if (action === 'test') {
    const result = service.test(mcpId, { scope });
    writeJsonOrText(io, result, renderTestResults(result), args);
    return 0;
  }

  throw new Error(`Unknown configure mcp action '${action}'.`);
}
