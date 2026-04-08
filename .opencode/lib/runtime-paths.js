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

function tryReadWorkspaceProjectRootFromStatePath(customStatePath) {
  if (!customStatePath) {
    return null
  }

  const resolvedStatePath = path.resolve(customStatePath)
  const runtimeRoot = path.dirname(path.dirname(resolvedStatePath))
  const workspaceMetaPath = path.join(runtimeRoot, "workspace.json")

  if (!fs.existsSync(workspaceMetaPath)) {
    return null
  }

  try {
    const workspaceMeta = JSON.parse(fs.readFileSync(workspaceMetaPath, "utf8"))
    if (typeof workspaceMeta?.projectRoot === "string" && workspaceMeta.projectRoot.length > 0) {
      return path.resolve(workspaceMeta.projectRoot)
    }
  } catch {
    return null
  }

  return null
}

function isGlobalPathMode(env) {
  return env.OPENKIT_GLOBAL_MODE === "1" || env.OPENKIT_KIT_ROOT || env.OPENCODE_HOME
}

function hasExplicitStatePathOverride(customStatePath, env) {
  if (!customStatePath || !env.OPENKIT_WORKFLOW_STATE) {
    return false
  }

  return path.resolve(customStatePath) !== path.resolve(env.OPENKIT_WORKFLOW_STATE)
}

export function resolveProjectRoot(customStatePath, env = process.env) {
  const hasStateOverride = hasExplicitStatePathOverride(customStatePath, env)

  if (!hasStateOverride && env.OPENKIT_PROJECT_ROOT) {
    return path.resolve(env.OPENKIT_PROJECT_ROOT)
  }

  if (customStatePath) {
    const workspaceProjectRoot = tryReadWorkspaceProjectRootFromStatePath(customStatePath)
    if (workspaceProjectRoot) {
      return workspaceProjectRoot
    }

    if (!hasStateOverride && isGlobalPathMode(env)) {
      return detectProjectRoot(process.cwd())
    }

    return path.dirname(path.dirname(path.resolve(customStatePath)))
  }

  return detectProjectRoot(process.cwd())
}

export function resolveKitRoot(projectRoot, env = process.env, customStatePath = null) {
  if (hasExplicitStatePathOverride(customStatePath, env)) {
    return projectRoot
  }

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

  if (isGlobalPathMode(env)) {
    const projectRoot = resolveProjectRoot(customStatePath, env)
    const workspaceId = createWorkspaceId(projectRoot)
    return path.join(getOpenCodeHome(env), "workspaces", workspaceId, "openkit", ".opencode", "workflow-state.json")
  }

  return path.resolve(process.cwd(), ".opencode", "workflow-state.json")
}

export function resolveRuntimeRoot(customStatePath, env = process.env) {
  return path.dirname(path.dirname(resolveStatePath(customStatePath, env)))
}

export function resolvePathContext(customStatePath, env = process.env) {
  const projectRoot = resolveProjectRoot(customStatePath, env)
  const runtimeRoot = resolveRuntimeRoot(customStatePath, env)
  const kitRoot = resolveKitRoot(projectRoot, env, customStatePath)
  const statePath = resolveStatePath(customStatePath, env)

  return Object.freeze({
    projectRoot,
    runtimeRoot,
    kitRoot,
    statePath,
  })
}
