import { tryLoadDefaultCommandPermissionPolicy } from '../permissions/command-permission-policy.js';

export const ACTIVATION_POLICY_SCHEMA = 'openkit/capability-activation-policy@1';

export const ACTIVATION_POLICY_OUTCOMES = [
  'approved',
  'blocked',
  'needs_confirmation',
  'degraded',
  'unavailable',
  'not_applicable',
];

const MUTATING_SIDE_EFFECTS = new Set([
  'local_mutating',
  'workflow_mutating',
  'browser_mutating',
  'external_mutating',
  'git_mutating',
  'package_mutating',
  'deploy_release',
  'database_mutating',
  'system_privileged',
  'destructive',
]);

const DANGEROUS_SIDE_EFFECTS = new Set([
  'git_mutating',
  'package_mutating',
  'deploy_release',
  'database_mutating',
  'system_privileged',
  'destructive',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter((entry) => typeof entry === 'string' && entry.length > 0))];
}

function commandText(value) {
  return Array.isArray(value) ? value.join(' ') : String(value ?? '');
}

function hasMissingOrPlaceholderKey(keyState = {}) {
  return Object.values(asObject(keyState)).some((value) => {
    if (typeof value !== 'string') {
      return false;
    }
    return ['missing', 'needs_key', 'not_configured'].includes(value) || /^\$\{[^}]+\}$/.test(value);
  });
}

function hasUnavailableDependency(metadata = {}) {
  const dependencies = [...asList(metadata.dependencies), ...asList(metadata.dependencyStates)];
  return dependencies.some((dependency) => dependency?.required === true && dependency.status === 'unavailable');
}

function hasDegradedDependency(metadata = {}) {
  const dependencies = [...asList(metadata.dependencies), ...asList(metadata.dependencyStates)];
  return dependencies.some((dependency) => dependency?.status && dependency.status !== 'available');
}

function commandSideEffectLevel(command) {
  const text = commandText(command).toLowerCase();
  if (!text) {
    return null;
  }
  if (/\b(git\s+reset\s+--hard|git\s+clean|git\s+push\s+--force|git\s+push\s+--force-with-lease)\b/.test(text)) {
    return 'destructive';
  }
  if (/\bgit\s+(commit|merge|rebase|push|tag|checkout|restore|reset)\b/.test(text)) {
    return 'git_mutating';
  }
  if (/\bnpm\s+(publish|unpublish)\b|\bdeploy\b|\brelease\s+publish\b/.test(text)) {
    return 'deploy_release';
  }
  if (/\bnpm\s+(install|update|dedupe|audit\s+fix)\b/.test(text)) {
    return 'package_mutating';
  }
  if (/\b(dropdb|truncate|db\s+reset|db\s+wipe)\b/.test(text)) {
    return 'database_mutating';
  }
  if (/\b(sudo|chmod|chown)\b/.test(text)) {
    return 'system_privileged';
  }
  if (/\b(rm|rmdir|unlink)\b/.test(text)) {
    return 'destructive';
  }
  return null;
}

export function classifyCapabilityPolicy(capability = {}, { actionType = 'select', command = null } = {}) {
  const commandLevel = commandSideEffectLevel(command);
  const sideEffectLevel = commandLevel ?? capability.sideEffectLevel ?? 'read_only';
  const locality = capability.locality
    ?? (sideEffectLevel.startsWith('browser') ? 'browser' : sideEffectLevel.startsWith('external') ? 'external' : 'local');
  const metadata = asObject(capability.metadata);
  const policyRefs = ['src/capabilities/activation-policy.js'];
  if (MUTATING_SIDE_EFFECTS.has(sideEffectLevel) || commandLevel) {
    policyRefs.push('assets/default-command-permission-policy.json');
  }

  return {
    capabilityId: capability.id ?? null,
    actionType,
    sideEffectLevel,
    locality,
    family: capability.family ?? 'unknown',
    ownership: capability.ownership ?? metadata.ownership ?? 'unknown',
    isMutating: MUTATING_SIDE_EFFECTS.has(sideEffectLevel),
    isDangerous: DANGEROUS_SIDE_EFFECTS.has(sideEffectLevel),
    isBrowser: locality === 'browser' || sideEffectLevel.startsWith('browser_') || capability.family === 'browser',
    isExternal: locality === 'external' || sideEffectLevel.startsWith('external_') || capability.family === 'external',
    policyRefs,
  };
}

export function evaluateMcpReadiness(capability = {}) {
  const metadata = asObject(capability.metadata);
  const family = capability.family ?? '';
  if (!['bundled_mcp', 'custom_mcp', 'external', 'browser', 'policy_gated'].includes(family) && !metadata.mcpId) {
    return { applies: false, outcome: 'not_applicable', reason: 'capability is not MCP-backed', caveats: [], nextActions: [] };
  }

  const caveats = [...asList(capability.caveats)];
  const nextActions = [...asList(capability.nextActions)];

  if (metadata.enabled === false) {
    return {
      applies: true,
      outcome: 'unavailable',
      reason: 'MCP is disabled for the selected scope',
      caveats: uniqueStrings([...caveats, 'disabled for selected scope']),
      nextActions: uniqueStrings([...nextActions, 'Enable the MCP for the selected scope before execution.']),
    };
  }

  if (hasMissingOrPlaceholderKey(metadata.keyState)) {
    return {
      applies: true,
      outcome: 'unavailable',
      reason: 'required MCP secret/key is missing or still a placeholder',
      caveats: uniqueStrings([...caveats, 'required secret/key readiness is missing; values remain redacted']),
      nextActions: uniqueStrings([...nextActions, 'Configure the required MCP key, then rerun MCP doctor/readiness checks.']),
    };
  }

  if (hasUnavailableDependency(metadata)) {
    return {
      applies: true,
      outcome: 'unavailable',
      reason: 'required MCP dependency is unavailable',
      caveats: uniqueStrings([...caveats, 'required command dependency is unavailable']),
      nextActions: uniqueStrings([...nextActions, 'Install the required dependency, then rerun MCP doctor/readiness checks.']),
    };
  }

  if (capability.state === 'unavailable' || capability.state === 'not_configured') {
    return {
      applies: true,
      outcome: 'unavailable',
      reason: `MCP capability state is ${capability.state}`,
      caveats,
      nextActions,
    };
  }

  if (capability.state === 'degraded' || capability.state === 'preview' || capability.lifecycle === 'preview' || capability.lifecycle === 'policy_gated' || capability.lifecycle === 'custom' || hasDegradedDependency(metadata)) {
    return {
      applies: true,
      outcome: 'degraded',
      reason: 'MCP readiness is degraded or policy-gated; selection remains advisory',
      caveats: uniqueStrings([...caveats, `lifecycle=${capability.lifecycle ?? 'unknown'}`]),
      nextActions,
    };
  }

  return { applies: true, outcome: 'approved', reason: 'MCP readiness metadata is available', caveats, nextActions };
}

function evaluatePermissionPolicy({ classification, explicitUserIntent, caveats, nextActions }) {
  if (!classification.isMutating) {
    return { outcome: 'approved', caveats, nextActions };
  }

  const policyLoad = tryLoadDefaultCommandPermissionPolicy();
  if (policyLoad.status !== 'loaded') {
    return {
      outcome: 'degraded',
      caveats: uniqueStrings([...caveats, `command permission policy is ${policyLoad.status}`]),
      nextActions: uniqueStrings([...nextActions, 'Restore assets/default-command-permission-policy.json before mutating activation.']),
    };
  }

  const unsupported = asList(policyLoad.policy.unsupportedGranularity);
  const unsupportedMatch = unsupported.find((entry) => asList(entry.affectedPermissionKeys).some((key) => {
    if (classification.sideEffectLevel === 'git_mutating') {
      return String(key).startsWith('git ');
    }
    if (classification.sideEffectLevel === 'deploy_release') {
      return ['deploy', 'release publish'].includes(key);
    }
    if (classification.sideEffectLevel === 'database_mutating') {
      return ['dropdb', 'truncate', 'db reset', 'db wipe', 'npm'].includes(key);
    }
    return false;
  }));

  if (classification.isDangerous && explicitUserIntent !== true) {
    return {
      outcome: 'blocked',
      caveats: uniqueStrings([...caveats, 'dangerous capability requires explicit user intent and existing safety checks']),
      nextActions: uniqueStrings([...nextActions, 'Use a read-only alternative or obtain explicit user approval for the exact risky action.']),
    };
  }

  if (unsupportedMatch) {
    return {
      outcome: 'degraded',
      caveats: uniqueStrings([...caveats, unsupportedMatch.summary]),
      nextActions: uniqueStrings([...nextActions, 'Treat this activation as policy-gated until command granularity is verified.']),
    };
  }

  return { outcome: 'approved', caveats, nextActions };
}

export function evaluateActivationPolicy({
  capability = {},
  actionType = 'select',
  command = null,
  allowMutating = false,
  allowExternal = false,
  allowBrowser = false,
  explicitUserIntent = false,
  taskRelevant = false,
} = {}) {
  const classification = classifyCapabilityPolicy(capability, { actionType, command });
  let caveats = [...asList(capability.caveats)];
  let nextActions = [...asList(capability.nextActions)];

  const base = {
    schema: ACTIVATION_POLICY_SCHEMA,
    capabilityId: capability.id ?? null,
    actionType,
    sideEffectLevel: classification.sideEffectLevel,
    locality: classification.locality,
    policyRefs: classification.policyRefs,
    validationSurface: capability.surface ?? capability.validationSurface ?? 'runtime_tooling',
  };

  if (classification.sideEffectLevel === 'metadata_only' || capability.loadability === 'non_loadable') {
    return {
      ...base,
      outcome: 'unavailable',
      reason: 'metadata-only capabilities are discoverable but not loadable or executable',
      caveats,
      nextActions,
    };
  }

  if (capability.state === 'unavailable' || capability.state === 'not_configured') {
    return {
      ...base,
      outcome: 'unavailable',
      reason: `capability state is ${capability.state}`,
      caveats,
      nextActions,
    };
  }

  const mcpReadiness = evaluateMcpReadiness(capability);
  if (mcpReadiness.applies && mcpReadiness.outcome === 'unavailable') {
    return { ...base, outcome: 'unavailable', reason: mcpReadiness.reason, caveats: mcpReadiness.caveats, nextActions: mcpReadiness.nextActions };
  }
  if (mcpReadiness.applies && mcpReadiness.outcome === 'degraded') {
    caveats = uniqueStrings([...caveats, ...mcpReadiness.caveats]);
    nextActions = uniqueStrings([...nextActions, ...mcpReadiness.nextActions]);
  }

  if (classification.isBrowser && (allowBrowser !== true || taskRelevant !== true)) {
    return {
      ...base,
      outcome: 'blocked',
      reason: 'browser capability requires explicit browser allowance and task relevance',
      caveats,
      nextActions: uniqueStrings([...nextActions, 'Set allowBrowser only when browser evidence is task-relevant and ready.']),
    };
  }

  if (classification.isExternal && (allowExternal !== true || taskRelevant !== true)) {
    return {
      ...base,
      outcome: 'blocked',
      reason: 'external/provider capability requires explicit external allowance and task relevance',
      caveats,
      nextActions: uniqueStrings([...nextActions, 'Set allowExternal only when provider access is task-relevant and configured.']),
    };
  }

  if (classification.isMutating && allowMutating !== true) {
    return {
      ...base,
      outcome: 'needs_confirmation',
      reason: 'mutating capability requires an explicit policy allowance before activation',
      caveats,
      nextActions: uniqueStrings([...nextActions, 'Use non-mutating alternatives or request the appropriate policy-gated action.']),
    };
  }

  const permissionOutcome = evaluatePermissionPolicy({ classification, explicitUserIntent, caveats, nextActions });
  caveats = permissionOutcome.caveats;
  nextActions = permissionOutcome.nextActions;

  if (permissionOutcome.outcome === 'blocked' || permissionOutcome.outcome === 'degraded') {
    return {
      ...base,
      outcome: permissionOutcome.outcome,
      reason: permissionOutcome.outcome === 'blocked'
        ? 'dangerous capability is blocked without explicit user intent and safety checks'
        : 'command permission policy support is degraded for this capability',
      caveats,
      nextActions,
    };
  }

  if (mcpReadiness.applies && mcpReadiness.outcome === 'degraded') {
    return {
      ...base,
      outcome: 'degraded',
      reason: mcpReadiness.reason,
      caveats,
      nextActions,
    };
  }

  return {
    ...base,
    outcome: caveats.length > asList(capability.caveats).length ? 'degraded' : 'approved',
    reason: 'activation gate approved; this policy check did not execute the capability',
    caveats,
    nextActions,
  };
}
