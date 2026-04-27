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
    'Usage: openkit configure mcp [--interactive] <list|doctor|enable|disable|set-key|unset-key|test> [options]',
    '',
    'Options:',
    '  --interactive                 Start the guided, TTY-only MCP setup wizard',
    '  --scope openkit|global|both   Select materialization scope (default: openkit)',
    '  --json                        Emit redacted JSON for list, doctor, or test',
    '  --stdin                       Read set-key value from stdin without echoing it',
    '  --value <value>               Compatibility input path; shell history may retain the value',
    '',
    'Global scope writes placeholder-only entries for direct OpenCode; direct OpenCode launches may need exported env vars.',
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
    lines.push(`${status.mcpId} | enabled=${status.enabled ? 'yes' : 'no'} | state=${status.capabilityState} | keys=${keys} | lifecycle=${status.lifecycle}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderTestResults(result) {
  return [result].flat().map((item) => `${item.mcpId} [${item.scope}]: ${item.status}${item.reason ? ` (${item.reason})` : ''}`).join('\n') + '\n';
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
