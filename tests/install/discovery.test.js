import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { discoverProjectShape } from "../../src/install/discovery.js"

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-discovery-"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, value, "utf8")
}

test("discoverProjectShape classifies an OpenKit additive local metadata project", () => {
  const projectRoot = makeTempDir()

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    $schema: "https://example.com/opencode.schema.json",
  })
  writeJson(path.join(projectRoot, ".opencode", "install-manifest.json"), {
    installation: {
      mode: "additive-non-destructive",
    },
  })
  writeJson(path.join(projectRoot, "registry.json"), {
    kit: {
      productSurface: {
        emerging: "global-openkit-install",
      },
    },
  })

  const result = discoverProjectShape(projectRoot)

  assert.equal(result.projectRoot, projectRoot)
  assert.equal(result.classification, "openkit-additive-local-metadata")
  assert.equal(result.hasRuntimeManifest, true)
  assert.equal(result.hasRootInstallEntrypoint, false)
  assert.equal(result.hasInstallManifest, true)
  assert.equal(result.hasRegistry, true)
  assert.deepEqual(result.notes, [])
})

test("discoverProjectShape reports an OpenCode-only runtime when only the checked-in runtime manifest exists", () => {
  const projectRoot = makeTempDir()

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    name: "runtime-only",
  })

  const result = discoverProjectShape(projectRoot)

  assert.equal(result.classification, "opencode-runtime-only")
  assert.equal(result.hasRuntimeManifest, true)
  assert.equal(result.hasInstallManifest, false)
  assert.equal(result.hasRegistry, false)
  assert.deepEqual(result.notes, [])
})

test("discoverProjectShape flags mixed install surfaces without mutating project state", () => {
  const projectRoot = makeTempDir()

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    name: "runtime",
  })
  writeJson(path.join(projectRoot, "opencode.json"), {
    install: true,
  })

  const before = fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8")
  const result = discoverProjectShape(projectRoot)
  const after = fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8")

  assert.equal(result.classification, "mixed-install-surfaces")
  assert.equal(result.hasRuntimeManifest, true)
  assert.equal(result.hasRootInstallEntrypoint, true)
  assert.match(result.notes[0], /both repository-local runtime and root install entrypoint/i)
  assert.equal(after, before)
})

test("discoverProjectShape marks missing runtime surfaces as unknown", () => {
  const projectRoot = makeTempDir()

  const result = discoverProjectShape(projectRoot)

  assert.equal(result.classification, "unknown")
  assert.equal(result.hasRuntimeManifest, false)
  assert.equal(result.hasRootInstallEntrypoint, false)
  assert.equal(result.hasInstallManifest, false)
  assert.equal(result.hasRegistry, false)
  assert.match(result.notes[0], /no recognized runtime manifest/i)
})

test("discoverProjectShape reports malformed additive metadata explicitly instead of treating it as absent", () => {
  const projectRoot = makeTempDir()

  writeJson(path.join(projectRoot, ".opencode", "opencode.json"), {
    name: "runtime-only",
  })
  writeText(path.join(projectRoot, ".opencode", "install-manifest.json"), "{ invalid json\n")
  writeText(path.join(projectRoot, "registry.json"), "not-json\n")

  const result = discoverProjectShape(projectRoot)

  assert.equal(result.classification, "unclassified")
  assert.equal(result.hasRuntimeManifest, true)
  assert.equal(result.hasInstallManifest, true)
  assert.equal(result.hasRegistry, true)
  assert.deepEqual(result.malformedMetadata, {
    installManifest: true,
    registry: true,
  })
  assert.match(result.notes[0], /install manifest metadata is malformed/i)
  assert.match(result.notes[1], /registry metadata is malformed/i)
})
