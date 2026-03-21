const crypto = require("crypto")

function fail(message, details = {}) {
  const error = new Error(message)
  error.isStateGuardError = true
  Object.assign(error, details)
  throw error
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortJsonValue(value[key])
        return sorted
      }, {})
  }

  return value
}

function captureRevision(state) {
  return crypto.createHash("sha256").update(JSON.stringify(sortJsonValue(state))).digest("hex")
}

function guardWrite({ currentState, expectedRevision, nextState }) {
  const currentRevision = captureRevision(currentState)

  if (expectedRevision && currentRevision !== expectedRevision) {
    fail("Rejected stale write because the expected revision no longer matches persisted state", {
      code: "STALE_WRITE",
      currentRevision,
      expectedRevision,
    })
  }

  return {
    currentRevision,
    nextRevision: captureRevision(nextState),
    nextState,
  }
}

function planGuardedMirrorRefresh({ activeWorkItemId, targetWorkItemId, nextState }) {
  const shouldRefreshMirror = activeWorkItemId === targetWorkItemId

  return {
    shouldRefreshMirror,
    phases: shouldRefreshMirror ? ["primary", "replica"] : ["primary"],
    stateRevision: captureRevision(nextState),
    mirrorRevision: shouldRefreshMirror ? captureRevision(nextState) : null,
  }
}

function detectMirrorDivergence({ activeWorkItemId, activeState, mirrorState }) {
  const activeRevision = captureRevision(activeState)

  if (!mirrorState) {
    return {
      activeWorkItemId,
      activeRevision,
      mirrorRevision: null,
      isDiverged: true,
      reason: "mirror_missing",
    }
  }

  const mirrorRevision = captureRevision(mirrorState)

  if (mirrorRevision !== activeRevision) {
    return {
      activeWorkItemId,
      activeRevision,
      mirrorRevision,
      isDiverged: true,
      reason: "revision_mismatch",
    }
  }

  return {
    activeWorkItemId,
    activeRevision,
    mirrorRevision,
    isDiverged: false,
    reason: null,
  }
}

module.exports = {
  captureRevision,
  detectMirrorDivergence,
  guardWrite,
  planGuardedMirrorRefresh,
}
