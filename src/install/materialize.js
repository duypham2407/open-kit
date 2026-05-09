import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createInstallState } from "./install-state.js"
import { applyOpenKitMergePolicy } from "./merge-policy.js"
import { createMaterializationConflict, qualifyMergeConflicts } from "./conflicts.js"
import { createPermissionedOpenCodeConfigProjection, loadDefaultCommandPermissionPolicy } from "../permissions/command-permission-policy.js"
import { sanitizeOpenCodeConfig } from "../opencode/config-schema.js"
import { getOpenKitVersion } from "../version.js"

const ROOT_MANIFEST_ASSET_ID = "runtime.opencode-manifest"
const ROOT_MANIFEST_PATH = "opencode.json"
const INSTALL_STATE_ASSET_ID = "runtime.install-state"
const INSTALL_STATE_PATH = ".openkit/openkit-install.json"
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const BUNDLE_ROOT = path.resolve(MODULE_DIR, "../..")

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function readExistingJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return readJson(filePath)
}

function readTemplate(relativePath) {
  const template = readJson(path.join(BUNDLE_ROOT, relativePath))
  const permissionPolicy = loadDefaultCommandPermissionPolicy({ packageRoot: BUNDLE_ROOT })
  return sanitizeOpenCodeConfig({
    ...template,
    ...createPermissionedOpenCodeConfigProjection(permissionPolicy),
  }).config
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function removeFileIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

// Audit fix [2-M-6]: TOCTOU race in concurrent materializeInstall calls.
// Two parallel `openkit install` invocations could both observe
// existingInstallState === null and both proceed to write installStatePath
// and rootManifestPath, with the second write silently overwriting the
// first. Hold an exclusive lock file under the install state path's
// directory while reading + writing.
function acquireExclusiveLock(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  let fd
  try {
    fd = fs.openSync(lockPath, "wx")
  } catch (err) {
    if (err.code === "EEXIST") {
      return { acquired: false, reason: `lock file ${lockPath} already exists` }
    }
    throw err
  }
  fs.writeSync(fd, `${process.pid}\n`)
  fs.closeSync(fd)
  return { acquired: true, lockPath }
}

function releaseExclusiveLock(lockPath) {
  try {
    fs.unlinkSync(lockPath)
  } catch {
    // best-effort
  }
}

export function materializeInstall(projectRoot, { kitVersion = getOpenKitVersion(), now } = {}) {
  const desiredRootManifest = readTemplate("assets/opencode.json.template")
  const rootManifestPath = path.join(projectRoot, ROOT_MANIFEST_PATH)
  const installStatePath = path.join(projectRoot, INSTALL_STATE_PATH)

  const lockPath = `${installStatePath}.lock`
  const lock = acquireExclusiveLock(lockPath)
  if (!lock.acquired) {
    return {
      rootManifestPath,
      installStatePath,
      managedAssets: [],
      adoptedAssets: [],
      warnings: [
        `Another openkit install is already in progress (lock at ${lockPath}). If this is stale, delete the file and retry.`,
      ],
      conflicts: [
        createMaterializationConflict({
          assetId: INSTALL_STATE_ASSET_ID,
          path: INSTALL_STATE_PATH,
          reason: "concurrent-install-detected",
          resolution: "wait-for-other-install-to-finish",
        }),
      ],
    }
  }

  try {
    return runMaterializeInstall({
      projectRoot,
      kitVersion,
      now,
      desiredRootManifest,
      rootManifestPath,
      installStatePath,
    })
  } finally {
    releaseExclusiveLock(lockPath)
  }
}

function runMaterializeInstall({ projectRoot, kitVersion, now, desiredRootManifest, rootManifestPath, installStatePath }) {
  const existingRootManifest = readExistingJson(rootManifestPath)
  const existingInstallState = readExistingJson(installStatePath)

  let rootManifestToWrite = desiredRootManifest
  let rootManifestManagedStatus = "materialized"
  let adoptedAssets = []
  const warnings = []
  let conflicts = []

  if (existingRootManifest !== null) {
    const mergeResult = applyOpenKitMergePolicy({
      currentConfig: existingRootManifest,
      desiredConfig: desiredRootManifest,
    })

    conflicts = qualifyMergeConflicts(mergeResult.conflicts, ROOT_MANIFEST_ASSET_ID, ROOT_MANIFEST_PATH)

    if (conflicts.length === 0) {
      rootManifestToWrite = mergeResult.config
    } else {
      rootManifestToWrite = existingRootManifest
      rootManifestManagedStatus = null
      adoptedAssets = [
        {
          assetId: ROOT_MANIFEST_ASSET_ID,
          path: ROOT_MANIFEST_PATH,
          adoptedFrom: "user-existing",
          status: "adopted",
        },
      ]
    }
  }

  const hasExistingInstallState = existingInstallState !== null

  if (hasExistingInstallState) {
    conflicts.push(
      createMaterializationConflict({
        assetId: INSTALL_STATE_ASSET_ID,
        path: INSTALL_STATE_PATH,
        reason: "existing-managed-asset",
        resolution: "manual-review-required",
      }),
    )
  }

  if (hasExistingInstallState) {
    return {
      rootManifestPath,
      installStatePath,
      managedAssets: [],
      adoptedAssets,
      warnings,
      conflicts,
    }
  }

  if (conflicts.length > 0) {
    return {
      rootManifestPath,
      installStatePath,
      managedAssets: [],
      adoptedAssets,
      warnings,
      conflicts,
    }
  }

  const managedAssets = []

  if (rootManifestManagedStatus !== null) {
    managedAssets.push({
      assetId: ROOT_MANIFEST_ASSET_ID,
      path: ROOT_MANIFEST_PATH,
      status: rootManifestManagedStatus,
    })
  }

  managedAssets.push({
    assetId: INSTALL_STATE_ASSET_ID,
    path: INSTALL_STATE_PATH,
    status: "managed",
  })

  const installState = createInstallState({
    kitVersion,
    profile: "openkit-core",
    managedAssets,
    adoptedAssets,
    warnings,
    conflicts,
    now,
  })

  writeJson(installStatePath, installState)

  try {
    writeJson(rootManifestPath, rootManifestToWrite)
  } catch (error) {
    removeFileIfPresent(installStatePath)
    throw error
  }

  return {
    rootManifestPath,
    installStatePath,
    managedAssets,
    adoptedAssets,
    warnings,
    conflicts,
  }
}
