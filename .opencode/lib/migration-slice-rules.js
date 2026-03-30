const MIGRATION_SLICE_STATUS_VALUES = [
  "queued",
  "ready",
  "claimed",
  "in_progress",
  "parity_ready",
  "verified",
  "blocked",
  "cancelled",
]

const MIGRATION_SLICE_REQUIRED_FIELDS = {
  slice_id: "string",
  title: "string",
  summary: "string",
  kind: "string",
  status: "string",
  depends_on: "array",
  blocked_by: "array",
  artifact_refs: "array",
  preserved_invariants: "array",
  compatibility_risks: "array",
  verification_targets: "array",
  rollback_notes: "array",
  created_by: "string",
  created_at: "string",
  updated_at: "string",
}

const TRANSITIONS = new Map([
  ["queued", new Set(["ready", "cancelled"])],
  ["ready", new Set(["claimed", "cancelled"])],
  ["claimed", new Set(["in_progress", "cancelled"])],
  ["in_progress", new Set(["parity_ready", "blocked", "cancelled"])],
  ["parity_ready", new Set(["verified", "blocked", "cancelled"])],
  ["blocked", new Set(["claimed", "in_progress", "cancelled"])],
  ["verified", new Set(["cancelled"])],
  ["cancelled", new Set()],
])

const DEPENDENCY_SATISFIED_STATUSES = new Set(["parity_ready", "verified", "cancelled"])

function fail(message) {
  throw new Error(message)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function validateStringArrayEntries(field, values) {
  for (const value of values) {
    if (!isNonEmptyString(value)) {
      fail(`Migration slice field '${field}' must contain only non-empty strings`)
    }
  }
}

function validateMigrationSliceStatus(status) {
  if (!MIGRATION_SLICE_STATUS_VALUES.includes(status)) {
    fail(`Unknown migration slice status '${status}'`)
  }

  return status
}

function validateMigrationSliceShape(slice) {
  if (!slice || typeof slice !== "object" || Array.isArray(slice)) {
    fail("Migration slice must be an object")
  }

  for (const [field, kind] of Object.entries(MIGRATION_SLICE_REQUIRED_FIELDS)) {
    if (!(field in slice) || slice[field] === undefined) {
      fail(`Migration slice is missing required field '${field}'`)
    }

    if (kind === "string" && !isNonEmptyString(slice[field])) {
      fail(`Migration slice field '${field}' must be a non-empty string`)
    }

    if (kind === "array") {
      if (!Array.isArray(slice[field])) {
        fail(`Migration slice field '${field}' must be an array`)
      }
      validateStringArrayEntries(field, slice[field])
    }
  }

  if (slice.primary_owner !== null && slice.primary_owner !== undefined && !isNonEmptyString(slice.primary_owner)) {
    fail("Migration slice field 'primary_owner' must be null or a non-empty string")
  }

  if (slice.qa_owner !== null && slice.qa_owner !== undefined && !isNonEmptyString(slice.qa_owner)) {
    fail("Migration slice field 'qa_owner' must be null or a non-empty string")
  }

  validateMigrationSliceStatus(slice.status)
  return slice
}

function buildSliceIndex(slices) {
  const index = new Map()
  for (const slice of slices) {
    if (index.has(slice.slice_id)) {
      fail(`Duplicate migration slice id '${slice.slice_id}'`)
    }
    index.set(slice.slice_id, slice)
  }
  return index
}

function validateMigrationSliceTransition(slice, nextStatus) {
  validateMigrationSliceShape(slice)
  validateMigrationSliceStatus(nextStatus)
  const allowed = TRANSITIONS.get(slice.status)
  if (!allowed || !allowed.has(nextStatus)) {
    fail(`Invalid migration slice transition '${slice.status} -> ${nextStatus}'`)
  }

  if ((slice.status === "queued" && nextStatus === "ready") || (slice.status === "ready" && nextStatus === "claimed")) {
    if (Array.isArray(slice.blocked_by) && slice.blocked_by.length > 0) {
      fail(`Migration slice '${slice.slice_id}' cannot move to '${nextStatus}' with a blocked dependency`)
    }
  }

  if (slice.status === "claimed" && nextStatus === "in_progress" && !isNonEmptyString(slice.primary_owner)) {
    fail(`Migration slice '${slice.slice_id}' requires a primary_owner before entering 'in_progress'`)
  }

  if (slice.status === "in_progress" && nextStatus === "parity_ready" && !isNonEmptyString(slice.primary_owner)) {
    fail(`Migration slice '${slice.slice_id}' requires a primary_owner before entering 'parity_ready'`)
  }

  if (slice.status === "parity_ready" && nextStatus === "verified" && !isNonEmptyString(slice.qa_owner)) {
    fail(`Migration slice '${slice.slice_id}' requires a qa_owner before entering 'verified'`)
  }
}

function validateMigrationSliceBoard(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    fail("Migration slice board must be an object")
  }

  if (board.mode !== "migration") {
    fail("Migration slice boards require mode 'migration'")
  }

  if (!Array.isArray(board.slices)) {
    fail("Migration slice board must include a slices array")
  }

  if (board.slices.length === 0) {
    fail("Migration slice board must include at least one slice")
  }

  const slices = board.slices.map((slice) => validateMigrationSliceShape(slice))
  const index = buildSliceIndex(slices)

  for (const slice of slices) {
    for (const dependencyId of slice.depends_on) {
      if (!index.has(dependencyId)) {
        fail(`Migration slice '${slice.slice_id}' depends on unknown slice '${dependencyId}'`)
      }
    }

    for (const blockedId of slice.blocked_by) {
      if (!index.has(blockedId)) {
        fail(`Migration slice '${slice.slice_id}' is blocked by unknown slice '${blockedId}'`)
      }
    }
  }

  for (const slice of slices) {
    const unresolvedDependencies = slice.depends_on.filter((dependencyId) => {
      const dependency = index.get(dependencyId)
      return !DEPENDENCY_SATISFIED_STATUSES.has(dependency.status)
    })

    const activeWhileBlocked = ["ready", "claimed", "in_progress"].includes(slice.status)
    if (activeWhileBlocked && unresolvedDependencies.length > 0) {
      fail(
        `Migration slice '${slice.slice_id}' cannot be '${slice.status}' while blocked by unresolved dependencies: ${unresolvedDependencies.join(", ")}`,
      )
    }

    if (slice.status === "claimed" && !isNonEmptyString(slice.primary_owner)) {
      fail(`Migration slice '${slice.slice_id}' in 'claimed' status requires a primary_owner`)
    }

    if (slice.status === "in_progress" && !isNonEmptyString(slice.primary_owner)) {
      fail(`Migration slice '${slice.slice_id}' in 'in_progress' status requires a primary_owner`)
    }

    if (slice.status === "parity_ready" && !isNonEmptyString(slice.primary_owner)) {
      fail(`Migration slice '${slice.slice_id}' in 'parity_ready' status requires a primary_owner`)
    }

    if (slice.status === "verified" && !isNonEmptyString(slice.qa_owner)) {
      fail(`Migration slice '${slice.slice_id}' in 'verified' status requires a qa_owner`)
    }
  }

  if (board.parallel_mode === "none") {
    const active = slices.filter((slice) => ["claimed", "in_progress", "parity_ready"].includes(slice.status))
    if (active.length > 1) {
      fail("Sequential migration execution allows only one active slice at a time")
    }
  }

  return board
}

module.exports = {
  MIGRATION_SLICE_STATUS_VALUES,
  validateMigrationSliceBoard,
  validateMigrationSliceShape,
  validateMigrationSliceStatus,
  validateMigrationSliceTransition,
}
