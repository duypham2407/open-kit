const crypto = require("crypto")
const fs = require("fs")
const os = require("os")
const path = require("path")

function getOpenCodeHome(env = process.env) {
  if (env.OPENCODE_HOME) {
    return path.resolve(env.OPENCODE_HOME)
  }

  if (process.platform === "win32") {
    const base = env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    return path.join(base, "opencode")
  }

  const base = env.XDG_CONFIG_HOME ? path.resolve(env.XDG_CONFIG_HOME) : path.join(os.homedir(), ".config")
  return path.join(base, "opencode")
}

function detectProjectRoot(startDir) {
  let current = path.resolve(startDir || process.cwd())

  while (true) {
    if (fs.existsSync(path.join(current, ".git")) || fs.existsSync(path.join(current, "package.json"))) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return path.resolve(startDir || process.cwd())
    }
    current = parent
  }
}

function createWorkspaceId(projectRoot) {
  const seed = process.platform === "win32" ? projectRoot.toLowerCase() : projectRoot
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16)
}

function resolveProjectRoot(customStatePath) {
  if (process.env.OPENKIT_PROJECT_ROOT) {
    return path.resolve(process.env.OPENKIT_PROJECT_ROOT)
  }

  if (customStatePath) {
    if (process.env.OPENKIT_GLOBAL_MODE === "1" || process.env.OPENKIT_KIT_ROOT || process.env.OPENCODE_HOME) {
      return detectProjectRoot(process.cwd())
    }

    return path.dirname(path.dirname(path.resolve(customStatePath)))
  }

  return detectProjectRoot(process.cwd())
}

function resolveKitRoot(projectRoot) {
  if (process.env.OPENKIT_KIT_ROOT) {
    return path.resolve(process.env.OPENKIT_KIT_ROOT)
  }

  return projectRoot
}

function resolveStatePath(customStatePath) {
  if (customStatePath) {
    return path.resolve(customStatePath)
  }

  if (process.env.OPENKIT_WORKFLOW_STATE) {
    return path.resolve(process.env.OPENKIT_WORKFLOW_STATE)
  }

  if (process.env.OPENKIT_GLOBAL_MODE === "1" || process.env.OPENKIT_KIT_ROOT || process.env.OPENCODE_HOME) {
    const projectRoot = resolveProjectRoot(customStatePath)
    const workspaceId = createWorkspaceId(projectRoot)
    return path.join(getOpenCodeHome(), "workspaces", workspaceId, "openkit", ".opencode", "workflow-state.json")
  }

  return path.resolve(process.cwd(), ".opencode", "workflow-state.json")
}

function resolveRuntimeRoot(customStatePath) {
  return path.dirname(path.dirname(resolveStatePath(customStatePath)))
}

module.exports = {
  createWorkspaceId,
  detectProjectRoot,
  getOpenCodeHome,
  resolveKitRoot,
  resolveProjectRoot,
  resolveRuntimeRoot,
  resolveStatePath,
}
