const QUICK_STAGE_SEQUENCE = [
  "quick_intake",
  "quick_brainstorm",
  "quick_plan",
  "quick_implement",
  "quick_test",
  "quick_done",
]

const FULL_STAGE_SEQUENCE = [
  "full_intake",
  "full_product",
  "full_solution",
  "full_implementation",
  "full_code_review",
  "full_qa",
  "full_done",
]

const MIGRATION_STAGE_SEQUENCE = [
  "migration_intake",
  "migration_baseline",
  "migration_strategy",
  "migration_upgrade",
  "migration_code_review",
  "migration_verify",
  "migration_done",
]

const STAGE_SEQUENCE = [...QUICK_STAGE_SEQUENCE, ...MIGRATION_STAGE_SEQUENCE, ...FULL_STAGE_SEQUENCE]

const STAGE_OWNERS = {
  quick_intake: "QuickAgent",
  quick_brainstorm: "QuickAgent",
  quick_plan: "QuickAgent",
  quick_implement: "QuickAgent",
  quick_test: "QuickAgent",
  quick_done: "QuickAgent",
  migration_intake: "MasterOrchestrator",
  migration_baseline: "SolutionLead",
  migration_strategy: "SolutionLead",
  migration_upgrade: "FullstackAgent",
  migration_code_review: "CodeReviewer",
  migration_verify: "QAAgent",
  migration_done: "MasterOrchestrator",
  full_intake: "MasterOrchestrator",
  full_product: "ProductLead",
  full_solution: "SolutionLead",
  full_implementation: "FullstackAgent",
  full_code_review: "CodeReviewer",
  full_qa: "QAAgent",
  full_done: "MasterOrchestrator",
}

const MODE_VALUES = ["quick", "migration", "full"]
const LANE_SOURCE_VALUES = ["orchestrator_routed", "user_explicit"]

const ROUTING_WORK_INTENT_VALUES = ["maintenance", "modernization", "feature"]
const ROUTING_BEHAVIOR_DELTA_VALUES = ["preserve", "extend", "redefine"]
const ROUTING_DOMINANT_UNCERTAINTY_VALUES = ["low_local", "compatibility", "product"]
const ROUTING_SCOPE_SHAPE_VALUES = ["local", "adjacent", "cross_boundary"]

const MODE_STAGE_SEQUENCES = {
  quick: QUICK_STAGE_SEQUENCE,
  migration: MIGRATION_STAGE_SEQUENCE,
  full: FULL_STAGE_SEQUENCE,
}

const MODE_APPROVAL_GATES = {
  quick: ["quick_verified"],
  migration: [
    "baseline_to_strategy",
    "strategy_to_upgrade",
    "upgrade_to_code_review",
    "code_review_to_verify",
    "migration_verified",
  ],
  full: [
    "product_to_solution",
    "solution_to_fullstack",
    "fullstack_to_code_review",
    "code_review_to_qa",
    "qa_to_done",
  ],
}

const TRANSITION_GATES = {
  quick: {
    "quick_test->quick_done": "quick_verified",
  },
  migration: {
    "migration_baseline->migration_strategy": "baseline_to_strategy",
    "migration_strategy->migration_upgrade": "strategy_to_upgrade",
    "migration_upgrade->migration_code_review": "upgrade_to_code_review",
    "migration_code_review->migration_verify": "code_review_to_verify",
    "migration_verify->migration_done": "migration_verified",
  },
  full: {
    "full_product->full_solution": "product_to_solution",
    "full_solution->full_implementation": "solution_to_fullstack",
    "full_implementation->full_code_review": "fullstack_to_code_review",
    "full_code_review->full_qa": "code_review_to_qa",
    "full_qa->full_done": "qa_to_done",
  },
}

const STATUS_VALUES = ["idle", "in_progress", "blocked", "done"]
const PARALLEL_MODES = ["none", "limited", "enabled"]

const ARTIFACT_KINDS = [
  "task_card",
  "scope_package",
  "solution_package",
  "migration_report",
  "qa_report",
  "adr",
]

const ISSUE_TYPES = ["bug", "design_flaw", "requirement_gap"]
const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"]
const ISSUE_STATUS_VALUES = ["open", "in_progress", "resolved", "closed"]
const ROOTED_IN_VALUES = ["implementation", "architecture", "requirements"]

const VERIFICATION_EVIDENCE_KINDS = ["automated", "manual", "runtime", "review"]

const RECOMMENDED_OWNERS = {
  bug: ["FullstackAgent"],
  design_flaw: ["SolutionLead", "MasterOrchestrator"],
  requirement_gap: ["ProductLead", "MasterOrchestrator"],
}

const ESCALATION_RETRY_THRESHOLD = 3

function createPendingGate() {
  return {
    status: "pending",
    approved_by: null,
    approved_at: null,
    notes: null,
  }
}

function createEmptyApprovals(mode) {
  return getApprovalGatesForMode(mode).reduce((accumulator, gate) => {
    accumulator[gate] = createPendingGate()
    return accumulator
  }, {})
}

function createEmptyArtifacts() {
  return {
    task_card: null,
    scope_package: null,
    solution_package: null,
    migration_report: null,
    qa_report: null,
    adr: [],
  }
}

function createDefaultParallelization(mode) {
  return {
    parallel_mode: mode === "quick" ? "none" : "none",
    why: null,
    safe_parallel_zones: [],
    sequential_constraints: [],
    integration_checkpoint: null,
    max_active_execution_tracks: null,
  }
}

function createDefaultRoutingProfile(mode, selectionReason) {
  if (mode === "quick") {
    return {
      work_intent: "maintenance",
      behavior_delta: "preserve",
      dominant_uncertainty: "low_local",
      scope_shape: "local",
      selection_reason: selectionReason,
    }
  }

  if (mode === "migration") {
    return {
      work_intent: "modernization",
      behavior_delta: "preserve",
      dominant_uncertainty: "compatibility",
      scope_shape: "adjacent",
      selection_reason: selectionReason,
    }
  }

  return {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: selectionReason,
  }
}

function createDefaultMigrationContext() {
  return {
    baseline_summary: null,
    target_outcome: null,
    preserved_invariants: [],
    allowed_behavior_changes: [],
    compatibility_hotspots: [],
    baseline_evidence_refs: [],
    rollback_checkpoints: [],
  }
}

function getApprovalGatesForMode(mode) {
  return MODE_APPROVAL_GATES[mode] ?? []
}

function getInitialStageForMode(mode) {
  const sequence = MODE_STAGE_SEQUENCES[mode] ?? []
  return sequence[0] ?? null
}

function getModeForStage(stage) {
  if (QUICK_STAGE_SEQUENCE.includes(stage)) {
    return "quick"
  }

  if (FULL_STAGE_SEQUENCE.includes(stage)) {
    return "full"
  }

  if (MIGRATION_STAGE_SEQUENCE.includes(stage)) {
    return "migration"
  }

  return null
}

function getNextStage(mode, currentStage) {
  const sequence = MODE_STAGE_SEQUENCES[mode] ?? []
  const index = sequence.indexOf(currentStage)
  if (index === -1 || index === sequence.length - 1) {
    return null
  }

  return sequence[index + 1]
}

function getTransitionGate(mode, fromStage, toStage) {
  return TRANSITION_GATES[mode]?.[`${fromStage}->${toStage}`] ?? null
}

function getReworkRoute(mode, issueType, laneSource = "orchestrator_routed") {
  if (mode === "quick") {
    if (issueType === "bug") {
      return {
        mode: "quick",
        stage: "quick_test",
        owner: STAGE_OWNERS.quick_test,
        escalate: false,
      }
    }

    if (issueType === "design_flaw" || issueType === "requirement_gap") {
      return {
        mode: "quick",
        stage: "quick_test",
        owner: STAGE_OWNERS.quick_test,
        escalate: false,
        reportToUser: true,
      }
    }
  }

  if (mode === "full") {
    if (issueType === "bug") {
      return {
        mode: "full",
        stage: "full_implementation",
        owner: STAGE_OWNERS.full_implementation,
        escalate: false,
      }
    }

    if (issueType === "design_flaw") {
      return {
        mode: "full",
        stage: "full_solution",
        owner: STAGE_OWNERS.full_solution,
        escalate: false,
      }
    }

    if (issueType === "requirement_gap") {
      return {
        mode: "full",
        stage: "full_product",
        owner: STAGE_OWNERS.full_product,
        escalate: false,
      }
    }
  }

  if (mode === "migration") {
    if (issueType === "bug") {
      return {
        mode: "migration",
        stage: "migration_upgrade",
        owner: STAGE_OWNERS.migration_upgrade,
        escalate: false,
      }
    }

    if (issueType === "design_flaw") {
      return {
        mode: "migration",
        stage: "migration_strategy",
        owner: STAGE_OWNERS.migration_strategy,
        escalate: false,
      }
    }

    if (issueType === "requirement_gap") {
      if (laneSource === "user_explicit") {
        return {
          mode: "migration",
          stage: "migration_verify",
          owner: STAGE_OWNERS.migration_verify,
          escalate: false,
          reportToUser: true,
          blocked: true,
        }
      }

      return {
        mode: "full",
        stage: "full_intake",
        owner: STAGE_OWNERS.full_intake,
        escalate: true,
      }
    }
  }

  return null
}

module.exports = {
  ARTIFACT_KINDS,
  ESCALATION_RETRY_THRESHOLD,
  FULL_STAGE_SEQUENCE,
  ISSUE_SEVERITIES,
  ISSUE_STATUS_VALUES,
  ISSUE_TYPES,
  LANE_SOURCE_VALUES,
  MIGRATION_STAGE_SEQUENCE,
  MODE_APPROVAL_GATES,
  MODE_STAGE_SEQUENCES,
  MODE_VALUES,
  QUICK_STAGE_SEQUENCE,
  RECOMMENDED_OWNERS,
  ROOTED_IN_VALUES,
  ROUTING_BEHAVIOR_DELTA_VALUES,
  ROUTING_DOMINANT_UNCERTAINTY_VALUES,
  ROUTING_SCOPE_SHAPE_VALUES,
  ROUTING_WORK_INTENT_VALUES,
  STAGE_OWNERS,
  STAGE_SEQUENCE,
  STATUS_VALUES,
  TRANSITION_GATES,
  VERIFICATION_EVIDENCE_KINDS,
  createDefaultMigrationContext,
  createDefaultRoutingProfile,
  createEmptyApprovals,
  createEmptyArtifacts,
  createPendingGate,
  getApprovalGatesForMode,
  getInitialStageForMode,
  getModeForStage,
  getNextStage,
  getReworkRoute,
  getTransitionGate,
  PARALLEL_MODES,
  createDefaultParallelization,
}
