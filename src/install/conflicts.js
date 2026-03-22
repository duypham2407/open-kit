export function createMaterializationConflict({
  assetId,
  path,
  field,
  reason,
  currentValue,
  desiredValue,
  resolution = "manual-review-required",
}) {
  const conflict = {
    assetId,
    path,
    reason,
    resolution,
  }

  if (field !== undefined) {
    conflict.field = field
  }

  if (currentValue !== undefined) {
    conflict.currentValue = currentValue
  }

  if (desiredValue !== undefined) {
    conflict.desiredValue = desiredValue
  }

  return conflict
}

export function qualifyMergeConflicts(mergeConflicts, assetId, assetPath) {
  return mergeConflicts.map((conflict) =>
    createMaterializationConflict({
      assetId,
      path: assetPath,
      field: conflict.field,
      reason: conflict.reason,
      currentValue: conflict.currentValue,
      desiredValue: conflict.desiredValue,
    }),
  )
}
