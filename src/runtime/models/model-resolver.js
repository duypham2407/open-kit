import { normalizeFallbackChain } from './fallback-chain.js';
import { createModelResolutionTrace, normalizeFallbackChainDetailed } from './model-resolution.js';

function normalizeProfile(profile = null) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }

  if (typeof profile.model !== 'string' || profile.model.trim().length === 0) {
    return null;
  }

  return profile;
}

function deriveSelectedProfile({ profiles = [], quickSwitchEnabled = true, actionState = null } = {}) {
  const normalizedProfiles = (Array.isArray(profiles) ? profiles : []).map(normalizeProfile).filter(Boolean).slice(0, 2);
  if (normalizedProfiles.length === 0) {
    return { selectedProfile: null, selectedProfileIndex: 0, profiles: [] };
  }

  const shouldQuickSwitch = quickSwitchEnabled !== false && normalizedProfiles.length > 1 && (actionState?.lastStatus === 'failure');
  const selectedProfileIndex = shouldQuickSwitch ? 1 : 0;
  return {
    selectedProfile: normalizedProfiles[selectedProfileIndex] ?? normalizedProfiles[0],
    selectedProfileIndex,
    profiles: normalizedProfiles,
  };
}

export function resolveModel({ explicitModel = null, category = null, specialist = null, config = {}, actionState = null, manualProfileIndex = null } = {}) {
  const subjectType = specialist ? 'specialist' : 'category';
  const subjectId = specialist?.id ?? category?.id ?? 'runtime-default';
  const agentConfig = explicitModel ? null : config.agents?.[subjectId] ?? null;
  const categoryConfig = category ? config.categories?.[category.id] ?? category : null;
  const runtimeAutoFallback = config.modelExecution?.autoFallback ?? null;
  const quickSwitchEnabled = config.modelExecution?.quickSwitchProfiles?.enabled !== false;
  const { selectedProfile, selectedProfileIndex, profiles } = deriveSelectedProfile({
    profiles: agentConfig?.profiles,
    quickSwitchEnabled,
    actionState,
  });
  const forcedProfile = Array.isArray(agentConfig?.profiles) && Number.isInteger(manualProfileIndex)
    ? normalizeProfile(agentConfig.profiles[manualProfileIndex])
    : null;
  const activeProfile = forcedProfile ?? selectedProfile;
  const activeProfileIndex = forcedProfile ? manualProfileIndex : selectedProfileIndex;
  const effectiveAgentConfig = activeProfile
    ? {
        ...agentConfig,
        ...activeProfile,
      }
    : agentConfig;
  const autoFallback = effectiveAgentConfig?.auto_fallback ?? runtimeAutoFallback;
  const defaultModel = specialist?.defaultModel ?? category?.model ?? 'openai/gpt-5.4-mini';
  const model = explicitModel ?? effectiveAgentConfig?.model ?? categoryConfig?.model ?? defaultModel;
  const fallbackEntries = normalizeFallbackChainDetailed(effectiveAgentConfig?.fallback_models ?? categoryConfig?.fallback_models ?? []);
  const fallbackModels = normalizeFallbackChain(fallbackEntries);
  const prompt = effectiveAgentConfig?.prompt ?? null;
  const promptAppend = effectiveAgentConfig?.prompt_append ?? categoryConfig?.prompt_append ?? null;
  const variant = effectiveAgentConfig?.variant ?? categoryConfig?.variant ?? null;
  const reasoningEffort = effectiveAgentConfig?.reasoningEffort ?? categoryConfig?.reasoningEffort ?? null;
  const textVerbosity = effectiveAgentConfig?.textVerbosity ?? categoryConfig?.textVerbosity ?? null;
  const temperature = effectiveAgentConfig?.temperature ?? categoryConfig?.temperature ?? null;
  const topP = effectiveAgentConfig?.top_p ?? categoryConfig?.top_p ?? null;
  const maxTokens = effectiveAgentConfig?.maxTokens ?? categoryConfig?.maxTokens ?? null;
  const trace = createModelResolutionTrace({
    subjectType,
    subjectId,
    explicitModel,
    agentConfig: effectiveAgentConfig,
    categoryConfig,
    defaultModel,
    resolvedModel: model,
    fallbackEntries,
    autoFallback,
    selectedProfileIndex: activeProfileIndex,
    profiles,
  });

  return {
    model,
    fallbackModels,
    fallbackEntries,
    autoFallback: {
      enabled: autoFallback?.enabled ?? true,
      afterFailures: autoFallback?.after_failures ?? autoFallback?.afterFailures ?? runtimeAutoFallback?.afterFailures ?? 3,
    },
    selectedProfileIndex: activeProfileIndex,
    profiles,
    actionState,
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
