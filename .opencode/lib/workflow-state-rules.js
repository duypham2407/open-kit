const STAGE_SEQUENCE = [
  "intake",
  "brief",
  "spec",
  "architecture",
  "plan",
  "implementation",
  "qa",
  "done",
]

const STAGE_OWNERS = {
  intake: "MasterOrchestrator",
  brief: "PMAgent",
  spec: "BAAgent",
  architecture: "ArchitectAgent",
  plan: "TechLeadAgent",
  implementation: "FullstackAgent",
  qa: "QAAgent",
  done: "MasterOrchestrator",
}

const TRANSITION_GATES = {
  "brief->spec": "pm_to_ba",
  "spec->architecture": "ba_to_architect",
  "architecture->plan": "architect_to_tech_lead",
  "plan->implementation": "tech_lead_to_fullstack",
  "implementation->qa": "fullstack_to_qa",
  "qa->done": "qa_to_done",
}

const APPROVAL_GATES = [
  "pm_to_ba",
  "ba_to_architect",
  "architect_to_tech_lead",
  "tech_lead_to_fullstack",
  "fullstack_to_qa",
  "qa_to_done",
]

const STATUS_VALUES = ["idle", "in_progress", "blocked", "done"]

const ARTIFACT_KINDS = ["brief", "spec", "architecture", "plan", "qa_report", "adr"]

const ISSUE_TYPES = ["bug", "design_flaw", "requirement_gap"]
const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"]
const ROOTED_IN_VALUES = ["implementation", "architecture", "requirements"]

const RECOMMENDED_OWNERS = {
  bug: ["FullstackAgent"],
  design_flaw: ["ArchitectAgent", "TechLeadAgent"],
  requirement_gap: ["BAAgent"],
}

const REWORK_ROUTING = {
  bug: { stage: "implementation", owner: "FullstackAgent" },
  design_flaw: { stage: "architecture", owner: "ArchitectAgent" },
  requirement_gap: { stage: "spec", owner: "BAAgent" },
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

function createEmptyApprovals() {
  return APPROVAL_GATES.reduce((accumulator, gate) => {
    accumulator[gate] = createPendingGate()
    return accumulator
  }, {})
}

function createEmptyArtifacts() {
  return {
    brief: null,
    spec: null,
    architecture: null,
    plan: null,
    qa_report: null,
    adr: [],
  }
}

function getTransitionGate(fromStage, toStage) {
  return TRANSITION_GATES[`${fromStage}->${toStage}`] ?? null
}

function getNextStage(currentStage) {
  const index = STAGE_SEQUENCE.indexOf(currentStage)
  if (index === -1 || index === STAGE_SEQUENCE.length - 1) {
    return null
  }

  return STAGE_SEQUENCE[index + 1]
}

module.exports = {
  APPROVAL_GATES,
  ARTIFACT_KINDS,
  ESCALATION_RETRY_THRESHOLD,
  ISSUE_SEVERITIES,
  ISSUE_TYPES,
  RECOMMENDED_OWNERS,
  REWORK_ROUTING,
  ROOTED_IN_VALUES,
  STAGE_OWNERS,
  STAGE_SEQUENCE,
  STATUS_VALUES,
  TRANSITION_GATES,
  createEmptyApprovals,
  createEmptyArtifacts,
  createPendingGate,
  getNextStage,
  getTransitionGate,
}
