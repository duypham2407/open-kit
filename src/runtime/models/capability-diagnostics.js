import { inferModelCapabilities } from './model-capabilities.js';

export function createModelCapabilityDiagnostics(models = []) {
  return models.map((model) => inferModelCapabilities(model));
}
