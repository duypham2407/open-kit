const STANDARD_CAPABILITY_STATES = new Set([
  'available',
  'unavailable',
  'degraded',
  'preview',
  'compatibility_only',
  'not_configured',
]);

const DEFAULT_LIMITS = {
  maxLines: 25,
  maxChars: 2400,
  maxCategories: 5,
  maxSkillNames: 3,
  maxBundledMcpIds: 3,
  maxCustomMcpIds: 3,
};

const STATUS_RANK = {
  available: 0,
  preview: 1,
  degraded: 2,
  compatibility_only: 3,
  not_configured: 4,
  unavailable: 5,
};

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key|token|secret|password|cookie)\s*[:=]\s*[^\s,;]+/gi,
  /(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
  /([?&](?:token|access_token|api_key|apikey|secret|password)=)[^\s&#]+/gi,
];

const REFRESH_ROUTES = [
  'tool.runtime-summary',
  'tool.capability-router',
  'tool.skill-index',
  'tool.capability-inventory',
  'tool.mcp-doctor',
  'tool.capability-health',
];

const MODE_STAGE_PREFIXES = {
  quick: 'quick_',
  migration: 'migration_',
  full: 'full_',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unique(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function redactSecrets(value) {
  let output = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, prefix) => {
      if (typeof prefix === 'string' && prefix.startsWith('http')) {
        return prefix;
      }
      if (typeof prefix === 'string' && prefix.startsWith('?')) {
        return `${prefix}[redacted]`;
      }
      if (typeof prefix === 'string' && prefix.startsWith('&')) {
        return `${prefix}[redacted]`;
      }
      return '[redacted]';
    });
  }
  return output;
}

function containsSecretLikeValue(value) {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(String(value ?? ''));
  });
}

function safeIdentifier(value, fallback = 'unknown') {
  const raw = String(value ?? '').trim();
  if (!raw || containsSecretLikeValue(raw)) {
    return fallback;
  }
  return redactSecrets(raw).replace(/[^a-zA-Z0-9_.:-]+/g, '-').slice(0, 80) || fallback;
}

function safeText(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }
  return redactSecrets(raw).replace(/\s+/g, ' ').slice(0, 320);
}

function normalizeCapabilityState(value, fallback = 'unavailable') {
  return STANDARD_CAPABILITY_STATES.has(value) ? value : fallback;
}

function normalizeWorkflowContext(workflowState = {}) {
  const state = isPlainObject(workflowState) ? workflowState : {};
  const mode = ['quick', 'migration', 'full'].includes(state.mode) ? state.mode : 'unknown';
  const stage = typeof state.current_stage === 'string' && state.current_stage.length > 0
    ? state.current_stage
    : 'unknown';
  const owner = typeof state.current_owner === 'string' && state.current_owner.length > 0
    ? state.current_owner
    : 'unknown';
  const status = typeof state.status === 'string' && state.status.length > 0 ? state.status : 'unknown';
  const stageMatchesMode = mode !== 'unknown' && stage.startsWith(MODE_STAGE_PREFIXES[mode]);
  const known = mode !== 'unknown' && stage !== 'unknown' && owner !== 'unknown' && stageMatchesMode;

  return {
    mode,
    stage,
    owner,
    status,
    known,
    staleCaveats: known
      ? []
      : ['workflow state is missing, unknown, or does not match canonical mode/stage vocabulary'],
  };
}

function normalizeOwner(owner) {
  return String(owner ?? '').replace(/\s+/g, '').toLowerCase();
}

function roleGuardrailFor(workflowContext) {
  const owner = normalizeOwner(workflowContext.owner);
  const { mode, stage } = workflowContext;

  if (!workflowContext.known) {
    return {
      role: 'unknown',
      stage,
      hint: 'Unknown workflow state: use generic capability discovery only, then refresh workflow context before role-specific work.',
      suggestedRoutes: ['tool.runtime-summary', 'tool.workflow-state', 'tool.capability-router'],
      caveats: ['Do not guess lane, stage, owner, or approval authority from capability guidance.'],
    };
  }

  if (owner === 'masterorchestrator') {
    return {
      role: 'MasterOrchestrator',
      stage,
      hint: 'Master Orchestrator controls routing, state, dispatch, approvals, and readiness only; do not implement, review, QA, or author scope/solution content.',
      suggestedRoutes: ['tool.workflow-state', 'tool.runtime-summary', 'tool.capability-router'],
      caveats: ['Capability guidance is advisory and cannot override workflow gates.'],
    };
  }

  if (mode === 'quick' || owner === 'quickagent') {
    return {
      role: 'QuickAgent',
      stage,
      hint: 'Quick Agent remains the single quick-lane owner across brainstorm, plan, implementation, and test; do not introduce full-delivery handoffs or task-board assumptions.',
      suggestedRoutes: ['tool.capability-router', 'tool.skill-index', 'tool.runtime-summary'],
      caveats: ['Use the closest real validation path and record missing target-project app validation honestly.'],
    };
  }

  if (mode === 'migration') {
    return {
      role: workflowContext.owner,
      stage,
      hint: 'Migration guidance preserves baseline, compatibility, parity, staged upgrade, rollback, review, and verification semantics; do not assume full-delivery task-board behavior.',
      suggestedRoutes: ['tool.capability-router', 'tool.skill-index', 'tool.mcp-doctor', 'tool.runtime-summary'],
      caveats: ['Refactor only for migration seams/adapters and route requirement ambiguity instead of rewriting behavior by default.'],
    };
  }

  if (owner === 'productlead') {
    return {
      role: 'ProductLead',
      stage,
      hint: 'Product Lead defines problem, business rules, scope, and acceptance criteria; do not take implementation or architecture ownership.',
      suggestedRoutes: ['tool.capability-router', 'tool.skill-index', 'tool.runtime-summary'],
      caveats: ['Use product/context reads to clarify requirements, not to implement.'],
    };
  }

  if (owner === 'solutionlead') {
    return {
      role: 'SolutionLead',
      stage,
      hint: 'Solution Lead plans technical direction, sequencing, validation, and capability discovery from approved scope; do not rewrite product scope or implement.',
      suggestedRoutes: ['tool.capability-router', 'tool.skill-index', 'tool.semantic-search', 'tool.syntax-outline'],
      caveats: ['Route requirement gaps back through workflow instead of changing scope locally.'],
    };
  }

  if (owner === 'fullstackagent') {
    return {
      role: 'FullstackAgent',
      stage,
      hint: 'Fullstack Agent implements approved solution-package work and records evidence; QA ownership, review approval, and product/scope changes stay separate.',
      suggestedRoutes: ['tool.capability-router', 'tool.skill-index', 'tool.semantic-search', 'tool.evidence-capture'],
      caveats: ['Use implementation aids only in implementation-owned stages and keep validation-surface labels honest.'],
    };
  }

  if (owner === 'codereviewer' || owner === 'codereview') {
    return {
      role: 'CodeReviewer',
      stage,
      hint: 'Code Reviewer checks scope/solution compliance first, then quality, scans, dependencies, and findings; do not implement fixes or claim QA closure as reviewer.',
      suggestedRoutes: ['tool.rule-scan', 'tool.security-scan', 'tool.find-dependencies', 'tool.runtime-summary'],
      caveats: ['Route implementation, solution, or product findings to the correct owner.'],
    };
  }

  if (owner === 'qaagent') {
    return {
      role: 'QAAgent',
      stage,
      hint: 'QA Agent verifies behavior, evidence, runtime health, and issue classification; do not implement, bypass review, or approve closure without validation evidence.',
      suggestedRoutes: ['tool.runtime-summary', 'tool.evidence-capture', 'tool.browser-verify', 'tool.capability-health'],
      caveats: ['QA completion still requires real validation evidence or explicit unavailable-path notes.'],
    };
  }

  return {
    role: workflowContext.owner,
    stage,
    hint: 'Use role-appropriate capability discovery and preserve OpenKit workflow ownership boundaries.',
    suggestedRoutes: ['tool.runtime-summary', 'tool.capability-router', 'tool.skill-index'],
    caveats: ['Capability guidance is advisory and does not assign work across roles.'],
  };
}

function roleAllowsCodeIntelligence(context) {
  const owner = normalizeOwner(context.owner);
  return context.mode === 'migration' || [
    'solutionlead',
    'fullstackagent',
    'codereviewer',
    'codereview',
    'quickagent',
  ].includes(owner);
}

function roleAllowsVerificationReview(context) {
  const owner = normalizeOwner(context.owner);
  return context.mode === 'migration' || [
    'fullstackagent',
    'codereviewer',
    'codereview',
    'qaagent',
    'quickagent',
  ].includes(owner) || ['full_code_review', 'full_qa', 'quick_test', 'migration_code_review', 'migration_verify'].includes(context.stage);
}

function statusSummary(entries = []) {
  const states = Object.fromEntries([...STANDARD_CAPABILITY_STATES].map((state) => [state, 0]));
  for (const entry of entries) {
    const state = normalizeCapabilityState(entry.capabilityState ?? entry.status);
    states[state] += 1;
  }
  return states;
}

function collectReadinessEnvelopes(entries = []) {
  return entries
    .map((entry) => entry?.capabilityEnvelope ?? entry?.readiness)
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 8);
}

function matchesRoleOrStage(skill, context) {
  const roles = Array.isArray(skill.roles) ? skill.roles : [];
  const stages = Array.isArray(skill.stages) ? skill.stages : [];
  return roles.includes('all') || roles.includes(context.owner) || stages.includes('all') || stages.includes(context.stage);
}

function rankSkill(skill, context) {
  let score = 0;
  const roles = Array.isArray(skill.roles) ? skill.roles : [];
  const stages = Array.isArray(skill.stages) ? skill.stages : [];
  const tags = Array.isArray(skill.tags) ? skill.tags : [];

  if (roles.includes(context.owner)) score += 40;
  if (stages.includes(context.stage)) score += 40;
  if (roles.includes('all')) score += 8;
  if (stages.includes('all')) score += 8;
  if (context.mode === 'quick' && stages.some((stage) => stage.startsWith('quick_'))) score += 10;
  if (context.mode === 'migration' && stages.some((stage) => stage.startsWith('migration_'))) score += 12;
  if (context.mode === 'full' && stages.some((stage) => stage.startsWith('full_'))) score += 10;
  if (tags.includes('workflow')) score += 4;
  if (tags.includes('verification') && roleAllowsVerificationReview(context)) score += 6;
  if (tags.includes('code-intelligence') && roleAllowsCodeIntelligence(context)) score += 6;
  score -= STATUS_RANK[normalizeCapabilityState(skill.capabilityState)] ?? 10;
  return score;
}

function selectRelevantSkills(skills = [], context, limits) {
  if (!context.known) {
    return [];
  }
  return skills
    .filter((skill) => matchesRoleOrStage(skill, context))
    .map((skill) => ({ skill, score: rankSkill(skill, context) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || safeIdentifier(left.skill.name).localeCompare(safeIdentifier(right.skill.name)))
    .slice(0, limits.maxSkillNames)
    .map((entry) => entry.skill);
}

function collectRecommendedMcpIds(skills = []) {
  return unique(skills.flatMap((skill) => (skill.recommended_mcps ?? []).map((ref) => ref?.id).filter(Boolean)));
}

function mcpNeedsKey(mcp) {
  return Object.values(mcp?.keyState ?? {}).some((value) => value === 'missing');
}

function mcpKeyStateSummary(mcp) {
  const values = Object.values(mcp?.keyState ?? {});
  if (values.length === 0) return 'no-key-required';
  if (values.some((value) => value === 'missing')) return 'missing';
  if (values.some((value) => value === 'present_redacted')) return 'present_redacted';
  return 'redacted-state-only';
}

function normalizeMcpKind(mcp) {
  return mcp?.kind === 'custom' ? 'custom_mcp' : 'bundled_mcp';
}

function buildMcpCaveat(mcp) {
  const kind = normalizeMcpKind(mcp);
  const state = normalizeCapabilityState(mcp?.capabilityState ?? mcp?.status);
  const id = safeIdentifier(mcp?.mcpId ?? mcp?.id, kind === 'custom_mcp' ? 'custom-mcp' : 'bundled-mcp');
  const caveats = [];
  if (mcp?.enabled === false) caveats.push('disabled for scope');
  if (state === 'not_configured' && mcpNeedsKey(mcp)) caveats.push('needs-key');
  if (state !== 'available') caveats.push(`state=${state}`);
  if (kind === 'custom_mcp') {
    caveats.push(`origin=${safeIdentifier(mcp?.origin, 'unknown-origin')}`);
    caveats.push(`ownership=${safeIdentifier(mcp?.ownership, 'custom')}`);
  }
  if (mcpKeyStateSummary(mcp) !== 'no-key-required') {
    caveats.push(`keys=${mcpKeyStateSummary(mcp)}`);
  }

  return {
    id,
    kind,
    state,
    caveat: caveats.length > 0
      ? `${caveats.join('; ')}; inspect explicitly with tool.mcp-doctor or openkit configure mcp doctor`
      : 'available snapshot only; inspect explicitly before relying on current health',
    secretSafe: true,
  };
}

function selectMcpCaveats(mcps = [], relevantMcpIds = [], limits = DEFAULT_LIMITS) {
  const relevant = mcps.filter((mcp) => relevantMcpIds.includes(mcp.mcpId));
  const explanatory = mcps.filter((mcp) => {
    const state = normalizeCapabilityState(mcp.capabilityState ?? mcp.status);
    return mcp.kind === 'custom' || state !== 'available' || mcp.enabled === false || mcpNeedsKey(mcp);
  });
  const candidates = unique([...relevant, ...explanatory].map((mcp) => mcp.mcpId))
    .map((id) => mcps.find((mcp) => mcp.mcpId === id))
    .filter(Boolean)
    .sort((left, right) => {
      const leftKind = left.kind === 'custom' ? 1 : 0;
      const rightKind = right.kind === 'custom' ? 1 : 0;
      if (leftKind !== rightKind) return leftKind - rightKind;
      const leftState = STATUS_RANK[normalizeCapabilityState(left.capabilityState ?? left.status)] ?? 10;
      const rightState = STATUS_RANK[normalizeCapabilityState(right.capabilityState ?? right.status)] ?? 10;
      return rightState - leftState || safeIdentifier(left.mcpId).localeCompare(safeIdentifier(right.mcpId));
    });

  const bundled = candidates.filter((mcp) => mcp.kind !== 'custom').slice(0, limits.maxBundledMcpIds);
  const custom = candidates.filter((mcp) => mcp.kind === 'custom').slice(0, limits.maxCustomMcpIds);
  return [...bundled, ...custom].map(buildMcpCaveat);
}

function buildCustomMcpSummary(mcps = [], caveats = [], limits = DEFAULT_LIMITS) {
  const custom = mcps.filter((mcp) => mcp.kind === 'custom');
  const shown = caveats
    .filter((entry) => entry.kind === 'custom_mcp')
    .slice(0, limits.maxCustomMcpIds)
    .map((entry) => ({
      id: entry.id,
      kind: 'custom',
      state: entry.state,
      caveat: entry.caveat,
    }));
  return {
    total: custom.length,
    shown,
    overflow: Math.max(0, custom.length - shown.length),
    caveat: 'Custom MCPs are kind=custom, origin-labeled, and are not bundled defaults.',
  };
}

function makeCategory(id, status, summary, nextActions, caveats = []) {
  return {
    id,
    status: normalizeCapabilityState(status, 'degraded'),
    summary: safeText(summary),
    nextActions: unique(nextActions).slice(0, 5),
    caveats: caveats.map((caveat) => safeText(caveat)).filter(Boolean).slice(0, 4),
  };
}

function buildCategories({ context, skills, mcps, relevantSkills }) {
  const skillStates = statusSummary(skills);
  const mcpStates = statusSummary(mcps);
  const readinessEnvelopes = collectReadinessEnvelopes([...mcps, ...skills]);
  const degradedReadiness = readinessEnvelopes.filter((entry) => normalizeCapabilityState(entry.state) !== 'available');
  const categories = [
    makeCategory(
      'workflow',
      'available',
      'Consider workflow-state/runtime-summary for stage, approvals, artifacts, evidence, and readiness.',
      ['tool.workflow-state', 'tool.runtime-summary'],
      ['Compatibility runtime evidence is not target-project app validation.'],
    ),
    makeCategory(
      'skill-discovery',
      skills.length > 0 ? 'available' : 'degraded',
      relevantSkills.length > 0
        ? `Consider capability-router or skill-index for role/stage skill details; relevant skills: ${relevantSkills.map((skill) => safeIdentifier(skill.name)).join(', ')}.`
        : 'Consider capability-router or skill-index for explicit skill discovery; no full skill catalog is preloaded here.',
      ['tool.capability-router', 'tool.skill-index', 'tool.skill-mcp-bindings'],
      [`skill states available=${skillStates.available ?? 0}, preview=${skillStates.preview ?? 0}, unavailable=${skillStates.unavailable ?? 0}`],
    ),
    makeCategory(
      'mcp-readiness',
      mcps.length > 0 ? (mcpStates.not_configured > 0 || mcpStates.unavailable > 0 ? 'degraded' : 'available') : 'degraded',
      'Inspect MCP readiness explicitly; key-required MCPs show not_configured/needs-key only and no secrets.',
      ['tool.mcp-doctor', 'tool.capability-health', 'openkit configure mcp doctor', 'openkit configure mcp list'],
      [`MCP snapshot states available=${mcpStates.available ?? 0}, not_configured=${mcpStates.not_configured ?? 0}, unavailable=${mcpStates.unavailable ?? 0}`],
    ),
  ];

  if (roleAllowsCodeIntelligence(context)) {
    categories.push(makeCategory(
      'code-intelligence',
      degradedReadiness.some((entry) => entry.family === 'code_intelligence') ? 'degraded' : 'available',
      'Consider graph, syntax, semantic, AST, or codemod tools only when the current role/stage owns code exploration or implementation planning; inspect readiness/fallback evidence before relying on results.',
      ['tool.semantic-search', 'tool.syntax-outline', 'tool.find-dependencies', 'tool.ast-grep-search', 'tool.codemod-preview'],
      [
        ...(context.mode === 'migration' ? ['Use migration-safe discovery for seams/adapters and parity, not opportunistic rewrites.'] : []),
        'Capability guidance is advisory and does not prove code-intelligence results are complete or fresh.',
      ],
    ));
  }

  if (roleAllowsVerificationReview(context)) {
    categories.push(makeCategory(
      'verification-review',
      'available',
      'Consider scan, browser, and evidence tools only for roles/stages that own implementation verification, review, or QA.',
      ['tool.rule-scan', 'tool.security-scan', 'tool.browser-verify', 'tool.evidence-capture'],
      ['Actual completion still requires real evidence or explicit unavailable-path caveats.'],
    ));
  }

  return categories.slice(0, DEFAULT_LIMITS.maxCategories);
}

function stringifyLineList(values = []) {
  return values.map((value) => safeText(value)).filter(Boolean).join(', ');
}

function buildInitialLines(model) {
  const lines = [];
  const { workflowContext } = model;
  lines.push(`capability guidance: ${model.source.replace(/_/g, ' ')}; advisory only; no skill or MCP was auto-activated.`);
  lines.push(`freshness: ${model.freshness.kind}; ${model.freshness.caveat} Refresh: ${model.freshness.refreshRoutes.slice(0, 4).join(', ')}.`);
  lines.push(`workflow context: ${workflowContext.mode} / ${workflowContext.stage} / ${workflowContext.owner}; validation surface ${model.validationSurface}.`);
  for (const caveat of workflowContext.staleCaveats ?? []) {
    lines.push(`workflow caveat: ${safeText(caveat)}.`);
  }
  for (const hint of model.roleHints) {
    lines.push(`role guardrail: ${hint.hint} Routes: ${hint.suggestedRoutes.slice(0, 4).join(', ')}.`);
    if ((hint.caveats ?? []).length > 0) {
      lines.push(`role caveat: ${safeText(hint.caveats[0], '').slice(0, 160)}`);
    }
  }
  if (model.capabilityCaveats.length > 0) {
    for (const caveat of model.capabilityCaveats.slice(0, 4)) {
      lines.push(`capability caveat: ${caveat.id} (${caveat.kind}, ${caveat.state}) — ${caveat.caveat}.`);
    }
  }
  if (model.customMcpSummary.total > 0) {
    const shown = model.customMcpSummary.shown.map((entry) => `${entry.id}:${entry.state}`).join(', ') || 'none shown';
    lines.push(`custom MCPs: ${model.customMcpSummary.total} total; shown ${shown}; ${model.customMcpSummary.caveat}`);
  } else {
    lines.push('custom MCPs: none configured in this snapshot; custom entries would be origin-labeled and not bundled defaults.');
  }
  lines.push(`target app validation: ${model.targetProjectValidation.status}; ${model.targetProjectValidation.caveat}`);
  lines.push('recommended routes:');
  for (const category of model.categories) {
    const caveatSuffix = category.caveats.length > 0 ? ` Caveat: ${safeText(category.caveats[0]).slice(0, 90)}.` : '';
    lines.push(`- ${category.id} [${category.status}]: ${safeText(category.summary).slice(0, 150)} Next: ${category.nextActions.slice(0, 3).join(', ')}.${caveatSuffix}`);
  }
  lines.push('details stay explicit: call capability-router, skill-index, capability-inventory, mcp-doctor, or capability-health for catalogs/readiness; this summary is not a catalog dump.');
  return lines.map((line) => safeText(line));
}

function enforceLimits(lines, limits) {
  const cappedLines = [];
  let usedChars = 0;
  let truncated = false;

  for (const line of lines) {
    const normalized = safeText(line);
    if (!normalized) continue;
    const nextChars = usedChars + normalized.length + 1;
    if (cappedLines.length >= limits.maxLines || nextChars > limits.maxChars) {
      truncated = true;
      break;
    }
    cappedLines.push(normalized);
    usedChars = nextChars;
  }

  if (truncated) {
    const truncationLine = 'guidance truncated by compact caps; call tool.runtime-summary, tool.capability-router, tool.skill-index, or tool.mcp-doctor for explicit details.';
    while (cappedLines.length >= limits.maxLines || usedChars + truncationLine.length + 1 > limits.maxChars) {
      const removed = cappedLines.pop();
      usedChars -= (removed?.length ?? 0) + 1;
    }
    cappedLines.push(truncationLine);
  }

  return { lines: cappedLines, truncated };
}

export function buildCapabilityGuidance({
  workflowState = null,
  capabilities = {},
  source = 'runtime_summary',
  generatedAt = new Date().toISOString(),
  limits: limitOverrides = {},
} = {}) {
  const limits = { ...DEFAULT_LIMITS, ...limitOverrides };
  const workflowContext = normalizeWorkflowContext(workflowState);
  const skills = Array.isArray(capabilities.skills) ? capabilities.skills : [];
  const mcps = Array.isArray(capabilities.mcps) ? capabilities.mcps : [];
  const metadataAvailable = skills.length > 0 || mcps.length > 0;
  const relevantSkills = selectRelevantSkills(skills, workflowContext, limits);
  const relevantMcpIds = collectRecommendedMcpIds(relevantSkills);
  const capabilityCaveats = selectMcpCaveats(mcps, relevantMcpIds, limits);
  const readinessEnvelopes = collectReadinessEnvelopes([...mcps, ...skills]);
  const categories = buildCategories({ context: workflowContext, skills, mcps, relevantSkills }).slice(0, limits.maxCategories);
  const roleHints = [roleGuardrailFor(workflowContext)];
  const status = !metadataAvailable ? 'unavailable' : workflowContext.known ? 'ok' : 'degraded';
  const model = {
    status,
    validationSurface: 'runtime_tooling',
    generatedAt,
    source,
    freshness: {
      kind: source === 'startup_snapshot' ? 'startup_snapshot' : source === 'explicit_runtime_tool' ? 'fresh_read' : 'last_known',
      caveat: source === 'startup_snapshot'
        ? 'Capability readiness can change after this startup snapshot.'
        : 'Capability readiness is a compact read model and may be stale unless refreshed explicitly.',
      refreshRoutes: REFRESH_ROUTES,
    },
    workflowContext: {
      mode: workflowContext.mode,
      stage: workflowContext.stage,
      owner: workflowContext.owner,
      status: workflowContext.status,
      staleCaveats: workflowContext.staleCaveats,
    },
    categories,
    roleHints,
    capabilityCaveats,
    readinessEnvelopes,
    customMcpSummary: buildCustomMcpSummary(mcps, capabilityCaveats, limits),
    limits: {
      maxLines: limits.maxLines,
      maxChars: limits.maxChars,
      maxCategories: limits.maxCategories,
      maxSkillNames: limits.maxSkillNames,
      maxBundledMcpIds: limits.maxBundledMcpIds,
      maxCustomMcpIds: limits.maxCustomMcpIds,
      truncated: false,
    },
    targetProjectValidation: {
      status: 'unavailable',
      caveat: 'OpenKit capability checks are not target-project app build/lint/test evidence unless the target project defines app-native commands.',
    },
  };

  const { lines, truncated } = enforceLimits(buildInitialLines(model), limits);
  return {
    ...model,
    renderedLines: lines,
    lines,
    limits: {
      ...model.limits,
      truncated,
    },
  };
}

export function buildUnavailableCapabilityGuidance({ workflowState = null, source = 'startup_snapshot', reason = 'Capability metadata could not be loaded.' } = {}) {
  const workflowContext = normalizeWorkflowContext(workflowState);
  const limits = DEFAULT_LIMITS;
  const model = {
    status: 'unavailable',
    validationSurface: 'runtime_tooling',
    generatedAt: new Date().toISOString(),
    source,
    freshness: {
      kind: source === 'startup_snapshot' ? 'startup_snapshot' : 'last_known',
      caveat: 'No fresh capability metadata is available; treat this guidance as degraded.',
      refreshRoutes: REFRESH_ROUTES,
    },
    workflowContext: {
      mode: workflowContext.mode,
      stage: workflowContext.stage,
      owner: workflowContext.owner,
      status: workflowContext.status,
      staleCaveats: unique([...workflowContext.staleCaveats, safeText(reason)]),
    },
    categories: [
      makeCategory(
        'workflow',
        'degraded',
        'Refresh workflow and capability state explicitly before relying on role-specific recommendations.',
        ['tool.runtime-summary', 'tool.workflow-state', 'node .opencode/workflow-state.js resume-summary'],
        [reason],
      ),
      makeCategory(
        'skill-discovery',
        'unavailable',
        'Skill-specific recommendations are not available in this snapshot; call skill-index explicitly after startup.',
        ['tool.skill-index', 'tool.capability-router'],
        ['No skill body was loaded automatically.'],
      ),
      makeCategory(
        'mcp-readiness',
        'unavailable',
        'MCP readiness is unknown in this snapshot; inspect explicitly before use.',
        ['tool.mcp-doctor', 'tool.capability-health', 'openkit configure mcp doctor'],
        ['No MCP-backed tool was executed automatically.'],
      ),
    ],
    roleHints: [roleGuardrailFor(workflowContext)],
    capabilityCaveats: [],
    customMcpSummary: {
      total: 0,
      shown: [],
      overflow: 0,
      caveat: 'Custom MCP state is unknown; custom entries must be origin-labeled when visible.',
    },
    limits: {
      ...limits,
      truncated: false,
    },
    targetProjectValidation: {
      status: 'unavailable',
      caveat: 'OpenKit capability guidance does not validate target-project app build/lint/test behavior.',
    },
  };
  const { lines, truncated } = enforceLimits(buildInitialLines(model), limits);
  return {
    ...model,
    renderedLines: lines,
    lines,
    limits: {
      ...model.limits,
      truncated,
    },
  };
}

export function renderCapabilityGuidanceLines(model) {
  return Array.isArray(model?.renderedLines) ? model.renderedLines : [];
}

export const CAPABILITY_GUIDANCE_LIMITS = { ...DEFAULT_LIMITS };
