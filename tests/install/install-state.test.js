import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  OPENKIT_ASSET_MANIFEST,
  listManagedAssetIds,
  getManagedAsset,
  listBundledAssetIds,
  validateBundledAssetFiles,
} from "../../src/install/asset-manifest.js"
import {
  INSTALL_STATE_SCHEMA,
  createInstallState,
  validateInstallState,
} from "../../src/install/install-state.js"

test("asset manifest defines the phase 1 managed assets", () => {
  assert.equal(OPENKIT_ASSET_MANIFEST.schema, "openkit/asset-manifest@1")
  assert.equal(OPENKIT_ASSET_MANIFEST.manifestVersion, 1)
  assert.deepEqual(listManagedAssetIds(), [
    "runtime.opencode-manifest",
    "runtime.install-state",
  ])

  const runtimeManifest = getManagedAsset("runtime.opencode-manifest")
  assert.deepEqual(runtimeManifest, {
    id: "runtime.opencode-manifest",
    path: "opencode.json",
    kind: "template",
    templatePath: "assets/opencode.json.template",
    phase: 1,
    required: true,
    adoptionAllowed: true,
    description: "Managed install entrypoint manifest for OpenKit installs.",
  })

  const installStateAsset = getManagedAsset("runtime.install-state")
  assert.deepEqual(installStateAsset, {
    id: "runtime.install-state",
    path: ".openkit/openkit-install.json",
    kind: "template",
    templatePath: "assets/openkit-install.json.template",
    phase: 1,
    required: true,
    adoptionAllowed: false,
    description: "OpenKit-managed install state persisted in the target repository.",
  })
})

test("asset manifest defines the explicit OpenCode-native phase 1 bundle", () => {
  assert.deepEqual(OPENKIT_ASSET_MANIFEST.bundle.namespace, "openkit")
  assert.deepEqual(OPENKIT_ASSET_MANIFEST.bundle.phase, 1)
  assert.deepEqual(OPENKIT_ASSET_MANIFEST.bundle.includedAssetClasses, [
    "agents",
    "commands",
    "context",
    "skills",
  ])
  assert.deepEqual(OPENKIT_ASSET_MANIFEST.bundle.deferredAssetClasses, [
    "plugins",
    "package.json",
  ])
  assert.equal(OPENKIT_ASSET_MANIFEST.bundle.assets.some((asset) => asset.id.includes("opcode")), false)
  assert.deepEqual(OPENKIT_ASSET_MANIFEST.bundle.collisionPolicy, {
    installNamespace: "openkit",
    assetIdPrefix: "opencode",
    onCollision: "fail-closed-and-require-explicit-mapping",
    rationale: "Phase 1 ships an explicit namespaced bundle instead of overwriting unrelated OpenCode-native assets.",
  })

  assert.deepEqual(listBundledAssetIds(), [
    "opencode.bundle.readme",
    "opencode.agent.ArchitectAgent",
    "opencode.agent.BAAgent",
    "opencode.agent.CodeReviewer",
    "opencode.agent.FullstackAgent",
    "opencode.agent.MasterOrchestrator",
    "opencode.agent.PMAgent",
    "opencode.agent.QAAgent",
    "opencode.agent.TechLeadAgent",
    "opencode.command.brainstorm",
    "opencode.command.delivery",
    "opencode.command.execute-plan",
    "opencode.command.configure-agent-models",
    "opencode.command.migrate",
    "opencode.command.quick-task",
    "opencode.command.task",
    "opencode.command.write-plan",
    "opencode.context.lane-selection",
    "opencode.skill.brainstorming",
    "opencode.skill.code-review",
    "opencode.skill.subagent-driven-development",
    "opencode.skill.systematic-debugging",
    "opencode.skill.test-driven-development",
    "opencode.skill.using-skills",
    "opencode.skill.verification-before-completion",
    "opencode.skill.writing-plans",
    "opencode.skill.writing-specs",
  ])
})

test("install state factory records managed assets, adopted assets, warnings, and conflicts", () => {
  const state = createInstallState({
    kitVersion: "0.2.0",
    profile: "openkit-core",
    managedAssets: [
      {
        assetId: "runtime.install-state",
        path: ".openkit/openkit-install.json",
        status: "managed",
        checksum: "sha256:install-state",
      },
    ],
    adoptedAssets: [
      {
        assetId: "runtime.opencode-manifest",
        path: "opencode.json",
        adoptedFrom: "user-existing",
        status: "adopted",
      },
    ],
    warnings: [
      {
        code: "root-manifest-adopted",
        message: "Existing root opencode.json was adopted instead of overwritten.",
      },
    ],
    conflicts: [
      {
        assetId: "runtime.opencode-manifest",
        path: "opencode.json",
        reason: "content-mismatch",
        resolution: "manual-review-required",
      },
    ],
  })

  assert.equal(state.schema, INSTALL_STATE_SCHEMA)
  assert.equal(state.stateVersion, 1)
  assert.equal(state.kit.name, "OpenKit")
  assert.equal(state.kit.version, "0.2.0")
  assert.equal(state.installation.profile, "openkit-core")
  assert.equal(state.installation.status, "installed")
  assert.match(state.installation.installedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(state.assets.managed, [
    {
      assetId: "runtime.install-state",
      path: ".openkit/openkit-install.json",
      status: "managed",
      checksum: "sha256:install-state",
    },
  ])
  assert.deepEqual(state.assets.adopted, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      adoptedFrom: "user-existing",
      status: "adopted",
    },
  ])
  assert.deepEqual(state.warnings, [
    {
      code: "root-manifest-adopted",
      message: "Existing root opencode.json was adopted instead of overwritten.",
    },
  ])
  assert.deepEqual(state.conflicts, [
    {
      assetId: "runtime.opencode-manifest",
      path: "opencode.json",
      reason: "content-mismatch",
      resolution: "manual-review-required",
    },
  ])
})

test("install state validation rejects malformed state objects", () => {
  assert.deepEqual(validateInstallState(createInstallState({})), [])

  const errors = validateInstallState({
    schema: "openkit/install-state@999",
    stateVersion: 2,
    kit: { name: "", version: "" },
    installation: {
      profile: "",
      status: "pending",
      installedAt: "not-a-timestamp",
    },
    assets: {
      managed: [
        {
          assetId: "runtime.install-state",
          path: "",
          status: "unsupported",
        },
      ],
      adopted: [
        {
          assetId: "runtime.opencode-manifest",
          path: "opencode.json",
          status: "managed",
        },
      ],
    },
    warnings: [
      {
        code: "",
        message: "warning without code",
      },
    ],
    conflicts: [
      {
        assetId: "runtime.opencode-manifest",
        path: "opencode.json",
        reason: "",
        resolution: "manual-review-required",
      },
    ],
  })

  assert.deepEqual(errors, [
    "schema must be 'openkit/install-state@1'",
    "stateVersion must be 1",
    "kit.name must be a non-empty string",
    "kit.version must be a non-empty string",
    "installation.profile must be a non-empty string",
    "installation.status must be 'installed'",
    "installation.installedAt must be an ISO-8601 timestamp",
    "assets.managed[0].path must be a non-empty string",
    "assets.managed[0].status must be one of: managed, materialized",
    "assets.adopted[0].status must be 'adopted'",
    "warnings[0].code must be a non-empty string",
    "conflicts[0].reason must be a non-empty string",
  ])
})

test("install state validation rejects wrong collection types", () => {
  const errors = validateInstallState({
    schema: INSTALL_STATE_SCHEMA,
    stateVersion: 1,
    kit: { name: "OpenKit", version: "0.2.0" },
    installation: {
      profile: "openkit-core",
      status: "installed",
      installedAt: "2026-03-22T12:00:00.000Z",
    },
    assets: {
      managed: { assetId: "runtime.install-state" },
      adopted: "not-an-array",
    },
    warnings: { code: "warning" },
    conflicts: null,
  })

  assert.deepEqual(errors, [
    "assets.managed must be an array",
    "assets.adopted must be an array",
    "warnings must be an array",
    "conflicts must be an array",
  ])
})

test("install state validation rejects parseable non-ISO timestamps", () => {
  const errors = validateInstallState({
    schema: INSTALL_STATE_SCHEMA,
    stateVersion: 1,
    kit: { name: "OpenKit", version: "0.2.0" },
    installation: {
      profile: "openkit-core",
      status: "installed",
      installedAt: "March 22, 2026",
    },
    assets: {
      managed: [],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  })

  assert.deepEqual(errors, [
    "installation.installedAt must be an ISO-8601 timestamp",
  ])
})

test("asset templates exist and point at the new schemas", () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url))
  const opencodeTemplatePath = path.resolve(testDir, "../../assets/opencode.json.template")
  const installTemplatePath = path.resolve(testDir, "../../assets/openkit-install.json.template")

  const opencodeTemplate = JSON.parse(fs.readFileSync(opencodeTemplatePath, "utf8"))
  const installTemplate = JSON.parse(fs.readFileSync(installTemplatePath, "utf8"))

  assert.equal(opencodeTemplate.installState.path, ".openkit/openkit-install.json")
  assert.equal(opencodeTemplate.installState.schema, INSTALL_STATE_SCHEMA)
  assert.equal(opencodeTemplate.productSurface.installReadiness, "managed")
  assert.equal(opencodeTemplate.productSurface.installationMode, "openkit-managed")

  assert.equal(installTemplate.schema, INSTALL_STATE_SCHEMA)
  assert.equal(installTemplate.stateVersion, 1)
  assert.equal(installTemplate.installation.profile, "openkit-core")
  assert.deepEqual(installTemplate.assets, {
    managed: [],
    adopted: [],
  })
  assert.deepEqual(installTemplate.warnings, [])
  assert.deepEqual(installTemplate.conflicts, [])
})

test("bundled asset manifest matches the derived asset bundle on disk", () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(testDir, "../..")

  const validation = validateBundledAssetFiles(projectRoot)

  assert.deepEqual(validation.missingFiles, [])
  assert.deepEqual(validation.mismatchedFiles, [])
  assert.equal(validation.bundleFileCount, 27)
  assert.deepEqual(validation.extraBundledFiles, [])
})

test("bundled asset validator reports drift between source and derived copy", () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(testDir, "../..")
  const bundledFilePath = path.join(projectRoot, "assets/install-bundle/opencode/commands/task.md")
  const originalContents = fs.readFileSync(bundledFilePath, "utf8")

  fs.writeFileSync(bundledFilePath, `${originalContents}\n<!-- drift -->\n`, "utf8")

  try {
    const validation = validateBundledAssetFiles(projectRoot)

    assert.deepEqual(validation.missingFiles, [])
    assert.deepEqual(validation.mismatchedFiles, [
      {
        id: "opencode.command.task",
        sourcePath: "commands/task.md",
        bundledPath: "assets/install-bundle/opencode/commands/task.md",
      },
    ])
  } finally {
    fs.writeFileSync(bundledFilePath, originalContents, "utf8")
  }
})
