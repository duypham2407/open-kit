import {
  BROWSER_AUTOMATION_PROVIDERS,
  DISABLED_RUNTIME_BUCKETS,
  EMBEDDING_PROVIDERS,
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

function validatePositiveIntegerIfPresent(value, label, errors) {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    errors.push(`${label} must be a positive integer when provided.`);
  }
}

function validatePromptField(value, label, errors) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string when provided.`);
  }
}

function validateFallbackModels(value, label, errors) {
  if (value === undefined) {
    return;
  }

  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      continue;
    }

    if (isPlainObject(entry) && typeof entry.model === 'string' && entry.model.trim().length > 0) {
      if (entry.variant !== undefined && (typeof entry.variant !== 'string' || entry.variant.trim().length === 0)) {
        errors.push(`${label} object entries must use a non-empty string for variant.`);
      }
      if (
        entry.reasoningEffort !== undefined &&
        (typeof entry.reasoningEffort !== 'string' || entry.reasoningEffort.trim().length === 0)
      ) {
        errors.push(`${label} object entries must use a non-empty string for reasoningEffort.`);
      }
      if (
        entry.textVerbosity !== undefined &&
        (typeof entry.textVerbosity !== 'string' || entry.textVerbosity.trim().length === 0)
      ) {
        errors.push(`${label} object entries must use a non-empty string for textVerbosity.`);
      }
      if (entry.temperature !== undefined && (typeof entry.temperature !== 'number' || !Number.isFinite(entry.temperature))) {
        errors.push(`${label} object entries must use a finite number for temperature.`);
      }
      if (entry.top_p !== undefined && (typeof entry.top_p !== 'number' || !Number.isFinite(entry.top_p))) {
        errors.push(`${label} object entries must use a finite number for top_p.`);
      }
      if (entry.maxTokens !== undefined && (!Number.isInteger(entry.maxTokens) || entry.maxTokens <= 0)) {
        errors.push(`${label} object entries must use a positive integer for maxTokens.`);
      }
      continue;
    }

    errors.push(`${label} entries must be non-empty strings or objects with a non-empty model field.`);
    return;
  }
}

function validateToolPermissionMap(value, label, errors) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'boolean') {
      errors.push(`${label}.${key} must be a boolean.`);
    }
  }
}

function validatePermissionMap(value, label, errors) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }

  const allowed = new Set(['ask', 'allow', 'deny']);
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      if (!allowed.has(entry)) {
        errors.push(`${label}.${key} must be one of: ask, allow, deny.`);
      }
      continue;
    }

    if (!isPlainObject(entry)) {
      errors.push(`${label}.${key} must be a permission string or an object.`);
      continue;
    }

    for (const [commandKey, commandValue] of Object.entries(entry)) {
      if (typeof commandValue !== 'string' || !allowed.has(commandValue)) {
        errors.push(`${label}.${key}.${commandKey} must be one of: ask, allow, deny.`);
      }
    }
  }
}

function validateAgentConfig(agentConfig, label, errors) {
  if (!isPlainObject(agentConfig)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (agentConfig.model !== undefined && (typeof agentConfig.model !== 'string' || agentConfig.model.trim().length === 0)) {
    errors.push(`${label}.model must be a non-empty string when provided.`);
  }
  if (agentConfig.variant !== undefined && (typeof agentConfig.variant !== 'string' || agentConfig.variant.trim().length === 0)) {
    errors.push(`${label}.variant must be a non-empty string when provided.`);
  }
  if (
    agentConfig.reasoningEffort !== undefined &&
    (typeof agentConfig.reasoningEffort !== 'string' || agentConfig.reasoningEffort.trim().length === 0)
  ) {
    errors.push(`${label}.reasoningEffort must be a non-empty string when provided.`);
  }
  if (
    agentConfig.textVerbosity !== undefined &&
    (typeof agentConfig.textVerbosity !== 'string' || agentConfig.textVerbosity.trim().length === 0)
  ) {
    errors.push(`${label}.textVerbosity must be a non-empty string when provided.`);
  }
  if (agentConfig.temperature !== undefined && (typeof agentConfig.temperature !== 'number' || !Number.isFinite(agentConfig.temperature))) {
    errors.push(`${label}.temperature must be a finite number when provided.`);
  }
  if (agentConfig.top_p !== undefined && (typeof agentConfig.top_p !== 'number' || !Number.isFinite(agentConfig.top_p))) {
    errors.push(`${label}.top_p must be a finite number when provided.`);
  }
  if (agentConfig.maxTokens !== undefined && (!Number.isInteger(agentConfig.maxTokens) || agentConfig.maxTokens <= 0)) {
    errors.push(`${label}.maxTokens must be a positive integer when provided.`);
  }
  validatePromptField(agentConfig.prompt, `${label}.prompt`, errors);
  validatePromptField(agentConfig.prompt_append, `${label}.prompt_append`, errors);
  validateFallbackModels(agentConfig.fallback_models, `${label}.fallback_models`, errors);
  if (agentConfig.profiles !== undefined) {
    if (!Array.isArray(agentConfig.profiles) || agentConfig.profiles.length === 0 || agentConfig.profiles.length > 2) {
      errors.push(`${label}.profiles must be an array with 1 or 2 entries when provided.`);
    } else {
      for (const [index, profile] of agentConfig.profiles.entries()) {
        validateAgentConfig(profile, `${label}.profiles.${index}`, errors);
      }
    }
  }
  if (agentConfig.auto_fallback !== undefined) {
    if (!isPlainObject(agentConfig.auto_fallback)) {
      errors.push(`${label}.auto_fallback must be an object when provided.`);
    } else {
      validateBooleanIfPresent(agentConfig.auto_fallback.enabled, `${label}.auto_fallback.enabled`, errors);
      validatePositiveIntegerIfPresent(agentConfig.auto_fallback.after_failures, `${label}.auto_fallback.after_failures`, errors);
    }
  }
  validateToolPermissionMap(agentConfig.tools, `${label}.tools`, errors);
  validatePermissionMap(agentConfig.permission, `${label}.permission`, errors);
}

function validateCategoryConfig(categoryConfig, label, errors) {
  if (!isPlainObject(categoryConfig)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (categoryConfig.model !== undefined && (typeof categoryConfig.model !== 'string' || categoryConfig.model.trim().length === 0)) {
    errors.push(`${label}.model must be a non-empty string when provided.`);
  }
  if (categoryConfig.description !== undefined && (typeof categoryConfig.description !== 'string' || categoryConfig.description.trim().length === 0)) {
    errors.push(`${label}.description must be a non-empty string when provided.`);
  }
  if (categoryConfig.variant !== undefined && (typeof categoryConfig.variant !== 'string' || categoryConfig.variant.trim().length === 0)) {
    errors.push(`${label}.variant must be a non-empty string when provided.`);
  }
  if (
    categoryConfig.reasoningEffort !== undefined &&
    (typeof categoryConfig.reasoningEffort !== 'string' || categoryConfig.reasoningEffort.trim().length === 0)
  ) {
    errors.push(`${label}.reasoningEffort must be a non-empty string when provided.`);
  }
  if (
    categoryConfig.textVerbosity !== undefined &&
    (typeof categoryConfig.textVerbosity !== 'string' || categoryConfig.textVerbosity.trim().length === 0)
  ) {
    errors.push(`${label}.textVerbosity must be a non-empty string when provided.`);
  }
  if (categoryConfig.temperature !== undefined && (typeof categoryConfig.temperature !== 'number' || !Number.isFinite(categoryConfig.temperature))) {
    errors.push(`${label}.temperature must be a finite number when provided.`);
  }
  if (categoryConfig.top_p !== undefined && (typeof categoryConfig.top_p !== 'number' || !Number.isFinite(categoryConfig.top_p))) {
    errors.push(`${label}.top_p must be a finite number when provided.`);
  }
  if (categoryConfig.maxTokens !== undefined && (!Number.isInteger(categoryConfig.maxTokens) || categoryConfig.maxTokens <= 0)) {
    errors.push(`${label}.maxTokens must be a positive integer when provided.`);
  }
  validatePromptField(categoryConfig.prompt_append, `${label}.prompt_append`, errors);
  validateFallbackModels(categoryConfig.fallback_models, `${label}.fallback_models`, errors);
  validateToolPermissionMap(categoryConfig.tools, `${label}.tools`, errors);
}

function validateHookRuleMap(value, label, errors) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    validateStringArray(entry, `${label}.${key}`, errors);
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
  validateObjectIfPresent(config.modelExecution, 'modelExecution', errors);
  validateObjectIfPresent(config.hooks, 'hooks', errors);
  validateObjectIfPresent(config.tools, 'tools', errors);
  validateObjectIfPresent(config.skills, 'skills', errors);
  validateObjectIfPresent(config.commands, 'commands', errors);
  validateObjectIfPresent(config.mcps, 'mcps', errors);

  if (isPlainObject(config.agents)) {
    for (const [agentId, agentConfig] of Object.entries(config.agents)) {
      validateAgentConfig(agentConfig, `agents.${agentId}`, errors);
    }
  }

  if (isPlainObject(config.categories)) {
    for (const [categoryId, categoryConfig] of Object.entries(config.categories)) {
      validateCategoryConfig(categoryConfig, `categories.${categoryId}`, errors);
    }
  }

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

  if (isPlainObject(config.modelExecution)) {
    if (config.modelExecution.autoFallback !== undefined) {
      if (!isPlainObject(config.modelExecution.autoFallback)) {
        errors.push('modelExecution.autoFallback must be an object when provided.');
      } else {
        validateBooleanIfPresent(config.modelExecution.autoFallback.enabled, 'modelExecution.autoFallback.enabled', errors);
        validatePositiveIntegerIfPresent(
          config.modelExecution.autoFallback.afterFailures,
          'modelExecution.autoFallback.afterFailures',
          errors
        );
      }
    }

    if (config.modelExecution.quickSwitchProfiles !== undefined) {
      if (!isPlainObject(config.modelExecution.quickSwitchProfiles)) {
        errors.push('modelExecution.quickSwitchProfiles must be an object when provided.');
      } else {
        validateBooleanIfPresent(
          config.modelExecution.quickSwitchProfiles.enabled,
          'modelExecution.quickSwitchProfiles.enabled',
          errors
        );
      }
    }
  }

  if (isPlainObject(config.hooks)) {
    if (isPlainObject(config.hooks.continuationRuntime)) {
      validateBooleanIfPresent(
        config.hooks.continuationRuntime.attentionOnRisk,
        'hooks.continuationRuntime.attentionOnRisk',
        errors
      );
    } else if (config.hooks.continuationRuntime !== undefined) {
      errors.push('hooks.continuationRuntime must be an object when provided.');
    }

    if (isPlainObject(config.hooks.toolOutputTruncation)) {
      const maxChars = config.hooks.toolOutputTruncation.maxChars;
      const maxItems = config.hooks.toolOutputTruncation.maxItems;

      if (maxChars !== undefined && (!Number.isInteger(maxChars) || maxChars <= 0)) {
        errors.push('hooks.toolOutputTruncation.maxChars must be a positive integer when provided.');
      }

      if (maxItems !== undefined && (!Number.isInteger(maxItems) || maxItems <= 0)) {
        errors.push('hooks.toolOutputTruncation.maxItems must be a positive integer when provided.');
      }
    } else if (config.hooks.toolOutputTruncation !== undefined) {
      errors.push('hooks.toolOutputTruncation must be an object when provided.');
    }

    if (isPlainObject(config.hooks.rulesInjector)) {
      validateStringArray(config.hooks.rulesInjector.always ?? [], 'hooks.rulesInjector.always', errors);
      validateHookRuleMap(config.hooks.rulesInjector.byMode, 'hooks.rulesInjector.byMode', errors);
      validateHookRuleMap(config.hooks.rulesInjector.byCategory, 'hooks.rulesInjector.byCategory', errors);
    } else if (config.hooks.rulesInjector !== undefined) {
      errors.push('hooks.rulesInjector must be an object when provided.');
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

  if (isPlainObject(config.supervisorDialogue)) {
    validateBooleanIfPresent(config.supervisorDialogue.enabled, 'supervisorDialogue.enabled', errors);
    if (isPlainObject(config.supervisorDialogue.openclaw)) {
      const openclaw = config.supervisorDialogue.openclaw;
      if (
        openclaw.transport !== undefined &&
        !['unconfigured', 'http', 'command'].includes(openclaw.transport)
      ) {
        errors.push('supervisorDialogue.openclaw.transport must be one of: unconfigured, http, command.');
      }
      if (openclaw.url !== undefined && openclaw.url !== null && typeof openclaw.url !== 'string') {
        errors.push('supervisorDialogue.openclaw.url must be a string or null when provided.');
      }
      if (openclaw.command !== undefined && openclaw.command !== null && typeof openclaw.command !== 'string') {
        errors.push('supervisorDialogue.openclaw.command must be a string or null when provided.');
      }
      if (openclaw.args !== undefined) {
        validateStringArray(openclaw.args, 'supervisorDialogue.openclaw.args', errors);
      }
      if (openclaw.timeoutMs !== undefined) {
        validatePositiveIntegerIfPresent(openclaw.timeoutMs, 'supervisorDialogue.openclaw.timeoutMs', errors);
      }
      validateObjectIfPresent(openclaw.env, 'supervisorDialogue.openclaw.env', errors);
    } else if (config.supervisorDialogue.openclaw !== undefined) {
      errors.push('supervisorDialogue.openclaw must be an object when provided.');
    }
  } else if (config.supervisorDialogue !== undefined) {
    errors.push('supervisorDialogue must be an object when provided.');
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

  if (isPlainObject(config.embedding)) {
    validateBooleanIfPresent(config.embedding.enabled, 'embedding.enabled', errors);
    if (
      config.embedding.provider !== undefined &&
      !EMBEDDING_PROVIDERS.includes(config.embedding.provider)
    ) {
      errors.push(
        `embedding.provider must be one of: ${EMBEDDING_PROVIDERS.join(', ')}.`
      );
    }
    if (config.embedding.model !== undefined && (typeof config.embedding.model !== 'string' || config.embedding.model.trim().length === 0)) {
      errors.push('embedding.model must be a non-empty string when provided.');
    }
    validatePositiveIntegerIfPresent(config.embedding.dimensions, 'embedding.dimensions', errors);
    validatePositiveIntegerIfPresent(config.embedding.batchSize, 'embedding.batchSize', errors);
    if (config.embedding.apiKey !== undefined && config.embedding.apiKey !== null && typeof config.embedding.apiKey !== 'string') {
      errors.push('embedding.apiKey must be a string or null when provided.');
    }
    if (config.embedding.baseUrl !== undefined && config.embedding.baseUrl !== null && typeof config.embedding.baseUrl !== 'string') {
      errors.push('embedding.baseUrl must be a string or null when provided.');
    }
  } else if (config.embedding !== undefined) {
    errors.push('embedding must be an object when provided.');
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
