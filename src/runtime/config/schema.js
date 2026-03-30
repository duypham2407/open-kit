import {
  BROWSER_AUTOMATION_PROVIDERS,
  DISABLED_RUNTIME_BUCKETS,
  RUNTIME_CONFIG_SCHEMA,
  RUNTIME_FEATURE_FLAGS,
} from '../types.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateStringArray(values, label, errors) {
  if (!Array.isArray(values)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  for (const value of values) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${label} entries must be non-empty strings.`);
      return;
    }
  }
}

function validateObjectIfPresent(value, label, errors) {
  if (value !== undefined && !isPlainObject(value)) {
    errors.push(`${label} must be an object when provided.`);
  }
}

function validateBooleanIfPresent(value, label, errors) {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${label} must be a boolean when provided.`);
  }
}

function validateNumberMap(value, label, errors) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      errors.push(`${label}.${key} must be a non-negative number.`);
    }
  }
}

export function validateRuntimeConfig(config) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(config)) {
    return {
      errors: ['Runtime config must be a JSON object.'],
      warnings,
    };
  }

  if (config.schema !== undefined && config.schema !== RUNTIME_CONFIG_SCHEMA) {
    warnings.push(
      `runtime config schema is '${config.schema}' but OpenKit currently expects '${RUNTIME_CONFIG_SCHEMA}'.`
    );
  }

  validateObjectIfPresent(config.runtime, 'runtime', errors);
  validateObjectIfPresent(config.disabled, 'disabled', errors);
  validateObjectIfPresent(config.agents, 'agents', errors);
  validateObjectIfPresent(config.categories, 'categories', errors);
  validateObjectIfPresent(config.hooks, 'hooks', errors);
  validateObjectIfPresent(config.tools, 'tools', errors);
  validateObjectIfPresent(config.skills, 'skills', errors);
  validateObjectIfPresent(config.commands, 'commands', errors);
  validateObjectIfPresent(config.mcps, 'mcps', errors);

  if (isPlainObject(config.disabled)) {
    for (const bucket of DISABLED_RUNTIME_BUCKETS) {
      if (bucket in config.disabled) {
        validateStringArray(config.disabled[bucket], `disabled.${bucket}`, errors);
      }
    }
  }

  if (isPlainObject(config.runtime)) {
    validateBooleanIfPresent(config.runtime.enabled, 'runtime.enabled', errors);
    validateObjectIfPresent(config.runtime.featureFlags, 'runtime.featureFlags', errors);

    if (isPlainObject(config.runtime.featureFlags)) {
      for (const [key, value] of Object.entries(config.runtime.featureFlags)) {
        if (!RUNTIME_FEATURE_FLAGS.includes(key)) {
          warnings.push(`runtime.featureFlags.${key} is unknown and will be ignored.`);
          continue;
        }

        validateBooleanIfPresent(value, `runtime.featureFlags.${key}`, errors);
      }
    }
  }

  if (isPlainObject(config.backgroundTask)) {
    validateBooleanIfPresent(config.backgroundTask.enabled, 'backgroundTask.enabled', errors);
    validateNumberMap(config.backgroundTask.providerConcurrency, 'backgroundTask.providerConcurrency', errors);
    validateNumberMap(config.backgroundTask.modelConcurrency, 'backgroundTask.modelConcurrency', errors);
  } else if (config.backgroundTask !== undefined) {
    errors.push('backgroundTask must be an object when provided.');
  }

  if (isPlainObject(config.notifications)) {
    validateBooleanIfPresent(config.notifications.enabled, 'notifications.enabled', errors);
  } else if (config.notifications !== undefined) {
    errors.push('notifications must be an object when provided.');
  }

  if (isPlainObject(config.tmux)) {
    validateBooleanIfPresent(config.tmux.enabled, 'tmux.enabled', errors);
    if (
      config.tmux.layout !== undefined &&
      (typeof config.tmux.layout !== 'string' || config.tmux.layout.trim().length === 0)
    ) {
      errors.push('tmux.layout must be a non-empty string when provided.');
    }
  } else if (config.tmux !== undefined) {
    errors.push('tmux must be an object when provided.');
  }

  if (isPlainObject(config.browserAutomation)) {
    if (
      config.browserAutomation.provider !== undefined &&
      !BROWSER_AUTOMATION_PROVIDERS.includes(config.browserAutomation.provider)
    ) {
      errors.push(
        `browserAutomation.provider must be one of: ${BROWSER_AUTOMATION_PROVIDERS.join(', ')}.`
      );
    }
  } else if (config.browserAutomation !== undefined) {
    errors.push('browserAutomation must be an object when provided.');
  }

  if (isPlainObject(config.experimental)) {
    validateBooleanIfPresent(config.experimental.taskSystem, 'experimental.taskSystem', errors);
    validateBooleanIfPresent(
      config.experimental.aggressiveTruncation,
      'experimental.aggressiveTruncation',
      errors
    );
  } else if (config.experimental !== undefined) {
    errors.push('experimental must be an object when provided.');
  }

  if (isPlainObject(config.runtimeFallback)) {
    validateBooleanIfPresent(config.runtimeFallback.enabled, 'runtimeFallback.enabled', errors);
  } else if (config.runtimeFallback !== undefined) {
    errors.push('runtimeFallback must be an object when provided.');
  }

  return { errors, warnings };
}
