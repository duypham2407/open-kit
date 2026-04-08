import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { resolvePathContext } from "../lib/runtime-paths.js"

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-runtime-paths-"))
}

test("resolvePathContext returns distinct roots in divergent-root mode", () => {
  const projectRoot = makeTempDir()
  const runtimeRoot = makeTempDir()
  const kitRoot = makeTempDir()
  const statePath = path.join(runtimeRoot, ".opencode", "workflow-state.json")

  const context = resolvePathContext(statePath, {
    OPENKIT_PROJECT_ROOT: projectRoot,
    OPENKIT_KIT_ROOT: kitRoot,
  })

  assert.equal(context.projectRoot, projectRoot)
  assert.equal(context.runtimeRoot, runtimeRoot)
  assert.equal(context.kitRoot, kitRoot)
  assert.equal(context.statePath, statePath)
})

test("resolvePathContext collapses roots in local mode", () => {
  const projectRoot = makeTempDir()
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const context = resolvePathContext(statePath, {})

  assert.equal(context.projectRoot, projectRoot)
  assert.equal(context.runtimeRoot, projectRoot)
  assert.equal(context.kitRoot, projectRoot)
  assert.equal(context.statePath, statePath)
})

test("resolvePathContext returns a frozen object", () => {
  const projectRoot = makeTempDir()
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const context = resolvePathContext(statePath, {})

  assert.equal(Object.isFrozen(context), true)
})

test("resolvePathContext derives projectRoot from workspace metadata when env hints are absent", () => {
  const projectRoot = makeTempDir()
  const runtimeRoot = makeTempDir()
  const statePath = path.join(runtimeRoot, ".opencode", "workflow-state.json")

  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(path.join(runtimeRoot, "workspace.json"), `${JSON.stringify({ projectRoot }, null, 2)}\n`, "utf8")

  const context = resolvePathContext(statePath, {})
  assert.equal(context.projectRoot, projectRoot)
  assert.equal(context.runtimeRoot, runtimeRoot)
  assert.equal(context.statePath, statePath)
})
