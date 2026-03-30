import { summarizeRuntimeCapabilities } from './capability-registry.js';
import { createContinuationHooks, createCoreHooks, createSessionHooks, createSkillHooks, createToolGuardHooks } from './hooks/index.js';

export function createHooks({ config, capabilityIndex, projectRoot, capabilities, skills }) {
  const disabledHooks = new Set(config?.disabled?.hooks ?? []);
  const capabilitySummary = summarizeRuntimeCapabilities(capabilities);
  const allHooks = [
    ...createSessionHooks({ projectRoot, capabilitySummary }),
    ...createToolGuardHooks(),
    ...createContinuationHooks(),
    ...createSkillHooks({ skills: skills.skills }),
  ].filter((hook) => !disabledHooks.has(hook.id));
  const safeHooks = createCoreHooks({ hooks: allHooks });

  return {
    hookList: safeHooks,
    hooks: Object.fromEntries(safeHooks.map((hook) => [hook.id, hook])),
  };
}
