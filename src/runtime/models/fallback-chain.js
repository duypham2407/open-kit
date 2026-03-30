export function normalizeFallbackChain(fallbackModels = []) {
  const entries = Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels];

  return entries
    .map((entry) => {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return entry;
      }

      if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.model === 'string' && entry.model.trim().length > 0) {
        return entry.model;
      }

      return null;
    })
    .filter(Boolean);
}
