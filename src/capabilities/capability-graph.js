import { listMcpCatalogEntries } from './mcp-catalog.js';
import { listBundledSkills } from './skill-catalog.js';
import {
  STANDARD_CAPABILITY_STATES,
  VALIDATION_SURFACES,
  normalizeCapabilityState,
  normalizeValidationSurface,
} from './status.js';

export const CAPABILITY_GRAPH_SCHEMA = 'openkit/capability-graph@1';
export const CAPABILITY_GRAPH_NODE_SCHEMA = 'openkit/capability-graph-node@1';

export const CAPABILITY_GRAPH_FAMILIES = [
  'runtime_tool',
  'bundled_mcp',
  'custom_mcp',
  'skill',
  'metadata_only_skill',
  'browser',
  'external',
  'policy_gated',
  'target_project_validation_probe',
];

export const CAPABILITY_LOADABILITY_VALUES = ['loadable', 'non_loadable', 'not_applicable', 'unknown'];

export const CAPABILITY_SIDE_EFFECT_LEVELS = [
  'metadata_only',
  'read_only',
  'diagnostic',
  'local_mutating',
  'workflow_mutating',
  'browser_read',
  'browser_mutating',
  'external_read',
  'external_mutating',
  'git_mutating',
  'package_mutating',
  'deploy_release',
  'database_mutating',
  'system_privileged',
  'destructive',
];

export const CAPABILITY_LOCALITY_VALUES = ['local', 'external', 'browser', 'mixed', 'unknown'];
export const CAPABILITY_FRESHNESS_STATES = ['fresh', 'startup_snapshot', 'cached', 'stale', 'unknown'];

const DEFAULT_TARGET_PROJECT_VALIDATION_PROBES = [
  {
    id: 'target_project.validation.typecheck',
    label: 'Target Project Typecheck Probe',
    toolId: 'tool.typecheck',
    domainSignals: ['typecheck', 'typescript', 'target-project-validation'],
    nextActions: ['Run tool.typecheck only when the target project declares tsconfig.json or equivalent app-native typecheck configuration.'],
  },
  {
    id: 'target_project.validation.lint',
    label: 'Target Project Lint Probe',
    toolId: 'tool.lint',
    domainSignals: ['lint', 'eslint', 'biome', 'target-project-validation'],
    nextActions: ['Run tool.lint only when the target project declares a supported app-native linter configuration.'],
  },
  {
    id: 'target_project.validation.test-run',
    label: 'Target Project Test Probe',
    toolId: 'tool.test-run',
    domainSignals: ['test', 'unit-test', 'target-project-validation'],
    nextActions: ['Run tool.test-run only when the target project declares app-native test tooling.'],
  },
];

function clone(value) {
  return structuredClone(value);
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.length > 0) : [];
}

function uniqueStrings(values = []) {
  return [...new Set(normalizeList(values))];
}

function normalizeRelationship(relationship) {
  if (!relationship || typeof relationship !== 'object') {
    return null;
  }
  const targetId = typeof relationship.targetId === 'string' && relationship.targetId.length > 0
    ? relationship.targetId
    : null;
  if (!targetId) {
    return null;
  }
  return {
    type: typeof relationship.type === 'string' && relationship.type.length > 0 ? relationship.type : 'related',
    targetId,
    relationship: typeof relationship.relationship === 'string' && relationship.relationship.length > 0
      ? relationship.relationship
      : 'related',
    reason: typeof relationship.reason === 'string' && relationship.reason.length > 0 ? relationship.reason : null,
  };
}

function normalizeRelationships(relationships = []) {
  return Array.isArray(relationships)
    ? relationships.map(normalizeRelationship).filter(Boolean)
    : [];
}

function normalizeFreshness(value, fallbackSource = 'catalog') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const state = CAPABILITY_FRESHNESS_STATES.includes(value.state) ? value.state : 'unknown';
    return {
      state,
      source: typeof value.source === 'string' && value.source.length > 0 ? value.source : fallbackSource,
      checkedAt: typeof value.checkedAt === 'string' && value.checkedAt.length > 0 ? value.checkedAt : null,
    };
  }

  const state = CAPABILITY_FRESHNESS_STATES.includes(value) ? value : 'cached';
  return { state, source: fallbackSource, checkedAt: null };
}

function ensureValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function textSignals(...values) {
  return uniqueStrings(values
    .flat()
    .filter((value) => value !== null && value !== undefined)
    .flatMap((value) => String(value).split(/[^A-Za-z0-9_-]+/))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 1));
}

function relationshipToMcp(ref) {
  if (!ref?.id) {
    return null;
  }
  return normalizeRelationship({
    type: 'recommended_mcp',
    targetId: `mcp.${ref.id}`,
    relationship: ref.relationship ?? 'supporting',
    reason: ref.reason ?? null,
  });
}

function relationshipToSkill(skillRef) {
  if (typeof skillRef !== 'string' || skillRef.length === 0) {
    return null;
  }
  return normalizeRelationship({
    type: 'supports_skill',
    targetId: skillRef,
    relationship: 'supports',
    reason: 'Catalog metadata links this MCP to the skill.',
  });
}

function mcpLocality(entry) {
  if (entry.definition?.type === 'remote') {
    return 'external';
  }
  if (entry.category === 'browser') {
    return 'browser';
  }
  if ((entry.secretBindings ?? []).length > 0 || ['research', 'code-search'].includes(entry.category)) {
    return 'external';
  }
  return 'local';
}

function mcpSideEffectLevel(entry) {
  if (entry.category === 'source-control' || entry.lifecycle === 'policy_gated') {
    return 'git_mutating';
  }
  if (entry.category === 'browser') {
    return entry.id === 'playwright' ? 'browser_mutating' : 'browser_read';
  }
  if ((entry.secretBindings ?? []).length > 0 || ['research', 'code-search'].includes(entry.category)) {
    return 'external_read';
  }
  if (entry.id === 'openkit') {
    return 'workflow_mutating';
  }
  return 'diagnostic';
}

function mcpCaveats(entry) {
  return uniqueStrings([
    ...(entry.docs?.limitations ?? []),
    ...(entry.lifecycle === 'preview' ? ['preview lifecycle; behavior may be partial'] : []),
    ...(entry.lifecycle === 'policy_gated' ? ['policy-gated lifecycle; inspect setup policy before use'] : []),
    ...((entry.secretBindings ?? []).length > 0 ? ['requires redacted secret/key readiness before execution'] : []),
    ...(entry.defaultEnabled?.openkit === false ? ['not enabled by default in the OpenKit scope'] : []),
    ...(entry.defaultEnabled?.global === false ? ['not enabled by default in the global scope'] : []),
    ...(entry.id === 'openkit' ? ['OpenKit MCP includes read-only and mutating tools; individual tool policy governs execution.'] : []),
  ]);
}

function mcpNextActions(entry) {
  if (entry.status === 'available') {
    return ['Use explicit MCP doctor/test before relying on current session readiness.'];
  }
  if ((entry.secretBindings ?? []).length > 0) {
    return [`Run openkit configure mcp set-key ${entry.id} --stdin before execution.`];
  }
  if ((entry.dependencyChecks ?? []).length > 0) {
    return ['Run openkit configure mcp doctor or tool.mcp-doctor for dependency readiness.'];
  }
  return [entry.docs?.setup ?? 'docs/operator/mcp-configuration.md'];
}

function skillLoadability(entry) {
  if (
    entry.packaging?.source === 'metadata_only'
    || entry.source?.kind === 'stub'
    || entry.support_level === 'stub'
    || entry.sourceExists === false
    || entry.capabilityState === 'unavailable'
  ) {
    return 'non_loadable';
  }
  return 'loadable';
}

function skillFamily(entry) {
  return skillLoadability(entry) === 'non_loadable' ? 'metadata_only_skill' : 'skill';
}

function skillCaveats(entry, loadability) {
  return uniqueStrings([
    ...(entry.limitations ?? []),
    ...(loadability === 'non_loadable' ? ['skill is discoverable as metadata but cannot be loaded until a bundled skill body exists'] : []),
    ...(entry.status === 'preview' ? ['preview skill maturity; load only when explicitly suitable'] : []),
    ...(entry.status === 'experimental' ? ['experimental skill maturity; load only when explicitly allowed'] : []),
  ]);
}

function runtimeSideEffectLevel(capability) {
  const id = String(capability.id ?? '');
  if (/codemod|safer-edit/i.test(id)) {
    return 'local_mutating';
  }
  if (/background|continuation|workflow|evidence/i.test(id)) {
    return 'workflow_mutating';
  }
  if (/browser/i.test(id)) {
    return 'browser_read';
  }
  if (/rule|audit|syntax|ast|lsp|graph|session|diagnostic/i.test(id)) {
    return 'diagnostic';
  }
  return 'read_only';
}

function runtimeCaveats(capability) {
  return uniqueStrings([
    ...(capability.caveats ?? []),
    ...(runtimeSideEffectLevel(capability).endsWith('_mutating') ? ['execution remains governed by the existing tool and workflow policy gates'] : []),
  ]);
}

function buildGraphNode({
  id,
  label = id,
  family,
  ownership,
  surface = 'runtime_tooling',
  state = 'degraded',
  status = null,
  source = 'catalog',
  category = null,
  maturity = null,
  supportLevel = null,
  lifecycle = null,
  loadability = 'not_applicable',
  sideEffectLevel = 'read_only',
  locality = 'local',
  domainSignals = [],
  roles = [],
  stages = [],
  freshness = 'cached',
  caveats = [],
  nextActions = [],
  relationships = [],
  evidenceRefs = [],
  metadata = {},
} = {}) {
  return {
    schema: CAPABILITY_GRAPH_NODE_SCHEMA,
    id,
    label,
    family: ensureValue(family, CAPABILITY_GRAPH_FAMILIES, 'runtime_tool'),
    ownership: typeof ownership === 'string' && ownership.length > 0 ? ownership : 'openkit-runtime',
    surface: normalizeValidationSurface(surface),
    state: normalizeCapabilityState(state),
    status,
    source,
    category,
    maturity,
    supportLevel,
    lifecycle,
    loadability: ensureValue(loadability, CAPABILITY_LOADABILITY_VALUES, 'unknown'),
    sideEffectLevel: ensureValue(sideEffectLevel, CAPABILITY_SIDE_EFFECT_LEVELS, 'read_only'),
    locality: ensureValue(locality, CAPABILITY_LOCALITY_VALUES, 'unknown'),
    domainSignals: uniqueStrings(domainSignals),
    roles: uniqueStrings(roles),
    stages: uniqueStrings(stages),
    freshness: normalizeFreshness(freshness, source),
    caveats: uniqueStrings(caveats),
    nextActions: uniqueStrings(nextActions),
    relationships: normalizeRelationships(relationships),
    evidenceRefs: uniqueStrings(evidenceRefs),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? clone(metadata) : {},
  };
}

export function normalizeBundledMcpToGraphNode(entry) {
  const sideEffectLevel = mcpSideEffectLevel(entry);
  const keyState = entry.keyState
    ?? Object.fromEntries((entry.secretBindings ?? []).map((binding) => [binding.envVar, 'not_configured']));
  return buildGraphNode({
    id: `mcp.${entry.id}`,
    label: entry.displayName ?? entry.id,
    family: 'bundled_mcp',
    ownership: 'openkit-bundled',
    surface: 'runtime_tooling',
    state: entry.capabilityState ?? entry.status,
    status: entry.capabilityState ?? entry.status,
    source: entry.source ?? 'bundled_mcp_catalog',
    category: entry.category ?? null,
    lifecycle: entry.lifecycle ?? null,
    loadability: 'not_applicable',
    sideEffectLevel,
    locality: mcpLocality(entry),
    domainSignals: textSignals(entry.id, entry.category, entry.lifecycle, entry.description, entry.skillRefs),
    freshness: { state: 'cached', source: 'mcp_catalog', checkedAt: null },
    caveats: mcpCaveats(entry),
    nextActions: mcpNextActions(entry),
    relationships: (entry.skillRefs ?? []).map(relationshipToSkill).filter(Boolean),
    evidenceRefs: ['src/capabilities/mcp-catalog.js', entry.docs?.setup].filter(Boolean),
    metadata: {
      mcpId: entry.id,
      transport: entry.transport,
      enabled: entry.enabled ?? entry.defaultEnabled?.openkit === true,
      optional: entry.optional === true,
      defaultEnabled: entry.defaultEnabled ?? {},
      policy: entry.policy ?? {},
      dependencies: entry.dependencies ?? (entry.dependencyChecks ?? []).map((check) => ({ id: check.id, kind: check.kind, required: check.required === true, status: 'unknown' })),
      secretEnvVars: (entry.secretBindings ?? []).map((binding) => binding.envVar),
      keyState,
      dependencyChecks: (entry.dependencyChecks ?? []).map((check) => ({ id: check.id, kind: check.kind, required: check.required === true })),
    },
  });
}

export function normalizeCustomMcpToGraphNode(entry) {
  const family = entry.family === 'custom_mcp' || entry.kind === 'custom' ? 'custom_mcp' : 'bundled_mcp';
  const sideEffectLevel = entry.definition?.type === 'remote'
    ? 'external_read'
    : ((entry.riskWarnings ?? []).some((warning) => /write|mutat|delete|run code|command/i.test(warning)) ? 'local_mutating' : 'diagnostic');
  return buildGraphNode({
    id: `mcp.${entry.mcpId ?? entry.id}`,
    label: entry.displayName ?? entry.label ?? entry.id,
    family,
    ownership: entry.ownership ?? 'custom',
    surface: entry.validationSurface ?? entry.surface ?? 'runtime_tooling',
    state: entry.capabilityState ?? entry.state ?? 'degraded',
    status: entry.capabilityState ?? entry.status ?? null,
    source: entry.source ?? 'mcp_health',
    category: entry.category ?? null,
    lifecycle: entry.lifecycle ?? 'custom',
    loadability: 'not_applicable',
    sideEffectLevel,
    locality: entry.definition?.type === 'remote' ? 'external' : 'local',
    domainSignals: textSignals(entry.id, entry.mcpId, entry.displayName, entry.origin, entry.ownership, entry.riskWarnings),
    freshness: entry.capabilityEnvelope?.freshness ?? entry.freshness ?? { state: 'fresh', source: 'mcp_health', checkedAt: null },
    caveats: uniqueStrings([...(entry.caveats ?? []), ...(entry.riskWarnings ?? [])]),
    nextActions: entry.nextActions ?? [],
    evidenceRefs: ['src/global/mcp/health-checks.js'],
    metadata: {
      mcpId: entry.mcpId ?? entry.id,
      kind: entry.kind ?? 'custom',
      origin: entry.origin ?? null,
      enabled: entry.enabled === true,
      scope: entry.scope ?? null,
      keyState: entry.keyState ?? {},
      dependencyStates: entry.dependencies ?? [],
    },
  });
}

export function normalizeSkillToGraphNode(entry) {
  const loadability = skillLoadability(entry);
  return buildGraphNode({
    id: entry.id,
    label: entry.displayName ?? entry.name,
    family: skillFamily(entry),
    ownership: entry.packaging?.source === 'metadata_only' ? 'metadata-only' : 'openkit-bundled',
    surface: entry.validationSurface ?? 'runtime_tooling',
    state: entry.capabilityState,
    status: entry.status,
    source: entry.packaging?.source ?? 'repo',
    category: entry.category ?? entry.tags?.[0] ?? null,
    maturity: entry.status,
    supportLevel: entry.support_level ?? null,
    lifecycle: entry.lifecycle ?? entry.status,
    loadability,
    sideEffectLevel: loadability === 'non_loadable' ? 'metadata_only' : 'read_only',
    locality: 'local',
    domainSignals: textSignals(entry.name, entry.description, entry.tags, (entry.triggers ?? []).map((trigger) => trigger.value)),
    roles: entry.roles ?? [],
    stages: entry.stages ?? [],
    freshness: { state: 'cached', source: 'skill_catalog', checkedAt: null },
    caveats: skillCaveats(entry, loadability),
    nextActions: loadability === 'loadable'
      ? ['Load this skill explicitly only when the active task, role, and stage make it eligible.']
      : ['Use fallback guidance or add a bundled skill body before attempting to load this skill.'],
    relationships: (entry.recommended_mcps ?? []).map(relationshipToMcp).filter(Boolean),
    evidenceRefs: ['src/capabilities/skill-catalog.js', entry.docs?.source].filter(Boolean),
    metadata: {
      skillName: entry.name,
      path: entry.path,
      packaging: entry.packaging ?? {},
      bundled: entry.bundled === true,
      sourceExists: entry.sourceExists === true,
      bundleExists: entry.bundleExists === true,
      recommendedMcps: entry.recommended_mcps ?? [],
      triggers: entry.triggers ?? [],
    },
  });
}

export function normalizeRuntimeCapabilityToGraphNode(capability) {
  const sideEffectLevel = runtimeSideEffectLevel(capability);
  return buildGraphNode({
    id: capability.id,
    label: capability.name ?? capability.displayName ?? capability.id,
    family: 'runtime_tool',
    ownership: 'openkit-runtime',
    surface: capability.validationSurface ?? 'runtime_tooling',
    state: capability.capabilityState ?? capability.state,
    status: capability.status ?? null,
    source: 'runtime_capability_registry',
    category: capability.category ?? null,
    lifecycle: capability.lifecycle ?? capability.status ?? null,
    loadability: 'not_applicable',
    sideEffectLevel,
    locality: sideEffectLevel.startsWith('external') ? 'external' : (sideEffectLevel.startsWith('browser') ? 'browser' : 'local'),
    domainSignals: textSignals(capability.id, capability.category, capability.description),
    freshness: { state: 'cached', source: 'runtime_capability_registry', checkedAt: null },
    caveats: runtimeCaveats(capability),
    nextActions: ['Use the specific runtime tool only through its governed tool surface; this graph node is metadata, not execution.'],
    evidenceRefs: ['src/runtime/capability-registry.js'],
    metadata: {
      enabled: capability.enabled === true,
      enabledByDefault: capability.enabledByDefault !== false,
      featureFlag: capability.featureFlag ?? null,
      description: capability.description ?? null,
    },
  });
}

export function normalizeTargetProjectValidationProbeToGraphNode(probe) {
  return buildGraphNode({
    id: probe.id,
    label: probe.label,
    family: 'target_project_validation_probe',
    ownership: 'target-project',
    surface: 'target_project_app',
    state: probe.state ?? 'not_configured',
    status: probe.status ?? 'metadata_probe',
    source: 'runtime_tool_registry',
    category: 'target_project_validation',
    loadability: 'not_applicable',
    sideEffectLevel: 'diagnostic',
    locality: 'local',
    domainSignals: probe.domainSignals ?? [],
    freshness: { state: 'unknown', source: 'project_probe_required', checkedAt: null },
    caveats: [
      'metadata registration is not target-project validation evidence',
      'availability depends on app-native project configuration and tool execution',
      ...(probe.caveats ?? []),
    ],
    nextActions: probe.nextActions ?? [],
    evidenceRefs: ['src/runtime/tools/external/typecheck.js', 'src/runtime/tools/external/lint.js', 'src/runtime/tools/external/test-run.js'],
    metadata: { toolId: probe.toolId ?? null },
  });
}

function dedupeNodes(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    if (!node?.id || byId.has(node.id)) {
      continue;
    }
    byId.set(node.id, node);
  }
  return [...byId.values()];
}

function summarizeGraph(nodes) {
  const summary = {
    total: nodes.length,
    families: Object.fromEntries(CAPABILITY_GRAPH_FAMILIES.map((family) => [family, 0])),
    states: Object.fromEntries(STANDARD_CAPABILITY_STATES.map((state) => [state, 0])),
    surfaces: Object.fromEntries(VALIDATION_SURFACES.map((surface) => [surface, 0])),
    loadability: Object.fromEntries(CAPABILITY_LOADABILITY_VALUES.map((value) => [value, 0])),
  };

  for (const node of nodes) {
    summary.families[node.family] = (summary.families[node.family] ?? 0) + 1;
    summary.states[node.state] = (summary.states[node.state] ?? 0) + 1;
    summary.surfaces[node.surface] = (summary.surfaces[node.surface] ?? 0) + 1;
    summary.loadability[node.loadability] = (summary.loadability[node.loadability] ?? 0) + 1;
  }

  return summary;
}

export function buildCapabilityGraph({
  bundledMcps = listMcpCatalogEntries(),
  customMcps = [],
  skills = listBundledSkills(),
  runtimeCapabilities = [],
  targetProjectValidationProbes = DEFAULT_TARGET_PROJECT_VALIDATION_PROBES,
} = {}) {
  const nodes = dedupeNodes([
    ...bundledMcps.map(normalizeBundledMcpToGraphNode),
    ...customMcps.map(normalizeCustomMcpToGraphNode),
    ...skills.map(normalizeSkillToGraphNode),
    ...runtimeCapabilities
      .filter((capability) => String(capability.id ?? '').startsWith('capability.'))
      .map(normalizeRuntimeCapabilityToGraphNode),
    ...targetProjectValidationProbes.map(normalizeTargetProjectValidationProbeToGraphNode),
  ]);
  const relationships = nodes.flatMap((node) => node.relationships.map((relationship) => ({
    sourceId: node.id,
    ...relationship,
  })));

  return {
    schema: CAPABILITY_GRAPH_SCHEMA,
    version: 1,
    validationSurface: 'runtime_tooling',
    freshness: { state: 'cached', source: 'metadata_normalization', checkedAt: null },
    nodes,
    relationships,
    summary: summarizeGraph(nodes),
  };
}

export function validateCapabilityGraphNode(node) {
  const errors = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { valid: false, errors: ['node must be an object'] };
  }
  if (node.schema !== CAPABILITY_GRAPH_NODE_SCHEMA) {
    errors.push(`schema must be ${CAPABILITY_GRAPH_NODE_SCHEMA}`);
  }
  for (const field of ['id', 'label', 'family', 'ownership', 'surface', 'state', 'loadability', 'sideEffectLevel', 'locality']) {
    if (typeof node[field] !== 'string' || node[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (!CAPABILITY_GRAPH_FAMILIES.includes(node.family)) {
    errors.push(`family '${node.family}' is unsupported`);
  }
  if (!STANDARD_CAPABILITY_STATES.includes(node.state)) {
    errors.push(`state '${node.state}' is unsupported`);
  }
  if (!VALIDATION_SURFACES.includes(node.surface)) {
    errors.push(`surface '${node.surface}' is unsupported`);
  }
  if (!CAPABILITY_LOADABILITY_VALUES.includes(node.loadability)) {
    errors.push(`loadability '${node.loadability}' is unsupported`);
  }
  if (!CAPABILITY_SIDE_EFFECT_LEVELS.includes(node.sideEffectLevel)) {
    errors.push(`sideEffectLevel '${node.sideEffectLevel}' is unsupported`);
  }
  if (!CAPABILITY_LOCALITY_VALUES.includes(node.locality)) {
    errors.push(`locality '${node.locality}' is unsupported`);
  }
  if (!node.freshness || !CAPABILITY_FRESHNESS_STATES.includes(node.freshness.state)) {
    errors.push('freshness.state must use the supported freshness vocabulary');
  }
  for (const field of ['domainSignals', 'roles', 'stages', 'caveats', 'nextActions', 'relationships', 'evidenceRefs']) {
    if (!Array.isArray(node[field])) {
      errors.push(`${field} must be an array`);
    }
  }
  if (node.family === 'metadata_only_skill' && node.loadability !== 'non_loadable') {
    errors.push('metadata-only skill nodes must be non_loadable');
  }
  return { valid: errors.length === 0, errors };
}

export function assertCapabilityGraphNode(node) {
  const validation = validateCapabilityGraphNode(node);
  if (!validation.valid) {
    throw new Error(`Invalid capability graph node '${node?.id ?? 'unknown'}': ${validation.errors.join('; ')}`);
  }
  return node;
}

export function validateCapabilityGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return { valid: false, errors: ['graph must be an object'] };
  }
  if (graph.schema !== CAPABILITY_GRAPH_SCHEMA) {
    errors.push(`schema must be ${CAPABILITY_GRAPH_SCHEMA}`);
  }
  if (!Array.isArray(graph.nodes)) {
    errors.push('nodes must be an array');
  } else {
    for (const node of graph.nodes) {
      const nodeValidation = validateCapabilityGraphNode(node);
      for (const error of nodeValidation.errors) {
        errors.push(`${node.id ?? 'unknown'}: ${error}`);
      }
    }
  }
  if (!Array.isArray(graph.relationships)) {
    errors.push('relationships must be an array');
  }
  return { valid: errors.length === 0, errors };
}

export function assertCapabilityGraph(graph) {
  const validation = validateCapabilityGraph(graph);
  if (!validation.valid) {
    throw new Error(`Invalid capability graph: ${validation.errors.join('; ')}`);
  }
  return graph;
}
