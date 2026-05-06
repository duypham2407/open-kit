import { CAPABILITY_GRAPH_FAMILIES, CAPABILITY_FRESHNESS_STATES } from './capability-graph.js';
import { STANDARD_CAPABILITY_STATES } from './status.js';
import { sanitizeCapabilityDecision } from './capability-decision-ledger.js';

export const CAPABILITY_READ_MODEL_SCHEMA = 'openkit/capability-read-model@1';

const DEFAULT_NEXT_ACTION_LIMIT = 8;
const POLICY_GATED_SIDE_EFFECTS = new Set([
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

function emptyCounts(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function increment(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function boundedUnique(values = [], limit = DEFAULT_NEXT_ACTION_LIMIT) {
  return [...new Set(values.filter((entry) => typeof entry === 'string' && entry.length > 0))].slice(0, limit);
}

function classifyReadiness(nodes, predicate) {
  const matched = nodes.filter(predicate);
  const states = emptyCounts(STANDARD_CAPABILITY_STATES);
  for (const node of matched) {
    increment(states, node.state);
  }
  return { total: matched.length, states };
}

function targetProjectValidation(nodes) {
  const probes = nodes.filter((node) => node.surface === 'target_project_app' || node.family === 'target_project_validation_probe');
  const available = probes.filter((node) => node.state === 'available').length;
  const unavailable = probes.length - available;
  return {
    surface: 'target_project_app',
    total: probes.length,
    available,
    unavailable,
    state: available > 0 ? 'available' : 'unavailable',
    caveats: available > 0
      ? ['Target-project validation availability requires app-native command execution evidence.']
      : ['No app-native target-project validation command is configured or proven available.'],
  };
}

export function buildCapabilityReadModel({ graph, ledgerEntries = [], generatedAt = new Date().toISOString(), maxNextActions = DEFAULT_NEXT_ACTION_LIMIT } = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const statusDistribution = emptyCounts(STANDARD_CAPABILITY_STATES);
  const familyCounts = emptyCounts(CAPABILITY_GRAPH_FAMILIES);
  const freshness = emptyCounts(CAPABILITY_FRESHNESS_STATES);
  const ownership = { bundled: 0, custom: 0, metadataOnly: 0, runtime: 0, targetProject: 0, other: 0 };
  const nextActions = [];
  let policyGatedCount = 0;
  let metadataOnlySkills = 0;
  let unavailableSkills = 0;

  for (const node of nodes) {
    increment(statusDistribution, node.state);
    increment(familyCounts, node.family);
    increment(freshness, node.freshness?.state ?? 'unknown');
    if (POLICY_GATED_SIDE_EFFECTS.has(node.sideEffectLevel) || node.family === 'policy_gated' || node.lifecycle === 'policy_gated') {
      policyGatedCount += 1;
    }
    if (node.family === 'metadata_only_skill') {
      metadataOnlySkills += 1;
    }
    if ((node.family === 'skill' || node.family === 'metadata_only_skill') && node.state !== 'available') {
      unavailableSkills += 1;
    }
    if (node.family === 'custom_mcp') {
      ownership.custom += 1;
    } else if (node.family === 'bundled_mcp' || node.ownership === 'openkit-bundled') {
      ownership.bundled += 1;
    } else if (node.family === 'metadata_only_skill' || node.ownership === 'metadata-only') {
      ownership.metadataOnly += 1;
    } else if (node.family === 'runtime_tool') {
      ownership.runtime += 1;
    } else if (node.family === 'target_project_validation_probe') {
      ownership.targetProject += 1;
    } else {
      ownership.other += 1;
    }
    nextActions.push(...(node.nextActions ?? []));
  }

  const ledgerCounts = { total: ledgerEntries.length, byAction: {}, byOutcome: {} };
  for (const entry of ledgerEntries) {
    increment(ledgerCounts.byAction, entry.actionType ?? 'unknown');
    increment(ledgerCounts.byOutcome, entry.outcome ?? 'unknown');
  }

  return sanitizeCapabilityDecision({
    schema: CAPABILITY_READ_MODEL_SCHEMA,
    status: 'ok',
    validationSurface: 'runtime_tooling',
    generatedAt,
    freshnessLabel: freshness.fresh > 0 ? 'fresh' : (freshness.cached > 0 || freshness.startup_snapshot > 0 ? 'cached' : (freshness.stale > 0 ? 'stale' : 'unknown')),
    graph: {
      total: nodes.length,
      statusDistribution,
      familyCounts,
      policyGatedCount,
      metadataOnlySkills,
      unavailableSkills,
      freshness,
    },
    readiness: {
      external: classifyReadiness(nodes, (node) => node.locality === 'external' || node.sideEffectLevel?.startsWith('external_') || node.family === 'external'),
      browser: classifyReadiness(nodes, (node) => node.locality === 'browser' || node.sideEffectLevel?.startsWith('browser_') || node.family === 'browser'),
      targetProjectValidation: targetProjectValidation(nodes),
    },
    ownership,
    ledger: ledgerCounts,
    nextActions: boundedUnique([
      ...nextActions,
      'Use tool.capability-router with rank=true for bounded resolver detail.',
      'Use explicit MCP doctor/health tools before relying on external or browser capabilities.',
    ], maxNextActions),
  });
}
