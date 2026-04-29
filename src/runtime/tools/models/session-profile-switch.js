function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function modelEntryFromOverride(value) {
  if (!isPlainObject(value) || typeof value.model !== 'string' || value.model.trim().length === 0) {
    return null;
  }

  return {
    model: value.model,
    fallbackModels: Array.isArray(value.fallback_models) ? value.fallback_models : [],
    fallbackEntries: Array.isArray(value.fallback_models)
      ? value.fallback_models.map((entry) => (typeof entry === 'string' ? { model: entry } : entry)).filter(Boolean)
      : [],
    autoFallback: {
      enabled: value.auto_fallback?.enabled ?? true,
      afterFailures: value.auto_fallback?.after_failures ?? value.auto_fallback?.afterFailures ?? 3,
    },
    selectedProfileIndex: 0,
    profiles: [],
    actionState: null,
    prompt: value.prompt ?? null,
    promptAppend: value.prompt_append ?? null,
    variant: value.variant ?? null,
    reasoningEffort: value.reasoningEffort ?? null,
    textVerbosity: value.textVerbosity ?? null,
    temperature: value.temperature ?? null,
    topP: value.top_p ?? null,
    maxTokens: value.maxTokens ?? null,
  };
}

function createResolution(agentId, value) {
  const entry = modelEntryFromOverride(value);
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    trace: {
      subjectType: 'agent',
      subjectId: agentId,
      resolvedModel: entry.model,
      selectedFrom: 'session-profile',
      precedence: [{ source: 'session-profile', model: entry.model }],
      fallbackEntries: entry.fallbackEntries,
      autoFallback: entry.autoFallback,
      selectedProfileIndex: 0,
      profiles: [],
    },
  };
}

function refreshModelRuntime(modelRuntime, effectiveOverrides) {
  if (!modelRuntime || !isPlainObject(effectiveOverrides?.agent)) {
    return null;
  }

  const nextBySubject = new Map(
    (modelRuntime.resolutions ?? []).map((entry) => [entry?.trace?.subjectId, entry])
  );

  for (const [agentId, value] of Object.entries(effectiveOverrides.agent)) {
    const resolution = createResolution(agentId, value);
    if (resolution) {
      nextBySubject.set(agentId, resolution);
    }
  }

  const resolutions = [...nextBySubject.values()];
  modelRuntime.resolutions = resolutions;
  modelRuntime.resolvedModels = resolutions.map((entry) => entry.model);
  modelRuntime.resolutionTrace = resolutions.map((entry) => entry.trace);
  modelRuntime.fallbackChains = resolutions.map((entry) => entry.fallbackModels ?? []);
  modelRuntime.executionState = resolutions.map((entry) => ({
    subjectId: entry.trace.subjectId,
    subjectType: entry.trace.subjectType,
    threshold: entry.autoFallback?.afterFailures ?? 3,
    failureCount: 0,
    shouldUseFallback: false,
    activeModel: entry.model,
    activeVariant: entry.variant ?? null,
  }));

  return {
    resolutions,
    resolvedModels: modelRuntime.resolvedModels,
    resolutionTrace: modelRuntime.resolutionTrace,
  };
}

export function applySessionProfileOverridesToModelRuntime(modelRuntime, effectiveOverrides) {
  return refreshModelRuntime(modelRuntime, effectiveOverrides);
}

export function createSessionProfileSwitchTool({ sessionProfileManager, modelRuntime = null }) {
  return {
    id: 'tool.session-profile-switch',
    name: 'Session Profile Switch',
    family: 'models',
    stage: 'active',
    status: 'active',
    description: 'Lists global agent model profiles and applies one to the current OpenKit runtime session state.',
    execute(input = {}) {
      const action = typeof input === 'string' ? input : input.action ?? 'list';

      if (action === 'cancel') {
        return {
          status: 'cancelled',
          message: 'Profile switch cancelled; active session profile was not changed.',
          activeProfileState: sessionProfileManager.getActiveProfileState(),
        };
      }

      if (action === 'list') {
        const profiles = sessionProfileManager.listProfiles();
        return {
          status: profiles.length > 0 ? 'ok' : 'empty',
          profiles,
          activeProfileState: sessionProfileManager.getActiveProfileState(),
          message: profiles.length > 0
            ? 'Global agent model profiles are available for session switching.'
            : 'No global agent model profiles are available to switch.',
        };
      }

      if (action !== 'apply') {
        return {
          status: 'invalid-input',
          message: `Unknown session profile switch action '${action}'.`,
        };
      }

      const profileName = typeof input === 'object' && input !== null ? input.profileName : null;
      const result = sessionProfileManager.applyProfile(profileName);
      if (result.status !== 'ok') {
        return {
          ...result,
          activeProfileState: sessionProfileManager.getActiveProfileState(),
        };
      }

      return {
        ...result,
        modelResolution: refreshModelRuntime(modelRuntime, result.effectiveOverrides),
      };
    },
  };
}
