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

export function normalizeValidationSurface(value, fallback = 'runtime_tooling') {
  return VALIDATION_SURFACES.includes(value) ? value : fallback;
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.length > 0) : [];
}

export function buildCapabilityStatusEnvelope({
  id,
  label = id,
  family,
  surface = 'runtime_tooling',
  state = 'degraded',
  source = 'runtime',
  freshness = 'fresh',
  evidenceRefs = [],
  caveats = [],
  nextActions = [],
} = {}) {
  return {
    id,
    label,
    family,
    surface: normalizeValidationSurface(surface),
    state: normalizeCapabilityState(state),
    source,
    freshness,
    evidenceRefs: normalizeList(evidenceRefs),
    caveats: normalizeList(caveats),
    nextActions: normalizeList(nextActions),
  };
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
