const OPENKIT_MERGE_ALLOWLIST = new Set([
  "plugin",
  "instructions",
  "installState",
  "permission",
  "productSurface",
])

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (isPlainObject(value)) {
    return { ...value }
  }

  return value
}

function mergeUniqueArray(currentValue, desiredValue) {
  const currentItems = Array.isArray(currentValue) ? currentValue : []
  const desiredItems = Array.isArray(desiredValue) ? desiredValue : []
  const merged = [...currentItems]

  for (const item of desiredItems) {
    if (!merged.some((existing) => Object.is(existing, item))) {
      merged.push(item)
    }
  }

  return merged
}

function valuesMatch(currentValue, desiredValue) {
  if (Object.is(currentValue, desiredValue)) {
    return true
  }

  if (Array.isArray(currentValue) || Array.isArray(desiredValue)) {
    if (!Array.isArray(currentValue) || !Array.isArray(desiredValue)) {
      return false
    }

    if (currentValue.length !== desiredValue.length) {
      return false
    }

    return currentValue.every((item, index) => valuesMatch(item, desiredValue[index]))
  }

  if (isPlainObject(currentValue) || isPlainObject(desiredValue)) {
    if (!isPlainObject(currentValue) || !isPlainObject(desiredValue)) {
      return false
    }

    const currentKeys = Object.keys(currentValue).sort()
    const desiredKeys = Object.keys(desiredValue).sort()

    if (!valuesMatch(currentKeys, desiredKeys)) {
      return false
    }

    return currentKeys.every((key) => valuesMatch(currentValue[key], desiredValue[key]))
  }

  return false
}

export function applyOpenKitMergePolicy({ currentConfig = {}, desiredConfig = {} }) {
  const config = {}
  const conflicts = []
  const appliedFields = []
  const keys = new Set([...Object.keys(currentConfig), ...Object.keys(desiredConfig)])

  for (const key of keys) {
    const hasCurrent = Object.hasOwn(currentConfig, key)
    const hasDesired = Object.hasOwn(desiredConfig, key)

    if (!hasDesired) {
      config[key] = cloneValue(currentConfig[key])
      continue
    }

    if (OPENKIT_MERGE_ALLOWLIST.has(key)) {
      if (Array.isArray(desiredConfig[key])) {
        config[key] = mergeUniqueArray(currentConfig[key], desiredConfig[key])
        appliedFields.push(key)
        continue
      }

      if (!hasCurrent) {
        config[key] = cloneValue(desiredConfig[key])
        appliedFields.push(key)
        continue
      }

      config[key] = cloneValue(currentConfig[key])

      if (!valuesMatch(currentConfig[key], desiredConfig[key])) {
        conflicts.push({
          field: key,
          reason: "unsupported-top-level-key",
          currentValue: cloneValue(currentConfig[key]),
          desiredValue: cloneValue(desiredConfig[key]),
        })
      } else {
        appliedFields.push(key)
      }

      continue
    }

    if (!hasCurrent) {
      conflicts.push({
        field: key,
        reason: "unclassified-top-level-key",
        currentValue: undefined,
        desiredValue: cloneValue(desiredConfig[key]),
      })
      continue
    }

    config[key] = cloneValue(currentConfig[key])

    if (!Object.is(currentConfig[key], desiredConfig[key])) {
      conflicts.push({
        field: key,
        reason: "unsupported-top-level-key",
        currentValue: cloneValue(currentConfig[key]),
        desiredValue: cloneValue(desiredConfig[key]),
      })
    }
  }

  return {
    config,
    conflicts,
    appliedFields,
    mergeAllowlist: [...OPENKIT_MERGE_ALLOWLIST],
  }
}
