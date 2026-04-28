import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createInstallState } from "./install-state.js"
import { applyOpenKitMergePolicy } from "./merge-policy.js"
import { createMaterializationConflict, qualifyMergeConflicts } from "./conflicts.js"
import { createPermissionedOpenCodeConfigMetadata, loadDefaultCommandPermissionPolicy } from "../permissions/command-permission-policy.js"
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
  return {
    ...template,
    ...createPermissionedOpenCodeConfigMetadata(permissionPolicy),
  }
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

export function materializeInstall(projectRoot, { kitVersion = getOpenKitVersion(), now } = {}) {
  const desiredRootManifest = readTemplate("assets/opencode.json.template")
  const rootManifestPath = path.join(projectRoot, ROOT_MANIFEST_PATH)
  const installStatePath = path.join(projectRoot, INSTALL_STATE_PATH)
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
