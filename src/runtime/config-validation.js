function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateFallbackModels(value, label, warnings) {
  if (value === undefined) {
    return;
  }

  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      continue;
    }

    if (isPlainObject(entry) && typeof entry.model === 'string' && entry.model.trim().length > 0) {
      if (Object.hasOwn(entry, 'variant') && typeof entry.variant !== 'string') {
        warnings.push(`${label} object entries must use a string for variant when provided.`);
      }
      continue;
    }

    warnings.push(`${label} entries must be non-empty strings or objects with a non-empty model field.`);
    return;
  }
}

function validateModelProfile(value, label, warnings) {
  if (!isPlainObject(value)) {
    warnings.push(`${label} must be an object.`);
    return;
  }

  if (typeof value.model !== 'string' || value.model.trim().length === 0) {
    warnings.push(`${label}.model must be a non-empty string.`);
  }

  if (Object.hasOwn(value, 'variant') && typeof value.variant !== 'string') {
    warnings.push(`${label}.variant must be a string when provided.`);
  }

  validateFallbackModels(value.fallback_models, `${label}.fallback_models`, warnings);
  validateAutoFallback(value.auto_fallback, `${label}.auto_fallback`, warnings);
}

function validateAutoFallback(value, label, warnings) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    warnings.push(`${label} must be an object when provided.`);
    return;
  }

  if (Object.hasOwn(value, 'enabled') && typeof value.enabled !== 'boolean') {
    warnings.push(`${label}.enabled must be a boolean when provided.`);
  }

  if (
    Object.hasOwn(value, 'after_failures') &&
    (!Number.isInteger(value.after_failures) || value.after_failures <= 0)
  ) {
    warnings.push(`${label}.after_failures must be a positive integer when provided.`);
  }

  for (const key of Object.keys(value)) {
    if (!['enabled', 'after_failures'].includes(key)) {
      warnings.push(`${label}.${key} is unknown and will be ignored.`);
    }
  }
}

export function validateAgentModelSettings(settings) {
  const warnings = [];

  if (!isPlainObject(settings)) {
    return ['Agent model settings must be a JSON object.'];
  }

  if (!isPlainObject(settings.agentModels)) {
    warnings.push('agentModels is missing or malformed; OpenKit will treat it as empty.');
    return warnings;
  }

  for (const [agentId, value] of Object.entries(settings.agentModels)) {
    if (!isPlainObject(value)) {
      warnings.push(`agentModels.${agentId} must be an object.`);
      continue;
    }

    if (typeof value.model !== 'string' || value.model.trim().length === 0) {
      warnings.push(`agentModels.${agentId}.model must be a non-empty string.`);
    }

    if (Object.hasOwn(value, 'variant') && typeof value.variant !== 'string') {
      warnings.push(`agentModels.${agentId}.variant must be a string when provided.`);
    }

    validateFallbackModels(value.fallback_models, `agentModels.${agentId}.fallback_models`, warnings);
    validateAutoFallback(value.auto_fallback, `agentModels.${agentId}.auto_fallback`, warnings);
    if (Object.hasOwn(value, 'profiles')) {
      if (!Array.isArray(value.profiles) || value.profiles.length === 0 || value.profiles.length > 2) {
        warnings.push(`agentModels.${agentId}.profiles must be an array with 1 or 2 entries.`);
      } else {
        value.profiles.forEach((profile, index) => {
          validateModelProfile(profile, `agentModels.${agentId}.profiles.${index}`, warnings);
        });
      }
    }

    for (const key of Object.keys(value)) {
      if (!['model', 'variant', 'fallback_models', 'auto_fallback', 'profiles'].includes(key)) {
        warnings.push(`agentModels.${agentId}.${key} is unknown and will be ignored.`);
      }
    }
  }

  return warnings;
}
