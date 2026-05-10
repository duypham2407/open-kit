import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deepMergeConfig } from '../global/config-merge.js';
import { materializePromptFileReferences } from './config/prompt-file-loader.js';
import { validateRuntimeConfig } from './config/schema.js';
import { logDiagnostic } from './lib/diagnostics.js';
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

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateConfigSchema(config) {
  const errors = [];

  // Top-level must be a plain object
  if (!isPlainObject(config)) {
    errors.push('config must be an object');
    return { valid: false, errors };
  }

  // profiles must be an object and profiles.default is required
  if (config.profiles === undefined) {
    errors.push('profiles.default is required');
  } else if (!isPlainObject(config.profiles)) {
    errors.push('profiles must be an object');
  } else if (typeof config.profiles.default !== 'string' || config.profiles.default.length === 0) {
    errors.push('profiles.default is required and must be a non-empty string');
  }

  // mcps is optional but must be an object if present; mcps.servers must be array if present
  if (config.mcps !== undefined) {
    if (!isPlainObject(config.mcps)) {
      errors.push('mcps must be an object');
    } else if (config.mcps.servers !== undefined && !Array.isArray(config.mcps.servers)) {
      errors.push('mcps.servers must be an array');
    }
  }

  // Optional object fields: disabled, backgroundTask, codeIntelligence, categories, specialists
  const optionalObjectFields = ['disabled', 'backgroundTask', 'codeIntelligence', 'categories', 'specialists'];
  for (const field of optionalObjectFields) {
    if (config[field] !== undefined && !isPlainObject(config[field])) {
      errors.push(`${field} must be an object`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateConfigFile(configPath) {
  // Check file exists
  if (!fs.existsSync(configPath)) {
    return {
      valid: false,
      reason: 'file_not_found',
      data: null,
    };
  }

  // Check file is readable
  try {
    fs.accessSync(configPath, fs.constants.R_OK);
  } catch {
    return {
      valid: false,
      reason: 'permission_denied',
      data: null,
    };
  }

  // Try parse JSONC
  let parsed;
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    parsed = JSON.parse(stripJsonComments(content));
  } catch (err) {
    return {
      valid: false,
      reason: 'parse_error',
      error: err.message,
      data: null,
    };
  }

  // Validate schema
  const schemaResult = validateConfigSchema(parsed);
  if (!schemaResult.valid) {
    return {
      valid: false,
      reason: 'schema_invalid',
      errors: schemaResult.errors,
      data: parsed,
    };
  }

  return { valid: true, data: parsed };
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

/**
 * Return a fresh, schema-valid default runtime config object.
 *
 * Used as the final fallback in {@link loadRuntimeConfigWithDiagnostics} when
 * neither a project nor user config can be loaded.
 *
 * @returns {object} Minimal safe runtime config (always satisfies validateConfigSchema)
 */
export function getDefaultRuntimeConfig() {
  return {
    profiles: {
      default: 'sonnet',
    },
  };
}

/**
 * Load runtime config with a fallback chain and structured diagnostics.
 *
 * Resolution order:
 *   1. Project config: <projectRoot>/.opencode/openkit.runtime.jsonc
 *   2. User config:    ~/.config/openkit/config.jsonc
 *   3. Built-in defaults from {@link getDefaultRuntimeConfig}
 *
 * Each step is recorded via {@link logDiagnostic}:
 *   - 'debug' when a candidate file is simply not present
 *   - 'warning' when a candidate file is present but cannot be parsed/validated,
 *     or when the loader is forced to fall back to defaults
 *   - 'info' when a config is successfully loaded
 *
 * This function never throws: failures are converted to diagnostic events and
 * the loader continues down the chain. The returned object always has the
 * shape `{ success, data, source, error }`.
 *
 * @param {string} [projectRoot=process.cwd()] - Project root used to locate
 *   the project config and to anchor the diagnostics file.
 * @param {object} [options] - Test seam.
 * @param {string} [options.home] - Override home directory used to resolve the
 *   user config path. Defaults to `os.homedir()`.
 * @returns {{ success: boolean, data: object, source: 'project'|'user'|'defaults', error: null|string }}
 */
export function loadRuntimeConfigWithDiagnostics(projectRoot = process.cwd(), options = {}) {
  const home = options.home ?? os.homedir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');
  const userConfigPath = home ? path.join(home, '.config', 'openkit', 'config.jsonc') : null;

  // 1. Project config
  const projectAttempt = tryLoadConfigPath(projectConfigPath, 'project', projectRoot);
  if (projectAttempt.success) {
    logDiagnostic(
      'config_loading',
      'info',
      `Loaded project config from ${projectConfigPath}`,
      { path: projectConfigPath, source: 'project' },
      projectRoot
    );
    return { success: true, data: projectAttempt.data, source: 'project', error: null };
  }

  // 2. User config
  if (userConfigPath) {
    const userAttempt = tryLoadConfigPath(userConfigPath, 'user', projectRoot);
    if (userAttempt.success) {
      logDiagnostic(
        'config_loading',
        'info',
        `Loaded user config from ${userConfigPath}`,
        { path: userConfigPath, source: 'user' },
        projectRoot
      );
      return { success: true, data: userAttempt.data, source: 'user', error: null };
    }
  } else {
    logDiagnostic(
      'config_loading',
      'debug',
      'User config skipped: no home directory available',
      {},
      projectRoot
    );
  }

  // 3. Defaults
  logDiagnostic(
    'config_loading',
    'warning',
    'Falling back to built-in default runtime config',
    {
      reason: 'no_usable_config_found',
      projectConfigPath,
      userConfigPath,
    },
    projectRoot
  );

  return {
    success: true,
    data: getDefaultRuntimeConfig(),
    source: 'defaults',
    error: null,
  };
}

function tryLoadConfigPath(configPath, sourceLabel, projectRoot) {
  if (!fs.existsSync(configPath)) {
    logDiagnostic(
      'config_loading',
      'debug',
      `${sourceLabel} config not found at ${configPath}`,
      { path: configPath, source: sourceLabel, reason: 'file_not_found' },
      projectRoot
    );
    return { success: false };
  }

  const result = validateConfigFile(configPath);
  if (result.valid) {
    return { success: true, data: result.data };
  }

  // Map validateConfigFile failure reasons to diagnostic messages.
  if (result.reason === 'file_not_found') {
    // Race: file existed during existsSync but disappeared. Treat as missing.
    logDiagnostic(
      'config_loading',
      'debug',
      `${sourceLabel} config not found at ${configPath}`,
      { path: configPath, source: sourceLabel, reason: 'file_not_found' },
      projectRoot
    );
    return { success: false };
  }

  if (result.reason === 'permission_denied') {
    logDiagnostic(
      'config_loading',
      'warning',
      `Cannot read ${sourceLabel} config at ${configPath}: permission denied`,
      { path: configPath, source: sourceLabel, reason: 'permission_denied' },
      projectRoot
    );
    return { success: false };
  }

  if (result.reason === 'parse_error') {
    logDiagnostic(
      'config_loading',
      'warning',
      `Failed to parse ${sourceLabel} config at ${configPath}`,
      { path: configPath, source: sourceLabel, reason: 'parse_error', error: result.error },
      projectRoot
    );
    return { success: false };
  }

  if (result.reason === 'schema_invalid') {
    logDiagnostic(
      'config_loading',
      'warning',
      `Schema validation failed for ${sourceLabel} config at ${configPath}`,
      {
        path: configPath,
        source: sourceLabel,
        reason: 'schema_invalid',
        errors: result.errors ?? [],
      },
      projectRoot
    );
    return { success: false };
  }

  // Unknown failure shape: still don't throw.
  logDiagnostic(
    'config_loading',
    'warning',
    `Unable to load ${sourceLabel} config at ${configPath}`,
    { path: configPath, source: sourceLabel, reason: result.reason ?? 'unknown' },
    projectRoot
  );
  return { success: false };
}
