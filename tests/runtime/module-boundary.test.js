import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const worktreeRoot = path.resolve(__dirname, "..", "..")

test(".opencode declares a CommonJS boundary for the legacy runtime", () => {
  const packageJsonPath = path.join(worktreeRoot, ".opencode", "package.json")
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

  assert.equal(packageJson.type, "commonjs")
})
