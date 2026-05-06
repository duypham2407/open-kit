import { buildCapabilityGraph } from '../../capabilities/capability-graph.js';
import { evaluateActivationPolicy } from '../../capabilities/activation-policy.js';
import { CapabilityDecisionLedger } from '../../capabilities/capability-decision-ledger.js';
import { buildCapabilityReadModel } from '../../capabilities/capability-read-model.js';
import { listBundledSkills } from '../../capabilities/skill-catalog.js';
import { buildCapabilityGuidance } from '../tools/capability/capability-router-summary.js';
import { listRuntimeCapabilities } from '../capability-registry.js';

const STATUS_WEIGHT = {
  stable: 30,
  preview: 10,
  experimental: 0,
};

const CAPABILITY_RESOLVER_SCHEMA = 'openkit/capability-resolver@1';
const DEFAULT_GROUP_LIMIT = 3;
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

const STATE_SCORE = {
  available: 40,
  preview: 18,
  degraded: 4,
  compatibility_only: 0,
  not_configured: -30,
  unavailable: -40,
};

const MATURITY_SCORE = {
  stable: 12,
  preview: 2,
  experimental: -8,
};

const SUPPORT_SCORE = {
  maintained: 8,
  best_effort: 2,
  compatibility_only: -4,
  stub: -30,
};

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function includesWildcard(values = [], expected) {
  return values.includes(expected) || values.includes('all');
}

function matchText(value, intent) {
  const normalizedIntent = normalize(intent);
  const normalizedValue = normalize(value);
  return normalizedIntent.length > 0 && normalizedValue.length > 0 && normalizedIntent.includes(normalizedValue);
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.length > 0);
  }
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function normalizeSkillId(skillName) {
  const value = String(skillName ?? '').trim();
  return value.startsWith('skill.') ? value : (value ? `skill.${value}` : '');
}

function normalizeMcpId(mcpId) {
  const value = String(mcpId ?? '').trim();
  return value.startsWith('mcp.') ? value : (value ? `mcp.${value}` : '');
}

function boundedLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GROUP_LIMIT;
  }
  return Math.max(1, Math.min(parsed, 10));
}

function hasGuardrailMatch(values = [], expected) {
  if (!expected || values.length === 0) {
    return null;
  }
  return includesWildcard(values, expected);
}

function isBrowserNode(node) {
  return node.locality === 'browser' || node.sideEffectLevel.startsWith('browser_') || node.family === 'browser';
}

function isExternalNode(node) {
  return node.locality === 'external' || node.sideEffectLevel.startsWith('external_') || node.family === 'external';
}

function isMutatingNode(node) {
  return MUTATING_SIDE_EFFECTS.has(node.sideEffectLevel);
}

function selectedPayload(node, score, reasons, caveats, activation) {
  return {
    capabilityId: node.id,
    family: node.family,
    score,
    reasons,
    caveats,
    nextActions: node.nextActions,
    activation,
    validationSurface: node.surface,
  };
}

function excludedPayload(node, reason, caveats = [], nextActions = []) {
  return {
    capabilityId: node.id,
    family: node.family,
    reason,
    caveats,
    nextActions,
    validationSurface: node.surface,
  };
}

function buildMcpContext(mcpRef, mcps) {
  const mcp = mcps.find((entry) => entry.mcpId === mcpRef.id);
  return {
    id: mcpRef.id,
    relationship: mcpRef.relationship,
    reason: mcpRef.reason,
    mcpKnown: Boolean(mcp),
    capabilityState: mcp?.capabilityState ?? 'unavailable',
    enabled: mcp?.enabled ?? false,
    guidance: mcp?.guidance ?? `MCP '${mcpRef.id}' is not configured in the current inventory.`,
  };
}

export class CapabilityRegistryManager {
  constructor({ mcpHealthManager, skillMcpManager, runtimeRoot = null, mode = 'read-write' } = {}) {
    this.mcpHealthManager = mcpHealthManager;
    this.skillMcpManager = skillMcpManager;
    this.decisionLedger = new CapabilityDecisionLedger({ runtimeRoot, mode });
  }

  listCapabilities({ scope = 'openkit', includeSkills = true, includeMcps = true } = {}) {
    const mcps = includeMcps ? this.mcpHealthManager.list({ scope }) : [];
    const skills = includeSkills ? listBundledSkills() : [];
    return { mcps, skills };
  }

  buildCapabilityGraph({ scope = 'openkit', config = undefined, targetProjectValidationProbes = undefined } = {}) {
    const { mcps, skills } = this.listCapabilities({ scope, includeSkills: true, includeMcps: true });
    const bundledMcps = mcps.filter((entry) => entry.kind !== 'custom' && entry.family !== 'custom_mcp');
    const customMcps = mcps.filter((entry) => entry.kind === 'custom' || entry.family === 'custom_mcp');
    return buildCapabilityGraph({
      bundledMcps,
      customMcps,
      skills,
      runtimeCapabilities: listRuntimeCapabilities({ config }),
      targetProjectValidationProbes,
    });
  }

  appendDecision(input = {}) {
    return this.decisionLedger.append(input);
  }

  listDecisions(input = {}) {
    return this.decisionLedger.list(input);
  }

  getDecision(id) {
    return this.decisionLedger.get(id);
  }

  buildReadModel({ scope = 'openkit', config = undefined, maxNextActions = undefined } = {}) {
    const graph = this.buildCapabilityGraph({ scope, config });
    const ledger = this.listDecisions({ limit: 200 });
    return buildCapabilityReadModel({ graph, ledgerEntries: ledger.entries, maxNextActions });
  }

  recordDecisionFromNode({ node = {}, actionType, outcome, reason, workflow = {}, policyGate = null, caveats = undefined } = {}) {
    return this.appendDecision({
      workflow,
      capability: node,
      actionType,
      outcome,
      reason,
      caveats: caveats ?? node.caveats ?? [],
      freshness: node.freshness ?? { state: 'unknown', source: 'read_model', checkedAt: null },
      policyGate,
      validationSurface: node.surface ?? 'runtime_tooling',
      evidenceRefs: node.evidenceRefs ?? [],
    });
  }

  summarizeGuidance({ scope = 'openkit', workflowState = null, source = 'explicit_runtime_tool', limits = undefined } = {}) {
    const capabilities = this.listCapabilities({ scope });
    return buildCapabilityGuidance({
      workflowState,
      capabilities,
      source,
      limits,
    });
  }

  rankCapabilities({
    scope = 'openkit',
    config = undefined,
    intent = '',
    mode = null,
    stage = null,
    role = null,
    status = null,
    tags = [],
    skillName = null,
    mcpId = null,
    includePreview = false,
    includeExperimental = false,
    allowExternal = false,
    allowBrowser = false,
    allowMutating = false,
    maxCandidates = DEFAULT_GROUP_LIMIT,
  } = {}) {
    const graph = this.buildCapabilityGraph({ scope, config });
    const limit = boundedLimit(maxCandidates);
    const requestedTags = asList(tags).map(normalize);
    const explicitSkillId = normalizeSkillId(skillName);
    const explicitMcpId = normalizeMcpId(mcpId);
    const normalizedIntent = normalize(intent);
    const selected = [];
    const downgraded = [];
    const blocked = [];
    const unavailable = [];
    const suppressed = [];

    for (const node of graph.nodes) {
      const reasons = [];
      const caveats = [...node.caveats];
      let score = 0;

      if (explicitSkillId || explicitMcpId) {
        const matchesExplicit = node.id === explicitSkillId || node.id === explicitMcpId;
        if (!matchesExplicit) {
          suppressed.push({ capabilityId: node.id, family: node.family, reason: 'not-explicitly-requested' });
          continue;
        }
        score += 120;
        reasons.push({ field: explicitSkillId ? 'skillName' : 'mcpId', value: explicitSkillId || explicitMcpId, weight: 120 });
      }

      if (node.state === 'unavailable' || node.loadability === 'non_loadable') {
        const reason = node.loadability === 'non_loadable'
          ? 'metadata-only capability is discoverable and rankable but never loadable'
          : 'capability is unavailable';
        unavailable.push(excludedPayload(node, reason, caveats, node.nextActions));
        continue;
      }

      if (node.state === 'not_configured') {
        unavailable.push(excludedPayload(node, 'capability is not configured for execution', caveats, node.nextActions));
        continue;
      }

      if (isBrowserNode(node) && allowBrowser !== true) {
        blocked.push({
          ...excludedPayload(node, 'browser capability withheld because browser access was not requested', caveats, ['Set allowBrowser only when browser evidence is task-relevant and configured.']),
          policyGate: 'allowBrowser',
        });
        continue;
      }

      if (isExternalNode(node) && allowExternal !== true) {
        blocked.push({
          ...excludedPayload(node, 'external capability withheld because external/provider access was not requested', caveats, ['Set allowExternal only when external lookup is task-relevant and configured.']),
          policyGate: 'allowExternal',
        });
        continue;
      }

      if (isMutatingNode(node) && allowMutating !== true) {
        blocked.push({
          ...excludedPayload(node, 'mutating capability withheld during ranking; selection requires an explicit policy gate', caveats, ['Use read-only or diagnostic alternatives, or request mutating capability selection explicitly.']),
          policyGate: 'allowMutating',
        });
        continue;
      }

      if (node.maturity === 'preview' && includePreview !== true) {
        downgraded.push(excludedPayload(node, 'preview capability suppressed unless includePreview is true', caveats, node.nextActions));
        continue;
      }

      if (node.maturity === 'experimental' && includeExperimental !== true) {
        downgraded.push(excludedPayload(node, 'experimental capability suppressed unless includeExperimental is true', caveats, node.nextActions));
        continue;
      }

      score += STATE_SCORE[node.state] ?? 0;
      if (STATE_SCORE[node.state]) {
        reasons.push({ field: 'state', value: node.state, weight: STATE_SCORE[node.state] });
      }

      score += MATURITY_SCORE[node.maturity] ?? 0;
      if (MATURITY_SCORE[node.maturity]) {
        reasons.push({ field: 'maturity', value: node.maturity, weight: MATURITY_SCORE[node.maturity] });
      }

      score += SUPPORT_SCORE[node.supportLevel] ?? 0;
      if (SUPPORT_SCORE[node.supportLevel]) {
        reasons.push({ field: 'supportLevel', value: node.supportLevel, weight: SUPPORT_SCORE[node.supportLevel] });
      }

      const roleMatch = hasGuardrailMatch(node.roles, role);
      if (roleMatch === true) {
        score += 10;
        reasons.push({ field: 'role', value: role, weight: 10 });
      } else if (roleMatch === false) {
        score -= 12;
        caveats.push(`role '${role}' is not listed for this capability`);
      }

      const stageMatch = hasGuardrailMatch(node.stages, stage);
      if (stageMatch === true) {
        score += 10;
        reasons.push({ field: 'stage', value: stage, weight: 10 });
      } else if (stageMatch === false) {
        score -= 12;
        caveats.push(`stage '${stage}' is not listed for this capability`);
      }

      if (mode && stage && normalize(stage).startsWith(`${normalize(mode)}_`)) {
        score += 4;
        reasons.push({ field: 'mode', value: mode, weight: 4 });
      }

      for (const tag of requestedTags) {
        if (node.domainSignals.map(normalize).includes(tag)) {
          score += 14;
          reasons.push({ field: 'tag', value: tag, weight: 14 });
        }
      }

      for (const signal of node.domainSignals) {
        if (normalizedIntent && normalizedIntent.includes(normalize(signal))) {
          score += 8;
          reasons.push({ field: 'domainSignal', value: signal, weight: 8 });
        }
      }

      if (node.locality === 'local') {
        score += 6;
        reasons.push({ field: 'locality', value: 'local', weight: 6 });
      }

      if (['read_only', 'diagnostic'].includes(node.sideEffectLevel)) {
        score += 6;
        reasons.push({ field: 'sideEffectLevel', value: node.sideEffectLevel, weight: 6 });
      }

      if (node.surface === 'runtime_tooling') {
        score += 4;
        reasons.push({ field: 'validationSurface', value: node.surface, weight: 4 });
      }

      if (!explicitSkillId && !explicitMcpId && requestedTags.length === 0 && normalizedIntent && reasons.every((reason) => !['domainSignal', 'tag'].includes(reason.field))) {
        suppressed.push({ capabilityId: node.id, family: node.family, reason: 'no-intent-or-tag-signal' });
        continue;
      }

      if (!explicitSkillId && !explicitMcpId && requestedTags.length > 0 && reasons.every((reason) => reason.field !== 'tag')) {
        suppressed.push({ capabilityId: node.id, family: node.family, reason: 'tag-filter-mismatch' });
        continue;
      }

      selected.push({ node, score, reasons, caveats });
    }

    selected.sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id));
    downgraded.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    blocked.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    unavailable.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    suppressed.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));

    const workflow = { mode, stage, role, status };
    const selectedPayloads = selected.slice(0, limit).map(({ node, score, reasons, caveats }) => {
      const activation = this.selectCapability({ node, mode, stage, role, allowMutating, allowExternal, allowBrowser, status, recordDecision: false });
      this.recordDecisionFromNode({
        node,
        actionType: 'rank',
        outcome: activation.eligible ? 'selected' : activation.outcome,
        reason: activation.reason,
        workflow,
        policyGate: activation.policyGate,
        caveats,
      });
      return selectedPayload(node, score, reasons, caveats, activation);
    });

    for (const entry of downgraded.slice(0, limit)) {
      this.recordDecisionFromNode({ node: graph.nodes.find((node) => node.id === entry.capabilityId), actionType: 'degrade', outcome: 'degraded', reason: entry.reason, workflow, caveats: entry.caveats });
    }
    for (const entry of blocked.slice(0, limit)) {
      this.recordDecisionFromNode({ node: graph.nodes.find((node) => node.id === entry.capabilityId), actionType: 'block', outcome: 'blocked', reason: entry.reason, workflow, policyGate: entry.policyGate, caveats: entry.caveats });
    }
    for (const entry of unavailable.slice(0, limit)) {
      this.recordDecisionFromNode({ node: graph.nodes.find((node) => node.id === entry.capabilityId), actionType: 'skip', outcome: 'skipped', reason: entry.reason, workflow, caveats: entry.caveats });
    }

    return {
      schema: CAPABILITY_RESOLVER_SCHEMA,
      status: selectedPayloads.length > 0 ? 'ok' : 'unavailable',
      validationSurface: 'runtime_tooling',
      workflow,
      selected: selectedPayloads,
      downgraded: downgraded.slice(0, limit),
      blocked: blocked.slice(0, limit),
      unavailable: unavailable.slice(0, limit),
      suppressed: suppressed.slice(0, limit),
      counts: {
        graphNodes: graph.nodes.length,
        selected: selected.length,
        downgraded: downgraded.length,
        blocked: blocked.length,
        unavailable: unavailable.length,
        suppressed: suppressed.length,
      },
      limits: { maxCandidates: limit },
      summary: selectedPayloads.length > 0
        ? 'Stable local read-only or diagnostic capabilities were preferred; blocked/unavailable groups require explicit next actions before activation.'
        : 'No graph-backed capability was eligible for the supplied resolver inputs without additional configuration or policy allowance.',
    };
  }

  selectCapability({ capabilityId = null, node = null, scope = 'openkit', config = undefined, mode = null, stage = null, role = null, status = null, allowMutating = false, allowExternal = false, allowBrowser = false, explicitUserIntent = false, taskRelevant = true, actionType = 'select', command = null, recordDecision = true } = {}) {
    const selectedNode = node ?? this.buildCapabilityGraph({ scope, config }).nodes.find((entry) => entry.id === capabilityId);
    if (!selectedNode) {
      const result = {
        eligible: false,
        requiredGate: null,
        policyGate: null,
        policy: null,
        outcome: 'unavailable',
        reason: 'capability is not present in the graph',
        caveats: [],
        nextActions: ['Inspect tool.capability-inventory or refresh capability metadata.'],
      };
      if (recordDecision) {
        this.appendDecision({ workflow: { mode, stage, role, status }, capability: { id: capabilityId, surface: 'runtime_tooling' }, actionType, outcome: 'failed', reason: result.reason, validationSurface: 'runtime_tooling' });
      }
      return result;
    }

    const caveats = [...selectedNode.caveats];
    if (selectedNode.loadability === 'non_loadable' || selectedNode.sideEffectLevel === 'metadata_only') {
      const result = {
        eligible: false,
        requiredGate: 'loadability',
        policyGate: 'loadability',
        policy: evaluateActivationPolicy({ capability: selectedNode, actionType, command, allowMutating, allowExternal, allowBrowser, explicitUserIntent, taskRelevant }),
        outcome: 'unavailable',
        reason: 'metadata-only capabilities are discoverable and rankable but never loadable',
        caveats,
        nextActions: selectedNode.nextActions,
      };
      if (recordDecision) {
        this.recordDecisionFromNode({ node: selectedNode, actionType, outcome: 'skipped', reason: result.reason, workflow: { mode, stage, role, status }, policyGate: result.policyGate, caveats: result.caveats });
      }
      return result;
    }

    if (selectedNode.state === 'unavailable' || selectedNode.state === 'not_configured') {
      const result = {
        eligible: false,
        requiredGate: 'readiness',
        policyGate: 'readiness',
        policy: evaluateActivationPolicy({ capability: selectedNode, actionType, command, allowMutating, allowExternal, allowBrowser, explicitUserIntent, taskRelevant }),
        outcome: 'unavailable',
        reason: `capability state is ${selectedNode.state}`,
        caveats,
        nextActions: selectedNode.nextActions,
      };
      if (recordDecision) {
        this.recordDecisionFromNode({ node: selectedNode, actionType, outcome: 'skipped', reason: result.reason, workflow: { mode, stage, role, status }, policyGate: result.policyGate, caveats: result.caveats });
      }
      return result;
    }

    if (role && selectedNode.roles.length > 0 && !hasGuardrailMatch(selectedNode.roles, role)) {
      caveats.push(`role '${role}' is outside this capability metadata guardrail`);
    }
    if (stage && selectedNode.stages.length > 0 && !hasGuardrailMatch(selectedNode.stages, stage)) {
      caveats.push(`stage '${stage}' is outside this capability metadata guardrail`);
    }
    if (mode && stage && !normalize(stage).startsWith(`${normalize(mode)}_`)) {
      caveats.push(`stage '${stage}' does not match mode '${mode}'`);
    }

    const policy = evaluateActivationPolicy({
      capability: { ...selectedNode, caveats },
      actionType,
      command,
      allowMutating,
      allowExternal,
      allowBrowser,
      explicitUserIntent,
      taskRelevant,
    });

    if (['blocked', 'needs_confirmation', 'unavailable'].includes(policy.outcome)) {
      const requiredGate = policy.outcome === 'needs_confirmation'
        ? 'confirmation'
        : isBrowserNode(selectedNode) ? 'allowBrowser'
          : isExternalNode(selectedNode) ? 'allowExternal'
            : isMutatingNode(selectedNode) ? 'allowMutating'
              : 'policy';
      const result = {
        eligible: false,
        requiredGate,
        policyGate: requiredGate,
        policy,
        outcome: policy.outcome,
        reason: policy.reason,
        caveats: policy.caveats,
        nextActions: policy.nextActions,
      };
      if (recordDecision) {
        this.recordDecisionFromNode({ node: selectedNode, actionType, outcome: policy.outcome === 'blocked' ? 'blocked' : 'degraded', reason: result.reason, workflow: { mode, stage, role, status }, policyGate: result.policyGate, caveats: result.caveats });
      }
      return result;
    }

    const result = {
      eligible: true,
      requiredGate: null,
      policyGate: null,
      policy,
      outcome: policy.outcome === 'degraded' ? 'degraded' : (caveats.length > selectedNode.caveats.length ? 'degraded' : 'approved'),
      reason: 'capability is eligible for explicit activation through its normal tool or skill path; selection does not activate it',
      caveats: policy.caveats,
      nextActions: policy.nextActions,
    };
    if (recordDecision) {
      this.recordDecisionFromNode({ node: selectedNode, actionType, outcome: result.outcome === 'degraded' ? 'degraded' : 'selected', reason: result.reason, workflow: { mode, stage, role, status }, policyGate: result.policyGate, caveats: result.caveats });
    }
    return result;
  }

  routeCapability({ scope = 'openkit', mcpId = null, skillName = null, intent = '', mode = null, role = null, stage = null, status = null, summary = false, tags = [], includePreview = false, includeExperimental = false, allowExternal = false, allowBrowser = false, allowMutating = false, maxCandidates = DEFAULT_GROUP_LIMIT, rank = false } = {}) {
    if (summary === true) {
      return this.summarizeGuidance({
        scope,
        workflowState: {
          mode,
          current_stage: stage,
          current_owner: role,
          status,
        },
        source: 'explicit_runtime_tool',
      });
    }

    const resolverResult = this.rankCapabilities({
      scope,
      intent,
      mode,
      stage,
      role,
      status,
      tags,
      skillName,
      mcpId,
      includePreview,
      includeExperimental,
      allowExternal,
      allowBrowser,
      allowMutating,
      maxCandidates,
    });

    if (rank === true) {
      return resolverResult;
    }

    const capabilities = this.listCapabilities({ scope });
    if (mcpId) {
      return { ...this.routeMcpCapability({ capabilities, scope, mcpId, intent }), resolver: resolverResult };
    }

    if (skillName || role || stage || (Array.isArray(tags) && tags.length > 0)) {
      return { ...this.routeSkillCapability({ capabilities, skillName, intent, role, stage, tags, includePreview, includeExperimental }), resolver: resolverResult };
    }

    const skillRoute = this.routeSkillCapability({ capabilities, skillName, intent, role, stage, tags, includePreview, includeExperimental });
    if (skillRoute.matchStatus === 'matched') {
      return { ...skillRoute, resolver: resolverResult };
    }

    return { ...this.routeMcpCapability({ capabilities, scope, mcpId, intent }), resolver: resolverResult };
  }

  routeMcpCapability({ capabilities, scope, mcpId = null, intent = '' }) {
    let candidate = null;
    if (mcpId) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === mcpId);
    } else if (/doc|library|api/i.test(intent)) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === 'context7');
    } else if (/browser|ui|page/i.test(intent)) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === 'chrome-devtools' || entry.mcpId === 'playwright');
    } else {
      candidate = capabilities.mcps.find((entry) => entry.enabled && entry.capabilityState === 'available') ?? capabilities.mcps[0];
    }

    if (!candidate) {
      return {
        status: 'unavailable',
        validationSurface: 'runtime_tooling',
        guidance: 'No matching MCP capability is present in the bundled catalog or OpenKit-managed custom registry.',
      };
    }
    if (!candidate.enabled) {
      if (candidate.capabilityState === 'not_configured') {
        return { ...candidate, status: 'not_configured', guidance: candidate.guidance };
      }
      return { ...candidate, status: 'disabled', guidance: `Run openkit configure mcp enable ${candidate.mcpId} --scope ${scope}` };
    }
    return {
      ...candidate,
      status: candidate.capabilityState,
      guidance: candidate.guidance,
    };
  }

  routeSkillCapability({ capabilities, skillName = null, intent = '', role = null, stage = null, tags = [], includePreview = false, includeExperimental = false } = {}) {
    const normalizedSkillName = String(skillName ?? '').replace(/^skill\./, '');
    const requestedTags = Array.isArray(tags) ? tags : [tags].filter(Boolean);
    const candidates = [];
    const suppressedCandidates = [];

    for (const skill of capabilities.skills) {
      const selectionReasons = [];
      let score = STATUS_WEIGHT[skill.status] ?? 0;

      if (normalizedSkillName) {
        if (skill.name === normalizedSkillName || skill.id === skillName) {
          score += 100;
          selectionReasons.push({ field: 'skillName', value: normalizedSkillName, weight: 100 });
        } else {
          continue;
        }
      }

      for (const tag of requestedTags) {
        if ((skill.tags ?? []).includes(tag)) {
          score += 8;
          selectionReasons.push({ field: 'tag', value: tag, weight: 8 });
        } else if (!normalizedSkillName) {
          score = -Infinity;
        }
      }

      if (score === -Infinity) {
        continue;
      }

      if (role && includesWildcard(skill.roles ?? [], role)) {
        score += 6;
        selectionReasons.push({ field: 'role', value: role, weight: 6 });
      }

      if (stage && includesWildcard(skill.stages ?? [], stage)) {
        score += 6;
        selectionReasons.push({ field: 'stage', value: stage, weight: 6 });
      }

      for (const trigger of skill.triggers ?? []) {
        if (matchText(trigger.value, intent)) {
          score += 10;
          selectionReasons.push({ field: 'trigger', value: trigger.value, weight: 10 });
        }
      }

      for (const tag of skill.tags ?? []) {
        if (matchText(tag, intent)) {
          score += 4;
          selectionReasons.push({ field: 'tag', value: tag, weight: 4 });
        }
      }

      if (!normalizedSkillName && selectionReasons.length === 0) {
        continue;
      }

      if (skill.capabilityState === 'unavailable' && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'metadata-only-or-unavailable' });
        continue;
      }
      if (skill.status === 'preview' && !includePreview && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'preview-not-requested' });
        continue;
      }
      if (skill.status === 'experimental' && !includeExperimental && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'experimental-not-requested' });
        continue;
      }

      candidates.push({ skill, score, selectionReasons });
    }

    candidates.sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name));
    const selected = candidates[0];

    if (!selected) {
      return {
        validationSurface: 'runtime_tooling',
        status: 'unavailable',
        matchStatus: 'no_match',
        candidatesConsidered: capabilities.skills.length,
        suppressedCandidates,
        guidance: 'No metadata-backed skill match was suitable for the supplied intent, role, stage, or tag filters.',
      };
    }

    return {
      validationSurface: 'runtime_tooling',
      status: selected.skill.capabilityState,
      matchStatus: 'matched',
      selectedSkill: {
        id: selected.skill.id,
        name: selected.skill.name,
        displayName: selected.skill.displayName,
        status: selected.skill.status,
        capabilityState: selected.skill.capabilityState,
        support_level: selected.skill.support_level,
        limitations: selected.skill.limitations,
      },
      selectionReasons: selected.selectionReasons,
      candidatesConsidered: candidates.length,
      suppressedCandidates,
      recommendedMcps: (selected.skill.recommended_mcps ?? []).map((mcpRef) => buildMcpContext(mcpRef, capabilities.mcps)),
      guidance: 'Load the selected skill explicitly before using it; router output is advisory and does not silently activate skills.',
    };
  }

  health({ scope = 'openkit', mcpId = null } = {}) {
    if (mcpId) {
      return { mcps: [this.mcpHealthManager.get(mcpId, { scope })].filter(Boolean) };
    }
    return { mcps: this.mcpHealthManager.list({ scope }) };
  }

  listSkillMcpBindings() {
    return this.skillMcpManager?.listBindings?.() ?? [];
  }
}
