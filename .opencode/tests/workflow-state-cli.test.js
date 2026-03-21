const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-cli-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const hooksDir = path.join(projectRoot, "hooks")
  const skillsDir = path.join(projectRoot, "skills", "using-skills")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(hooksDir, { recursive: true })
  fs.mkdirSync(skillsDir, { recursive: true })

  const fixtureState = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"),
  )

  fs.writeFileSync(path.join(opencodeDir, "workflow-state.json"), `${JSON.stringify(fixtureState, null, 2)}\n`, "utf8")
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version: "0.1.0",
        entryAgent: "MasterOrchestrator",
        registry: {
          path: "registry.json",
          schema: "openkit/component-registry@1",
        },
        installManifest: {
          path: ".opencode/install-manifest.json",
          schema: "openkit/install-manifest@1",
        },
        activeProfile: "openkit-core",
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(projectRoot, "registry.json"),
    `${JSON.stringify({
      schema: "openkit/component-registry@1",
      registryVersion: 1,
      profiles: [
        {
          id: "profile.openkit-core",
          name: "openkit-core",
          description: "Core profile",
          componentRefs: ["agents", "runtime", "docs"],
          defaultForRepository: true,
        },
        {
          id: "profile.runtime-docs-surface",
          name: "runtime-docs-surface",
          description: "Runtime and docs surface",
          componentRefs: ["runtime", "hooks", "docs"],
          defaultForRepository: false,
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(opencodeDir, "install-manifest.json"),
    `${JSON.stringify({
      schema: "openkit/install-manifest@1",
      manifestVersion: 1,
      installation: {
        activeProfile: "openkit-core",
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(path.join(hooksDir, "hooks.json"), '{"hooks":{}}\n', "utf8")
  fs.writeFileSync(path.join(hooksDir, "session-start"), "#!/usr/bin/env bash\n", "utf8")
  fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# using-skills\n", "utf8")
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.js"), "#!/usr/bin/env node\n", "utf8")
}

test("status command prints workflow and runtime summary", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit runtime status:/)
  assert.match(result.stdout, /kit: OpenKit AI Software Factory v0\.1\.0/)
  assert.match(result.stdout, /entry agent: MasterOrchestrator/)
  assert.match(result.stdout, /active profile: openkit-core/)
  assert.match(result.stdout, /registry: .*registry\.json/)
  assert.match(result.stdout, /install manifest: .*\.opencode\/install-manifest\.json/)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_done/)
  assert.match(result.stdout, /status: done/)
  assert.match(result.stdout, /work item: FEATURE-001 \(task-intake-dashboard\)/)
})

test("doctor command reports runtime diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /active profile: openkit-core/)
  assert.match(result.stdout, /registry: .*registry\.json/)
  assert.match(result.stdout, /install manifest: .*\.opencode\/install-manifest\.json/)
  assert.match(result.stdout, /\[ok\] manifest file found/)
  assert.match(result.stdout, /\[ok\] workflow state file found/)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
  assert.match(result.stdout, /\[ok\] registry file found/)
  assert.match(result.stdout, /\[ok\] install manifest found/)
  assert.match(result.stdout, /\[ok\] workflow state CLI found/)
  assert.match(result.stdout, /\[ok\] hooks config found/)
  assert.match(result.stdout, /\[ok\] session-start hook found/)
  assert.match(result.stdout, /\[ok\] meta-skill found/)
  assert.match(result.stdout, /\[ok\] active profile exists in registry/)
  assert.match(result.stdout, /Summary: 13 ok, 0 warn, 0 error/)
})

test("doctor command reports missing state as diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.rmSync(path.join(projectRoot, ".opencode", "workflow-state.json"))

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /\[error\] workflow state file found/)
  assert.match(result.stdout, /\[error\] workflow state is valid/)
  assert.match(result.stdout, /Summary: 11 ok, 0 warn, 2 error/)
})

test("doctor reports malformed registry as diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.writeFileSync(path.join(projectRoot, "registry.json"), "{not-valid-json}\n", "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /\[error\] registry metadata is readable/)
  assert.match(result.stdout, /Summary: 12 ok, 0 warn, 1 error/)
})

test("doctor reports when active profile is missing from registry", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const manifestPath = path.join(projectRoot, ".opencode", "install-manifest.json")
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  manifest.installation.activeProfile = "missing-profile"
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] active profile exists in registry/)
})

test("doctor reports when manifest and install-manifest active profiles diverge", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const opencodePath = path.join(projectRoot, ".opencode", "opencode.json")
  const opencodeManifest = JSON.parse(fs.readFileSync(opencodePath, "utf8"))
  opencodeManifest.kit.activeProfile = "runtime-docs-surface"
  fs.writeFileSync(opencodePath, `${JSON.stringify(opencodeManifest, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] manifest and install manifest profiles agree/)
})

test("profiles command lists available registry profiles", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "profiles"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit profiles:/)
  assert.match(result.stdout, /\* openkit-core - Core profile/)
  assert.match(result.stdout, /  runtime-docs-surface - Runtime and docs surface/)
})

test("show-profile command prints profile details", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "show-profile", "runtime-docs-surface"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Profile: runtime-docs-surface/)
  assert.match(result.stdout, /default: no/)
  assert.match(result.stdout, /components: runtime, hooks, docs/)
})

test("version command prints kit metadata version", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "version"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit version: 0\.1\.0/)
  assert.match(result.stdout, /active profile: openkit-core/)
})

test("sync-install-manifest updates the active profile", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "sync-install-manifest", "runtime-docs-surface"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated install manifest profile to 'runtime-docs-surface'/)

  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "install-manifest.json"), "utf8"),
  )
  assert.equal(manifest.installation.activeProfile, "runtime-docs-surface")

  const statusResult = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(statusResult.status, 0)
  assert.match(statusResult.stdout, /active profile: runtime-docs-surface/)
})
