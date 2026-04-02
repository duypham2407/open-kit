import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function getOpenCodeHome(env = process.env) {
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

export function detectProjectRoot(startDir) {
  let current = path.resolve(startDir || process.cwd())

  for (;;) {
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

export function createWorkspaceId(projectRoot) {
  const seed = process.platform === "win32" ? projectRoot.toLowerCase() : projectRoot
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16)
}

export function resolveProjectRoot(customStatePath, env = process.env) {
  if (env.OPENKIT_PROJECT_ROOT) {
    return path.resolve(env.OPENKIT_PROJECT_ROOT)
  }

  if (customStatePath) {
    if (env.OPENKIT_GLOBAL_MODE === "1" || env.OPENKIT_KIT_ROOT || env.OPENCODE_HOME) {
      return detectProjectRoot(process.cwd())
    }

    return path.dirname(path.dirname(path.resolve(customStatePath)))
  }

  return detectProjectRoot(process.cwd())
}

export function resolveKitRoot(projectRoot, env = process.env) {
  if (env.OPENKIT_KIT_ROOT) {
    return path.resolve(env.OPENKIT_KIT_ROOT)
  }

  return projectRoot
}

export function resolveStatePath(customStatePath, env = process.env) {
  if (customStatePath) {
    return path.resolve(customStatePath)
  }

  if (env.OPENKIT_WORKFLOW_STATE) {
    return path.resolve(env.OPENKIT_WORKFLOW_STATE)
  }

  if (env.OPENKIT_GLOBAL_MODE === "1" || env.OPENKIT_KIT_ROOT || env.OPENCODE_HOME) {
    const projectRoot = resolveProjectRoot(customStatePath, env)
    const workspaceId = createWorkspaceId(projectRoot)
    return path.join(getOpenCodeHome(env), "workspaces", workspaceId, "openkit", ".opencode", "workflow-state.json")
  }

  return path.resolve(process.cwd(), ".opencode", "workflow-state.json")
}

export function resolveRuntimeRoot(customStatePath, env = process.env) {
  return path.dirname(path.dirname(resolveStatePath(customStatePath, env)))
}
