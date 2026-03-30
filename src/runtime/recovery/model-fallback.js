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
