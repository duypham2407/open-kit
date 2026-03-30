import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resolveFileUri(value, { projectRoot, env = process.env } = {}) {
  if (typeof value !== 'string' || !value.startsWith('file://')) {
    return null;
  }

  const rawPath = value.slice('file://'.length);
  if (!rawPath) {
    throw new Error('file:// prompt reference must include a path.');
  }

  if (rawPath.startsWith('/')) {
    return path.resolve(rawPath);
  }

  if (rawPath.startsWith('~/')) {
    const homeDir = env.HOME ?? os.homedir();
    if (!homeDir) {
      throw new Error('HOME is required to resolve ~/ prompt references.');
    }
    return path.join(homeDir, rawPath.slice(2));
  }

  if (rawPath.startsWith('./') || rawPath.startsWith('../')) {
    return path.resolve(projectRoot, rawPath);
  }

  throw new Error(`unsupported file:// prompt reference '${value}'. Use absolute paths, file://~/..., or file://./...`);
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
