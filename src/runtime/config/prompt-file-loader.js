import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Audit fix [4-H-4]: project-root boundary check. Previously
 * resolveFileUri accepted file:///etc/passwd or file://~/sensitive without
 * any boundary check, then passed the resolved path to fs.readFileSync —
 * a malicious runtime config could exfiltrate any file readable by the
 * process. Now every resolved path must lie inside projectRoot (after
 * symlink resolution would not help here since the reader honors symlinks
 * later; the intent is to keep the *configured* path string inside the
 * project boundary).
 */
function assertInsideProjectRoot(resolvedPath, projectRoot, originalUri) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    throw new Error('projectRoot is required to resolve file:// prompt references safely.');
  }
  const projectRootAbs = path.resolve(projectRoot);
  const candidateAbs = path.resolve(resolvedPath);
  // Ensure prefix match with a separator so '/foo' does not match '/foobar'.
  const sep = path.sep;
  const prefix = projectRootAbs.endsWith(sep) ? projectRootAbs : projectRootAbs + sep;
  if (candidateAbs !== projectRootAbs && !candidateAbs.startsWith(prefix)) {
    throw new Error(
      `file:// prompt reference '${originalUri}' resolves outside the project root (${projectRootAbs}); refusing to read.`,
    );
  }
  return candidateAbs;
}

function resolveFileUri(value, { projectRoot, env = process.env } = {}) {
  if (typeof value !== 'string' || !value.startsWith('file://')) {
    return null;
  }

  const rawPath = value.slice('file://'.length);
  if (!rawPath) {
    throw new Error('file:// prompt reference must include a path.');
  }

  let resolvedPath;
  if (rawPath.startsWith('/')) {
    resolvedPath = path.resolve(rawPath);
  } else if (rawPath.startsWith('~/')) {
    const homeDir = env.HOME ?? os.homedir();
    if (!homeDir) {
      throw new Error('HOME is required to resolve ~/ prompt references.');
    }
    resolvedPath = path.join(homeDir, rawPath.slice(2));
  } else if (rawPath.startsWith('./') || rawPath.startsWith('../')) {
    resolvedPath = path.resolve(projectRoot, rawPath);
  } else {
    throw new Error(`unsupported file:// prompt reference '${value}'. Use absolute paths, file://~/..., or file://./...`);
  }

  return assertInsideProjectRoot(resolvedPath, projectRoot, value);
}

function loadPromptField(value, { projectRoot, env, warnings, label }) {
  const resolvedPath = resolveFileUri(value, { projectRoot, env });
  if (!resolvedPath) {
    return value;
  }

  try {
    return fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    warnings.push(`${label} could not load prompt file '${value}': ${error.message}`);
    return value;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function materializePromptFileReferences(config = {}, { projectRoot = process.cwd(), env = process.env } = {}) {
  const warnings = [];
  const nextConfig = JSON.parse(JSON.stringify(config ?? {}));

  for (const [agentId, agentConfig] of Object.entries(nextConfig.agents ?? {})) {
    if (!isPlainObject(agentConfig)) {
      continue;
    }
    if (typeof agentConfig.prompt === 'string') {
      agentConfig.prompt = loadPromptField(agentConfig.prompt, {
        projectRoot,
        env,
        warnings,
        label: `agents.${agentId}.prompt`,
      });
    }
    if (typeof agentConfig.prompt_append === 'string') {
      agentConfig.prompt_append = loadPromptField(agentConfig.prompt_append, {
        projectRoot,
        env,
        warnings,
        label: `agents.${agentId}.prompt_append`,
      });
    }
  }

  for (const [categoryId, categoryConfig] of Object.entries(nextConfig.categories ?? {})) {
    if (!isPlainObject(categoryConfig)) {
      continue;
    }
    if (typeof categoryConfig.prompt_append === 'string') {
      categoryConfig.prompt_append = loadPromptField(categoryConfig.prompt_append, {
        projectRoot,
        env,
        warnings,
        label: `categories.${categoryId}.prompt_append`,
      });
    }
  }

  return {
    config: nextConfig,
    warnings,
  };
}
