import fs from 'node:fs';
import path from 'node:path';

import { expandMcpScope } from '../../capabilities/status.js';
import { loadMcpCatalog, requireMcpCatalogEntry } from './catalog-loader.js';
import { getMcpCatalogEntry } from '../../capabilities/mcp-catalog.js';
import { getGlobalPaths } from '../paths.js';
import {
  addCustomMcpEntry,
  getCustomMcpEntry,
  removeCustomMcpEntry,
  setCustomMcpEnabled,
} from './custom-mcp-store.js';
import {
  normalizeImportedGlobalMcpEntry,
  validateLocalCustomMcpDefinition,
  validateRemoteCustomMcpDefinition,
} from './custom-mcp-validation.js';
import {
  buildCustomMcpStatus,
  buildMcpStatus,
  listCustomMcpStatuses,
  listMcpStatuses,
  testCustomMcpCapability,
  testMcpCapability,
} from './health-checks.js';
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

function scopeEnabledMap(scope, enabled) {
  const state = { openkit: false, global: false };
  for (const targetScope of expandMcpScope(scope)) {
    state[targetScope] = Boolean(enabled);
  }
  return state;
}

function assertValidValidation(validation) {
  if (validation.status !== 'valid') {
    throw new Error(validation.errors.join(' ') || 'Custom MCP validation failed.');
  }
}

function readGlobalOpenCodeConfig(env) {
  const configPath = path.join(getGlobalPaths({ env }).openCodeHome, 'opencode.json');
  if (!fs.existsSync(configPath)) {
    return { configPath, config: {} };
  }
  return { configPath, config: JSON.parse(fs.readFileSync(configPath, 'utf8')) };
}

function customResultSummary(entry, scope, env) {
  const scopes = expandMcpScope(scope);
  return scopes.length === 1
    ? buildCustomMcpStatus(entry, { scope: scopes[0], env })
    : scopes.map((targetScope) => buildCustomMcpStatus(entry, { scope: targetScope, env }));
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

  requireCustomMcp(customId) {
    const entry = getCustomMcpEntry(customId, { env: this.env });
    if (!entry) {
      throw new Error(`Unknown custom MCP '${customId}'.`);
    }
    return entry;
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

  listCustom({ scope = 'openkit' } = {}) {
    this.validateScope(scope);
    const statuses = scope === 'both'
      ? [...listCustomMcpStatuses({ scope: 'openkit', env: this.env }), ...listCustomMcpStatuses({ scope: 'global', env: this.env })]
      : listCustomMcpStatuses({ scope, env: this.env });
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

  getCustomStatus(customId, { scope = 'openkit' } = {}) {
    const entry = this.requireCustomMcp(customId);
    return buildCustomMcpStatus(entry, { scope, env: this.env });
  }

  addLocalCustom(customId, { command, environment = {}, displayName = null, scope = 'openkit', enable = false, yes = false } = {}) {
    if (getMcpCatalogEntry(customId)) {
      throw new Error(`Custom MCP id '${customId}' collides with a bundled MCP id; use bundled MCP commands instead.`);
    }
    const validation = validateLocalCustomMcpDefinition({ id: customId, displayName, command, environment }, { env: this.env });
    assertValidValidation(validation);
    const shouldEnable = enable === true && yes === true;
    const warnings = [...validation.warnings, ...(enable === true && yes !== true ? ['Custom local MCP was stored disabled because --yes was not provided for enablement.'] : [])];
    addCustomMcpEntry({
      id: customId,
      displayName: displayName ?? customId,
      origin: 'local',
      ownership: 'openkit-managed-custom',
      enabled: scopeEnabledMap(scope, shouldEnable),
      definition: validation.normalizedDefinition,
      secretBindings: validation.secretBindings,
      riskWarnings: validation.riskWarnings,
      validationWarnings: warnings,
    }, { env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    const entry = this.requireCustomMcp(customId);
    return {
      action: 'custom-add-local',
      customMcp: customResultSummary(entry, scope, this.env),
      requestedScope: scope,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      warnings,
      message: `stored custom local MCP ${customId}`,
    };
  }

  addRemoteCustom(customId, { url, transport = 'streamable-http', headers = {}, environment = {}, displayName = null, scope = 'openkit', enable = true, yes = false } = {}) {
    if (getMcpCatalogEntry(customId)) {
      throw new Error(`Custom MCP id '${customId}' collides with a bundled MCP id; use bundled MCP commands instead.`);
    }
    const validation = validateRemoteCustomMcpDefinition({ id: customId, displayName, url, transport, headers, environment });
    assertValidValidation(validation);
    const shouldEnable = enable === true && yes === true;
    const warnings = [...validation.warnings, ...(enable === true && yes !== true ? ['Custom remote MCP was stored disabled because --yes was not provided for enablement.'] : [])];
    addCustomMcpEntry({
      id: customId,
      displayName: displayName ?? customId,
      origin: 'remote',
      ownership: 'openkit-managed-custom',
      enabled: scopeEnabledMap(scope, shouldEnable),
      definition: validation.normalizedDefinition,
      secretBindings: validation.secretBindings,
      riskWarnings: validation.riskWarnings,
      validationWarnings: warnings,
    }, { env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    const entry = this.requireCustomMcp(customId);
    return {
      action: 'custom-add-remote',
      customMcp: customResultSummary(entry, scope, this.env),
      requestedScope: scope,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      warnings,
      message: `stored custom remote MCP ${customId}`,
    };
  }

  importGlobalCustom(globalId, { customId = globalId, scope = 'openkit', enable = true, yes = false } = {}) {
    if (getMcpCatalogEntry(customId)) {
      throw new Error(`Custom MCP id '${customId}' collides with a bundled MCP id; use bundled MCP commands instead.`);
    }
    const { configPath, config } = readGlobalOpenCodeConfig(this.env);
    const sourceEntry = config.mcp?.[globalId];
    if (!sourceEntry) {
      throw new Error(`Global OpenCode MCP '${globalId}' was not found in ${configPath}.`);
    }
    const normalized = normalizeImportedGlobalMcpEntry(globalId, sourceEntry, {
      customId,
      enabled: scopeEnabledMap(scope, enable === true && yes === true),
    });
    if (!normalized.entry) {
      return { action: 'custom-import-global', globalId, customId, outcome: normalized.outcome, reason: normalized.reason, errors: normalized.errors ?? [], warnings: normalized.warnings ?? [] };
    }
    addCustomMcpEntry(normalized.entry, { env: this.env, importSource: { source: 'global-opencode', sourceId: globalId } });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    const entry = this.requireCustomMcp(customId);
    return {
      action: 'custom-import-global',
      globalId,
      customId,
      outcome: normalized.outcome,
      customMcp: customResultSummary(entry, scope, this.env),
      requestedScope: scope,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      warnings: normalized.warnings ?? [],
      message: `imported global MCP ${globalId} as ${customId}`,
    };
  }

  importGlobalCustomBatch(globalIds = [], { scope = 'openkit', enable = true, yes = false } = {}) {
    const results = [];
    for (const globalId of globalIds) {
      try {
        const result = this.importGlobalCustom(globalId, { customId: globalId, scope, enable, yes });
        results.push({
          globalId,
          customId: result.customId ?? globalId,
          outcome: result.outcome ?? 'imported',
          scopeResults: result.scopeResults ?? {},
          warnings: result.warnings ?? [],
          conflicts: result.conflicts ?? [],
        });
      } catch (error) {
        results.push({ globalId, customId: globalId, outcome: /not found/i.test(error.message) ? 'skipped' : 'invalid', reason: error.message });
      }
    }
    return {
      action: 'custom-import-global-batch',
      requestedScope: scope,
      results,
      status: results.some((result) => result.outcome === 'imported' || result.outcome === 'needs_secret_setup') ? 'partial' : 'skipped',
    };
  }

  disableCustom(customId, { scope = 'openkit' } = {}) {
    this.requireCustomMcp(customId);
    setCustomMcpEnabled(customId, false, { scope, env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'custom-disable',
      customId,
      requestedScope: scope,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      message: `disabled custom MCP ${customId} for ${scope}`,
    };
  }

  removeCustom(customId, { scope = 'openkit' } = {}) {
    if (scope === 'all') {
      const removed = removeCustomMcpEntry(customId, { env: this.env });
      const materialized = materializeMcpProfiles({ scope: 'both', env: this.env });
      return {
        action: 'custom-remove',
        customId,
        status: removed.status,
        requestedScope: scope,
        scopeResults: normalizeScopeResults(materialized),
        conflicts: summarizeConflicts(materialized),
        guidance: 'Associated custom MCP secret values, if any, are preserved in secrets.env; remove them explicitly with unset-key if needed.',
      };
    }
    this.requireCustomMcp(customId);
    setCustomMcpEnabled(customId, false, { scope, env: this.env });
    const materialized = materializeMcpProfiles({ scope, env: this.env });
    return {
      action: 'custom-remove',
      customId,
      status: 'disabled_for_scope',
      requestedScope: scope,
      scopeResults: normalizeScopeResults(materialized),
      conflicts: summarizeConflicts(materialized),
      guidance: 'Custom definition preserved because --scope all was not requested.',
    };
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
    const entry = getMcpCatalogEntry(mcpId) ?? getCustomMcpEntry(mcpId, { env: this.env });
    if (!entry) {
      throw new Error(`Unknown MCP '${mcpId}'.`);
    }
    const binding = firstSecretBinding(entry, envVar);
    setSecretValue(binding.envVar, value, { env: this.env });
    if (getMcpCatalogEntry(mcpId)) {
      recordSecretBinding(mcpId, [binding.envVar], { env: this.env });
      setMcpEnabled(mcpId, true, { scope, env: this.env });
    } else {
      setCustomMcpEnabled(mcpId, true, { scope, env: this.env });
    }
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

  testCustom(customId, { scope = 'openkit' } = {}) {
    this.requireCustomMcp(customId);
    const results = expandMcpScope(scope).map((targetScope) => testCustomMcpCapability(customId, { scope: targetScope, env: this.env }));
    return scope === 'both' ? results : results[0];
  }

  testAll({ scope = 'openkit' } = {}) {
    return loadMcpCatalog().flatMap((entry) => expandMcpScope(scope).map((targetScope) => this.test(entry.id, { scope: targetScope })));
  }

  testAllCustom({ scope = 'openkit' } = {}) {
    return this.listCustom({ scope: scope === 'both' ? 'openkit' : scope }).statuses.flatMap((entry) => expandMcpScope(scope).map((targetScope) => this.testCustom(entry.mcpId, { scope: targetScope })));
  }

  inspectSecrets() {
    return inspectSecretFile({ env: this.env });
  }

  repairSecrets() {
    return repairSecretStorePermissions({ env: this.env });
  }
}

export { GLOBAL_CAVEAT };
