export function normalizeFallbackChain(fallbackModels = []) {
  return Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels].filter(Boolean);
}
