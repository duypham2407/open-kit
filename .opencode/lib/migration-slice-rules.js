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
