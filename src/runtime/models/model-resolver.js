import { normalizeFallbackChain } from './fallback-chain.js';

export function resolveModel({ explicitModel = null, category = null, specialist = null, config = {} } = {}) {
  const agentConfig = explicitModel ? null : config.agents?.[specialist?.id ?? ''] ?? null;
  const model = explicitModel ?? agentConfig?.model ?? specialist?.defaultModel ?? category?.model ?? 'openai/gpt-5.4-mini';
  const fallbackModels = normalizeFallbackChain(agentConfig?.fallback_models ?? []);

  return {
    model,
    fallbackModels,
  };
}
