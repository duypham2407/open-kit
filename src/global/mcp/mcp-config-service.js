import { expandMcpScope } from '../../capabilities/status.js';
import { loadMcpCatalog, requireMcpCatalogEntry } from './catalog-loader.js';
import { buildMcpStatus, listMcpStatuses, testMcpCapability } from './health-checks.js';
import { readMcpConfig, recordSecretBinding, setMcpEnabled } from './mcp-config-store.js';
import { materializeMcpProfiles } from './profile-materializer.js';
import {
  inspectSecretFile,
  repairSecretStorePermissions,
  setSecretValue,
  unsetSecretValue,
} from './secret-manager.js';

const GLOBAL_CAVEAT = 'Direct OpenCode launches do not load OpenKit secrets.env; export needed env vars or use openkit run.';

function firstSecretBinding(entry, envVar = null) {
  const binding = envVar
    ? entry.secretBindings?.find((candidate) => candidate.envVar === envVar)
    : entry.secretBindings?.[0];
  if (!binding) {
    throw new Error(`MCP '${entry.id}' does not define the requested secret binding.`);
  }
  return binding;
}

function normalizeScopeResults(materialized) {
  const scopeResults = {};
  for (const [scope, result] of Object.entries(materialized.results ?? {})) {
    scopeResults[scope] = result.status === 'conflict' ? 'conflict' : 'success';
  }
  return scopeResults;
}

function scopeChanged(mcpId, scope, expectedEnabled, beforeConfig, afterConfig) {
  const before = beforeConfig.scopes?.[scope]?.[mcpId];
  const after = afterConfig.scopes?.[scope]?.[mcpId];
  const wasEnabled = before?.enabled === true;
  const nowEnabled = after?.enabled === true;
  return wasEnabled !== nowEnabled || after?.source !== before?.source || nowEnabled !== expectedEnabled;
}

function normalizeEnablementScopeResults(mcpId, expectedEnabled, scope, beforeConfig, afterConfig, materialized) {
  const results = normalizeScopeResults(materialized);
  for (const targetScope of expandMcpScope(scope)) {
    if (results[targetScope] === 'success' && !scopeChanged(mcpId, targetScope, expectedEnabled, beforeConfig, afterConfig)) {
      results[targetScope] = 'skipped';
    }
  }
  return results;
}

function summarizeConflicts(materialized) {
  const conflicts = [];
  for (const [scope, result] of Object.entries(materialized.results ?? {})) {
    for (const mcpId of Object.keys(result.conflicts ?? {})) {
      conflicts.push({ scope, mcpId, reason: 'existing user-managed global OpenCode entry was preserved' });
    }
  }
  return conflicts;
}

export class McpConfigService {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  validateScope(scope = 'openkit') {
    expandMcpScope(scope);
    return scope;
  }

  requireMcp(mcpId) {
    return requireMcpCatalogEntry(mcpId);
  }

  list({ scope = 'openkit' } = {}) {
    this.validateScope(scope);
    const statuses = scope === 'both'
      ? [...listMcpStatuses({ scope: 'openkit', env: this.env }), ...listMcpStatuses({ scope: 'global', env: this.env })]
      : listMcpStatuses({ scope, env: this.env });
    return {
      scope,
      statuses,
      secretFile: inspectSecretFile({ env: this.env }),
      directOpenCodeCaveat: scope === 'global' || scope === 'both' ? GLOBAL_CAVEAT : null,
    };
  }

  getStatus(mcpId, { scope = 'openkit' } = {}) {
    const entry = this.requireMcp(mcpId);
    return buildMcpStatus(entry, { scope, env: this.env });
  }

  enable(mcpId, { scope = 'openkit' } = {}) {
    this.requireMcp(mcpId);
    const beforeConfig = readMcpConfig({ env: this.env });
    setMcpEnabled(mcpId, true, { scope, env: this.env });
    const afterConfig = readMcpConfig({ env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'enable',
      mcpId,
      requestedScope: scope,
      scopeResults: normalizeEnablementScopeResults(mcpId, true, scope, beforeConfig, afterConfig, materialized),
      conflicts: summarizeConflicts(materialized),
      message: `enabled ${mcpId} for ${scope}`,
    };
  }

  disable(mcpId, { scope = 'openkit' } = {}) {
    this.requireMcp(mcpId);
    const beforeConfig = readMcpConfig({ env: this.env });
    setMcpEnabled(mcpId, false, { scope, env: this.env });
    const afterConfig = readMcpConfig({ env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'disable',
      mcpId,
      requestedScope: scope,
      scopeResults: normalizeEnablementScopeResults(mcpId, false, scope, beforeConfig, afterConfig, materialized),
      conflicts: summarizeConflicts(materialized),
      message: `disabled ${mcpId} for ${scope}`,
    };
  }

  setKey(mcpId, value, { scope = 'openkit', envVar = null } = {}) {
    const entry = this.requireMcp(mcpId);
    const binding = firstSecretBinding(entry, envVar);
    setSecretValue(binding.envVar, value, { env: this.env });
    recordSecretBinding(mcpId, [binding.envVar], { env: this.env });
    setMcpEnabled(mcpId, true, { scope, env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'set-key',
      mcpId,
      requestedScope: scope,
      envVar: binding.envVar,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      keyState: 'present_redacted',
      message: `${binding.envVar}: present (redacted)`,
    };
  }

  unsetKey(mcpId, { scope = 'openkit', envVar = null } = {}) {
    const entry = this.requireMcp(mcpId);
    const binding = firstSecretBinding(entry, envVar);
    unsetSecretValue(binding.envVar, { env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'unset-key',
      mcpId,
      requestedScope: scope,
      envVar: binding.envVar,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      keyState: 'missing',
      message: `${binding.envVar}: missing`,
    };
  }

  test(mcpId, { scope = 'openkit' } = {}) {
    this.requireMcp(mcpId);
    const results = expandMcpScope(scope).map((targetScope) => testMcpCapability(mcpId, { scope: targetScope, env: this.env }));
    return scope === 'both' ? results : results[0];
  }

  testAll({ scope = 'openkit' } = {}) {
    return loadMcpCatalog().flatMap((entry) => expandMcpScope(scope).map((targetScope) => this.test(entry.id, { scope: targetScope })));
  }

  inspectSecrets() {
    return inspectSecretFile({ env: this.env });
  }

  repairSecrets() {
    return repairSecretStorePermissions({ env: this.env });
  }
}

export { GLOBAL_CAVEAT };
