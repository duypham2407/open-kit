import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deepMergeConfig } from '../global/config-merge.js';
import { materializePromptFileReferences } from './config/prompt-file-loader.js';
import { validateRuntimeConfig } from './config/schema.js';
import { createDefaultRuntimeConfig } from './runtime-config-defaults.js';
import { PROJECT_RUNTIME_CONFIG_FILES, USER_RUNTIME_CONFIG_FILES } from './types.js';

function migrateRuntimeConfig(config = {}, warnings = []) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }

  const nextConfig = JSON.parse(JSON.stringify(config));

  if (nextConfig.disabled_tools && !nextConfig.disabled?.tools) {
    nextConfig.disabled ??= {};
    nextConfig.disabled.tools = Array.isArray(nextConfig.disabled_tools) ? [...nextConfig.disabled_tools] : [];
    delete nextConfig.disabled_tools;
    warnings.push('runtime config migrated legacy key disabled_tools -> disabled.tools');
  }

  if (nextConfig.mcp && !nextConfig.mcps) {
    nextConfig.mcps = nextConfig.mcp;
    delete nextConfig.mcp;
    warnings.push('runtime config migrated legacy key mcp -> mcps');
  }

  if (nextConfig.background_task && !nextConfig.backgroundTask) {
    nextConfig.backgroundTask = nextConfig.background_task;
    delete nextConfig.background_task;
    warnings.push('runtime config migrated legacy key background_task -> backgroundTask');
  }

  return nextConfig;
}

function stripJsonComments(source) {
  let result = '';
  let inString = false;
  let stringQuote = '"';
  let isEscaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false;
        result += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += current;
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (current === '\\') {
        isEscaped = true;
        continue;
      }
      if (current === stringQuote) {
        inString = false;
      }
      continue;
    }

    if ((current === '"' || current === "'") && !inString) {
      inString = true;
      stringQuote = current;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += current;
  }

  return result;
}

function stripTrailingCommas(source) {
  return source.replace(/,\s*([}\]])/g, '$1');
}

export function parseRuntimeConfigContent(content, sourceLabel = 'runtime config') {
  try {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
  } catch (error) {
    throw new Error(`${sourceLabel} must contain valid JSON or JSONC.`, { cause: error });
  }
}

function resolveUserConfigDir(env = process.env) {
  if (env.XDG_CONFIG_HOME) {
    return path.join(env.XDG_CONFIG_HOME, 'opencode');
  }

  if (env.APPDATA) {
    return path.join(env.APPDATA, 'opencode');
  }

  const homeDir = env.HOME ?? os.homedir();
  if (!homeDir) {
    return null;
  }

  return path.join(homeDir, '.config', 'opencode');
}

function readConfigFile(filePath, readFileSync = fs.readFileSync) {
  const content = readFileSync(filePath, 'utf8');
  return parseRuntimeConfigContent(content, filePath);
}

function firstExistingPath(paths, existsSync = fs.existsSync) {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getRuntimeConfigSearchPaths({ projectRoot = process.cwd(), env = process.env } = {}) {
  const projectPaths = PROJECT_RUNTIME_CONFIG_FILES.map((relativePath) => path.join(projectRoot, relativePath));
  const userConfigDir = resolveUserConfigDir(env);
  const userPaths = userConfigDir
    ? USER_RUNTIME_CONFIG_FILES.map((fileName) => path.join(userConfigDir, fileName))
    : [];

  return {
    project: projectPaths,
    user: userPaths,
  };
}

export function loadRuntimeConfig({
  projectRoot = process.cwd(),
  env = process.env,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
} = {}) {
  const defaults = createDefaultRuntimeConfig();
  const searchPaths = getRuntimeConfigSearchPaths({ projectRoot, env });
  const explicitConfigPath = env.OPENKIT_RUNTIME_CONFIG
    ? path.resolve(projectRoot, env.OPENKIT_RUNTIME_CONFIG)
    : null;
  const userConfigPath = explicitConfigPath || firstExistingPath(searchPaths.user, existsSync);
  const projectConfigPath = firstExistingPath(searchPaths.project, existsSync);
  const warnings = [];

  const userConfig = userConfigPath && existsSync(userConfigPath)
    ? migrateRuntimeConfig(readConfigFile(userConfigPath, readFileSync), warnings)
    : null;
  const projectConfig = projectConfigPath && existsSync(projectConfigPath)
    ? migrateRuntimeConfig(readConfigFile(projectConfigPath, readFileSync), warnings)
    : null;

  const config = deepMergeConfig(
    deepMergeConfig(defaults, userConfig ?? {}),
    projectConfig ?? {}
  );

  const promptMaterialization = materializePromptFileReferences(config, { projectRoot, env });
  const validation = validateRuntimeConfig(promptMaterialization.config);
  warnings.push(...validation.warnings);
  warnings.push(...promptMaterialization.warnings);

  if (validation.errors.length > 0) {
    throw new Error(
      `OpenKit runtime config is invalid:\n- ${validation.errors.join('\n- ')}`
    );
  }

  return {
    config: promptMaterialization.config,
    defaults,
    searchPaths,
    userConfigPath: userConfigPath && existsSync(userConfigPath) ? userConfigPath : null,
    projectConfigPath: projectConfigPath && existsSync(projectConfigPath) ? projectConfigPath : null,
    userConfig,
    projectConfig,
    warnings,
  };
}
