export function resolveRuntimeFallback({ enabled = true, reason = null, retryable = true } = {}) {
  return {
    enabled,
    reason,
    retryable,
    suggestedAction: enabled ? null : 'reduce runtime surface area or fall back to workflow-state guided execution',
  };
}
