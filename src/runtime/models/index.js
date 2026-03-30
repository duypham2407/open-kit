import { resolveModelFallback } from '../recovery/model-fallback.js';
import { createModelCapabilityDiagnostics } from './capability-diagnostics.js';
import { resolveModel } from './model-resolver.js';

export function createModelRuntime({ categories, specialists, config }) {
  const resolutions = [
    ...categories.categories.map((entry) => resolveModel({ category: entry, config })),
    ...specialists.specialists.map((entry) => resolveModel({ specialist: entry, config })),
  ];
  const resolvedModels = resolutions.map((entry) => entry.model);
  const fallbackChains = resolutions.map((entry) => resolveModelFallback([entry.model, ...(entry.fallbackModels ?? [])]));
  const resolutionTrace = resolutions.map((entry) => entry.trace);

  return {
    resolvedModels,
    diagnostics: createModelCapabilityDiagnostics(resolvedModels),
    fallbackChains,
    resolutions,
    resolutionTrace,
  };
}
