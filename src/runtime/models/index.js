import { createModelCapabilityDiagnostics } from './capability-diagnostics.js';
import { resolveModel } from './model-resolver.js';

export function createModelRuntime({ categories, specialists, config }) {
  const resolvedModels = [
    ...categories.categories.map((entry) => resolveModel({ category: entry, config }).model),
    ...specialists.specialists.map((entry) => resolveModel({ specialist: entry, config }).model),
  ];

  return {
    resolvedModels,
    diagnostics: createModelCapabilityDiagnostics(resolvedModels),
  };
}
