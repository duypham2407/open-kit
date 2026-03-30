function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFallbackEntry(entry) {
  if (typeof entry === 'string') {
    return { model: entry };
  }

  if (isPlainObject(entry) && typeof entry.model === 'string' && entry.model.trim().length > 0) {
    return {
      model: entry.model,
      variant: entry.variant ?? null,
      reasoningEffort: entry.reasoningEffort ?? null,
      textVerbosity: entry.textVerbosity ?? null,
      temperature: entry.temperature ?? null,
      top_p: entry.top_p ?? null,
      maxTokens: entry.maxTokens ?? null,
    };
  }

  return null;
}

export function normalizeFallbackChainDetailed(fallbackModels = []) {
  const entries = Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels];
  return entries.map(normalizeFallbackEntry).filter(Boolean);
}

export function createModelResolutionTrace({
  subjectType,
  subjectId,
  explicitModel = null,
  agentConfig = null,
  categoryConfig = null,
  defaultModel = null,
  resolvedModel,
  fallbackEntries = [],
}) {
  const precedence = [];

  if (explicitModel) {
    precedence.push({ source: 'explicit', model: explicitModel });
  }
  if (agentConfig?.model) {
    precedence.push({ source: 'agent-config', model: agentConfig.model });
  }
  if (categoryConfig?.model) {
    precedence.push({ source: 'category-config', model: categoryConfig.model });
  }
  if (defaultModel) {
    precedence.push({ source: 'default', model: defaultModel });
  }

  return {
    subjectType,
    subjectId,
    resolvedModel,
    selectedFrom: precedence.find((entry) => entry.model === resolvedModel)?.source ?? 'default',
    precedence,
    fallbackEntries,
  };
}
