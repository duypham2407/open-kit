import { FULL_STAGE_SEQUENCE, MIGRATION_STAGE_SEQUENCE, QUICK_STAGE_SEQUENCE } from "./workflow-state-rules.js"

const EVIDENCE_RULES = {
  quick: {
    quick_test: {
      requiredKinds: ["manual", "runtime", "automated"],
      summary: "Test and verification evidence proving each acceptance point was checked by the Quick Agent.",
    },
  },
  migration: {
    migration_verify: {
      requiredKinds: ["manual", "runtime", "automated", "review"],
      summary: "Parity, compatibility, and regression evidence for the migration.",
    },
  },
  full: {
    full_qa: {
      requiredKinds: ["manual", "runtime", "automated", "review"],
      summary: "Implementation, QA, or requirements evidence supporting feature closure.",
    },
  },
}

const NEXT_ACTION_BY_STAGE = {
  quick_intake: "Initialize workflow state and advance to brainstorm.",
  quick_brainstorm: "Read the codebase deeply, clarify and align understanding, and obtain explicit user confirmation before any option analysis.",
  quick_plan: "Analyze the solution space, present 3 options by default (or explain why fewer), wait for user option selection, create the selected-option execution plan, and wait for separate explicit plan confirmation.",
  quick_implement: "Execute the plan step by step, staying within the agreed scope.",
  quick_test: "Run tests, verify acceptance points with real evidence, check regression, and approve quick_verified.",
  quick_done: "Summarize changes, evidence, and notes, then close the quick task.",
  migration_intake: "Freeze preserved behavior and confirm the migration scope.",
  migration_baseline: "Capture the baseline, preserved invariants, and compatibility risks.",
  migration_strategy: "Create the migration solution package, then define staged upgrade slices, rollback checkpoints, and any required seams or adapters.",
  migration_upgrade: "Execute the current migration slice while preserving baseline behavior.",
  migration_code_review: "Review the upgrade for preserved-invariant drift, unsafe rewrites, and undocumented behavior changes.",
  migration_verify: "Verify parity with baseline evidence, smoke checks, and compatibility validation.",
  migration_done: "Close the migration or queue follow-up cleanup after parity is proven.",
  full_intake: "Open the work item, record routing context, and dispatch the first active role.",
  full_product: "Create the scope package with the problem, scope, business rules, and acceptance expectations.",
  full_solution: "Create the solution package with the technical approach, sequencing, and validation strategy.",
  full_implementation: "Execute the approved solution package and keep task-board state honest.",
  full_code_review: "Check scope-package and solution-package compliance first, then code quality before QA begins.",
  full_qa: "Validate implementation, classify issues, and approve closure when the work is ready.",
  full_done: "Close the feature and reconcile any remaining task-board state.",
}

const ARTIFACT_RULES = {
  quick: [
    {
      id: "task_card",
      availableFrom: "quick_brainstorm",
      requiredFrom: null,
      recommendedFrom: "quick_plan",
      optional: true,
      summary: "Optional quick-task traceability card.",
    },
  ],
  migration: [
    {
      id: "solution_package",
      availableFrom: "migration_strategy",
      requiredFrom: "migration_strategy",
      recommendedFrom: "migration_strategy",
      optional: false,
      summary: "Primary migration solution package for baseline, strategy, and staged upgrade slices.",
    },
    {
      id: "migration_report",
      availableFrom: "migration_baseline",
      requiredFrom: null,
      recommendedFrom: "migration_strategy",
      optional: true,
      summary: "Single living migration artifact for baseline, execution, and verification notes.",
    },
  ],
  full: [
    {
      id: "scope_package",
      availableFrom: "full_product",
      requiredFrom: "full_product",
      recommendedFrom: "full_product",
      optional: false,
      summary: "Primary scope package for product intent, rules, and acceptance.",
    },
    {
      id: "solution_package",
      availableFrom: "full_solution",
      requiredFrom: "full_solution",
      recommendedFrom: "full_solution",
      optional: false,
      summary: "Primary solution package for technical direction, slices, and validation.",
    },
    {
      id: "qa_report",
      availableFrom: "full_qa",
      requiredFrom: "full_qa",
      recommendedFrom: "full_qa",
      optional: false,
      summary: "QA evidence and closure recommendation.",
    },
    {
      id: "adr",
      availableFrom: "full_solution",
      requiredFrom: null,
      recommendedFrom: "full_solution",
      optional: true,
      summary: "Optional architecture decision records.",
    },
  ],
}

// ---------------------------------------------------------------------------
// Tool evidence gates (Tier 2)
//
// Each entry maps a target stage to the tool-sourced evidence that MUST exist
// in state.verification_evidence before advanceStage allows the transition.
//
// The `requiredSources` array is an array of groups.  Each group is an array of
// acceptable `source` field values.  At least one evidence entry whose `source`
// matches each group must be present.
//
// When `fallbackManualAllowed` is true, a single entry with source "manual" and
// the special scope `tool-evidence-override:<target_stage>` satisfies the entire
// gate.  This exists so human operators can unblock the pipeline when a tool is
// genuinely unavailable.
//
// Terminal `*_done` stages are NOT gated here because the existing EVIDENCE_RULES
// and assertStageExitReadiness already enforce kind-based evidence requirements
// at those stages.
// ---------------------------------------------------------------------------
const TOOL_EVIDENCE_GATES = {
  quick: {},
  migration: {
    migration_code_review: {
      requiredSources: [["rule-scan", "tool.rule-scan", "codemod-preview", "tool.codemod-preview"]],
      fallbackManualAllowed: true,
      summary: "Migration upgrade must record a rule-scan or codemod-preview before entering code review.",
    },
  },
  full: {
    full_code_review: {
      requiredSources: [["rule-scan", "tool.rule-scan"]],
      fallbackManualAllowed: true,
      summary: "Fullstack must run rule-scan on changed files before entering code review.",
    },
    full_qa: {
      requiredSources: [
        ["rule-scan", "tool.rule-scan"],
        ["security-scan", "tool.security-scan"],
      ],
      fallbackManualAllowed: true,
      summary: "Code Reviewer must run rule-scan and security-scan before QA begins.",
    },
  },
}

function checkToolEvidenceGate(state, targetStage) {
  const gate = TOOL_EVIDENCE_GATES[state?.mode]?.[targetStage]
  if (!gate) {
    return { passed: true, missingGroups: [], summary: null }
  }

  const evidence = getVerificationEvidence(state)
  const availableSources = new Set(evidence.map((entry) => entry.source))

  // Check for manual override
  if (gate.fallbackManualAllowed) {
    const overrideScope = `tool-evidence-override:${targetStage}`
    const hasOverride = evidence.some(
      (entry) => entry.source === "manual" && entry.scope === overrideScope,
    )
    if (hasOverride) {
      return { passed: true, missingGroups: [], summary: gate.summary }
    }
  }

  const missingGroups = []
  for (const sourceGroup of gate.requiredSources) {
    const satisfied = sourceGroup.some((src) => availableSources.has(src))
    if (!satisfied) {
      missingGroups.push(sourceGroup)
    }
  }

  return {
    passed: missingGroups.length === 0,
    missingGroups,
    summary: gate.summary,
    fallbackManualAllowed: gate.fallbackManualAllowed,
  }
}

const DOD_RULES = {
  quick: {
    requiredArtifacts: [],
    requiredApprovals: ["quick_verified"],
    requiredEvidenceStages: ["quick_test"],
    summary: "Quick work is done when the Quick Agent provides real test evidence, quick_verified is approved, and no unresolved issues remain.",
  },
  migration: {
    requiredArtifacts: ["solution_package"],
    requiredApprovals: ["migration_verified"],
    requiredEvidenceStages: ["migration_verify"],
    summary: "Migration work is done when parity or compatibility evidence exists, migration approval is explicit, and unresolved issues are closed.",
  },
  full: {
    requiredArtifacts: ["scope_package", "solution_package", "qa_report"],
    requiredApprovals: ["product_to_solution", "solution_to_fullstack", "fullstack_to_code_review", "code_review_to_qa", "qa_to_done"],
    requiredEvidenceStages: ["full_qa"],
    summary: "Full delivery is done when required artifacts, approvals, QA evidence, and issue closure all exist together.",
  },
}

const SEQUENCES = {
  quick: QUICK_STAGE_SEQUENCE,
  migration: MIGRATION_STAGE_SEQUENCE,
  full: FULL_STAGE_SEQUENCE,
}

function stageIndex(mode, stage) {
  return (SEQUENCES[mode] ?? []).indexOf(stage)
}

function getArtifactValue(state, artifactId) {
  if (!state?.artifacts) {
    return null
  }

  if (artifactId === "adr") {
    return Array.isArray(state.artifacts.adr) && state.artifacts.adr.length > 0 ? state.artifacts.adr : null
  }

  return state.artifacts[artifactId] ?? null
}

function summarizeArtifactState(rule, state) {
  const currentIndex = stageIndex(state.mode, state.current_stage)
  const value = getArtifactValue(state, rule.id)
  const availableIndex = rule.availableFrom ? stageIndex(state.mode, rule.availableFrom) : -1
  const requiredIndex = rule.requiredFrom ? stageIndex(state.mode, rule.requiredFrom) : -1
  const recommendedIndex = rule.recommendedFrom ? stageIndex(state.mode, rule.recommendedFrom) : -1

  if (value) {
    return {
      artifact: rule.id,
      status: "present",
      summary: rule.summary,
      value,
    }
  }

  if (requiredIndex !== -1 && currentIndex >= requiredIndex) {
    return {
      artifact: rule.id,
      status: "missing-required",
      summary: rule.summary,
      value: null,
    }
  }

  if (recommendedIndex !== -1 && currentIndex >= recommendedIndex) {
    return {
      artifact: rule.id,
      status: "recommended-now",
      summary: rule.summary,
      value: null,
    }
  }

  if (availableIndex !== -1 && currentIndex >= availableIndex) {
    return {
      artifact: rule.id,
      status: "available-now",
      summary: rule.summary,
      value: null,
    }
  }

  return {
    artifact: rule.id,
    status: "not-yet-needed",
    summary: rule.summary,
    value: null,
  }
}

function getArtifactRulesForMode(mode) {
  return ARTIFACT_RULES[mode] ?? []
}

function getArtifactReadiness(state) {
  if (!state?.mode) {
    return []
  }

  return getArtifactRulesForMode(state.mode).map((rule) => summarizeArtifactState(rule, state))
}

function getParallelizationSummary(state) {
  return state?.parallelization ?? null
}

function summarizeArtifactReadinessLines(state) {
  return getArtifactReadiness(state).map((entry) => `${entry.artifact}: ${entry.status}`)
}

function getNextAction(state) {
  if (!state?.current_stage) {
    return null
  }

  return NEXT_ACTION_BY_STAGE[state.current_stage] ?? null
}

function flattenArtifactRefs(state) {
  if (!state?.artifacts) {
    return []
  }

  const refs = []
  for (const [artifact, value] of Object.entries(state.artifacts)) {
    if (artifact === "adr") {
      for (const entry of Array.isArray(value) ? value : []) {
        if (typeof entry === "string" && entry.length > 0) {
          refs.push({ artifact, path: entry })
        }
      }
      continue
    }

    if (typeof value === "string" && value.length > 0) {
      refs.push({ artifact, path: value })
    }
  }
  return refs
}

function getVerificationEvidence(state) {
  return Array.isArray(state?.verification_evidence) ? state.verification_evidence : []
}

function summarizeVerificationEvidence(state) {
  return getVerificationEvidence(state).map((entry) => {
    const label = `${entry.kind}:${entry.scope}`
    return entry.exit_status === null || entry.exit_status === undefined
      ? `${label}`
      : `${label}:${entry.exit_status}`
  })
}

function getEvidenceRequirement(state) {
  if (!state?.mode || !state?.current_stage) {
    return null
  }

  return EVIDENCE_RULES[state.mode]?.[state.current_stage] ?? null
}

function getVerificationReadiness(state) {
  const requirement = getEvidenceRequirement(state)
  const evidence = getVerificationEvidence(state)

  if (!requirement) {
    return {
      status: "not-required-yet",
      requiredKinds: [],
      evidenceCount: evidence.length,
      missingKinds: [],
      summary: "No explicit verification evidence requirement at the current stage.",
    }
  }

  const availableKinds = new Set(evidence.map((entry) => entry.kind))
  const missingKinds = requirement.requiredKinds.filter((kind) => !availableKinds.has(kind))

  return {
    status: missingKinds.length === 0 && evidence.length > 0 ? "ready" : "missing-evidence",
    requiredKinds: requirement.requiredKinds,
    evidenceCount: evidence.length,
    missingKinds,
    summary: requirement.summary,
  }
}

function summarizeVerificationReadinessLine(state) {
  const readiness = getVerificationReadiness(state)
  if (readiness.status === "not-required-yet") {
    return "verification: not-required-yet"
  }

  if (readiness.status === "ready") {
    return `verification: ready (${readiness.evidenceCount} evidence item${readiness.evidenceCount === 1 ? "" : "s"})`
  }

  return `verification: missing-evidence${readiness.missingKinds.length > 0 ? ` (${readiness.missingKinds.join(", ")})` : ""}`
}

function getIssueTelemetry(state) {
  const issues = Array.isArray(state?.issues) ? state.issues : []
  const openIssues = issues.filter((issue) => issue.current_status !== "closed" && issue.current_status !== "resolved")
  const repeatedIssues = issues.filter((issue) => (issue.repeat_count ?? 0) > 0)
  const staleIssues = issues.filter((issue) => typeof issue.blocked_since === "string" || (issue.reopen_count ?? 0) > 0)

  return {
    total: issues.length,
    open: openIssues.length,
    repeated: repeatedIssues.length,
    staleSignals: staleIssues.length,
  }
}

function getDodRule(mode) {
  return DOD_RULES[mode] ?? null
}

export {
  checkToolEvidenceGate,
  getDodRule,
  flattenArtifactRefs,
  getArtifactReadiness,
  getEvidenceRequirement,
  getIssueTelemetry,
  getNextAction,
  getParallelizationSummary,
  getVerificationEvidence,
  getVerificationReadiness,
  summarizeArtifactReadinessLines,
  summarizeVerificationEvidence,
  summarizeVerificationReadinessLine,
  TOOL_EVIDENCE_GATES,
}
