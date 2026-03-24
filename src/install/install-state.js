import { getOpenKitVersion } from '../version.js'

export const INSTALL_STATE_SCHEMA = "openkit/install-state@1"

const MANAGED_STATUSES = new Set(["managed", "materialized"])
const ISO_8601_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

function createIsoTimestamp(now = new Date()) {
  return now.toISOString()
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && ISO_8601_TIMESTAMP_PATTERN.test(value)
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function isArray(value) {
  return Array.isArray(value)
}

export function createInstallState({
  kitVersion = getOpenKitVersion(),
  profile = "openkit-core",
  managedAssets = [],
  adoptedAssets = [],
  warnings = [],
  conflicts = [],
  now,
} = {}) {
  return {
    schema: INSTALL_STATE_SCHEMA,
    stateVersion: 1,
    kit: {
      name: "OpenKit",
      version: kitVersion,
    },
    installation: {
      profile,
      status: "installed",
      installedAt: createIsoTimestamp(now),
    },
    assets: {
      managed: normalizeArray(managedAssets),
      adopted: normalizeArray(adoptedAssets),
    },
    warnings: normalizeArray(warnings),
    conflicts: normalizeArray(conflicts),
  }
}

export function validateInstallState(state) {
  const errors = []

  if (!state || typeof state !== "object") {
    return ["install state must be an object"]
  }

  if (state.schema !== INSTALL_STATE_SCHEMA) {
    errors.push(`schema must be '${INSTALL_STATE_SCHEMA}'`)
  }

  if (state.stateVersion !== 1) {
    errors.push("stateVersion must be 1")
  }

  if (!isNonEmptyString(state.kit?.name)) {
    errors.push("kit.name must be a non-empty string")
  }

  if (!isNonEmptyString(state.kit?.version)) {
    errors.push("kit.version must be a non-empty string")
  }

  if (!isNonEmptyString(state.installation?.profile)) {
    errors.push("installation.profile must be a non-empty string")
  }

  if (state.installation?.status !== "installed") {
    errors.push("installation.status must be 'installed'")
  }

  if (!isIsoTimestamp(state.installation?.installedAt)) {
    errors.push("installation.installedAt must be an ISO-8601 timestamp")
  }

  if (!isArray(state.assets?.managed)) {
    errors.push("assets.managed must be an array")
  } else {
    state.assets.managed.forEach((asset, index) => {
      if (!isNonEmptyString(asset?.path)) {
        errors.push(`assets.managed[${index}].path must be a non-empty string`)
      }

      if (!MANAGED_STATUSES.has(asset?.status)) {
        errors.push(`assets.managed[${index}].status must be one of: managed, materialized`)
      }
    })
  }

  if (!isArray(state.assets?.adopted)) {
    errors.push("assets.adopted must be an array")
  } else {
    state.assets.adopted.forEach((asset, index) => {
      if (asset?.status !== "adopted") {
        errors.push(`assets.adopted[${index}].status must be 'adopted'`)
      }
    })
  }

  if (!isArray(state.warnings)) {
    errors.push("warnings must be an array")
  } else {
    state.warnings.forEach((warning, index) => {
      if (!isNonEmptyString(warning?.code)) {
        errors.push(`warnings[${index}].code must be a non-empty string`)
      }
    })
  }

  if (!isArray(state.conflicts)) {
    errors.push("conflicts must be an array")
  } else {
    state.conflicts.forEach((conflict, index) => {
      if (!isNonEmptyString(conflict?.reason)) {
        errors.push(`conflicts[${index}].reason must be a non-empty string`)
      }
    })
  }

  return errors
}
