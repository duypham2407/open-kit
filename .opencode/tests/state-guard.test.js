const test = require("node:test")
const assert = require("node:assert/strict")

const {
  captureRevision,
  detectMirrorDivergence,
  guardWrite,
  planGuardedMirrorRefresh,
} = require("../lib/state-guard")

function createState(overrides = {}) {
  return {
    work_item_id: "feature-100",
    feature_id: "FEATURE-100",
    feature_slug: "parallel-runtime",
    mode: "full",
    current_stage: "full_plan",
    status: "in_progress",
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

test("captureRevision returns a stable revision for equivalent state content", () => {
  const first = createState({ artifacts: { plan: "docs/plans/feature-100.md", qa_report: null } })
  const second = {
    status: "in_progress",
    current_stage: "full_plan",
    updated_at: "2026-03-21T00:00:00.000Z",
    work_item_id: "feature-100",
    feature_slug: "parallel-runtime",
    feature_id: "FEATURE-100",
    mode: "full",
    artifacts: { qa_report: null, plan: "docs/plans/feature-100.md" },
  }

  const firstRevision = captureRevision(first)
  const secondRevision = captureRevision(second)

  assert.equal(typeof firstRevision, "string")
  assert.equal(firstRevision.length > 0, true)
  assert.equal(firstRevision, secondRevision)
})

test("guardWrite rejects compare-and-swap writes when the expected revision is stale", () => {
  const persistedState = createState({ status: "in_progress" })
  const staleState = createState({ status: "queued" })

  const expectedRevision = captureRevision(staleState)
  const currentRevision = captureRevision(persistedState)

  let staleWriteError = null

  try {
    guardWrite({ currentState: persistedState, expectedRevision, nextState: createState({ status: "done" }) })
  } catch (error) {
    staleWriteError = error
  }

  assert.ok(staleWriteError)
  assert.equal(staleWriteError.code, "STALE_WRITE")
  assert.equal(staleWriteError.currentRevision, currentRevision)
  assert.equal(staleWriteError.expectedRevision, expectedRevision)
})

test("planGuardedMirrorRefresh exposes abstract ordered phases without storage sink names", () => {
  const activeState = createState({ status: "ready_for_qa" })

  const activePlan = planGuardedMirrorRefresh({
    activeWorkItemId: "feature-100",
    targetWorkItemId: "feature-100",
    nextState: activeState,
  })

  assert.equal(activePlan.shouldRefreshMirror, true)
  assert.deepEqual(activePlan.phases, ["primary", "replica"])
  assert.equal(activePlan.mirrorRevision, captureRevision(activeState))

  const inactivePlan = planGuardedMirrorRefresh({
    activeWorkItemId: "feature-100",
    targetWorkItemId: "feature-101",
    nextState: createState({ work_item_id: "feature-101", feature_id: "FEATURE-101" }),
  })

  assert.equal(inactivePlan.shouldRefreshMirror, false)
  assert.deepEqual(inactivePlan.phases, ["primary"])
})

test("detectMirrorDivergence reports lagging or failed mirror refreshes against the active item revision", () => {
  const activeState = createState({ status: "done" })
  const staleMirrorState = createState({ status: "in_progress" })

  const laggingMirror = detectMirrorDivergence({
    activeWorkItemId: "feature-100",
    activeState,
    mirrorState: staleMirrorState,
  })

  assert.equal(laggingMirror.isDiverged, true)
  assert.equal(laggingMirror.reason, "revision_mismatch")

  const failedMirror = detectMirrorDivergence({
    activeWorkItemId: "feature-100",
    activeState,
    mirrorState: null,
  })

  assert.equal(failedMirror.isDiverged, true)
  assert.equal(failedMirror.reason, "mirror_missing")
})
