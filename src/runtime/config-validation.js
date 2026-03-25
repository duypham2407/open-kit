function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

    for (const key of Object.keys(value)) {
      if (!['model', 'variant'].includes(key)) {
        warnings.push(`agentModels.${agentId}.${key} is unknown and will be ignored.`);
      }
    }
  }

  return warnings;
}
