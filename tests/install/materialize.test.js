import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { validateInstallState } from "../../src/install/install-state.js"
import { materializeInstall } from "../../src/install/materialize.js"

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-materialize-"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

test("materializeInstall creates managed wrapper files without mutating the checked-in runtime surface", () => {
  const projectRoot = makeTempDir()
  const runtimeManifestPath = path.join(projectRoot, ".opencode", "opencode.json")

  writeJson(runtimeManifestPath, {
    $schema: "https://example.com/opencode.schema.json",
    runtime: true,
  })

  const beforeRuntimeManifest = fs.readFileSync(runtimeManifestPath, "utf8")
  const result = materializeInstall(projectRoot, {
    kitVersion: "0.2.0",
    now: new Date("2026-03-22T12:00:00.000Z"),
  })

  const rootManifestPath = path.join(projectRoot, "opencode.json")
  const installStatePath = path.join(projectRoot, ".openkit", "openkit-install.json")
  const rootManifest = readJson(rootManifestPath)
  const installState = readJson(installStatePath)

  assert.equal(result.conflicts.length, 0)
  assert.equal(result.warnings.length, 0)
  assert.deepEqual(rootManifest, {
    installState: {
      path: ".openkit/openkit-install.json",
      schema: "openkit/install-state@1",
    },
    productSurface: {
      current: "managed-opencode-wrapper",
      wrapperReadiness: "managed",
      installationMode: "openkit-managed",
    },
  })
  assert.equal(fs.readFileSync(runtimeManifestPath, "utf8"), beforeRuntimeManifest)
  assert.deepEqual(validateInstallState(installState), [])
  assert.equal(installState.kit.version, "0.2.0")
  assert.equal(installState.installation.installedAt, "2026-03-22T12:00:00.000Z")
  assert.deepEqual(installState.assets.managed, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      status: "materialized",
    },
    {
      assetId: "runtime.install-state",
      path: ".openkit/openkit-install.json",
      status: "managed",
    },
  ])
})

test("materializeInstall additively inserts allowed wrapper-owned keys into an existing root manifest", () => {
  const projectRoot = makeTempDir()
  const rootManifestPath = path.join(projectRoot, "opencode.json")

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    runtime: true,
  })
  writeJson(rootManifestPath, {
    plugin: ["existing-plugin"],
    instructions: ["LOCAL.md"],
    theme: "light",
  })

  const result = materializeInstall(projectRoot, {
    now: new Date("2026-03-22T12:00:00.000Z"),
  })
  const afterRootManifest = readJson(rootManifestPath)
  const installState = readJson(path.join(projectRoot, ".openkit", "openkit-install.json"))

  assert.deepEqual(afterRootManifest, {
    plugin: ["existing-plugin"],
    instructions: ["LOCAL.md"],
    theme: "light",
    installState: {
      path: ".openkit/openkit-install.json",
      schema: "openkit/install-state@1",
    },
    productSurface: {
      current: "managed-opencode-wrapper",
      wrapperReadiness: "managed",
      installationMode: "openkit-managed",
    },
  })
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.managedAssets, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      status: "materialized",
    },
    {
      assetId: "runtime.install-state",
      path: ".openkit/openkit-install.json",
      status: "managed",
    },
  ])
  assert.deepEqual(validateInstallState(installState), [])
  assert.deepEqual(installState.assets.adopted, [])
  assert.deepEqual(installState.conflicts, result.conflicts)
})

test("materializeInstall fails closed for unsupported root manifest rewrites", () => {
  const projectRoot = makeTempDir()
  const rootManifestPath = path.join(projectRoot, "opencode.json")

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    runtime: true,
  })
  writeJson(rootManifestPath, {
    theme: "light",
    productSurface: {
      current: "custom-surface",
    },
  })

  const beforeRootManifest = fs.readFileSync(rootManifestPath, "utf8")
  const result = materializeInstall(projectRoot, {
    now: new Date("2026-03-22T12:00:00.000Z"),
  })
  const afterRootManifest = readJson(rootManifestPath)
  const installStatePath = path.join(projectRoot, ".openkit", "openkit-install.json")

  assert.deepEqual(afterRootManifest, JSON.parse(beforeRootManifest))
  assert.deepEqual(result.conflicts, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      field: "productSurface",
      reason: "unsupported-top-level-key",
      currentValue: {
        current: "custom-surface",
      },
      desiredValue: {
        current: "managed-opencode-wrapper",
        wrapperReadiness: "managed",
        installationMode: "openkit-managed",
      },
      resolution: "manual-review-required",
    },
  ])
  assert.equal(fs.existsSync(installStatePath), false)
  assert.deepEqual(result.managedAssets, [])
  assert.deepEqual(result.adoptedAssets, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      adoptedFrom: "user-existing",
      status: "adopted",
    },
  ])
})

test("materializeInstall reports pre-existing user-owned install-state without mutating wrapper assets", () => {
  const projectRoot = makeTempDir()
  const rootManifestPath = path.join(projectRoot, "opencode.json")
  const installStatePath = path.join(projectRoot, ".openkit", "openkit-install.json")

  writeJson(rootManifestPath, {
    plugin: ["existing-plugin"],
  })
  writeJson(installStatePath, {
    schema: "custom/install-state",
    owner: "user",
  })

  const beforeRootManifest = fs.readFileSync(rootManifestPath, "utf8")
  const beforeInstallState = fs.readFileSync(installStatePath, "utf8")
  const result = materializeInstall(projectRoot, {
    now: new Date("2026-03-22T12:00:00.000Z"),
  })

  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(result.conflicts, [
    {
      assetId: "runtime.install-state",
      path: ".openkit/openkit-install.json",
      reason: "existing-managed-asset",
      resolution: "manual-review-required",
    },
  ])
  assert.equal(fs.readFileSync(rootManifestPath, "utf8"), beforeRootManifest)
  assert.equal(fs.readFileSync(installStatePath, "utf8"), beforeInstallState)
})

test("materializeInstall does not leave a dangling root manifest when install-state write fails", () => {
  const projectRoot = makeTempDir()
  const runtimeManifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const rootManifestPath = path.join(projectRoot, "opencode.json")
  const openkitDirPath = path.join(projectRoot, ".openkit")
  const originalWriteFileSync = fs.writeFileSync

  writeJson(runtimeManifestPath, {
    runtime: true,
  })

  fs.mkdirSync(openkitDirPath, { recursive: true })

  try {
    fs.writeFileSync = (filePath, data, options) => {
      if (filePath === path.join(projectRoot, ".openkit", "openkit-install.json")) {
        throw new Error("simulated install-state write failure")
      }

      return originalWriteFileSync(filePath, data, options)
    }

    assert.throws(
      () => {
        materializeInstall(projectRoot, {
          now: new Date("2026-03-22T12:00:00.000Z"),
        })
      },
      /simulated install-state write failure/,
    )
  } finally {
    fs.writeFileSync = originalWriteFileSync
  }

  assert.equal(fs.existsSync(rootManifestPath), false)
  assert.equal(fs.existsSync(path.join(projectRoot, ".openkit", "openkit-install.json")), false)
})
