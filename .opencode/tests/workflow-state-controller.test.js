import test, { beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import {
  advanceStage,
  assignQaOwner,
  addReleaseWorkItem,
  cleanupWorkItemWorktree,
  clearVerificationEvidence,
  claimTask,
  claimMigrationSlice,
  createReleaseCandidate,
  createTask as createBoardTask,
  createMigrationSlice,
  draftReleaseNotes,
  getDefinitionOfDone,
  getInvocationLog,
  getIssueAgingReport,
  getOpsSummary,
  getPolicyExecutionTrace,
  getPolicyStatus,
  getReleaseCandidateReadiness,
  getReleaseDashboard,
  getReleaseReadiness,
  getRuntimeShortSummary,
  getWorkItemCloseoutSummary,
  getTaskAgingReport,
  getWorkflowAnalytics,
  getWorkflowMetrics,
  linkArtifact,
  listReleaseCandidates,
  listStaleIssues,
  recordRollbackPlan,
  recordIssue,
  recordVerificationEvidence,
  removeReleaseWorkItem,
  reassignTask,
  releaseTask,
  routeRework,
  setReleaseApproval,
  setReleaseStatus,
  setRoutingProfile,
  setParallelization,
  setMigrationSliceStatus,
  setTaskStatus,
  showState,
  showReleaseCandidate,
  showWorkItemState,
  selectActiveWorkItem,
  setApproval,
  startHotfix,
  startFeature,
  startTask,
  updateIssueStatus,
  validateHotfix,
  validateReleaseNotes,
  validateState,
  validateWorkItemBoard,
  _overrideWorkItemStore,
  _resetWorkItemStore,
} from "../lib/workflow-state-controller.js"
import * as workItemStore from "../lib/work-item-store.js"
import { readSupervisorDialogueStore } from "../lib/supervisor-dialogue-store.js"
import { createInvocationLogger, resolveLogPath } from "../lib/invocation-log.js"
import { checkPolicy, enforcePolicy, TOOL_INVOCATION_POLICIES } from "../lib/policy-engine.js"

// Destructure frequently used exports from the work-item-store namespace
const { readWorkItemIndex, readWorkItemState } = workItemStore

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-state-"))
}

function loadFixtureState() {
  const fixturePath = path.resolve(__dirname, "../workflow-state.json")
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"))
}

function createTempStateFile() {
  const dir = makeTempDir()
  const opencodeDir = path.join(dir, ".opencode")
  const templatesDir = path.join(dir, "docs", "templates")
  fs.mkdirSync(path.join(dir, "docs", "scope"), { recursive: true })
  fs.mkdirSync(path.join(dir, "docs", "solution"), { recursive: true })
  fs.mkdirSync(path.join(dir, "docs", "qa"), { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.mkdirSync(opencodeDir, { recursive: true })
  for (const template of ["scope-package-template.md", "solution-package-template.md", "migration-solution-package-template.md", "migration-report-template.md"]) {
    fs.copyFileSync(path.resolve(__dirname, "../../docs/templates", template), path.join(templatesDir, template))
  }
  const statePath = path.join(opencodeDir, "workflow-state.json")
  fs.writeFileSync(statePath, `${JSON.stringify(loadFixtureState(), null, 2)}\n`, "utf8")
  return statePath
}

function withEnv(overrides, callback) {
  const previous = {}
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined
    if (value === null || value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return callback()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Global env isolation
// Clear OPENKIT_ env vars before each test so tests using createTempStateFile
// are not contaminated by the shell environment (e.g. OPENKIT_PROJECT_ROOT,
// OPENKIT_KIT_ROOT, OPENKIT_WORKFLOW_STATE set by openkit run).
// Tests that need specific divergent-root behavior use withEnv() to set them.
// ---------------------------------------------------------------------------
const OPENKIT_ENV_KEYS = [
  "OPENKIT_PROJECT_ROOT",
  "OPENKIT_KIT_ROOT",
  "OPENKIT_WORKFLOW_STATE",
  "OPENKIT_GLOBAL_MODE",
]

let _savedEnv = {}

beforeEach(() => {
  _savedEnv = {}
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      _savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  }
})

afterEach(() => {
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(_savedEnv, key)) {
      process.env[key] = _savedEnv[key]
    } else {
      delete process.env[key]
    }
  }
  _savedEnv = {}
})

function setupDivergentRoots() {
  const projectRoot = makeTempDir()
  const runtimeRoot = makeTempDir()
  const kitRoot = path.join(makeTempDir(), "kit")
  const statePath = path.join(runtimeRoot, ".opencode", "workflow-state.json")
  const templatesDir = path.join(kitRoot, "docs", "templates")

  fs.mkdirSync(path.join(projectRoot, "docs", "scope"), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, "docs", "solution"), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, "docs", "qa"), { recursive: true })
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })

  for (const template of [
    "scope-package-template.md",
    "solution-package-template.md",
    "migration-solution-package-template.md",
    "migration-report-template.md",
  ]) {
    fs.copyFileSync(path.resolve(__dirname, "../../docs/templates", template), path.join(templatesDir, template))
  }

  fs.writeFileSync(statePath, `${JSON.stringify(loadFixtureState(), null, 2)}\n`, "utf8")

  return {
    projectRoot,
    runtimeRoot,
    kitRoot,
    statePath,
  }
}

function writeWorkItemWorktreeMetadata(statePath, workItemId, metadata) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const worktreePath = path.join(projectRoot, ".opencode", "work-items", workItemId, "worktree.json")
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true })
  fs.writeFileSync(worktreePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8")
}

function writeArtifact(statePath, relativePath, content, options = {}) {
  const projectRoot = options.projectRoot ?? path.dirname(path.dirname(statePath))
  const absolutePath = path.join(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${content}\n`, "utf8")
  return relativePath
}

function createTask(overrides = {}) {
  return {
    task_id: "TASK-1",
    title: "Implement controller integration",
    summary: "Add board-aware runtime enforcement",
    kind: "implementation",
    status: "ready",
    primary_owner: null,
    qa_owner: null,
    depends_on: [],
    blocked_by: [],
    artifact_refs: [],
    plan_refs: ["docs/solution/2026-03-21-feature.md"],
    branch_or_worktree: null,
    created_by: "SolutionLead",
    created_at: "2026-03-21T00:00:00.000Z",
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function countGroupsByClassification(groups, classification) {
  return groups.filter((group) => group.classification === classification).length
}

function makeScanEvidenceDetails({
  toolId = "tool.rule-scan",
  scanKind = "rule",
  evidenceType = "direct_tool",
  availabilityState = "available",
  resultState = "succeeded",
  groups = [],
  falsePositiveItems = [],
  manualOverride = null,
  substitute = null,
} = {}) {
  const total = groups.reduce((sum, group) => sum + (group.count ?? 0), 0)
  return {
    validation_surface: "runtime_tooling",
    scan_evidence: {
      evidence_type: evidenceType,
      direct_tool: {
        tool_id: toolId,
        availability_state: availabilityState,
        result_state: resultState,
        reason: availabilityState === "available" ? null : "direct scan tool unavailable in this test",
        invocation_ref: {
          work_item_id: "feature-test",
          entry_id: "invocation-test",
          log_path: ".opencode/work-items/feature-test/tool-invocations.json",
        },
        namespace_status: "callable",
        stale_process: {
          suspected: false,
          affected_surface: "in_session",
          caveat: "No stale role namespace observed in this test fixture.",
        },
      },
      substitute,
      scan_kind: scanKind,
      target_scope_summary: "changed runtime workflow files",
      rule_config_source: "bundled",
      finding_counts: {
        total,
        blocking: countGroupsByClassification(groups, "blocking") + countGroupsByClassification(groups, "true_positive"),
        true_positive: countGroupsByClassification(groups, "true_positive"),
        non_blocking_noise: countGroupsByClassification(groups, "non_blocking_noise"),
        false_positive: countGroupsByClassification(groups, "false_positive"),
        unclassified: countGroupsByClassification(groups, "unclassified"),
      },
      severity_summary: groups.reduce((summary, group) => {
        const severity = group.severity ?? "WARNING"
        summary[severity] = (summary[severity] ?? 0) + (group.count ?? 0)
        return summary
      }, {}),
      triage_summary: {
        groupCount: groups.length,
        blockingCount: countGroupsByClassification(groups, "blocking") + countGroupsByClassification(groups, "true_positive"),
        truePositiveCount: countGroupsByClassification(groups, "true_positive"),
        nonBlockingNoiseCount: countGroupsByClassification(groups, "non_blocking_noise"),
        falsePositiveCount: countGroupsByClassification(groups, "false_positive"),
        followUpCount: countGroupsByClassification(groups, "follow_up"),
        unclassifiedCount: countGroupsByClassification(groups, "unclassified"),
        groups,
      },
      false_positive_summary: {
        count: falsePositiveItems.length,
        items: falsePositiveItems,
      },
      manual_override: manualOverride,
    },
  }
}

function makeValidManualOverrideDetails({
  targetStage = "full_code_review",
  unavailableTool = "tool.rule-scan",
  availabilityState = "unavailable",
  resultState = "unavailable",
} = {}) {
  return makeScanEvidenceDetails({
    toolId: unavailableTool,
    evidenceType: "manual_override",
    availabilityState,
    resultState,
    groups: [],
    substitute: {
      ran: false,
      command_or_tool: null,
      validation_surface: "runtime_tooling",
      limitations: "no substitute scan output available in this environment",
    },
    manualOverride: {
      target_stage: targetStage,
      unavailable_tool: unavailableTool,
      reason: "managed Semgrep executable unavailable",
      substitute_evidence_ids: [],
      substitute_limitations: "no substitute scan output available in this environment",
      actor: "FullstackAgent",
      caveat: "Manual override is exceptional and does not prove target-project app validation.",
    },
  })
}

function writeTaskBoard(statePath, workItemId, board) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "tasks.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
  return boardPath
}

function readSupervisorEvents(statePath, workItemId) {
  const projectRoot = path.dirname(path.dirname(statePath))
  return readSupervisorDialogueStore(projectRoot, workItemId).outbound_events
}

function supervisorEventTypesSince(statePath, workItemId, offset) {
  return readSupervisorEvents(statePath, workItemId)
    .slice(offset)
    .map((event) => event.event_type)
}

function writeMigrationSliceBoard(statePath, workItemId, board) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "migration-slices.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
  return boardPath
}

function writeInvocationLogEntries(statePath, workItemId, entries) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const logPath = resolveLogPath(projectRoot, workItemId)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8")
}

function seedFeature001State(statePath, mutator) {
  validateState(statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const workItemStatePath = path.join(projectRoot, ".opencode", "work-items", "feature-001", "state.json")
  const state = JSON.parse(fs.readFileSync(workItemStatePath, "utf8"))
  mutator(state)
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  return state
}

function createWorkflowIssue(overrides = {}) {
  return {
    issue_id: "ISSUE-1",
    title: "Workflow issue fixture",
    type: "bug",
    severity: "high",
    rooted_in: "implementation",
    recommended_owner: "FullstackAgent",
    evidence: "regression fixture",
    artifact_refs: [],
    current_status: "open",
    opened_at: "2026-03-21T00:00:00.000Z",
    last_updated_at: "2026-03-21T00:00:00.000Z",
    reopen_count: 0,
    repeat_count: 0,
    blocked_since: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function createCloseoutReadyBoard(overrides = {}) {
  return {
    mode: "full",
    current_stage: "full_done",
    tasks: [
      createTask({
        task_id: "CLOSEOUT-1",
        title: "Implemented closeout fix",
        status: "done",
        primary_owner: "FullstackAgent",
        qa_owner: "QAAgent",
      }),
      createTask({
        task_id: "CLOSEOUT-2",
        title: "Cancelled optional follow-up",
        status: "cancelled",
      }),
    ],
    issues: [],
    ...overrides,
  }
}

function setWorkItemField(statePath, workItemId, field, value) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const wiStatePath = path.join(projectRoot, ".opencode", "work-items", workItemId, "state.json")
  const wiState = JSON.parse(fs.readFileSync(wiStatePath, "utf8"))
  wiState[field] = value
  fs.writeFileSync(wiStatePath, `${JSON.stringify(wiState, null, 2)}\n`, "utf8")
  // Also update the compatibility mirror to keep revision in sync
  fs.writeFileSync(statePath, `${JSON.stringify(wiState, null, 2)}\n`, "utf8")
}

function createMigrationSliceRecord(overrides = {}) {
  return {
    slice_id: "SLICE-1",
    title: "Compatibility seam",
    summary: "Preserve behavior while upgrading integration seam",
    kind: "compatibility",
    status: "ready",
    primary_owner: null,
    qa_owner: null,
    depends_on: [],
    blocked_by: [],
    artifact_refs: ["src/adapters/seam.ts"],
    preserved_invariants: ["existing runtime behavior"],
    compatibility_risks: ["seam drift"],
    verification_targets: ["parity smoke"],
    rollback_notes: ["revert seam changes"],
    created_by: "SolutionLead",
    created_at: "2026-03-21T00:00:00.000Z",
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function advanceMigrationWorkItemToStrategy(statePath, featureSlug = "migration-flow") {
  const state = showState(statePath).state
  writeArtifact(
    statePath,
    `docs/solution/2026-03-21-${featureSlug}.md`,
    [
      "# Solution Package",
      "",
      "## Goal",
      "",
      "## Preserved Invariants",
      "",
      "## Upgrade Sequence",
      "",
      "## Parity Verification",
      "",
      "## Rollback Notes",
    ].join("\n"),
  )
  advanceStage("migration_baseline", statePath)
  setApproval("baseline_to_strategy", "approved", "MasterOrchestrator", "2026-03-21", "Baseline approved", statePath)
  advanceStage("migration_strategy", statePath)
  linkArtifact("solution_package", `docs/solution/2026-03-21-${state.feature_slug ?? featureSlug}.md`, statePath)
  setApproval("strategy_to_upgrade", "approved", "FullstackAgent", "2026-03-21", "Strategy approved", statePath)
  advanceStage("migration_upgrade", statePath)
}

function advanceFullWorkItemToPlan(statePath) {
  const state = showState(statePath).state
  writeArtifact(
    statePath,
    `docs/scope/2026-03-21-${state.feature_slug}.md`,
    ["# Scope Package", "", "## Goal", "", "## In Scope", "", "## Out of Scope", "", "## Acceptance Criteria Matrix"].join("\n"),
  )
  advanceStage("full_product", statePath)
  linkArtifact("scope_package", `docs/scope/2026-03-21-${state.feature_slug}.md`, statePath)
  setApproval("product_to_solution", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_solution", statePath)
  writeArtifact(
    statePath,
    `docs/solution/2026-03-21-${state.feature_slug}.md`,
    [
      "# Solution Package",
      "",
      "## Recommended Path",
      "",
      "## Impacted Surfaces",
      "",
      "## Implementation Slices",
      "",
      "## Validation Matrix",
      "",
      "## Integration Checkpoint",
    ].join("\n"),
  )
  linkArtifact("solution_package", `docs/solution/2026-03-21-${state.feature_slug}.md`, statePath)
}

test("validateState accepts the shipped hard-split example state", () => {
  const statePath = path.resolve(__dirname, "../workflow-state.json")
  const result = validateState(statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_done")
})

test("startTask initializes quick mode with quick-only approvals", () => {
  const statePath = createTempStateFile()
  const result = startTask("quick", "TASK-123", "update-copy", "Scoped text change", statePath)

  assert.equal(result.state.mode, "quick")
  assert.equal(result.state.mode_reason, "Scoped text change")
  assert.equal(result.state.current_stage, "quick_intake")
  assert.equal(result.state.current_owner, "QuickAgent")
  assert.deepEqual(result.state.routing_profile, {
    work_intent: "maintenance",
    behavior_delta: "preserve",
    dominant_uncertainty: "low_local",
    scope_shape: "local",
    selection_reason: "Scoped text change",
  })
  assert.deepEqual(Object.keys(result.state.approvals), ["quick_verified"])
  assert.equal(result.state.artifacts.task_card, null)
  assert.equal(result.state.escalated_from, null)
  assert.equal(result.state.escalation_reason, null)
})

test("quick mode requires quick_brainstorm before quick_implement", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-129", "needs-plan", "Bounded quick work", statePath)

  assert.throws(() => advanceStage("quick_implement", statePath), /immediate next stage 'quick_brainstorm'/)
})

test("quick_brainstorm becomes the next stage after quick_intake", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-130", "plan-stage", "Live quick plan stage", statePath)
  const result = advanceStage("quick_brainstorm", statePath)

  assert.equal(result.state.current_stage, "quick_brainstorm")
  assert.equal(result.state.current_owner, "QuickAgent")
})

test("entering full_product auto-scaffolds the scope package", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-210", "auto-scope", statePath)
  const result = advanceStage("full_product", statePath)

  assert.match(result.state.artifacts.scope_package, /docs\/scope\/\d{4}-\d{2}-\d{2}-auto-scope\.md$/)
  assert.equal(result.state.last_auto_scaffold.artifact, "scope_package")
  assert.equal(result.state.last_auto_scaffold.stage, "full_product")
  assert.equal(fs.existsSync(path.join(path.dirname(path.dirname(statePath)), result.state.artifacts.scope_package)), true)
})

test("entering full_product auto-scaffolds under projectRoot in divergent-root mode", () => {
  const { projectRoot, runtimeRoot, kitRoot, statePath } = setupDivergentRoots()

  withEnv(
    {
      OPENKIT_PROJECT_ROOT: projectRoot,
      OPENKIT_KIT_ROOT: kitRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
    () => {
      startFeature("FEATURE-510", "auto-scope-divergent", statePath)
      const result = advanceStage("full_product", statePath)
      const artifactPath = result.state.artifacts.scope_package

      assert.match(artifactPath, /docs\/scope\/\d{4}-\d{2}-\d{2}-auto-scope-divergent\.md$/)
      assert.equal(fs.existsSync(path.join(projectRoot, artifactPath)), true)
      assert.equal(fs.existsSync(path.join(runtimeRoot, artifactPath)), false)
    },
  )
})

test("entering full_solution auto-scaffolds the solution package", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-211", "auto-solution", statePath)
  advanceStage("full_product", statePath)
  setApproval("product_to_solution", "approved", "user", "2026-03-21", "Approved", statePath)
  const result = advanceStage("full_solution", statePath)

  assert.match(result.state.artifacts.solution_package, /docs\/solution\/\d{4}-\d{2}-\d{2}-auto-solution\.md$/)
  assert.equal(result.state.last_auto_scaffold.artifact, "solution_package")
  assert.equal(result.state.last_auto_scaffold.stage, "full_solution")
  assert.equal(fs.existsSync(path.join(path.dirname(path.dirname(statePath)), result.state.artifacts.solution_package)), true)
})

test("entering full_solution auto-scaffolds under projectRoot in divergent-root mode", () => {
  const { projectRoot, runtimeRoot, kitRoot, statePath } = setupDivergentRoots()

  withEnv(
    {
      OPENKIT_PROJECT_ROOT: projectRoot,
      OPENKIT_KIT_ROOT: kitRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
    () => {
      startFeature("FEATURE-511", "auto-solution-divergent", statePath)
      advanceStage("full_product", statePath)
      setApproval("product_to_solution", "approved", "user", "2026-03-21", "Approved", statePath)
      const result = advanceStage("full_solution", statePath)
      const artifactPath = result.state.artifacts.solution_package

      assert.match(artifactPath, /docs\/solution\/\d{4}-\d{2}-\d{2}-auto-solution-divergent\.md$/)
      assert.equal(fs.existsSync(path.join(projectRoot, artifactPath)), true)
      assert.equal(fs.existsSync(path.join(runtimeRoot, artifactPath)), false)
    },
  )
})

test("linkArtifact resolves relative paths against projectRoot in divergent-root mode", () => {
  const { projectRoot, runtimeRoot, kitRoot, statePath } = setupDivergentRoots()

  withEnv(
    {
      OPENKIT_PROJECT_ROOT: projectRoot,
      OPENKIT_KIT_ROOT: kitRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
    () => {
      startFeature("FEATURE-512", "link-project-root", statePath)
      advanceStage("full_product", statePath)

      const linkedPath = "docs/scope/2026-03-21-link-project-root.md"
      writeArtifact(
        statePath,
        linkedPath,
        ["# Scope Package", "", "## Goal", "", "## In Scope", "", "## Out of Scope", "", "## Acceptance Criteria Matrix"].join("\n"),
        { projectRoot },
      )

      assert.equal(fs.existsSync(path.join(projectRoot, linkedPath)), true)
      assert.equal(fs.existsSync(path.join(runtimeRoot, linkedPath)), false)

      const result = linkArtifact("scope_package", linkedPath, statePath)
      assert.equal(result.state.artifacts.scope_package, linkedPath)
    },
  )
})

test("full mode rejects linking solution_package before full_solution", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-212", "premature-solution", statePath)
  const state = showState(statePath).state
  writeArtifact(
    statePath,
    `docs/solution/2026-03-21-${state.feature_slug}.md`,
    [
      "# Solution Package",
      "",
      "## Recommended Path",
      "",
      "## Impacted Surfaces",
      "",
      "## Implementation Slices",
      "",
      "## Validation Matrix",
      "",
      "## Integration Checkpoint",
    ].join("\n"),
  )

  assert.throws(
    () => linkArtifact("solution_package", `docs/solution/2026-03-21-${state.feature_slug}.md`, statePath),
    /cannot be linked before stage 'full_solution'/,
  )
})

test("quick_done requires quick_verified approval", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-124", "verify-copy", "Copy verification task", statePath)
  advanceStage("quick_brainstorm", statePath)
  advanceStage("quick_plan", statePath)
  advanceStage("quick_implement", statePath)
  advanceStage("quick_test", statePath)

  assert.throws(() => advanceStage("quick_done", statePath), /quick_verified/)

  setApproval("quick_verified", "approved", "QuickAgent", "2026-03-21", "Quick Agent verified", statePath)
  recordVerificationEvidence(
    {
      id: "quick-agent-gate",
      kind: "manual",
      scope: "quick_test",
      summary: "Quick Agent verification pass",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-agent-runtime",
      kind: "runtime",
      scope: "quick_test",
      summary: "Runtime smoke path completed",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-agent-automated",
      kind: "automated",
      scope: "quick_test",
      summary: "Targeted automated check completed",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  const result = advanceStage("quick_done", statePath)

  assert.equal(result.state.current_stage, "quick_done")
  assert.equal(result.state.status, "done")
})

test("quick_done also requires verification evidence", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-131", "verify-evidence", "Quick QA evidence gate", statePath)
  advanceStage("quick_brainstorm", statePath)
  advanceStage("quick_plan", statePath)
  advanceStage("quick_implement", statePath)
  advanceStage("quick_test", statePath)
  setApproval("quick_verified", "approved", "QuickAgent", "2026-03-21", "Quick Agent verified", statePath)

  assert.throws(() => advanceStage("quick_done", statePath), /missing verification evidence/)

  recordVerificationEvidence(
    {
      id: "quick-agent-evidence",
      kind: "manual",
      scope: "quick_test",
      summary: "Checked bounded acceptance bullets manually",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-agent-runtime-evidence",
      kind: "runtime",
      scope: "quick_test",
      summary: "Runtime validation completed",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-agent-automated-evidence",
      kind: "automated",
      scope: "quick_test",
      summary: "Automated validation completed",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )

  const result = advanceStage("quick_done", statePath)
  assert.equal(result.state.current_stage, "quick_done")
})

test("linkArtifact supports quick task cards", () => {
  const statePath = createTempStateFile()
  const dir = makeTempDir()
  const taskCardPath = path.join(dir, "2026-03-21-update-copy.md")

  fs.writeFileSync(taskCardPath, "# Quick Task\n", "utf8")
  startTask("quick", "TASK-125", "task-card", "Quick task artifact link", statePath)

  const result = linkArtifact("task_card", taskCardPath, statePath)

  assert.equal(result.state.artifacts.task_card, taskCardPath)
})

test("routeRework keeps quick design flaws inside quick mode and reports to user", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-126", "needs-spec", "Started as a quick task", statePath)
  const result = routeRework("design_flaw", false, statePath)

  // Quick Agent does not auto-escalate design flaws; it reports to user and stays in quick_test
  assert.equal(result.state.mode, "quick")
  assert.equal(result.state.current_stage, "quick_test")
  assert.equal(result.state.current_owner, "QuickAgent")
  assert.equal(result.state.escalated_from, null)
  assert.deepEqual(Object.keys(result.state.approvals), ["quick_verified"])
})

test("routeRework keeps full-mode bugs in full implementation", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-200", "dashboard-v2", "Feature-sized workflow", statePath)
  const result = routeRework("bug", true, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_implementation")
  assert.equal(result.state.current_owner, "FullstackAgent")
  assert.equal(result.state.retry_count, 1)
})

test("startTask initializes migration mode with migration approvals", () => {
  const statePath = createTempStateFile()
  const result = startTask("migration", "MIGRATE-100", "react-19-upgrade", "Upgrade React stack safely", statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_intake")
  assert.equal(result.state.current_owner, "MasterOrchestrator")
  assert.deepEqual(result.state.routing_profile, {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "Upgrade React stack safely",
  })
  assert.equal(result.state.lane_source, "orchestrator_routed")
  assert.deepEqual(result.state.migration_context, {
    baseline_summary: null,
    target_outcome: null,
    preserved_invariants: [],
    allowed_behavior_changes: [],
    compatibility_hotspots: [],
    baseline_evidence_refs: [],
    rollback_checkpoints: [],
  })
  assert.deepEqual(Object.keys(result.state.approvals), [
    "baseline_to_strategy",
    "strategy_to_upgrade",
    "upgrade_to_code_review",
    "code_review_to_verify",
    "migration_verified",
  ])
})

test("migration mode advances through its canonical stage chain", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-101", "legacy-refresh", "Legacy stack refresh", statePath)

  let result = advanceStage("migration_baseline", statePath)
  assert.equal(result.state.current_owner, "SolutionLead")

  setApproval("baseline_to_strategy", "approved", "MasterOrchestrator", "2026-03-21", "Baseline approved", statePath)
  result = advanceStage("migration_strategy", statePath)
  assert.equal(result.state.current_owner, "SolutionLead")

   writeArtifact(
    statePath,
    "docs/solution/2026-03-21-legacy-refresh.md",
    ["# Solution Package", "", "## Goal", "", "## Preserved Invariants", "", "## Upgrade Sequence", "", "## Parity Verification", "", "## Rollback Notes"].join("\n"),
  )
  linkArtifact("solution_package", "docs/solution/2026-03-21-legacy-refresh.md", statePath)

  setApproval("strategy_to_upgrade", "approved", "FullstackAgent", "2026-03-21", "Strategy approved", statePath)
  result = advanceStage("migration_upgrade", statePath)
  assert.equal(result.state.current_owner, "FullstackAgent")

  setApproval("upgrade_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Upgrade ready for review", statePath)
  recordVerificationEvidence(
    {
      id: "migration-rule-scan",
      kind: "automated",
      scope: "migration_upgrade",
      summary: "Rule scan on migrated files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "migrate-101", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  result = advanceStage("migration_code_review", statePath)
  assert.equal(result.state.current_owner, "CodeReviewer")

  setApproval("code_review_to_verify", "approved", "QAAgent", "2026-03-21", "Reviewed and ready for QA", statePath)
  recordVerificationEvidence(
    {
      id: "migration-review",
      kind: "review",
      scope: "migration_code_review",
      summary: "Migration code review completed",
      source: "migration-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  result = advanceStage("migration_verify", statePath)
  assert.equal(result.state.current_owner, "QAAgent")

  setApproval("migration_verified", "approved", "QAAgent", "2026-03-21", "Migration verified", statePath)
  recordVerificationEvidence(
    {
      id: "migration-parity-check",
      kind: "manual",
      scope: "migration_verify",
      summary: "Parity and compatibility checks reviewed",
      source: "migration-qa",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "migration-runtime-check",
      kind: "runtime",
      scope: "migration_verify",
      summary: "Runtime compatibility smoke checks passed",
      source: "migration-qa",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "migration-automated-check",
      kind: "automated",
      scope: "migration_verify",
      summary: "Automated regression checks passed",
      source: "migration-qa",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  result = advanceStage("migration_done", statePath)
  assert.equal(result.state.current_stage, "migration_done")
  assert.equal(result.state.status, "done")
})

test("migration_code_review is blocked when migration slices are still incomplete", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-120", "migration-review-gate", "Gate migration review on slice completion", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "migration-review-gate")

  createMigrationSlice(
    "migrate-120",
    {
      slice_id: "SLICE-120",
      title: "Compatibility seam",
      kind: "compatibility",
      created_by: "SolutionLead",
    },
    statePath,
  )
  claimMigrationSlice("migrate-120", "SLICE-120", "FullstackAgent", statePath, { requestedBy: "SolutionLead" })
  setMigrationSliceStatus("migrate-120", "SLICE-120", "in_progress", statePath)
  setApproval("upgrade_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Upgrade ready for review", statePath)

  assert.throws(
    () => advanceStage("migration_code_review", statePath),
    /active migration slices remain: SLICE-120/,
  )
})

test("migration_done is blocked until migration slices are verified or cancelled", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-121", "migration-done-gate", "Gate migration completion on slice verification", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "migration-done-gate")

  writeMigrationSliceBoard(statePath, "migrate-121", {
    mode: "migration",
    current_stage: "migration_upgrade",
    parallel_mode: "limited",
    slices: [
      createMigrationSliceRecord({
        slice_id: "SLICE-121",
        status: "verified",
        primary_owner: "FullstackAgent",
        qa_owner: "QAAgent",
      }),
    ],
    issues: [],
  })
  setApproval("upgrade_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Upgrade ready for review", statePath)
  recordVerificationEvidence(
    {
      id: "migration-rule-scan-121",
      kind: "automated",
      scope: "migration_upgrade",
      summary: "Rule scan on migrated files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "migrate-121", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  advanceStage("migration_code_review", statePath)

  setApproval("code_review_to_verify", "approved", "QAAgent", "2026-03-21", "Reviewed and ready for QA", statePath)
  recordVerificationEvidence(
    {
      id: "migration-review-121",
      kind: "review",
      scope: "migration_code_review",
      summary: "Migration code review completed",
      source: "migration-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  advanceStage("migration_verify", statePath)
  setApproval("migration_verified", "approved", "QAAgent", "2026-03-21", "Migration verified", statePath)
  recordVerificationEvidence(
    {
      id: "migration-parity-check-121",
      kind: "manual",
      scope: "migration_verify",
      summary: "Parity and compatibility checks reviewed",
      source: "migration-qa",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )

  writeMigrationSliceBoard(statePath, "migrate-121", {
    mode: "migration",
    current_stage: "migration_verify",
    parallel_mode: "limited",
    slices: [createMigrationSliceRecord({ slice_id: "SLICE-121", status: "parity_ready", primary_owner: "FullstackAgent" })],
    issues: [],
  })

  assert.throws(
    () => advanceStage("migration_done", statePath),
    /incomplete migration slices remain: SLICE-121/,
  )
})

test("definition of done and release readiness report migration slice blockers", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-122", "migration-dod", "Report migration slice blockers in closure checks", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "migration-dod")

  writeMigrationSliceBoard(statePath, "migrate-122", {
    mode: "migration",
    current_stage: "migration_upgrade",
    parallel_mode: "limited",
    slices: [createMigrationSliceRecord({ slice_id: "SLICE-122", status: "parity_ready", primary_owner: "FullstackAgent" })],
    issues: [],
  })

  const dod = getDefinitionOfDone(statePath)
  assert.equal(dod.ready, false)
  assert.deepEqual(dod.migrationSliceBlockers, ["migration slices incomplete: SLICE-122"])

  const readiness = getReleaseReadiness(statePath)
  assert.equal(readiness.releaseReady, false)
  assert.ok(readiness.blockers.includes("definition-of-done not satisfied"))
  assert.ok(readiness.blockers.includes("migration slices incomplete: SLICE-122"))
})

test("closeout summary stays not ready while migration slices remain incomplete", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-123", "migration-closeout", "Closeout should reflect migration slice completion", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "migration-closeout")

  writeMigrationSliceBoard(statePath, "migrate-123", {
    mode: "migration",
    current_stage: "migration_done",
    parallel_mode: "limited",
    slices: [createMigrationSliceRecord({ slice_id: "SLICE-123", status: "parity_ready", primary_owner: "FullstackAgent" })],
    issues: [],
  })

  const result = getWorkItemCloseoutSummary("migrate-123", statePath)
  assert.equal(result.readyToClose, false)
  assert.equal(result.migrationSliceBoardReadiness.present, true)
  assert.deepEqual(result.migrationSliceBoardReadiness.incompleteSliceIds, ["SLICE-123"])
})

test("closeout summary treats resolved issues and optional ADR recommendations as non-blocking history", () => {
  const statePath = createTempStateFile()
  seedFeature001State(statePath, (state) => {
    state.issues = [
      createWorkflowIssue({
        issue_id: "ISSUE-RESOLVED",
        title: "Previously severe implementation finding",
        current_status: "resolved",
        blocked_since: null,
      }),
      createWorkflowIssue({
        issue_id: "ISSUE-CLOSED",
        title: "Closed QA finding",
        severity: "medium",
        current_status: "closed",
        blocked_since: null,
      }),
    ]
  })
  writeTaskBoard(statePath, "feature-001", createCloseoutReadyBoard())

  const result = getWorkItemCloseoutSummary("feature-001", statePath)

  assert.equal(result.readyToClose, true)
  assert.deepEqual(result.unresolvedIssues, [])
  assert.equal(result.resolvedIssueHistory.length, 2)
  assert.deepEqual(result.resolvedIssueHistory.map((issue) => issue.issue_id), ["ISSUE-RESOLVED", "ISSUE-CLOSED"])
  assert.deepEqual(result.recommendedArtifacts.map((entry) => entry.artifact), ["adr"])
  assert.ok(result.recommendations.some((entry) => entry.type === "optional_artifact" && entry.artifact === "adr"))
  assert.deepEqual(result.blockers, [])
})

test("closeout summary keeps open issues blocking while preserving resolved issue history", () => {
  const statePath = createTempStateFile()
  seedFeature001State(statePath, (state) => {
    state.issues = [
      createWorkflowIssue({ issue_id: "ISSUE-OPEN", current_status: "open" }),
      createWorkflowIssue({
        issue_id: "ISSUE-RESOLVED",
        current_status: "resolved",
        blocked_since: null,
      }),
    ]
  })
  writeTaskBoard(statePath, "feature-001", createCloseoutReadyBoard())

  const result = getWorkItemCloseoutSummary("feature-001", statePath)

  assert.equal(result.readyToClose, false)
  assert.deepEqual(result.unresolvedIssues.map((issue) => issue.issue_id), ["ISSUE-OPEN"])
  assert.deepEqual(result.resolvedIssueHistory.map((issue) => issue.issue_id), ["ISSUE-RESOLVED"])
  assert.ok(result.blockers.some((blocker) => blocker.reason === "unresolved/open issues: 1"))
})

test("closeout summary reports full_done ready with valid board and scan evidence summary preserved", () => {
  const statePath = createTempStateFile()
  seedFeature001State(statePath, (state) => {
    state.verification_evidence.push({
      id: "closeout-rule-scan",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on closeout readiness files",
      source: "tool.rule-scan",
      command: "tool.rule-scan .opencode/lib/workflow-state-controller.js .opencode/workflow-state.js",
      exit_status: 0,
      artifact_refs: ["artifacts/closeout-rule-scan.json"],
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({ groups: [] }),
    })
  })
  writeTaskBoard(statePath, "feature-001", createCloseoutReadyBoard())

  const result = getWorkItemCloseoutSummary("feature-001", statePath)

  assert.equal(result.readyToClose, true)
  assert.equal(result.taskBoardCloseoutReadiness.present, true)
  assert.equal(result.taskBoardCloseoutReadiness.valid, true)
  assert.deepEqual(result.taskBoardCloseoutReadiness.incompleteTaskIds, [])
  assert.ok(result.scanEvidenceLines.some((line) => line.includes("scan evidence: closeout-rule-scan")))
  assert.ok(result.scanEvidenceLines.some((line) => line.includes("direct tool.rule-scan available/succeeded")))
})

test("closeout summary blocks full_done when task board has incomplete tasks", () => {
  const statePath = createTempStateFile()
  validateState(statePath)
  writeTaskBoard(statePath, "feature-001", createCloseoutReadyBoard({
    tasks: [
      createTask({
        task_id: "CLOSEOUT-ACTIVE",
        title: "Still active implementation work",
        status: "in_progress",
        primary_owner: "FullstackAgent",
      }),
    ],
  }))

  const result = getWorkItemCloseoutSummary("feature-001", statePath)

  assert.equal(result.readyToClose, false)
  assert.equal(result.taskBoardCloseoutReadiness.valid, false)
  assert.deepEqual(result.taskBoardCloseoutReadiness.activeTaskIds, ["CLOSEOUT-ACTIVE"])
  assert.deepEqual(result.taskBoardCloseoutReadiness.incompleteTaskIds, ["CLOSEOUT-ACTIVE"])
  assert.ok(result.blockers.some((blocker) => blocker.type === "task_board"))
})

test("closeout summary blocks missing required artifacts without treating optional ADR as required", () => {
  const statePath = createTempStateFile()
  seedFeature001State(statePath, (state) => {
    state.artifacts.qa_report = null
  })
  writeTaskBoard(statePath, "feature-001", createCloseoutReadyBoard())

  const result = getWorkItemCloseoutSummary("feature-001", statePath)

  assert.equal(result.readyToClose, false)
  assert.deepEqual(result.missingRequiredArtifacts.map((entry) => entry.artifact), ["qa_report"])
  assert.deepEqual(result.recommendedArtifacts.map((entry) => entry.artifact), ["adr"])
  assert.ok(result.blockers.some((blocker) => blocker.type === "missing_required_artifacts"))
  assert.ok(result.recommendations.some((entry) => entry.type === "optional_artifact" && entry.artifact === "adr"))
})

test("entering migration_strategy auto-scaffolds the migration solution package", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-110", "auto-migration-solution", "Migration auto scaffold", statePath)
  advanceStage("migration_baseline", statePath)
  setApproval("baseline_to_strategy", "approved", "MasterOrchestrator", "2026-03-21", "Baseline approved", statePath)
  const result = advanceStage("migration_strategy", statePath)

  assert.match(result.state.artifacts.solution_package, /docs\/solution\/\d{4}-\d{2}-\d{2}-auto-migration-solution\.md$/)
  assert.equal(result.state.last_auto_scaffold.artifact, "solution_package")
  assert.equal(result.state.last_auto_scaffold.stage, "migration_strategy")
  assert.equal(fs.existsSync(path.join(path.dirname(path.dirname(statePath)), result.state.artifacts.solution_package)), true)
})

test("migration design flaws reroute within migration strategy", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-102", "upgrade-routing", "Upgrade routing", statePath)
  const result = routeRework("design_flaw", false, statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_strategy")
  assert.equal(result.state.current_owner, "SolutionLead")
})

test("migration requirement gaps escalate into full delivery when orchestrator routed the lane", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-103", "upgrade-requirements", "Upgrade with requirement ambiguity", statePath)
  const result = routeRework("requirement_gap", false, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.equal(result.state.escalated_from, "migration")
  assert.match(result.state.mode_reason, /Promoted from migration mode/)
  assert.match(result.state.escalation_reason, /migration work escalated/i)
  assert.equal(result.state.routing_profile.dominant_uncertainty, "product")
})

test("migration requirement gaps stay blocked in migration_verify when lane is user_explicit", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-104", "explicit-user-lock", "Upgrade with explicit user-selected lane", statePath)
  const workItemStatePath = path.join(path.dirname(statePath), "work-items", "migrate-104", "state.json")
  const seeded = JSON.parse(fs.readFileSync(workItemStatePath, "utf8"))
  seeded.lane_source = "user_explicit"
  seeded.current_stage = "migration_verify"
  seeded.current_owner = "QAAgent"
  seeded.verification_evidence.push({
    id: "migration-review-proof",
    kind: "review",
    scope: "migration_code_review",
    summary: "Migration review completed before requirement ambiguity surfaced",
    source: "migration-review",
    command: null,
    exit_status: null,
    artifact_refs: [],
    recorded_at: "2026-03-21T00:00:00.000Z",
  })
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(seeded, null, 2)}\n`, "utf8")
  fs.writeFileSync(statePath, `${JSON.stringify(seeded, null, 2)}\n`, "utf8")

  const result = routeRework("requirement_gap", false, statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_verify")
  assert.equal(result.state.current_owner, "QAAgent")
  assert.equal(result.state.status, "blocked")
  assert.equal(result.state.escalated_from, null)
})

test("routeRework blocks after reaching the retry threshold", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-203", "retry-threshold", "Feature workflow with repeated bug", statePath)
  routeRework("bug", true, statePath)
  routeRework("bug", true, statePath)
  const result = routeRework("bug", true, statePath)

  assert.equal(result.state.retry_count, 3)
  assert.equal(result.state.status, "blocked")
  assert.equal(result.state.current_stage, "full_implementation")
})

test("repeated quick failures escalate into full delivery", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-300", "repeat-quick", "Repeated quick failure", statePath)
  routeRework("bug", true, statePath)
  routeRework("bug", true, statePath)
  const result = routeRework("bug", true, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.equal(result.state.escalated_from, "quick")
})

test("recordIssue stores lifecycle metadata and updateIssueStatus tracks reopen state", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-400", "issue-lifecycle", "Feature workflow", statePath)
  recordIssue(
    {
      issue_id: "ISSUE-1",
      title: "QA regression",
      type: "bug",
      severity: "high",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Failing smoke path",
      artifact_refs: [],
    },
    statePath,
  )

  let report = getIssueAgingReport(statePath)
  assert.equal(report.telemetry.total, 1)
  assert.equal(report.issues[0].current_status, "open")

  updateIssueStatus("ISSUE-1", "resolved", statePath)
  updateIssueStatus("ISSUE-1", "open", statePath)
  report = getIssueAgingReport(statePath)
  assert.equal(report.issues[0].reopen_count, 1)
})

test("listStaleIssues returns repeated or reopened open issues", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-401", "stale-issues", "Feature workflow", statePath)
  recordIssue(
    {
      issue_id: "ISSUE-2",
      title: "Repeated bug",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Repeat failure",
      artifact_refs: [],
      repeat_count: 1,
      current_status: "open",
      opened_at: "2026-03-21T00:00:00.000Z",
      last_updated_at: "2026-03-21T00:00:00.000Z",
      blocked_since: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )

  const result = listStaleIssues(statePath)
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].issue_id, "ISSUE-2")
})

test("authority writes append outbound supervisor events only after successful state writes", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-940-A", "authority-events", statePath)
  advanceStage("full_product", statePath)
  linkArtifact("scope_package", showState(statePath).state.artifacts.scope_package, statePath)

  let baseline = readSupervisorEvents(statePath, "feature-940-a").length
  setApproval("product_to_solution", "approved", "ProductLead", "2026-04-25", "Approved", statePath)
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-a", baseline), ["approval_changed"])

  baseline = readSupervisorEvents(statePath, "feature-940-a").length
  advanceStage("full_solution", statePath)
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-a", baseline), ["stage_changed"])

  writeTaskBoard(statePath, "feature-940-a", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ task_id: "TASK-F940-A", title: "Authority event task", status: "ready" })],
    issues: [],
  })
  linkArtifact("solution_package", showState(statePath).state.artifacts.solution_package, statePath)
  setApproval("solution_to_fullstack", "approved", "SolutionLead", "2026-04-25", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  baseline = readSupervisorEvents(statePath, "feature-940-a").length
  recordVerificationEvidence(
    {
      id: "authority-evidence",
      kind: "automated",
      scope: "full_implementation",
      summary: "Authority event evidence recorded",
      source: "test",
      recorded_at: "2026-04-25T00:00:00.000Z",
    },
    statePath,
  )
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-a", baseline), ["verification_signal"])

  baseline = readSupervisorEvents(statePath, "feature-940-a").length
  recordIssue(
    {
      issue_id: "ISSUE-AUTHORITY",
      title: "Authority blocker",
      type: "bug",
      severity: "high",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Blocking implementation evidence",
      artifact_refs: [],
    },
    statePath,
  )
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-a", baseline), ["issue_or_blocker_signal", "work_item_blocked", "human_attention_needed"])
})

test("failed authority writes do not append success supervisor events", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-F940-FAIL", "authority-fail", "Failed writes should not emit success events", statePath)
  advanceStage("quick_brainstorm", statePath)
  const baseline = readSupervisorEvents(statePath, "task-f940-fail").length

  assert.throws(
    () => setApproval("product_to_solution", "approved", "user", "2026-04-25", "Wrong gate", statePath),
    /mode 'quick'/,
  )
  assert.throws(() => advanceStage("quick_test", statePath), /immediate next stage 'quick_plan'/)
  assert.throws(
    () =>
      recordVerificationEvidence(
        {
          id: "bad-evidence",
          kind: "not-valid",
          scope: "quick_test",
          summary: "Invalid evidence should fail validation",
          source: "test",
          recorded_at: "2026-04-25T00:00:00.000Z",
        },
        statePath,
      ),
    /verification_evidence\[0\]\.kind/,
  )
  assert.throws(
    () =>
      recordIssue(
        {
          issue_id: "ISSUE-BAD",
          title: "Bad issue",
          type: "unknown",
          severity: "high",
          rooted_in: "implementation",
          recommended_owner: "FullstackAgent",
          evidence: "Invalid issue should fail validation",
          artifact_refs: [],
        },
        statePath,
      ),
    /issues\[0\]\.type/,
  )
  assert.throws(() => updateIssueStatus("ISSUE-MISSING", "resolved", statePath), /Unknown issue/)

  assert.equal(readSupervisorEvents(statePath, "task-f940-fail").length, baseline)
})

test("issue status changes append status and unblock supervisor events after the write", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-940-I", "issue-status-events", "Issue status events", statePath)
  recordIssue(
    {
      issue_id: "ISSUE-STATUS",
      title: "Issue status signal",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Open issue",
      artifact_refs: [],
    },
    statePath,
  )
  const baseline = readSupervisorEvents(statePath, "feature-940-i").length

  updateIssueStatus("ISSUE-STATUS", "resolved", statePath)

  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-i", baseline), ["issue_status_changed", "work_item_unblocked"])
})

test("task-board status and blocker changes append supervisor events only after board writes succeed", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-940-T", "task-status-events", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-940-t",
    {
      task_id: "TASK-F940-T",
      title: "Task event coverage",
      summary: "Emit task status events",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )
  createBoardTask(
    "feature-940-t",
    {
      task_id: "TASK-F940-BLOCKER",
      title: "Resolved blocker task",
      summary: "Provides a valid blocker reference",
      kind: "implementation",
      status: "done",
      qa_owner: "QA-Agent",
      created_by: "SolutionLead",
    },
    statePath,
  )
  let baseline = readSupervisorEvents(statePath, "feature-940-t").length

  claimTask("feature-940-t", "TASK-F940-T", "Dev-A", statePath, { requestedBy: "SolutionLead" })
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-t", baseline), ["task_status_changed"])

  baseline = readSupervisorEvents(statePath, "feature-940-t").length
  assert.throws(() => setTaskStatus("feature-940-t", "TASK-F940-T", "dev_done", statePath), /Invalid task transition/)
  assert.equal(readSupervisorEvents(statePath, "feature-940-t").length, baseline)

  setTaskStatus("feature-940-t", "TASK-F940-T", "in_progress", statePath)
  baseline = readSupervisorEvents(statePath, "feature-940-t").length
  setTaskStatus("feature-940-t", "TASK-F940-T", "dev_done", statePath)
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-t", baseline), ["task_status_changed"])

  assignQaOwner("feature-940-t", "TASK-F940-T", "QA-Agent", statePath, { requestedBy: "SolutionLead" })
  setTaskStatus("feature-940-t", "TASK-F940-T", "qa_ready", statePath)
  setTaskStatus("feature-940-t", "TASK-F940-T", "qa_in_progress", statePath)
  setTaskStatus("feature-940-t", "TASK-F940-T", "blocked", statePath)
  baseline = readSupervisorEvents(statePath, "feature-940-t").length
  setTaskStatus("feature-940-t", "TASK-F940-T", "claimed", statePath)
  assert.deepEqual(supervisorEventTypesSince(statePath, "feature-940-t", baseline), ["task_status_changed", "task_unblocked"])
})

test("supervisor append failure degrades reporting without rolling back successful authority write", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-F940-DEGRADE", "append-degrade", "Append failure should degrade", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const storeDir = path.join(projectRoot, ".opencode", "work-items", "task-f940-degrade")
  const storePath = path.join(storeDir, "supervisor-dialogue.json")
  fs.mkdirSync(storeDir, { recursive: true })
  fs.writeFileSync(storePath, "not json", "utf8")

  const result = advanceStage("quick_brainstorm", statePath)

  assert.equal(result.state.current_stage, "quick_brainstorm")
  assert.equal(workItemStore.readWorkItemState(projectRoot, "task-f940-degrade").current_stage, "quick_brainstorm")

  const repairedStore = readSupervisorDialogueStore(projectRoot, "task-f940-degrade")
  assert.equal(repairedStore.session.degraded_mode, true)
  assert.equal(repairedStore.session.attention_required, true)
  assert.equal(repairedStore.session.transport_health, "degraded")
  assert.match(repairedStore.session.last_detach_reason, /supervisor append failed/i)
})

test("workflow metrics and short runtime summary expose readiness state", () => {
  const statePath = createTempStateFile()
  const metrics = getWorkflowMetrics(statePath)
  const shortSummary = getRuntimeShortSummary(statePath)

  assert.equal(metrics.mode, "full")
  assert.equal(typeof metrics.verificationReadiness.status, "string")
  assert.equal(typeof shortSummary.readiness, "string")
})

test("task aging report scans tracked work items", () => {
  const statePath = createTempStateFile()
  const report = getTaskAgingReport(statePath)

  assert.ok(Array.isArray(report.reports))
  assert.ok(report.reports.length >= 1)
})

test("definition of done reports required gates and readiness", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-500", "dod-check", "Quick DoD check", statePath)

  const dod = getDefinitionOfDone(statePath)

  assert.equal(dod.mode, "quick")
  assert.equal(dod.ready, false)
  assert.ok(dod.requiredApprovals.includes("quick_verified"))
})

test("release readiness reports blockers for incomplete work", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-501", "release-ready", "Quick release check", statePath)

  const readiness = getReleaseReadiness(statePath)

  assert.equal(readiness.releaseReady, false)
  assert.ok(readiness.blockers.length > 0)
})

test("workflow analytics aggregates cross-work-item telemetry", () => {
  const statePath = createTempStateFile()
  const analytics = getWorkflowAnalytics(statePath)

  assert.ok(analytics.analytics.totalWorkItems >= 1)
  assert.equal(typeof analytics.analytics.totalRetries, "number")
})

test("ops summary returns compact operational overview", () => {
  const statePath = createTempStateFile()
  const summary = getOpsSummary(statePath)

  assert.equal(typeof summary.mode, "string")
  assert.equal(typeof summary.stage, "string")
  assert.ok(Array.isArray(summary.pendingApprovals))
})

test("policy execution trace lists docs runtime and tests", () => {
  const trace = getPolicyExecutionTrace()

  assert.ok(Array.isArray(trace.policies))
  assert.ok(trace.policies.some((policy) => policy.id === "verification-before-completion"))
})

test("release candidate lifecycle supports work items, notes, approvals, and dashboard visibility", () => {
  const statePath = createTempStateFile()

  createReleaseCandidate("rc-001", "Spring candidate", statePath)
  let releases = listReleaseCandidates(statePath)
  assert.equal(releases.index.releases.length, 1)

  addReleaseWorkItem("rc-001", "feature-001", statePath)
  let candidate = showReleaseCandidate("rc-001", statePath)
  assert.ok(candidate.candidate.included_work_items.includes("feature-001"))

  draftReleaseNotes("rc-001", statePath)
  let notes = validateReleaseNotes("rc-001", statePath)
  assert.equal(notes.ready, true)

  setReleaseApproval("rc-001", "qa_to_release", "approved", "QAAgent", "2026-03-22", "QA passed", statePath)
  setReleaseApproval("rc-001", "release_to_ship", "approved", "ReleaseManager", "2026-03-22", "Approved", statePath)
  recordRollbackPlan("rc-001", "Rollback to previous tag", "ReleaseManager", ["critical regression"], statePath)
  setReleaseStatus("rc-001", "candidate", statePath)

  const readiness = getReleaseCandidateReadiness("rc-001", statePath)
  assert.equal(readiness.ready, true)

  const dashboard = getReleaseDashboard(statePath)
  assert.ok(dashboard.dashboard.total >= 1)

  removeReleaseWorkItem("rc-001", "feature-001", statePath)
  candidate = showReleaseCandidate("rc-001", statePath)
  assert.equal(candidate.candidate.included_work_items.length, 0)
})

test("high-risk release candidate requires rollback plan", () => {
  const statePath = createTempStateFile()
  createReleaseCandidate("rc-002", "Risky release", statePath)
  addReleaseWorkItem("rc-002", "feature-001", statePath)
  setReleaseStatus("rc-002", "candidate", statePath)
  draftReleaseNotes("rc-002", statePath)
  setReleaseApproval("rc-002", "qa_to_release", "approved", "QAAgent", "2026-03-22", "QA passed", statePath)
  setReleaseApproval("rc-002", "release_to_ship", "approved", "ReleaseManager", "2026-03-22", "Approved", statePath)

  let candidate = showReleaseCandidate("rc-002", statePath)
  candidate = { candidate: { ...candidate.candidate, risk_level: "high" } }
  setReleaseStatus("rc-002", "candidate", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const releasePath = path.join(projectRoot, ".opencode", "releases", "rc-002", "release.json")
  const releaseJson = JSON.parse(fs.readFileSync(releasePath, "utf8"))
  releaseJson.risk_level = "high"
  fs.writeFileSync(releasePath, `${JSON.stringify(releaseJson, null, 2)}\n`, "utf8")

  const readiness = getReleaseCandidateReadiness("rc-002", statePath)
  assert.equal(readiness.ready, false)
  assert.match(readiness.blockers.join("\n"), /rollback plan/)
})

test("startHotfix creates a release-linked work item and validateHotfix reports readiness", () => {
  const statePath = createTempStateFile()
  createReleaseCandidate("rc-003", "Hotfix release", statePath)

  const hotfix = startHotfix("rc-003", "quick", "TASK-900", "hotfix-login", "Hotfix login issue", statePath)
  assert.equal(hotfix.state.mode, "quick")

  const candidate = showReleaseCandidate("rc-003", statePath)
  assert.ok(candidate.candidate.hotfix_work_items.includes(hotfix.workItemId))

  const validation = validateHotfix(hotfix.workItemId, statePath)
  assert.equal(typeof validation.ready, "boolean")
})

test("quick mode rejects full-delivery approvals", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-127", "bad-gate", "Quick workflow gate validation", statePath)

  assert.throws(
    () => setApproval("product_to_solution", "approved", "user", "2026-03-21", "Wrong gate", statePath),
    /mode 'quick'/,
  )
})

test("quick mode rejects skipping stages", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-128", "skip-stage", "Quick stage ordering", statePath)

  assert.throws(() => advanceStage("quick_test", statePath), /immediate next stage 'quick_brainstorm'/)
})

test("full mode rejects quick stages", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-201", "wrong-lane-stage", "Full workflow stage validation", statePath)

  assert.throws(() => advanceStage("quick_implement", statePath), /does not belong to mode 'full'/)
})

test("setRoutingProfile rejects contradictory routing metadata for quick mode", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-777", "routing-conflict", "Quick routing profile", statePath)

  assert.throws(
    () => setRoutingProfile("modernization", "preserve", "compatibility", "adjacent", "Actually a migration", statePath),
    /routing_profile\.work_intent must be 'maintenance' for quick mode/,
  )
})

test("compatibility startFeature initializes full mode", () => {
  const statePath = createTempStateFile()

  const result = startFeature("FEATURE-202", "compat-start", statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.match(result.state.mode_reason, /legacy start-feature command/)
})

test("legacy startTask creates and selects the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startTask("quick", "TASK-123", "update-copy", "Scoped text change", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "task-123")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "task-123")
  assert.equal(index.active_work_item_id, "task-123")
  assert.equal(index.work_items.at(-1).work_item_id, "task-123")
  assert.equal(persistedState.work_item_id, "task-123")
  assert.equal(persistedState.feature_id, "TASK-123")
  assert.deepEqual(mirrorState, persistedState)
  assert.equal(result.worktree_status, "not_requested")
  assert.equal(result.worktree_reason, null)
  assert.equal(result.worktree, null)
})

test("cleanupWorkItemWorktree skips with explicit reason when no retained metadata exists", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-936", "cleanup-skip", "No retained metadata exists", statePath)
  const result = cleanupWorkItemWorktree("task-936", statePath)

  assert.equal(result.status, "skipped")
  assert.match(result.reason, /No retained managed worktree metadata is registered/)
  assert.equal(result.metadata, null)
})

test("cleanupWorkItemWorktree removes stale metadata when worktree path is already missing", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))
  const runtimeRoot = projectRoot

  startTask("quick", "TASK-937", "cleanup-missing-path", "Metadata exists but path is gone", statePath)
  writeWorkItemWorktreeMetadata(statePath, "task-937", {
    schema: "openkit/worktree@2",
    work_item_id: "task-937",
    workflow_mode: "quick",
    lineage_key: "task-937",
    repository_root: projectRoot,
    target_branch: "main",
    branch: "openkit/quick/task-937",
    worktree_path: path.join(projectRoot, ".worktrees", "task-937"),
    created_at: "2026-04-20T00:00:00.000Z",
    env_propagation: {
      mode: "none",
      applied_at: null,
      source_files: [],
    },
  })

  const result = cleanupWorkItemWorktree("task-937", statePath)

  assert.equal(result.status, "skipped")
  assert.match(result.reason, /already missing/)
  assert.equal(result.metadata.work_item_id, "task-937")
  assert.equal(workItemStore.readWorkItemWorktree(runtimeRoot, "task-937"), null)
})

test("legacy startTask full creates and selects the active full-delivery work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startTask("full", "FEATURE-303", "legacy-full", "Legacy full start-task command", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "feature-303")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-303")
  assert.equal(result.state.mode, "full")
  assert.equal(index.active_work_item_id, "feature-303")
  assert.equal(index.work_items.at(-1).work_item_id, "feature-303")
  assert.equal(persistedState.work_item_id, "feature-303")
  assert.equal(persistedState.feature_id, "FEATURE-303")
  assert.deepEqual(mirrorState, persistedState)
})

test("startTask builds a fresh work item state without leaking unrelated active-item metadata", () => {
  const statePath = createTempStateFile()
  const activeState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  activeState.unrelated_runtime_note = "should-not-leak"
  fs.writeFileSync(statePath, `${JSON.stringify(activeState, null, 2)}\n`, "utf8")

  startFeature("FEATURE-202", "compat-start", statePath)
  const result = startTask("quick", "TASK-124", "fresh-shape", "Fresh quick task", statePath)

  assert.equal(Object.hasOwn(result.state, "unrelated_runtime_note"), false)
  assert.equal(result.state.mode, "quick")
  assert.deepEqual(result.state.issues, [])
})

test("legacy startFeature creates and selects the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startFeature("FEATURE-202", "compat-start", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "feature-202")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(index.active_work_item_id, "feature-202")
  assert.equal(index.work_items.at(-1).work_item_id, "feature-202")
  assert.equal(persistedState.work_item_id, "feature-202")
  assert.equal(persistedState.feature_id, "FEATURE-202")
  assert.deepEqual(mirrorState, persistedState)
})

test("showState reads the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = showState(statePath)

  assert.equal(result.state.work_item_id, "task-500")
  assert.equal(result.state.feature_id, "TASK-500")
  assert.equal(result.state.current_stage, "quick_intake")
})

test("showWorkItemState reads a non-active work item without changing selection", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = showWorkItemState("feature-202", statePath)
  const index = readWorkItemIndex(projectRoot)

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(result.state.feature_id, "FEATURE-202")
  assert.equal(index.active_work_item_id, "task-500")
})

test("selectActiveWorkItem refreshes the compatibility mirror after changing the backing-store selection", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = selectActiveWorkItem("feature-202", statePath)
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(mirrorState.work_item_id, "feature-202")
  assert.equal(mirrorState.feature_id, "FEATURE-202")
})

test("selectActiveWorkItem restores the previous active pointer when mirror write fails", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  _overrideWorkItemStore({
    writeCompatibilityMirror() {
      throw new Error("Simulated selection mirror failure")
    },
  })

  try {
    assert.throws(() => selectActiveWorkItem("feature-202", statePath), /mirror/i)
  } finally {
    _resetWorkItemStore()
  }

  const index = workItemStore.readWorkItemIndex(projectRoot)
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(index.active_work_item_id, "task-500")
  assert.equal(mirrorState.work_item_id, "task-500")
})

test("approving code_review_to_qa without a valid task board fails", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-600", "board-gate", statePath)
  advanceFullWorkItemToPlan(statePath)

  assert.throws(
    () => setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath),
    /valid task board|tasks\.json/,
  )
})

test("approving code_review_to_qa succeeds with a valid initial full_solution task board", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-601", "board-gate-pass", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-601", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "queued" }), createTask({ task_id: "TASK-2", title: "Queued follow-up", status: "queued" })],
    issues: [],
  })

  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  const result = setApproval("code_review_to_qa", "approved", "user", "2026-03-21", "Approved", statePath)

  assert.equal(result.state.approvals.code_review_to_qa.status, "approved")
})

test("solution_to_fullstack approval succeeds when mirror lags but work-item revision is current", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-606", "mirror-lag", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-606", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "queued" })],
    issues: [],
  })

  const workItemStatePath = path.join(projectRoot, ".opencode", "work-items", "feature-606", "state.json")
  const workItemState = JSON.parse(fs.readFileSync(workItemStatePath, "utf8"))
  workItemState.updated_at = "2026-04-04T02:30:49.524Z"
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(workItemState, null, 2)}\n`, "utf8")

  const result = setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.approvals.solution_to_fullstack.status, "approved")
  assert.equal(mirrorState.work_item_id, "feature-606")
  assert.equal(mirrorState.approvals.solution_to_fullstack.status, "approved")
})

test("full mode rejects parallelization before full_solution", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-611", "premature-parallel", statePath)
  advanceStage("full_product", statePath)

  assert.throws(
    () => setParallelization("limited", "too early", "integration checkpoint", 2, statePath),
    /cannot be set before stage 'full_solution'/,
  )
})

test("advancing full_solution to full_implementation without a valid task board fails", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-602", "missing-board", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-602", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  writeTaskBoard(statePath, "feature-602", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [],
    issues: [],
  })

  assert.throws(() => advanceStage("full_implementation", statePath), /task board must include at least one task/)
})

test("advancing full_implementation to full_qa fails when task board has incomplete implementation work", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-603", "qa-handoff", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-603", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "in_progress", primary_owner: "DevA" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "fullstack-rule-scan-603",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-603", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "reviewer-security-scan-603",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan on changed files",
      source: "tool.security-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.security-scan", scanKind: "security", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(() => advanceStage("full_qa", statePath), /full_qa/)
})

test("quick mode state with tasks.json present is rejected at controller validation time", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-700", "stale-board", "Quick task should reject task boards", statePath)
  writeTaskBoard(statePath, "task-700", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => validateState(statePath), /Quick mode cannot carry a task board/)
  assert.throws(() => showState(statePath), /Quick mode cannot carry a task board/)
})

test("migration mode state with tasks.json present is rejected at controller validation time", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-700", "stale-board", "Migration should reject task boards", statePath)
  writeTaskBoard(statePath, "migrate-700", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => validateState(statePath), /Migration mode cannot carry a task board/)
  assert.throws(() => showState(statePath), /Migration mode cannot carry a task board/)
})

test("valid full-delivery task board passes implementation and QA stage enforcement", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-604", "valid-board", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-604", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)

  let result = advanceStage("full_implementation", statePath)
  assert.equal(result.state.current_stage, "full_implementation")

  writeTaskBoard(statePath, "feature-604", {
    mode: "full",
    current_stage: "full_qa",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  recordVerificationEvidence(
    {
      id: "fullstack-rule-scan-604",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-604", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "reviewer-security-scan-604",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan on changed files",
      source: "tool.security-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.security-scan", scanKind: "security", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)
  recordVerificationEvidence(
    {
      id: "full-review",
      kind: "review",
      scope: "full_code_review",
      summary: "Full code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )

  result = advanceStage("full_qa", statePath)
  assert.equal(result.state.current_stage, "full_qa")
})

test("claimTask rejects implicit reassignment and requires explicit reassignTask flow", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-605", "assignment-safety", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-605",
    {
      task_id: "TASK-605",
      title: "Safe assignment",
      summary: "Reject unauthorized reassignment",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-605", "TASK-605", "Dev-A", statePath, { requestedBy: "SolutionLead" })

  assert.throws(
    () => claimTask("feature-605", "TASK-605", "Dev-B", statePath, { requestedBy: "SolutionLead" }),
    /Implicit reassignment is not allowed; use reassignTask/,
  )
})

test("reassignTask enforces authority and updates the claimed owner explicitly", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-609", "explicit-reassign", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-609",
    {
      task_id: "TASK-609",
      title: "Explicit reassignment",
      summary: "Use explicit reassignment flow",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-609", "TASK-609", "Dev-A", statePath, { requestedBy: "SolutionLead" })

  assert.throws(
    () => reassignTask("feature-609", "TASK-609", "Dev-B", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or SolutionLead can reassign primary_owner/,
  )

  const result = reassignTask("feature-609", "TASK-609", "Dev-B", statePath, { requestedBy: "SolutionLead" })

  assert.equal(result.board.tasks[0].primary_owner, "Dev-B")
  assert.equal(result.board.tasks[0].status, "claimed")
})

test("releaseTask enforces authority and clears claimed ownership explicitly", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-610", "explicit-release", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-610",
    {
      task_id: "TASK-610",
      title: "Explicit release",
      summary: "Use explicit release flow",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-610", "TASK-610", "Dev-A", statePath, { requestedBy: "SolutionLead" })

  assert.throws(
    () => releaseTask("feature-610", "TASK-610", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or SolutionLead can release primary_owner/,
  )

  const result = releaseTask("feature-610", "TASK-610", statePath, { requestedBy: "SolutionLead" })

  assert.equal(result.board.tasks[0].primary_owner, null)
  assert.equal(result.board.tasks[0].status, "ready")
})

test("releaseTask allows the current task owner to release their claimed task", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-612", "owner-release", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-612",
    {
      task_id: "TASK-612",
      title: "Owner release",
      summary: "Current owner can explicitly release task",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-612", "TASK-612", "Dev-A", statePath, { requestedBy: "SolutionLead" })

  const result = releaseTask("feature-612", "TASK-612", statePath, { requestedBy: "Dev-A" })

  assert.equal(result.board.tasks[0].primary_owner, null)
  assert.equal(result.board.tasks[0].status, "ready")
})

test("assignQaOwner rejects reassignment from the wrong authority", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-606", "qa-assignment-safety", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-606",
    {
      task_id: "TASK-606",
      title: "Safe QA assignment",
      summary: "Reject unauthorized QA reassignment",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-606", "TASK-606", "Dev-A", statePath, { requestedBy: "SolutionLead" })
  setTaskStatus("feature-606", "TASK-606", "in_progress", statePath)
  setTaskStatus("feature-606", "TASK-606", "dev_done", statePath)
  assignQaOwner("feature-606", "TASK-606", "QA-Agent", statePath, { requestedBy: "SolutionLead" })

  assert.throws(
    () => assignQaOwner("feature-606", "TASK-606", "QA-Agent-2", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or SolutionLead can reassign qa_owner/,
  )
})

test("setTaskStatus rejects QA-fail local rework without a task-scoped finding and reroute decision", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-607", "qa-fail-guardrails", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-607",
    {
      task_id: "TASK-607",
      title: "QA fail guardrails",
      summary: "Require local rework metadata",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "SolutionLead",
    },
    statePath,
  )

  assert.throws(
    () => setTaskStatus("feature-607", "TASK-607", "claimed", statePath, { requestedBy: "QAAgent" }),
    /task-scoped finding/,
  )

  assert.throws(
    () =>
      setTaskStatus("feature-607", "TASK-607", "claimed", statePath, {
        requestedBy: "QAAgent",
        finding: {
          issue_id: "ISSUE-607",
          task_id: "TASK-607",
          title: "Regression found",
          summary: "Fix one task-local bug",
          type: "bug",
          severity: "medium",
          rooted_in: "implementation",
          recommended_owner: "FullstackAgent",
          evidence: "Targeted QA reproduction",
          artifact_refs: ["docs/qa/2026-03-21-feature-607.md"],
          affects_tasks: ["TASK-607"],
          blocks_parallel_work: false,
        },
      }),
    /rerouteDecision/,
  )
})

test("QA-fail local rework applies the reroute decision to work-item runtime state", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-611", "qa-reroute-applied", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-611",
    {
      task_id: "TASK-611",
      title: "Apply reroute decision",
      summary: "Persist QA local rework route",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "SolutionLead",
    },
    statePath,
  )

  const result = setTaskStatus("feature-611", "TASK-611", "claimed", statePath, {
    requestedBy: "QAAgent",
    finding: {
      issue_id: "ISSUE-611",
      task_id: "TASK-611",
      title: "Regression found",
      summary: "Fix one task-local bug",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Targeted QA reproduction",
      artifact_refs: ["docs/qa/2026-03-21-feature-611.md"],
      affects_tasks: ["TASK-611"],
      blocks_parallel_work: false,
    },
    rerouteDecision: {
      stage: "full_implementation",
      owner: "FullstackAgent",
      decided_by: "SolutionLead",
      reason: "Return only the failing task to implementation",
    },
  })

  assert.equal(result.state.current_stage, "full_implementation")
  assert.equal(result.state.current_owner, "FullstackAgent")
  assert.equal(result.state.status, "in_progress")
  assert.equal(result.board.tasks[0].status, "claimed")
})

test("QA-fail local rework rejects invalid reroute decisions atomically before any task write", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-613", "atomic-qa-reroute", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-613",
    {
      task_id: "TASK-613",
      title: "Atomic QA reroute",
      summary: "Invalid reroute must not partially mutate task",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "SolutionLead",
    },
    statePath,
  )

  assert.throws(
    () =>
      setTaskStatus("feature-613", "TASK-613", "claimed", statePath, {
        requestedBy: "QAAgent",
        finding: {
          issue_id: "ISSUE-613",
          task_id: "TASK-613",
          title: "Regression found",
          summary: "Fix one task-local bug",
          type: "bug",
          severity: "medium",
          rooted_in: "implementation",
          recommended_owner: "FullstackAgent",
          evidence: "Targeted QA reproduction",
          artifact_refs: ["docs/qa/2026-03-21-feature-613.md"],
          affects_tasks: ["TASK-613"],
          blocks_parallel_work: false,
        },
        rerouteDecision: {
          stage: "full_done",
          owner: "MasterOrchestrator",
          decided_by: "SolutionLead",
          reason: "Invalid reroute target",
        },
      }),
    /field 'stage'/,
  )

  const workItem = validateWorkItemBoard("feature-613", statePath)
  assert.equal(workItem.state.current_stage, "full_solution")
  assert.equal(workItem.state.current_owner, "SolutionLead")
  assert.equal(workItem.board.tasks[0].status, "qa_in_progress")
  assert.equal(workItem.board.tasks[0].primary_owner, "Dev-A")
})

test("createTask rejects invalid parallel worktree metadata", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-608", "invalid-worktree-metadata", statePath)
  advanceFullWorkItemToPlan(statePath)

  assert.throws(
    () =>
      createBoardTask(
        "feature-608",
        {
          task_id: "TASK-608",
          title: "Parallel worktree metadata",
          summary: "Reject invalid protected branch metadata",
          kind: "implementation",
          created_by: "SolutionLead",
          worktree_metadata: {
            task_id: "TASK-608",
            branch: "main",
            worktree_path: ".worktrees/task-608-parallel",
          },
        },
        statePath,
      ),
    /must not target main/,
  )
})

test("createTask rejects task-board creation before full_solution", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-614", "board-stage-gate", statePath)

  assert.throws(
    () =>
      createBoardTask(
        "feature-614",
        {
          task_id: "TASK-614",
          title: "Too early task board",
          summary: "Task boards should wait until planning",
          kind: "implementation",
          created_by: "SolutionLead",
        },
        statePath,
      ),
    /full_solution/,
  )
})

test("startTask rejects stale overwrites when an existing work item changes between guarded reads", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-800", "stale-write", "Guard controller mutation paths", statePath)

  let readCount = 0
  _overrideWorkItemStore({
    readWorkItemState(projectRoot, workItemId) {
      const state = workItemStore.readWorkItemState(projectRoot, workItemId)
      if (workItemId === "task-800") {
        readCount += 1
        if (readCount === 2) {
          workItemStore.writeWorkItemState(projectRoot, workItemId, {
            ...state,
            status: "blocked",
            updated_at: "2026-03-21T01:00:00.000Z",
          })
          return workItemStore.readWorkItemState(projectRoot, workItemId)
        }
      }
      return state
    },
  })

  try {
    assert.throws(
      () => startTask("quick", "TASK-800", "stale-write", "Guard controller mutation paths", statePath),
      (error) => error.code === "STALE_WRITE" && /expected revision/i.test(error.message),
    )
  } finally {
    _resetWorkItemStore()
  }

  const persistedState = showState(statePath).state
  assert.equal(persistedState.status, "blocked")
  assert.equal(persistedState.current_stage, "quick_intake")
})

test("controller rolls back active-item writes when mirror refresh fails after the primary state write", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-801", "mirror-stale", "Guard mirror refresh ordering", statePath)

  let observedPrimaryWriteBeforeMirrorFailure = false
  _overrideWorkItemStore({
    writeCompatibilityMirror(projectRoot) {
      const activeState = workItemStore.readWorkItemState(projectRoot, "task-801")
      observedPrimaryWriteBeforeMirrorFailure ||= activeState.current_stage === "quick_brainstorm"
      throw new Error("Simulated mirror write failure")
    },
  })

  try {
    assert.throws(() => advanceStage("quick_brainstorm", statePath), /mirror/i)
  } finally {
    _resetWorkItemStore()
  }

  assert.equal(observedPrimaryWriteBeforeMirrorFailure, true)

  const persistedState = workItemStore.readWorkItemState(path.dirname(path.dirname(statePath)), "task-801")
  assert.equal(persistedState.current_stage, "quick_intake")

  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.equal(mirrorState.current_stage, "quick_intake")
})

test("controller restores primary and mirror state when index write fails late", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-802", "index-rollback", "Guard late index failures", statePath)

  const projectRoot = path.dirname(path.dirname(statePath))
  let observedMirrorWriteBeforeIndexFailure = false
  _overrideWorkItemStore({
    writeWorkItemIndex(root, index) {
      observedMirrorWriteBeforeIndexFailure = Boolean(index.active_work_item_id)
      throw new Error("Simulated index write failure")
    },
  })

  try {
    assert.throws(() => advanceStage("quick_brainstorm", statePath), /index write failure/)
  } finally {
    _resetWorkItemStore()
  }

  assert.equal(observedMirrorWriteBeforeIndexFailure, true)

  const persistedState = workItemStore.readWorkItemState(projectRoot, "task-802")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(persistedState.current_stage, "quick_intake")
  assert.equal(mirrorState.current_stage, "quick_intake")
})

// ---------------------------------------------------------------------------
// Tool evidence gate tests (Tier 2)
// ---------------------------------------------------------------------------

test("full_code_review is blocked without rule-scan tool evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-801", "tool-gate-code-review", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-801", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /Tool evidence gate blocked advance to 'full_code_review'.*rule-scan/,
  )
})

test("full_code_review blocks legacy source-only rule-scan evidence without structured scan details", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-802", "tool-gate-cr-pass", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-802", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-802",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-802", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /structured details\.scan_evidence/i,
  )
})

test("full_code_review blocks scan evidence missing direct tool classification", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-802C", "tool-gate-cr-malformed-structured", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-802c", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  const details = makeScanEvidenceDetails({ groups: [] })
  delete details.scan_evidence.direct_tool.tool_id
  recordVerificationEvidence(
    {
      id: "rule-scan-802c",
      kind: "automated",
      scope: "full_implementation",
      summary: "Malformed structured scan evidence",
      source: "tool.rule-scan",
      details,
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-802c", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /details\.scan_evidence\.direct_tool\.tool_id/i,
  )
})

test("full_code_review passes with structured zero-finding rule-scan evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-802B", "tool-gate-cr-pass-structured", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-802b", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-802b",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-802b", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
})

test("full_code_review blocks rule-scan source with mismatched security direct tool evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-8", "scan-gate-cr-tool-id-mismatch", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-8", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-source-security-direct-mismatch",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan source incorrectly carries security scan structured identity",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.security-scan", scanKind: "security", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-8", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /identifies tool\.security-scan.*requires tool\.rule-scan/i,
  )
})

test("full_code_review is blocked when rule-scan evidence has unclassified findings", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-1", "scan-gate-unclassified", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-1", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-unclassified",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan has findings that were not triaged",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        groups: [
          {
            ruleId: "openkit.quality.noisy-rule",
            severity: "WARNING",
            classification: "unclassified",
            count: 17,
          },
        ],
      }),
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-1", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /unclassified scan findings remain/i,
  )
})

test("full_code_review passes with classified non-blocking quality noise", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-2", "scan-gate-noise", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-2", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-noise",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan noise was classified and remains traceable",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        groups: [
          {
            ruleId: "openkit.quality.noisy-rule",
            severity: "WARNING",
            classification: "non_blocking_noise",
            count: 2301,
            rationale: "Legacy broad warning unrelated to changed runtime gate code; retained for rule tuning follow-up.",
            trace_ref: "artifacts/rule-scan-noise.json",
          },
        ],
      }),
      artifact_refs: ["artifacts/rule-scan-noise.json"],
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-2", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
  const evidence = result.state.verification_evidence.find((entry) => entry.id === "rule-scan-noise")
  assert.equal(evidence.details.scan_evidence.triage_summary.groups[0].classification, "non_blocking_noise")
  assert.deepEqual(evidence.artifact_refs, ["artifacts/rule-scan-noise.json"])
})

test("full_qa is blocked without security-scan tool evidence even if rule-scan exists", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-803", "tool-gate-qa-partial", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-803", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-803",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-803", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "review-803",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(
    () => advanceStage("full_qa", statePath),
    /Tool evidence gate blocked advance to 'full_qa'.*security-scan/,
  )
})

test("full_qa blocks legacy source-only rule/security scan evidence without structured scan details", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-804", "tool-gate-qa-pass", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-804", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-804",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-804", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-scan-804",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan on changed files",
      source: "tool.security-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-804",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(
    () => advanceStage("full_qa", statePath),
    /structured details\.scan_evidence/i,
  )
})

test("full_qa passes with structured zero-finding rule-scan and security-scan evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-804B", "tool-gate-qa-pass-structured", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-804b", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-804b",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-804b", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-scan-804b",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan on changed files",
      source: "tool.security-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.security-scan", scanKind: "security", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-804b",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  const result = advanceStage("full_qa", statePath)
  assert.equal(result.state.current_stage, "full_qa")
})

test("full_qa blocks security-scan source with mismatched rule direct tool evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-9", "scan-gate-qa-tool-id-mismatch", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-9", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-qa-mismatch-setup",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan passed with no findings",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-9", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-source-rule-direct-mismatch",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan source incorrectly carries rule scan structured identity",
      source: "tool.security-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.rule-scan", scanKind: "rule", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-qa-tool-id-mismatch",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(
    () => advanceStage("full_qa", statePath),
    /identifies tool\.rule-scan.*requires tool\.security-scan/i,
  )
})

test("full_code_review keeps mismatched scan evidence blocked despite required Tier 3 invocation", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-10", "scan-gate-mismatch-tier3", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-10", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-source-security-direct-tier3-mismatch",
      kind: "automated",
      scope: "full_implementation",
      summary: "Mismatched structured scan identity should fail before Tier 3 can satisfy the gate",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ toolId: "tool.security-scan", scanKind: "security", groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-10", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /identifies tool\.security-scan.*requires tool\.rule-scan/i,
  )
})

test("full_qa requires false-positive details for test-fixture security placeholders", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-3", "scan-gate-fixture-details", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-3", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-fixture-details",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan passed with no findings",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({ groups: [] }),
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-3", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-scan-fixture-missing-details",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan fixture placeholder false positive lacks full rationale",
      source: "tool.security-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        toolId: "tool.security-scan",
        scanKind: "security",
        groups: [
          {
            ruleId: "openkit.security.fixture-token",
            severity: "WARNING",
            classification: "false_positive",
            count: 1,
            rationale: "fixture placeholder only",
          },
        ],
        falsePositiveItems: [
          {
            rule_id: "openkit.security.fixture-token",
            file: "tests/fixtures/token.js",
            context: "test fixture placeholder",
            rationale: "Not a real secret.",
          },
        ],
      }),
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-fixture-details",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(
    () => advanceStage("full_qa", statePath),
    /false-positive scan finding.*security impact.*follow-up/i,
  )
})

test("full_qa passes with fully documented test-fixture security false positive", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-4", "scan-gate-fixture-pass", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-4", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-fixture-pass",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan passed with no findings",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({ groups: [] }),
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-4", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-scan-fixture-pass",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan fixture placeholder is documented as a false positive",
      source: "tool.security-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        toolId: "tool.security-scan",
        scanKind: "security",
        groups: [
          {
            ruleId: "openkit.security.fixture-token",
            severity: "WARNING",
            classification: "false_positive",
            count: 1,
            rationale: "Fixture-only token-looking placeholder; not loaded by production/runtime code.",
          },
        ],
        falsePositiveItems: [
          {
            rule_id: "openkit.security.fixture-token",
            file: "tests/fixtures/token.js",
            context: "test fixture placeholder, not production/runtime code",
            rationale: "Synthetic token-looking value used only in tests; not a real secret.",
            impact: "No production/runtime security impact and no exploitable credential.",
            follow_up: "none",
          },
        ],
      }),
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-fixture-pass",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  const result = advanceStage("full_qa", statePath)
  assert.equal(result.state.current_stage, "full_qa")
})

test("full_qa blocks unresolved production true-positive security findings", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-5", "scan-gate-true-positive", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-5", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-true-positive",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan passed with no findings",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({ groups: [] }),
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-5", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
    { tool_id: "tool.security-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)
  advanceStage("full_code_review", statePath)
  recordVerificationEvidence(
    {
      id: "security-scan-true-positive",
      kind: "automated",
      scope: "full_code_review",
      summary: "Security scan has unresolved production true positive",
      source: "tool.security-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        toolId: "tool.security-scan",
        scanKind: "security",
        groups: [
          {
            ruleId: "openkit.security.hardcoded-secret",
            severity: "ERROR",
            classification: "true_positive",
            count: 1,
            file: "src/runtime/server.js",
            context: "production runtime path",
            resolution: "unresolved",
            rationale: "Real secret-looking value remains in runtime code.",
          },
        ],
      }),
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "review-true-positive",
      kind: "review",
      scope: "full_code_review",
      summary: "Code review completed",
      source: "code-review",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("code_review_to_qa", "approved", "QAAgent", "2026-03-21", "Ready for QA", statePath)

  assert.throws(
    () => advanceStage("full_qa", statePath),
    /true-positive.*security.*unresolved/i,
  )
})

test("migration_code_review is blocked without rule-scan or codemod-preview evidence", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-801", "tool-gate-migration-cr", "Gate migration code review on tool evidence", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "tool-gate-migration-cr")
  setApproval("upgrade_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Upgrade ready for review", statePath)

  assert.throws(
    () => advanceStage("migration_code_review", statePath),
    /Tool evidence gate blocked advance to 'migration_code_review'.*rule-scan.*codemod-preview/,
  )
})

test("migration_code_review passes with codemod-preview evidence (alternative source)", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-802", "tool-gate-migration-cr-pass", "Pass migration code review with codemod-preview", statePath)
  advanceMigrationWorkItemToStrategy(statePath, "tool-gate-migration-cr-pass")
  recordVerificationEvidence(
    {
      id: "codemod-preview-802",
      kind: "automated",
      scope: "migration_upgrade",
      summary: "Codemod preview on upgrade transform",
      source: "tool.codemod-preview",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "migrate-802", [
    { tool_id: "tool.codemod-preview", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("upgrade_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Upgrade ready for review", statePath)

  const result = advanceStage("migration_code_review", statePath)
  assert.equal(result.state.current_stage, "migration_code_review")
})

test("tool evidence gate accepts manual override evidence", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-805", "tool-gate-manual-override", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-805", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record manual override instead of tool.rule-scan
  recordVerificationEvidence(
    {
      id: "manual-override-805",
      kind: "manual",
      scope: "tool-evidence-override:full_code_review",
      summary: "tool.rule-scan unavailable — semgrep not installed; manually reviewed changed files",
      source: "manual",
      details: makeValidManualOverrideDetails({ targetStage: "full_code_review", unavailableTool: "tool.rule-scan" }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
})

test("quick mode has no tool evidence gates on intermediate transitions", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-801", "quick-no-tool-gate", "Quick mode should not have tool gates on stages", statePath)
  advanceStage("quick_brainstorm", statePath)
  advanceStage("quick_plan", statePath)
  advanceStage("quick_implement", statePath)
  advanceStage("quick_test", statePath)

  // quick_test -> quick_done still requires only approval + kind evidence (EVIDENCE_RULES), not tool evidence gates
  setApproval("quick_verified", "approved", "QuickAgent", "2026-03-21", "Quick Agent verified", statePath)
  recordVerificationEvidence(
    {
      id: "quick-manual-801",
      kind: "manual",
      scope: "quick_test",
      summary: "Manual verification",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-runtime-801",
      kind: "runtime",
      scope: "quick_test",
      summary: "Runtime verification",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "quick-automated-801",
      kind: "automated",
      scope: "quick_test",
      summary: "Automated verification",
      source: "quick-agent",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )

  const result = advanceStage("quick_done", statePath)
  assert.equal(result.state.current_stage, "quick_done")
  assert.equal(result.state.status, "done")
})

test("definition of done includes tool evidence gate status", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-806", "dod-tool-gate", statePath)
  advanceFullWorkItemToPlan(statePath)

  const dod = getDefinitionOfDone(statePath)
  assert.equal(dod.ready, false)
  assert.ok(dod.toolEvidenceGate !== undefined, "toolEvidenceGate should be present")
  assert.ok(Array.isArray(dod.toolEvidenceBlockers), "toolEvidenceBlockers should be an array")
  // At full_solution, the gates for full_code_review and full_qa are not yet satisfied
  assert.ok(dod.toolEvidenceBlockers.length > 0, "should have tool evidence blockers for full mode")
})

// ---------------------------------------------------------------------------
// Tier 3: Runtime Policy Engine tests
// ---------------------------------------------------------------------------

test("invocation logger records entries to disk", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({ runtimeRoot: dir, workItemId: null })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 150 })
  logger.record({ toolId: "tool.security-scan", status: "failure", durationMs: 200 })

  const entries = logger.getEntries()
  assert.equal(entries.length, 2)
  assert.equal(entries[0].tool_id, "tool.rule-scan")
  assert.equal(entries[0].status, "success")
  assert.equal(entries[1].tool_id, "tool.security-scan")
  assert.equal(entries[1].status, "failure")
  assert.ok(logger.hasSuccessfulInvocation("tool.rule-scan"))
  assert.ok(!logger.hasSuccessfulInvocation("tool.security-scan"))
})

test("invocation logger records per-work-item log", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({ runtimeRoot: dir, workItemId: "feature-900" })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 50 })

  const logPath = resolveLogPath(dir, "feature-900")
  assert.ok(fs.existsSync(logPath), "log file should exist at per-work-item path")
  const globalLogPath = resolveLogPath(dir, null)
  assert.ok(!fs.existsSync(globalLogPath), "global log file should not exist when workItemId is set")
})

test("checkPolicy passes when no policy is defined for the stage", () => {
  const dir = makeTempDir()
  const result = checkPolicy({ mode: "quick", targetStage: "quick_done", runtimeRoot: dir, workItemId: null })
  assert.equal(result.passed, true)
  assert.equal(result.violations.length, 0)
})

test("checkPolicy fails when required tool invocation is missing", () => {
  const dir = makeTempDir()
  const result = checkPolicy({ mode: "full", targetStage: "full_code_review", runtimeRoot: dir, workItemId: null })
  assert.equal(result.passed, false)
  assert.equal(result.violations.length, 1)
  assert.ok(result.violations[0].message.includes("tool.rule-scan"))
})

test("checkPolicy passes when required tool invocation is present", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({ runtimeRoot: dir, workItemId: null })
  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 100 })

  const result = checkPolicy({ mode: "full", targetStage: "full_code_review", runtimeRoot: dir, workItemId: null })
  assert.equal(result.passed, true)
})

test("enforcePolicy blocks transition in enforce mode", () => {
  const dir = makeTempDir()
  const result = enforcePolicy({ mode: "full", targetStage: "full_code_review", runtimeRoot: dir, workItemId: null, enforcementMode: "enforce" })
  assert.equal(result.allowed, false)
  assert.equal(result.violations.length, 1)
})

test("enforcePolicy allows transition with warnings in warn mode", () => {
  const dir = makeTempDir()
  const result = enforcePolicy({ mode: "full", targetStage: "full_code_review", runtimeRoot: dir, workItemId: null, enforcementMode: "warn" })
  assert.equal(result.allowed, true)
  assert.equal(result.warnings.length, 1)
})

test("enforcePolicy skips check in off mode", () => {
  const dir = makeTempDir()
  const result = enforcePolicy({ mode: "full", targetStage: "full_code_review", runtimeRoot: dir, workItemId: null, enforcementMode: "off" })
  assert.equal(result.allowed, true)
  assert.equal(result.violations.length, 0)
  assert.equal(result.warnings.length, 0)
})

test("Tier 3 policy blocks advanceStage to full_code_review without tool invocations", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-900", "policy-block-code-review", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-900", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record Tier 2 tool evidence so Tier 2 gate passes
  recordVerificationEvidence(
    {
      id: "rule-scan-900",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  // Tier 2 passes but Tier 3 should fail because no runtime invocation was recorded
  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /Runtime policy blocked advance to 'full_code_review'/,
  )
})

test("Tier 3 policy allows advanceStage to full_code_review with tool invocation log entries", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-901", "policy-pass-code-review", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-901", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record Tier 2 tool evidence
  recordVerificationEvidence(
    {
      id: "rule-scan-901",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  // Write invocation log entries so Tier 3 passes
  writeInvocationLogEntries(statePath, "feature-901", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])

  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
})

test("Tier 3 policy manual override bypasses policy check", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-902", "policy-manual-override", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-902", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record Tier 2 tool evidence (the manual override below also covers Tier 2 gate)
  recordVerificationEvidence(
    {
      id: "manual-override-902",
      kind: "manual",
      scope: "tool-evidence-override:full_code_review",
      summary: "tool.rule-scan unavailable — semgrep not installed; manually reviewed changed files",
      source: "manual",
      details: makeValidManualOverrideDetails({ targetStage: "full_code_review", unavailableTool: "tool.rule-scan" }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  // No invocation log entries — the manual override should bypass both Tier 2 and Tier 3
  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
})

test("manual override without structured caveat details is rejected", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-6", "scan-gate-malformed-override", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-6", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "manual-override-malformed",
      kind: "manual",
      scope: "tool-evidence-override:full_code_review",
      summary: "Manual override lacks structured scan caveats",
      source: "manual",
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /manual override.*target stage.*unavailable tool.*reason.*substitute.*actor.*caveat/i,
  )
})

test("manual override cannot bypass triage of noisy available scan output", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-939-7", "scan-gate-override-noise", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-939-7", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  recordVerificationEvidence(
    {
      id: "rule-scan-noisy-untriaged",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan succeeded but noisy findings were not triaged",
      source: "tool.rule-scan",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        groups: [
          {
            ruleId: "openkit.quality.noisy-rule",
            severity: "WARNING",
            classification: "unclassified",
            count: 2301,
          },
        ],
      }),
    },
    statePath,
  )
  recordVerificationEvidence(
    {
      id: "manual-override-noisy-output",
      kind: "manual",
      scope: "tool-evidence-override:full_code_review",
      summary: "Attempted override after noisy scan output",
      source: "manual",
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeValidManualOverrideDetails({
        targetStage: "full_code_review",
        unavailableTool: "tool.rule-scan",
        availabilityState: "available",
        resultState: "succeeded",
      }),
    },
    statePath,
  )
  writeInvocationLogEntries(statePath, "feature-939-7", [
    { tool_id: "tool.rule-scan", status: "success", duration_ms: 100, stage: null, owner: null, recorded_at: "2026-03-21T00:00:00.000Z" },
  ])
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  assert.throws(
    () => advanceStage("full_code_review", statePath),
    /manual override.*available scan output.*triag/i,
  )
})

test("Tier 3 policy warn mode allows transition and records issue", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-903", "policy-warn-mode", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-903", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record Tier 2 tool evidence so Tier 2 gate passes
  recordVerificationEvidence(
    {
      id: "rule-scan-903",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  // Set policy_enforcement to warn — no invocation log, should still pass with a warning issue
  setWorkItemField(statePath, "feature-903", "policy_enforcement", "warn")

  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
  // Should have added a policy warning issue
  const policyIssues = result.state.issues.filter((issue) => issue.title.includes("Policy warning"))
  assert.ok(policyIssues.length > 0, "should have recorded at least one policy warning issue")
})

test("Tier 3 policy off mode skips policy check entirely", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-904", "policy-off-mode", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-904", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record Tier 2 tool evidence so Tier 2 gate passes
  recordVerificationEvidence(
    {
      id: "rule-scan-904",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan on changed files",
      source: "tool.rule-scan",
      details: makeScanEvidenceDetails({ groups: [] }),
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
    statePath,
  )
  setApproval("fullstack_to_code_review", "approved", "CodeReviewer", "2026-03-21", "Ready for review", statePath)

  // Set policy_enforcement to off
  setWorkItemField(statePath, "feature-904", "policy_enforcement", "off")

  // No invocation log entries — policy is off so it should pass
  const result = advanceStage("full_code_review", statePath)
  assert.equal(result.state.current_stage, "full_code_review")
  // No policy warning issues should have been added
  const policyIssues = result.state.issues.filter((issue) => issue.title.includes("Policy warning"))
  assert.equal(policyIssues.length, 0, "should not have policy warning issues when policy is off")
})

test("definition of done includes Tier 3 policy blockers", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-905", "dod-policy-blockers", statePath)
  advanceFullWorkItemToPlan(statePath)

  const dod = getDefinitionOfDone(statePath)
  assert.equal(dod.ready, false)
  assert.ok(Array.isArray(dod.policyBlockers), "policyBlockers should be an array")
  // At full_solution, the policy for full_code_review and full_qa should show blockers
  assert.ok(dod.policyBlockers.length > 0, "should have policy blockers for full mode")
})

test("policy execution trace includes tool-invocation-policy-engine entry", () => {
  const trace = getPolicyExecutionTrace()
  const policyEntry = trace.policies.find((p) => p.id === "tool-invocation-policy-engine")
  assert.ok(policyEntry, "trace should include tool-invocation-policy-engine policy")
  assert.equal(policyEntry.level, "muc-3")
  assert.ok(policyEntry.runtime.includes(".opencode/lib/policy-engine.js#enforcePolicy"))
})

// ---------------------------------------------------------------------------
// Dynamic work-item invocation logger tests
//
// These tests validate the `getWorkItemId` dynamic getter added so the
// runtime invocation logger writes to per-work-item logs that the policy
// engine can see during stage transitions.
// ---------------------------------------------------------------------------

test("invocation logger with getWorkItemId writes to per-work-item log", () => {
  const dir = makeTempDir()
  let activeId = "feature-dynamic-1"
  const logger = createInvocationLogger({
    runtimeRoot: dir,
    getWorkItemId: () => activeId,
  })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 50 })

  const expectedPath = resolveLogPath(dir, "feature-dynamic-1")
  assert.ok(fs.existsSync(expectedPath), "log should exist at per-work-item path from getter")

  const globalPath = resolveLogPath(dir, null)
  assert.ok(!fs.existsSync(globalPath), "global log should not exist when getter provides work item id")

  const entries = logger.getEntries()
  assert.equal(entries.length, 1)
  assert.equal(entries[0].tool_id, "tool.rule-scan")
})

test("invocation logger with getWorkItemId follows active work item changes", () => {
  const dir = makeTempDir()
  let activeId = "feature-a"
  const logger = createInvocationLogger({
    runtimeRoot: dir,
    getWorkItemId: () => activeId,
  })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 30 })

  // Switch active work item
  activeId = "feature-b"
  logger.record({ toolId: "tool.security-scan", status: "success", durationMs: 40 })

  // Each work item should have its own entry
  const entriesA = JSON.parse(
    fs.readFileSync(resolveLogPath(dir, "feature-a"), "utf8")
  ).entries
  const entriesB = JSON.parse(
    fs.readFileSync(resolveLogPath(dir, "feature-b"), "utf8")
  ).entries

  assert.equal(entriesA.length, 1, "feature-a should have 1 entry")
  assert.equal(entriesA[0].tool_id, "tool.rule-scan")
  assert.equal(entriesB.length, 1, "feature-b should have 1 entry")
  assert.equal(entriesB[0].tool_id, "tool.security-scan")
})

test("invocation logger with getWorkItemId falls back to static workItemId when getter returns null", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({
    runtimeRoot: dir,
    workItemId: "static-fallback",
    getWorkItemId: () => null,
  })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 20 })

  const expectedPath = resolveLogPath(dir, "static-fallback")
  assert.ok(fs.existsSync(expectedPath), "log should fall back to static workItemId")

  const entries = logger.getEntries()
  assert.equal(entries.length, 1)
})

test("invocation logger with getWorkItemId falls back to global log when both getter and static are null", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({
    runtimeRoot: dir,
    workItemId: null,
    getWorkItemId: () => null,
  })

  logger.record({ toolId: "tool.rule-scan", status: "success", durationMs: 10 })

  const globalPath = resolveLogPath(dir, null)
  assert.ok(fs.existsSync(globalPath), "log should fall back to global path")

  const entries = logger.getEntries()
  assert.equal(entries.length, 1)
})

test("invocation logger without runtimeRoot returns no-op logger", () => {
  const logger = createInvocationLogger({ runtimeRoot: null })

  // Should not throw
  logger.record({ toolId: "tool.rule-scan", status: "success" })
  assert.deepEqual(logger.getEntries(), [])
  assert.equal(logger.hasSuccessfulInvocation("tool.rule-scan"), false)
  assert.equal(logger.logPath, null)
})

test("invocation logger logPath getter reflects dynamic work item", () => {
  const dir = makeTempDir()
  let activeId = "feature-x"
  const logger = createInvocationLogger({
    runtimeRoot: dir,
    getWorkItemId: () => activeId,
  })

  const path1 = logger.logPath
  assert.ok(path1.includes("feature-x"), "logPath should reflect current work item id")

  activeId = "feature-y"
  const path2 = logger.logPath
  assert.ok(path2.includes("feature-y"), "logPath should update when active work item changes")
  assert.notEqual(path1, path2, "logPaths should differ after active work item change")
})

test("invocation logger records stage and owner metadata", () => {
  const dir = makeTempDir()
  const logger = createInvocationLogger({ runtimeRoot: dir, workItemId: null })

  logger.record({
    toolId: "tool.rule-scan",
    status: "success",
    durationMs: 100,
    stage: "full_implementation",
    owner: "CodeReviewer",
  })

  const entries = logger.getEntries()
  assert.equal(entries.length, 1)
  assert.equal(entries[0].stage, "full_implementation")
  assert.equal(entries[0].owner, "CodeReviewer")
})

// ---------------------------------------------------------------------------
// getInvocationLog / getPolicyStatus (CLI diagnostic functions)
// ---------------------------------------------------------------------------

test("getInvocationLog returns invocation log entries for the active work item", () => {
  const statePath = createTempStateFile()

  // Start a full-delivery feature and advance to implementation
  startFeature("FEATURE-DIAG-1", "diag-one", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-diag-1", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Write some invocation log entries
  writeInvocationLogEntries(statePath, "feature-diag-1", [
    { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:00:00Z" },
    { tool_id: "tool.security-scan", status: "failure", recorded_at: "2026-03-21T00:01:00Z" },
    { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:02:00Z" },
  ])

  const result = getInvocationLog(null, statePath)

  assert.equal(result.workItemId, "feature-diag-1")
  assert.equal(result.totalEntries, 3)
  assert.equal(result.successfulEntries, 2)
  assert.equal(result.failedEntries, 1)
  assert.ok(result.uniqueTools.includes("tool.rule-scan"))
  assert.ok(result.uniqueTools.includes("tool.security-scan"))
  assert.ok(result.logPath.includes("feature-diag-1"))
})

test("getInvocationLog returns empty result when no invocations exist", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-DIAG-2", "diag-two", statePath)

  const result = getInvocationLog(null, statePath)

  assert.equal(result.workItemId, "feature-diag-2")
  assert.equal(result.totalEntries, 0)
  assert.equal(result.successfulEntries, 0)
  assert.equal(result.failedEntries, 0)
  assert.deepEqual(result.uniqueTools, [])
})

test("getInvocationLog accepts explicit work item id", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-DIAG-3A", "diag-three-a", statePath)

  // Write entries to first work item
  writeInvocationLogEntries(statePath, "feature-diag-3a", [
    { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:00:00Z" },
  ])

  // Create second work item (which becomes active)
  startFeature("FEATURE-DIAG-3B", "diag-three-b", statePath)

  // Explicit id reads first work item even though second is active
  const result = getInvocationLog("feature-diag-3a", statePath)
  assert.equal(result.workItemId, "feature-diag-3a")
  assert.equal(result.totalEntries, 1)
})

test("getPolicyStatus returns policy check for the next stage transition", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-POL-1", "pol-one", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-pol-1", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // No invocations recorded yet — policy should show blocked
  const result = getPolicyStatus(statePath)

  assert.equal(result.mode, "full")
  assert.equal(result.currentStage, "full_implementation")
  assert.equal(result.nextStage, "full_code_review")
  assert.equal(result.enforcementMode, "enforce")
  assert.equal(result.hasManualOverride, false)

  // Tier 3 policy should show not passed (no tool.rule-scan invocation)
  assert.ok(result.policy)
  assert.equal(result.policy.passed, false)
  assert.ok(result.policy.violations.length > 0)

  // Now add the required invocation
  writeInvocationLogEntries(statePath, "feature-pol-1", [
    { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:00:00Z" },
  ])

  const result2 = getPolicyStatus(statePath)
  assert.equal(result2.policy.passed, true)
  assert.equal(result2.policy.violations.length, 0)
})

test("getPolicyStatus detects manual override", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-POL-2", "pol-two", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-pol-2", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("solution_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)

  // Record manual override
  recordVerificationEvidence(
    {
      id: "manual-override-cr",
      kind: "manual",
      scope: "tool-evidence-override:full_code_review",
      summary: "Manual override for testing",
      source: "manual",
      recorded_at: new Date().toISOString(),
    },
    statePath,
  )

  const result = getPolicyStatus(statePath)
  assert.equal(result.hasManualOverride, true)
})
