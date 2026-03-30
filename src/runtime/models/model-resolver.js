import { normalizeFallbackChain } from './fallback-chain.js';
import { createModelResolutionTrace, normalizeFallbackChainDetailed } from './model-resolution.js';

export function resolveModel({ explicitModel = null, category = null, specialist = null, config = {} } = {}) {
  const subjectType = specialist ? 'specialist' : 'category';
  const subjectId = specialist?.id ?? category?.id ?? 'runtime-default';
  const agentConfig = explicitModel ? null : config.agents?.[subjectId] ?? null;
  const categoryConfig = category ? config.categories?.[category.id] ?? category : null;
  const defaultModel = specialist?.defaultModel ?? category?.model ?? 'openai/gpt-5.4-mini';
  const model = explicitModel ?? agentConfig?.model ?? categoryConfig?.model ?? defaultModel;
  const fallbackEntries = normalizeFallbackChainDetailed(agentConfig?.fallback_models ?? categoryConfig?.fallback_models ?? []);
  const fallbackModels = normalizeFallbackChain(fallbackEntries);
  const prompt = agentConfig?.prompt ?? null;
  const promptAppend = agentConfig?.prompt_append ?? categoryConfig?.prompt_append ?? null;
  const variant = agentConfig?.variant ?? categoryConfig?.variant ?? null;
  const reasoningEffort = agentConfig?.reasoningEffort ?? categoryConfig?.reasoningEffort ?? null;
  const textVerbosity = agentConfig?.textVerbosity ?? categoryConfig?.textVerbosity ?? null;
  const temperature = agentConfig?.temperature ?? categoryConfig?.temperature ?? null;
  const topP = agentConfig?.top_p ?? categoryConfig?.top_p ?? null;
  const maxTokens = agentConfig?.maxTokens ?? categoryConfig?.maxTokens ?? null;
  const trace = createModelResolutionTrace({
    subjectType,
    subjectId,
    explicitModel,
    agentConfig,
    categoryConfig,
    defaultModel,
    resolvedModel: model,
    fallbackEntries,
  });

  return {
    model,
    fallbackModels,
    fallbackEntries,
    prompt,
    promptAppend,
    variant,
    reasoningEffort,
    textVerbosity,
    temperature,
    topP,
    maxTokens,
    trace,
  };
}
