export const OPENCODE_CONFIG_ALLOWED_TOP_LEVEL_KEYS = Object.freeze([
  '$schema',
  'agent',
  'autoshare',
  'autoupdate',
  'command',
  'compaction',
  'default_agent',
  'disabled_providers',
  'enabled_providers',
  'enterprise',
  'experimental',
  'formatter',
  'instructions',
  'layout',
  'logLevel',
  'lsp',
  'mcp',
  'mode',
  'model',
  'permission',
  'plugin',
  'provider',
  'server',
  'share',
  'shell',
  'skills',
  'small_model',
  'snapshot',
  'tool_output',
  'tools',
  'username',
  'watcher',
]);

export const OPENKIT_ONLY_OPENCODE_CONFIG_KEYS = Object.freeze([
  'commandPermissionPolicy',
  'hooks',
  'installState',
  'kit',
  'productSurface',
]);

const OPENCODE_CONFIG_ALLOWED_TOP_LEVEL_KEY_SET = new Set(OPENCODE_CONFIG_ALLOWED_TOP_LEVEL_KEYS);
const OPENKIT_ONLY_OPENCODE_CONFIG_KEY_SET = new Set(OPENKIT_ONLY_OPENCODE_CONFIG_KEYS);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isOpenCodeConfigTopLevelKey(key) {
  return OPENCODE_CONFIG_ALLOWED_TOP_LEVEL_KEY_SET.has(key);
}

export function isOpenKitOnlyOpenCodeConfigKey(key) {
  return OPENKIT_ONLY_OPENCODE_CONFIG_KEY_SET.has(key);
}

export function getUnknownOpenCodeConfigTopLevelKeys(config) {
  if (!isPlainObject(config)) {
    return [];
  }

  return Object.keys(config).filter((key) => !isOpenCodeConfigTopLevelKey(key));
}

export function getOpenKitOnlyOpenCodeConfigKeys(config) {
  if (!isPlainObject(config)) {
    return [];
  }

  return Object.keys(config).filter((key) => isOpenKitOnlyOpenCodeConfigKey(key));
}

export function sanitizeOpenCodeConfig(config = {}) {
  const sanitizedConfig = isPlainObject(config) ? structuredClone(config) : {};
  const strippedKeys = [];

  for (const key of OPENKIT_ONLY_OPENCODE_CONFIG_KEYS) {
    if (Object.hasOwn(sanitizedConfig, key)) {
      delete sanitizedConfig[key];
      strippedKeys.push(key);
    }
  }

  return {
    config: sanitizedConfig,
    strippedKeys,
    unknownKeys: getUnknownOpenCodeConfigTopLevelKeys(sanitizedConfig),
  };
}

export function validateOpenCodeConfigTopLevelKeys(config, { configPath = 'opencode.json' } = {}) {
  if (!isPlainObject(config)) {
    return {
      status: 'invalid',
      configPath,
      unknownKeys: [],
      openKitOnlyKeys: [],
      errors: ['OpenCode config must be a JSON object.'],
    };
  }

  const unknownKeys = getUnknownOpenCodeConfigTopLevelKeys(config);
  const openKitOnlyKeys = getOpenKitOnlyOpenCodeConfigKeys(config);
  const errors = [];

  if (unknownKeys.length > 0) {
    errors.push(
      `OpenCode config contains schema-invalid top-level keys at ${configPath}: ${unknownKeys.join(', ')}.`,
    );
  }

  if (openKitOnlyKeys.length > 0) {
    errors.push(
      `OpenKit-only metadata must not be embedded in OpenCode-validated config at ${configPath}: ${openKitOnlyKeys.join(', ')}.`,
    );
  }

  return {
    status: errors.length === 0 ? 'valid' : 'invalid',
    configPath,
    unknownKeys,
    openKitOnlyKeys,
    errors,
  };
}
