import { expandMcpScope } from '../../capabilities/status.js';
import { getMcpCatalogEntry } from '../../capabilities/mcp-catalog.js';
import { materializeMcpProfiles } from './profile-materializer.js';
import { recordSecretBinding, setMcpEnabled } from './mcp-config-store.js';
import { inspectSecretFile, setSecretValue, unsetSecretValue } from './secret-manager.js';
import { listMcpStatuses, testMcpCapability } from './health-checks.js';

function parseScope(args) {
  const index = args.indexOf('--scope');
  if (index === -1) {
    return 'openkit';
  }
  const scope = args[index + 1];
  expandMcpScope(scope);
  return scope;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function requireMcp(id) {
  const entry = getMcpCatalogEntry(id);
  if (!entry) {
    throw new Error(`Unknown MCP '${id}'. Run openkit configure mcp list to see supported MCP ids.`);
  }
  return entry;
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
    'Usage: openkit configure mcp <list|doctor|enable|disable|set-key|unset-key|test> [options]',
    '',
    'Options:',
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

export async function runConfigureMcp(args = [], io, { env = process.env } = {}) {
  const [action, mcpId] = args;
  if (!action || action === '--help' || action === '-h') {
    io.stdout.write(`${configureMcpHelp()}\n`);
    return 0;
  }

  const scope = parseScope(args);
  const json = hasFlag(args, '--json');

  if (action === 'list' || action === 'doctor') {
    const statuses = scope === 'both'
      ? [...listMcpStatuses({ scope: 'openkit', env }), ...listMcpStatuses({ scope: 'global', env })]
      : listMcpStatuses({ scope, env });
    const secretFile = inspectSecretFile({ env });
    const directOpenCodeCaveat = scope === 'global' || scope === 'both'
      ? 'Direct OpenCode launches do not load OpenKit secrets.env; export needed env vars or use openkit run.'
      : null;
    const payload = { status: 'ok', scope, secretFile, directOpenCodeCaveat, mcps: statuses };
    writeJsonOrText(io, payload, `${renderStatuses(statuses, scope)}${directOpenCodeCaveat ? `${directOpenCodeCaveat}\n` : ''}`, args);
    return 0;
  }

  if (action === 'enable' || action === 'disable') {
    requireMcp(mcpId);
    setMcpEnabled(mcpId, action === 'enable', { scope, env });
    const materialized = materializeMcpProfiles({ scope, env });
    io.stdout.write(`${action === 'enable' ? 'enabled' : 'disabled'} ${mcpId} for ${scope}\n`);
    if (Object.values(materialized.results).some((result) => result.status === 'conflict')) {
      io.stderr.write('One or more profile entries have unmanaged conflicts; existing user config was preserved.\n');
    }
    return 0;
  }

  if (action === 'set-key') {
    const entry = requireMcp(mcpId);
    const envVarIndex = args.indexOf('--env-var');
    const binding = envVarIndex === -1
      ? entry.secretBindings?.[0]
      : entry.secretBindings?.find((candidate) => candidate.envVar === args[envVarIndex + 1]);
    if (!binding) {
      throw new Error(`MCP '${mcpId}' does not define the requested secret binding.`);
    }
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
    setSecretValue(binding.envVar, value, { env });
    recordSecretBinding(mcpId, [binding.envVar], { env });
    setMcpEnabled(mcpId, true, { scope, env });
    materializeMcpProfiles({ scope, env });
    io.stdout.write(`${binding.envVar}: present (redacted)\n`);
    return 0;
  }

  if (action === 'unset-key') {
    const entry = requireMcp(mcpId);
    const envVarIndex = args.indexOf('--env-var');
    const binding = envVarIndex === -1
      ? entry.secretBindings?.[0]
      : entry.secretBindings?.find((candidate) => candidate.envVar === args[envVarIndex + 1]);
    if (!binding) {
      throw new Error(`MCP '${mcpId}' does not define the requested secret binding.`);
    }
    unsetSecretValue(binding.envVar, { env });
    materializeMcpProfiles({ scope, env });
    io.stdout.write(`${binding.envVar}: missing\n`);
    return 0;
  }

  if (action === 'test') {
    requireMcp(mcpId);
    const result = testMcpCapability(mcpId, { scope, env });
    writeJsonOrText(io, result, `${mcpId}: ${result.status}${result.reason ? ` (${result.reason})` : ''}\n`, args);
    return 0;
  }

  throw new Error(`Unknown configure mcp action '${action}'.`);
}
