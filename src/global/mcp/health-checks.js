import { isCommandAvailable } from '../../command-detection.js';
import { getMcpCatalogEntry, listMcpCatalogEntries } from '../../capabilities/mcp-catalog.js';
import { readMcpConfig } from './mcp-config-store.js';
import { loadSecretsEnv } from './secret-manager.js';

function getKeyState(entry, loadedSecrets, env = process.env) {
  return Object.fromEntries((entry.secretBindings ?? []).map((binding) => {
    const present = Boolean(env[binding.envVar] || loadedSecrets.values?.[binding.envVar]);
    return [binding.envVar, present ? 'present_redacted' : 'missing'];
  }));
}

function getDependencyState(entry, env = process.env) {
  return (entry.dependencyChecks ?? []).map((check) => {
    if (check.kind !== 'command') {
      return { ...check, status: 'not_checked' };
    }
    const available = isCommandAvailable(check.command, { env });
    return {
      ...check,
      status: available ? 'available' : (check.required ? 'unavailable' : 'degraded'),
    };
  });
}

export function buildMcpStatus(entry, { scope = 'openkit', config = readMcpConfig(), loadedSecrets = { values: {} }, env = process.env } = {}) {
  const scopeState = config.scopes?.[scope]?.[entry.id] ?? { enabled: entry.defaultEnabled?.[scope] === true, source: 'default' };
  const keyState = getKeyState(entry, loadedSecrets, env);
  const dependencies = getDependencyState(entry, env);
  const missingRequiredKeys = Object.values(keyState).some((value) => value === 'missing') && (entry.secretBindings ?? []).some((binding) => binding.required);
  const missingRequiredDeps = dependencies.some((check) => check.required && check.status === 'unavailable');
  const optionalMissing = dependencies.some((check) => !check.required && check.status !== 'available');
  let capabilityState = entry.status;
  if (!scopeState.enabled) {
    capabilityState = entry.status === 'available' ? 'available' : entry.status;
  } else if (missingRequiredKeys) {
    capabilityState = 'not_configured';
  } else if (missingRequiredDeps) {
    capabilityState = 'unavailable';
  } else if (optionalMissing || entry.lifecycle === 'preview' || entry.lifecycle === 'policy_gated') {
    capabilityState = 'preview';
  } else {
    capabilityState = 'available';
  }

  return {
    mcpId: entry.id,
    displayName: entry.displayName,
    scope,
    enabled: scopeState.enabled === true,
    source: scopeState.source ?? 'default',
    capabilityState,
    lifecycle: entry.lifecycle,
    optional: entry.optional === true,
    keyState,
    dependencies,
    validationSurface: 'runtime_tooling',
    guidance: missingRequiredKeys
      ? `Run openkit configure mcp set-key ${entry.id} --stdin`
      : entry.docs?.setup ?? 'docs/operator/mcp-configuration.md',
  };
}

export function listMcpStatuses({ scope = 'openkit', env = process.env } = {}) {
  const config = readMcpConfig({ env });
  let loadedSecrets = { values: {} };
  try {
    loadedSecrets = loadSecretsEnv({ env });
  } catch {
    loadedSecrets = { values: {} };
  }
  return listMcpCatalogEntries().map((entry) => buildMcpStatus(entry, { scope, config, loadedSecrets, env }));
}

export function testMcpCapability(mcpId, { scope = 'openkit', env = process.env } = {}) {
  const entry = getMcpCatalogEntry(mcpId);
  if (!entry) {
    throw new Error(`Unknown MCP '${mcpId}'.`);
  }
  const status = buildMcpStatus(entry, {
    scope,
    config: readMcpConfig({ env }),
    loadedSecrets: (() => {
      try {
        return loadSecretsEnv({ env });
      } catch {
        return { values: {} };
      }
    })(),
    env,
  });
  if (!status.enabled) {
    return { ...status, status: 'skipped', reason: 'disabled' };
  }
  if (status.capabilityState === 'not_configured') {
    return { ...status, status: 'not_configured', reason: 'missing_key' };
  }
  if (status.capabilityState === 'unavailable') {
    return { ...status, status: 'unavailable', reason: 'missing_dependency' };
  }
  return { ...status, status: status.capabilityState === 'available' ? 'pass' : 'degraded', reason: status.capabilityState };
}
