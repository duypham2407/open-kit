import crypto from "node:crypto"

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

/**
 * Audit fix [1-L-3]: this revision hash is order-invariant on object
 * keys (sortJsonValue) but uses JSON.stringify which has two known
 * non-canonicalisations:
 *   1. `undefined`-valued keys are dropped, so { x: undefined } and {}
 *      hash identically. State writers should normalise undefined to
 *      null before recording.
 *   2. Floating-point values are stringified at full precision, so
 *      semantically equal values that differ by IEEE-754 rounding will
 *      produce different hashes. State writers should round numeric
 *      values to a stable precision before recording if equivalence
 *      across float representations matters.
 * State currently contains no numeric fields where rounding matters,
 * and `undefined` is not a normal value in JSON-loaded state, so this
 * is a documentation note rather than an active bug.
 */
export function captureRevision(state) {
  return crypto.createHash("sha256").update(JSON.stringify(sortJsonValue(state))).digest("hex")
}

export function guardWrite({ currentState, expectedRevision, nextState }) {
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

export function planGuardedMirrorRefresh({ activeWorkItemId, targetWorkItemId, nextState }) {
  const shouldRefreshMirror = activeWorkItemId === targetWorkItemId

  return {
    shouldRefreshMirror,
    phases: shouldRefreshMirror ? ["primary", "replica"] : ["primary"],
    stateRevision: captureRevision(nextState),
    mirrorRevision: shouldRefreshMirror ? captureRevision(nextState) : null,
  }
}

export function detectMirrorDivergence({ activeWorkItemId, activeState, mirrorState }) {
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
