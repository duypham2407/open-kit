const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")

const {
  bootstrapLegacyWorkflowState,
  deriveWorkItemId,
  readWorkItemIndex,
  readWorkItemState,
  refreshCompatibilityMirror,
  resolveWorkItemPaths,
  setActiveWorkItem,
  validateActiveMirror,
  writeWorkItemIndex,
  writeWorkItemState,
} = require("../lib/work-item-store")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-work-item-store-"))
}

function createFixtureState(overrides = {}) {
  return {
    feature_id: "FEATURE-001",
    feature_slug: "task-intake-dashboard",
    mode: "full",
    mode_reason: "Feature-sized workflow example with full artifact chain and approvals",
    routing_profile: {
      work_intent: "feature",
      behavior_delta: "extend",
      dominant_uncertainty: "product",
      scope_shape: "cross_boundary",
      selection_reason: "Feature-sized workflow example with full artifact chain and approvals",
    },
    current_stage: "full_done",
    status: "done",
    current_owner: "MasterOrchestrator",
    artifacts: {
      task_card: null,
      scope_package: "docs/scope/2026-03-20-task-intake-dashboard.md",
      solution_package: "docs/solution/2026-03-20-task-intake-dashboard.md",
      brief: "docs/briefs/2026-03-20-task-intake-dashboard.md",
      spec: "docs/scope/2026-03-20-task-intake-dashboard.md",
      architecture: "docs/architecture/2026-03-20-task-intake-dashboard.md",
      plan: "docs/solution/2026-03-20-task-intake-dashboard.md",
      migration_report: null,
      qa_report: "docs/qa/2026-03-20-task-intake-dashboard.md",
      adr: [],
    },
    approvals: {
      product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-20", notes: null },
      solution_to_fullstack: { status: "approved", approved_by: "user", approved_at: "2026-03-20", notes: null },
      fullstack_to_code_review: { status: "approved", approved_by: "user", approved_at: "2026-03-20", notes: null },
      code_review_to_qa: { status: "approved", approved_by: "user", approved_at: "2026-03-20", notes: null },
      qa_to_done: { status: "approved", approved_by: "user", approved_at: "2026-03-20", notes: null },
    },
    issues: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: "2026-03-20",
    ...overrides,
  }
}

function setupLegacyState(projectRoot, overrides = {}) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })

  const state = createFixtureState(overrides)
  const statePath = path.join(opencodeDir, "workflow-state.json")
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  return {
    state,
    statePath,
  }
}

test("deriveWorkItemId uses a persisted id when present and otherwise derives a stable slug from feature_id", () => {
  assert.equal(deriveWorkItemId({ work_item_id: "existing-item", feature_id: "FEATURE-001" }), "existing-item")
  assert.equal(deriveWorkItemId({ feature_id: "FEATURE-001" }), "feature-001")
  assert.equal(deriveWorkItemId({ feature_id: "Feature 001 / Alpha" }), "feature-001-alpha")
})

test("bootstrapLegacyWorkflowState creates index and per-item state from the compatibility file without duplicates", () => {
  const projectRoot = makeTempProject()
  const { state } = setupLegacyState(projectRoot)

  const firstResult = bootstrapLegacyWorkflowState(projectRoot)
  const secondResult = bootstrapLegacyWorkflowState(projectRoot)

  assert.equal(firstResult.workItemId, "feature-001")
  assert.equal(secondResult.workItemId, "feature-001")

  const index = readWorkItemIndex(projectRoot)
  assert.equal(index.active_work_item_id, "feature-001")
  assert.equal(index.work_items.length, 1)
  assert.deepEqual(index.work_items[0], {
    work_item_id: "feature-001",
    feature_id: state.feature_id,
    feature_slug: state.feature_slug,
    mode: state.mode,
    status: state.status,
    state_path: ".opencode/work-items/feature-001/state.json",
  })

  const perItemState = readWorkItemState(projectRoot, "feature-001")
  assert.equal(perItemState.work_item_id, "feature-001")
  assert.equal(perItemState.feature_id, state.feature_id)

  const mirrorState = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"),
  )
  assert.equal(mirrorState.work_item_id, "feature-001")
  assert.deepEqual(mirrorState, perItemState)
})

test("readWorkItemIndex and writeWorkItemIndex round-trip the minimal index shape", () => {
  const projectRoot = makeTempProject()

  writeWorkItemIndex(projectRoot, {
    active_work_item_id: "feature-900",
    work_items: [
      {
        work_item_id: "feature-900",
        feature_id: "FEATURE-900",
        feature_slug: "runtime-updates",
        mode: "full",
        status: "in_progress",
        state_path: ".opencode/work-items/feature-900/state.json",
      },
    ],
  })

  assert.deepEqual(readWorkItemIndex(projectRoot), {
    active_work_item_id: "feature-900",
    work_items: [
      {
        work_item_id: "feature-900",
        feature_id: "FEATURE-900",
        feature_slug: "runtime-updates",
        mode: "full",
        status: "in_progress",
        state_path: ".opencode/work-items/feature-900/state.json",
      },
    ],
  })
})

test("readWorkItemState and writeWorkItemState round-trip one work item state file", () => {
  const projectRoot = makeTempProject()
  const state = createFixtureState({
    work_item_id: "feature-777",
    feature_id: "FEATURE-777",
    feature_slug: "isolated-store-helper",
    status: "in_progress",
  })

  writeWorkItemState(projectRoot, "feature-777", state)

  const persistedState = readWorkItemState(projectRoot, "feature-777")
  assert.deepEqual(persistedState, state)

  const paths = resolveWorkItemPaths(projectRoot, "feature-777")
  assert.equal(fs.existsSync(paths.statePath), true)
})

test("writeWorkItemState persists the stable work_item_id for general state writes", () => {
  const projectRoot = makeTempProject()

  writeWorkItemState(projectRoot, "feature-888", createFixtureState({
    feature_id: "FEATURE-888",
    feature_slug: "stable-id-write",
    status: "in_progress",
  }))

  const persistedState = readWorkItemState(projectRoot, "feature-888")
  assert.equal(persistedState.work_item_id, "feature-888")
  assert.equal(persistedState.feature_id, "FEATURE-888")
})

test("setActiveWorkItem updates the active pointer independently of mirror refresh", () => {
  const projectRoot = makeTempProject()
  setupLegacyState(projectRoot)
  bootstrapLegacyWorkflowState(projectRoot)

  writeWorkItemState(projectRoot, "feature-002", createFixtureState({
    work_item_id: "feature-002",
    feature_id: "FEATURE-002",
    feature_slug: "parallel-runtime",
    status: "in_progress",
  }))
  writeWorkItemIndex(projectRoot, {
    active_work_item_id: "feature-001",
    work_items: [
      {
        work_item_id: "feature-001",
        feature_id: "FEATURE-001",
        feature_slug: "task-intake-dashboard",
        mode: "full",
        status: "done",
        state_path: ".opencode/work-items/feature-001/state.json",
      },
      {
        work_item_id: "feature-002",
        feature_id: "FEATURE-002",
        feature_slug: "parallel-runtime",
        mode: "full",
        status: "in_progress",
        state_path: ".opencode/work-items/feature-002/state.json",
      },
    ],
  })

  setActiveWorkItem(projectRoot, "feature-002")

  const index = readWorkItemIndex(projectRoot)
  const mirrorState = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"),
  )

  assert.equal(index.active_work_item_id, "feature-002")
  assert.equal(mirrorState.work_item_id, "feature-001")
})

test("setActiveWorkItem rejects an index entry whose state file is missing", () => {
  const projectRoot = makeTempProject()
  setupLegacyState(projectRoot)
  bootstrapLegacyWorkflowState(projectRoot)

  writeWorkItemIndex(projectRoot, {
    active_work_item_id: "feature-001",
    work_items: [
      {
        work_item_id: "feature-001",
        feature_id: "FEATURE-001",
        feature_slug: "task-intake-dashboard",
        mode: "full",
        status: "done",
        state_path: ".opencode/work-items/feature-001/state.json",
      },
      {
        work_item_id: "feature-404",
        feature_id: "FEATURE-404",
        feature_slug: "missing-state",
        mode: "full",
        status: "in_progress",
        state_path: ".opencode/work-items/feature-404/state.json",
      },
    ],
  })

  assert.throws(() => setActiveWorkItem(projectRoot, "feature-404"), /Work-item state missing/)
  assert.equal(readWorkItemIndex(projectRoot).active_work_item_id, "feature-001")
})

test("refreshCompatibilityMirror writes from the active per-item state and validateActiveMirror reports stale or missing mirrors", () => {
  const projectRoot = makeTempProject()
  setupLegacyState(projectRoot)
  bootstrapLegacyWorkflowState(projectRoot)

  writeWorkItemState(projectRoot, "feature-001", createFixtureState({
    work_item_id: "feature-001",
    feature_id: "FEATURE-001",
    feature_slug: "task-intake-dashboard",
    status: "in_progress",
    updated_at: "2026-03-21",
  }))

  assert.throws(() => validateActiveMirror(projectRoot), /Compatibility mirror diverged/)

  refreshCompatibilityMirror(projectRoot)
  assert.doesNotThrow(() => validateActiveMirror(projectRoot))

  fs.rmSync(path.join(projectRoot, ".opencode", "workflow-state.json"))
  assert.throws(() => validateActiveMirror(projectRoot), /Compatibility mirror missing/)
})

test("validateActiveMirror accepts reordered but semantically equivalent JSON content", () => {
  const projectRoot = makeTempProject()
  setupLegacyState(projectRoot)
  bootstrapLegacyWorkflowState(projectRoot)

  const activeState = readWorkItemState(projectRoot, "feature-001")
  const reorderedMirrorState = {
    updated_at: activeState.updated_at,
    escalation_reason: activeState.escalation_reason,
    escalated_from: activeState.escalated_from,
    retry_count: activeState.retry_count,
    issues: activeState.issues,
    approvals: {
      qa_to_done: activeState.approvals.qa_to_done,
      code_review_to_qa: activeState.approvals.code_review_to_qa,
      fullstack_to_code_review: activeState.approvals.fullstack_to_code_review,
      solution_to_fullstack: activeState.approvals.solution_to_fullstack,
      product_to_solution: activeState.approvals.product_to_solution,
    },
    artifacts: {
      adr: activeState.artifacts.adr,
      qa_report: activeState.artifacts.qa_report,
      migration_report: activeState.artifacts.migration_report,
      plan: activeState.artifacts.plan,
      architecture: activeState.artifacts.architecture,
      spec: activeState.artifacts.spec,
      brief: activeState.artifacts.brief,
      solution_package: activeState.artifacts.solution_package,
      scope_package: activeState.artifacts.scope_package,
      task_card: activeState.artifacts.task_card,
    },
    current_owner: activeState.current_owner,
    status: activeState.status,
    current_stage: activeState.current_stage,
    routing_profile: {
      selection_reason: activeState.routing_profile.selection_reason,
      scope_shape: activeState.routing_profile.scope_shape,
      dominant_uncertainty: activeState.routing_profile.dominant_uncertainty,
      behavior_delta: activeState.routing_profile.behavior_delta,
      work_intent: activeState.routing_profile.work_intent,
    },
    mode_reason: activeState.mode_reason,
    mode: activeState.mode,
    feature_slug: activeState.feature_slug,
    feature_id: activeState.feature_id,
    work_item_id: activeState.work_item_id,
  }

  fs.writeFileSync(
    path.join(projectRoot, ".opencode", "workflow-state.json"),
    `${JSON.stringify(reorderedMirrorState, null, 2)}\n`,
    "utf8",
  )

  assert.doesNotThrow(() => validateActiveMirror(projectRoot))
})

test("activating a different work item and refreshing the mirror rewrites compatibility state from the new active item", () => {
  const projectRoot = makeTempProject()
  setupLegacyState(projectRoot)
  bootstrapLegacyWorkflowState(projectRoot)

  writeWorkItemState(projectRoot, "feature-002", createFixtureState({
    feature_id: "FEATURE-002",
    feature_slug: "parallel-runtime",
    status: "in_progress",
    updated_at: "2026-03-21",
  }))
  writeWorkItemIndex(projectRoot, {
    active_work_item_id: "feature-001",
    work_items: [
      {
        work_item_id: "feature-001",
        feature_id: "FEATURE-001",
        feature_slug: "task-intake-dashboard",
        mode: "full",
        status: "done",
        state_path: ".opencode/work-items/feature-001/state.json",
      },
      {
        work_item_id: "feature-002",
        feature_id: "FEATURE-002",
        feature_slug: "parallel-runtime",
        mode: "full",
        status: "in_progress",
        state_path: ".opencode/work-items/feature-002/state.json",
      },
    ],
  })

  setActiveWorkItem(projectRoot, "feature-002")
  refreshCompatibilityMirror(projectRoot)

  const mirrorState = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"),
  )
  assert.equal(mirrorState.work_item_id, "feature-002")
  assert.equal(mirrorState.feature_id, "FEATURE-002")
  assert.equal(mirrorState.feature_slug, "parallel-runtime")
  assert.equal(mirrorState.updated_at, "2026-03-21")
})
