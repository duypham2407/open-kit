const QUICK_STAGE_SEQUENCE = [
  "quick_intake",
  "quick_plan",
  "quick_build",
  "quick_verify",
  "quick_done",
]

const FULL_STAGE_SEQUENCE = [
  "full_intake",
  "full_brief",
  "full_spec",
  "full_architecture",
  "full_plan",
  "full_implementation",
  "full_qa",
  "full_done",
]

const MIGRATION_STAGE_SEQUENCE = [
  "migration_intake",
  "migration_baseline",
  "migration_strategy",
  "migration_upgrade",
  "migration_verify",
  "migration_done",
]

const STAGE_SEQUENCE = [...QUICK_STAGE_SEQUENCE, ...MIGRATION_STAGE_SEQUENCE, ...FULL_STAGE_SEQUENCE]

const STAGE_OWNERS = {
  quick_intake: "MasterOrchestrator",
  quick_plan: "MasterOrchestrator",
  quick_build: "FullstackAgent",
  quick_verify: "QAAgent",
  quick_done: "MasterOrchestrator",
  migration_intake: "MasterOrchestrator",
  migration_baseline: "ArchitectAgent",
  migration_strategy: "TechLeadAgent",
  migration_upgrade: "FullstackAgent",
  migration_verify: "QAAgent",
  migration_done: "MasterOrchestrator",
  full_intake: "MasterOrchestrator",
  full_brief: "PMAgent",
  full_spec: "BAAgent",
  full_architecture: "ArchitectAgent",
  full_plan: "TechLeadAgent",
  full_implementation: "FullstackAgent",
  full_qa: "QAAgent",
  full_done: "MasterOrchestrator",
}

const MODE_VALUES = ["quick", "migration", "full"]

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
    "upgrade_to_verify",
    "migration_verified",
  ],
  full: [
    "pm_to_ba",
    "ba_to_architect",
    "architect_to_tech_lead",
    "tech_lead_to_fullstack",
    "fullstack_to_qa",
    "qa_to_done",
  ],
}

const TRANSITION_GATES = {
  quick: {
    "quick_verify->quick_done": "quick_verified",
  },
  migration: {
    "migration_baseline->migration_strategy": "baseline_to_strategy",
    "migration_strategy->migration_upgrade": "strategy_to_upgrade",
    "migration_upgrade->migration_verify": "upgrade_to_verify",
    "migration_verify->migration_done": "migration_verified",
  },
  full: {
    "full_brief->full_spec": "pm_to_ba",
    "full_spec->full_architecture": "ba_to_architect",
    "full_architecture->full_plan": "architect_to_tech_lead",
    "full_plan->full_implementation": "tech_lead_to_fullstack",
    "full_implementation->full_qa": "fullstack_to_qa",
    "full_qa->full_done": "qa_to_done",
  },
}

const STATUS_VALUES = ["idle", "in_progress", "blocked", "done"]

const ARTIFACT_KINDS = ["task_card", "brief", "spec", "architecture", "plan", "migration_report", "qa_report", "adr"]

const ISSUE_TYPES = ["bug", "design_flaw", "requirement_gap"]
const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"]
const ROOTED_IN_VALUES = ["implementation", "architecture", "requirements"]

const RECOMMENDED_OWNERS = {
  bug: ["FullstackAgent"],
  design_flaw: ["ArchitectAgent", "TechLeadAgent", "MasterOrchestrator"],
  requirement_gap: ["BAAgent", "MasterOrchestrator"],
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
    brief: null,
    spec: null,
    architecture: null,
    plan: null,
    migration_report: null,
    qa_report: null,
    adr: [],
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

function getReworkRoute(mode, issueType) {
  if (mode === "quick") {
    if (issueType === "bug") {
      return {
        mode: "quick",
        stage: "quick_build",
        owner: STAGE_OWNERS.quick_build,
        escalate: false,
      }
    }

    if (issueType === "design_flaw" || issueType === "requirement_gap") {
      return {
        mode: "full",
        stage: "full_intake",
        owner: STAGE_OWNERS.full_intake,
        escalate: true,
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
        stage: "full_architecture",
        owner: STAGE_OWNERS.full_architecture,
        escalate: false,
      }
    }

    if (issueType === "requirement_gap") {
      return {
        mode: "full",
        stage: "full_spec",
        owner: STAGE_OWNERS.full_spec,
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
  ISSUE_TYPES,
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
}
