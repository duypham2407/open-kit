import fs from 'node:fs';
import path from 'node:path';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay;
  }

  const result = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseJsonContent(content, sourceLabel) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${sourceLabel} must contain valid JSON.`, { cause: error });
  }
}

function normalizeConfigPaths(value, configDir, keyPath = []) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeConfigPaths(entry, configDir, [...keyPath, index]));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeConfigPaths(entry, configDir, [...keyPath, key]),
      ])
    );
  }

  if (typeof value !== 'string' || !configDir || path.isAbsolute(value)) {
    return value;
  }

  const parentKey = keyPath.at(-2);
  const currentKey = keyPath.at(-1);

  if (currentKey === 'instructions' || parentKey === 'instructions') {
    return path.resolve(configDir, value);
  }

  return value;
}

export function buildOpenCodeLayering({ projectRoot, env = process.env }) {
  const runtimeManifestPath = path.join(projectRoot, '.opencode', 'opencode.json');
  const managedConfigDir = path.dirname(runtimeManifestPath);
  const managedConfig = readJsonIfPresent(runtimeManifestPath);

  if (!managedConfig) {
    throw new Error(
      `OpenKit managed runtime manifest was not found at ${runtimeManifestPath}.`
    );
  }

  const baselineConfigDir = env.OPENCODE_CONFIG_DIR ?? null;
  const baselineDirConfig = baselineConfigDir
    ? readJsonIfPresent(path.join(baselineConfigDir, 'opencode.json'))
    : null;
  const baselineContentConfig = parseJsonContent(
    env.OPENCODE_CONFIG_CONTENT,
    'OPENCODE_CONFIG_CONTENT'
  );

  const normalizedBaselineDirConfig = normalizeConfigPaths(baselineDirConfig ?? {}, baselineConfigDir);
  const normalizedBaselineContentConfig = normalizeConfigPaths(
    baselineContentConfig ?? {},
    baselineConfigDir
  );
  const baselineConfig = deepMerge(normalizedBaselineDirConfig, normalizedBaselineContentConfig);
  const mergedConfig = deepMerge(baselineConfig, managedConfig);
  const layeredEnv = { ...env };

  if (baselineConfigDir || baselineContentConfig) {
    layeredEnv.OPENCODE_CONFIG_DIR = managedConfigDir;
    layeredEnv.OPENCODE_CONFIG_CONTENT = JSON.stringify(mergedConfig);
  } else {
    layeredEnv.OPENCODE_CONFIG_DIR = managedConfigDir;
    delete layeredEnv.OPENCODE_CONFIG_CONTENT;
  }

  return {
    env: layeredEnv,
    baseline: {
      configDir: baselineConfigDir,
      hasConfigContent: Boolean(baselineContentConfig),
      config: baselineConfig,
    },
    managedConfig: {
      configDir: managedConfigDir,
      runtimeManifestPath,
      config: managedConfig,
    },
    mergedConfig,
  };
}
