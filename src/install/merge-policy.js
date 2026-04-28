import { isOpenCodeConfigTopLevelKey, sanitizeOpenCodeConfig } from "../opencode/config-schema.js"

const OPENKIT_MERGE_ALLOWLIST = new Set([
  "plugin",
  "instructions",
  "mcp",
  "permission",
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
  const sanitizedCurrent = sanitizeOpenCodeConfig(currentConfig).config
  const sanitizedDesired = sanitizeOpenCodeConfig(desiredConfig).config
  const keys = new Set([...Object.keys(sanitizedCurrent), ...Object.keys(sanitizedDesired)])

  for (const key of keys) {
    const hasCurrent = Object.hasOwn(sanitizedCurrent, key)
    const hasDesired = Object.hasOwn(sanitizedDesired, key)

    if (!hasDesired) {
      if (!isOpenCodeConfigTopLevelKey(key)) {
        conflicts.push({
          field: key,
          reason: "schema-invalid-top-level-key",
          currentValue: cloneValue(sanitizedCurrent[key]),
          desiredValue: undefined,
        })
        continue
      }

      config[key] = cloneValue(sanitizedCurrent[key])
      continue
    }

    if (OPENKIT_MERGE_ALLOWLIST.has(key)) {
      if (Array.isArray(sanitizedDesired[key])) {
        config[key] = mergeUniqueArray(sanitizedCurrent[key], sanitizedDesired[key])
        appliedFields.push(key)
        continue
      }

      if (!hasCurrent) {
        config[key] = cloneValue(sanitizedDesired[key])
        appliedFields.push(key)
        continue
      }

      config[key] = cloneValue(sanitizedCurrent[key])

      if (!valuesMatch(sanitizedCurrent[key], sanitizedDesired[key])) {
        conflicts.push({
          field: key,
          reason: "unsupported-top-level-key",
          currentValue: cloneValue(sanitizedCurrent[key]),
          desiredValue: cloneValue(sanitizedDesired[key]),
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
        desiredValue: cloneValue(sanitizedDesired[key]),
      })
      continue
    }

    config[key] = cloneValue(sanitizedCurrent[key])

    if (!Object.is(sanitizedCurrent[key], sanitizedDesired[key])) {
      conflicts.push({
        field: key,
        reason: "unsupported-top-level-key",
        currentValue: cloneValue(sanitizedCurrent[key]),
        desiredValue: cloneValue(sanitizedDesired[key]),
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
