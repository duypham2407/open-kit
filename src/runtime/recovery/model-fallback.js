export function resolveModelFallback(models = []) {
  return {
    chainLength: models.length,
    models,
  };
}
