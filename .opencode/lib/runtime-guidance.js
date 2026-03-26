const { FULL_STAGE_SEQUENCE, MIGRATION_STAGE_SEQUENCE, QUICK_STAGE_SEQUENCE } = require("./workflow-state-rules")

const NEXT_ACTION_BY_STAGE = {
  quick_intake: "Confirm quick eligibility and bound the work before planning.",
  quick_plan: "Record the bounded checklist, acceptance bullets, and short verification path.",
  quick_build: "Implement the smallest safe change and keep the verification path short.",
  quick_verify: "Inspect QA Lite evidence, resolve bugs, or escalate if the work is no longer safely bounded.",
  quick_done: "Close the quick task or record any follow-up work.",
  migration_intake: "Freeze preserved behavior and confirm the migration scope.",
  migration_baseline: "Capture the baseline, preserved invariants, and compatibility risks.",
  migration_strategy: "Define staged upgrade slices, rollback checkpoints, and any required seams or adapters.",
  migration_upgrade: "Execute the current migration slice while preserving baseline behavior.",
  migration_verify: "Verify parity with baseline evidence, smoke checks, and compatibility validation.",
  migration_done: "Close the migration or queue follow-up cleanup after parity is proven.",
  full_intake: "Clarify the feature goal, scope, and intake conditions before drafting the brief.",
  full_brief: "Produce the product brief so the work can move into spec definition.",
  full_spec: "Define acceptance behavior and scenarios before architecture work.",
  full_architecture: "Design the technical approach and record architecture decisions.",
  full_plan: "Produce the implementation plan and, when useful, seed the execution task board.",
  full_implementation: "Execute the approved plan and keep task-board state honest.",
  full_qa: "Validate implementation, classify issues, and approve closure when the work is ready.",
  full_done: "Close the feature and reconcile any remaining task-board state.",
}

const ARTIFACT_RULES = {
  quick: [
    {
      id: "task_card",
      availableFrom: "quick_plan",
      requiredFrom: null,
      recommendedFrom: "quick_plan",
      optional: true,
      summary: "Optional quick-task traceability card.",
    },
  ],
  migration: [
    {
      id: "architecture",
      availableFrom: "migration_baseline",
      requiredFrom: null,
      recommendedFrom: "migration_strategy",
      optional: true,
      summary: "Migration architecture or compatibility-seam record.",
    },
    {
      id: "plan",
      availableFrom: "migration_strategy",
      requiredFrom: null,
      recommendedFrom: "migration_upgrade",
      optional: true,
      summary: "Migration plan for staged upgrade slices.",
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
      id: "brief",
      availableFrom: "full_brief",
      requiredFrom: "full_spec",
      recommendedFrom: "full_brief",
      optional: false,
      summary: "Product brief for the full-delivery work item.",
    },
    {
      id: "spec",
      availableFrom: "full_spec",
      requiredFrom: "full_architecture",
      recommendedFrom: "full_spec",
      optional: false,
      summary: "Behavioral specification and acceptance criteria.",
    },
    {
      id: "architecture",
      availableFrom: "full_architecture",
      requiredFrom: "full_plan",
      recommendedFrom: "full_architecture",
      optional: false,
      summary: "Architecture decision and implementation approach.",
    },
    {
      id: "plan",
      availableFrom: "full_plan",
      requiredFrom: "full_implementation",
      recommendedFrom: "full_plan",
      optional: false,
      summary: "Implementation plan for full delivery.",
    },
    {
      id: "qa_report",
      availableFrom: "full_qa",
      requiredFrom: "full_done",
      recommendedFrom: "full_qa",
      optional: false,
      summary: "QA evidence and closure recommendation.",
    },
    {
      id: "adr",
      availableFrom: "full_architecture",
      requiredFrom: null,
      recommendedFrom: "full_architecture",
      optional: true,
      summary: "Optional architecture decision records.",
    },
  ],
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

module.exports = {
  flattenArtifactRefs,
  getArtifactReadiness,
  getNextAction,
  getParallelizationSummary,
  summarizeArtifactReadinessLines,
}
