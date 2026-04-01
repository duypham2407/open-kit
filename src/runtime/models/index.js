import { resolveAutoFallbackState, resolveModelFallback } from '../recovery/model-fallback.js';
import { createModelCapabilityDiagnostics } from './capability-diagnostics.js';
import { resolveModel } from './model-resolver.js';

export function createModelRuntime({ categories, specialists, config }) {
  const actionModelState = config.__runtime?.actionModelStateManager ?? null;
  const agentProfileSwitchManager = config.__runtime?.agentProfileSwitchManager ?? null;
  const resolutions = [
    ...categories.categories.map((entry) =>
      resolveModel({
        category: entry,
        config,
        actionState: actionModelState?.get?.(entry.id, `category:${entry.id}`) ?? null,
        manualProfileIndex: agentProfileSwitchManager?.get?.(entry.id)?.profileIndex ?? null,
      })
    ),
    ...specialists.specialists.map((entry) =>
      resolveModel({
        specialist: entry,
        config,
        actionState: actionModelState?.get?.(entry.id, `specialist:${entry.id}`) ?? null,
        manualProfileIndex: agentProfileSwitchManager?.get?.(entry.id)?.profileIndex ?? null,
      })
    ),
  ];
  const resolvedModels = resolutions.map((entry) => entry.model);
  const fallbackChains = resolutions.map((entry) => resolveModelFallback([entry.model, ...(entry.fallbackModels ?? [])]));
  const executionState = resolutions.map((entry) => {
    const failureCount = Number.isInteger(entry.actionState?.consecutiveFailures)
      ? entry.actionState.consecutiveFailures
      : 0;
    return {
      subjectId: entry.trace.subjectId,
      subjectType: entry.trace.subjectType,
      ...resolveAutoFallbackState({
        primaryModel: entry.model,
        fallbackEntries: entry.fallbackEntries ?? [],
        autoFallback: entry.autoFallback,
        failureCount,
        selectedProfileIndex: entry.selectedProfileIndex ?? 0,
      }),
    };
  });
  const resolutionTrace = resolutions.map((entry) => entry.trace);

  return {
    resolvedModels,
    diagnostics: createModelCapabilityDiagnostics(resolvedModels),
    fallbackChains,
    executionState,
    resolutions,
    resolutionTrace,
  };
}
