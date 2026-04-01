export function resolveModelFallback(models = []) {
  const chain = Array.isArray(models) ? models.filter(Boolean) : [];
  return {
    chainLength: chain.length,
    models: chain,
    primary: chain[0] ?? null,
    fallback: chain[1] ?? null,
    available: chain.length > 0,
    retryable: chain.length > 1,
  };
}

export function resolveAutoFallbackState({
  primaryModel = null,
  fallbackEntries = [],
  autoFallback = null,
  failureCount = 0,
  selectedProfileIndex = 0,
} = {}) {
  const fallbackChain = resolveModelFallback([
    primaryModel,
    ...fallbackEntries.map((entry) => (typeof entry === 'string' ? entry : entry?.model ?? null)),
  ]);
  const enabled = autoFallback?.enabled !== false;
  const threshold = autoFallback?.after_failures ?? autoFallback?.afterFailures ?? 3;
  const shouldUseFallback = enabled && fallbackChain.retryable && failureCount >= threshold;
  const activeEntry = shouldUseFallback ? fallbackEntries[0] ?? null : null;

  return {
    enabled,
    threshold,
    failureCount,
    selectedProfileIndex,
    shouldUseFallback,
    activeModel: shouldUseFallback ? fallbackChain.fallback : fallbackChain.primary,
    activeVariant: shouldUseFallback && activeEntry && typeof activeEntry === 'object' ? activeEntry.variant ?? null : null,
    fallbackChain,
  };
}
