export const STANDARD_CAPABILITY_STATES = [
  'available',
  'unavailable',
  'degraded',
  'preview',
  'compatibility_only',
  'not_configured',
];

export const VALIDATION_SURFACES = [
  'global_cli',
  'in_session',
  'compatibility_runtime',
  'runtime_tooling',
  'documentation',
  'package',
  'target_project_app',
];

export const MCP_SCOPE_VALUES = ['openkit', 'global', 'both'];
export const MATERIALIZED_MCP_SCOPES = ['openkit', 'global'];

export function isStandardCapabilityState(value) {
  return STANDARD_CAPABILITY_STATES.includes(value);
}

export function normalizeCapabilityState(value, fallback = 'degraded') {
  return isStandardCapabilityState(value) ? value : fallback;
}

export function isSupportedMcpScope(value) {
  return MCP_SCOPE_VALUES.includes(value);
}

export function expandMcpScope(scope = 'openkit') {
  if (!isSupportedMcpScope(scope)) {
    throw new Error(`Invalid scope '${scope}'. Expected one of: openkit, global, both.`);
  }

  return scope === 'both' ? [...MATERIALIZED_MCP_SCOPES] : [scope];
}
