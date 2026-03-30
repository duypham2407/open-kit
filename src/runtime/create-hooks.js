import { summarizeRuntimeCapabilities } from './capability-registry.js';
import { createContinuationHooks, createCoreHooks, createSessionHooks, createSkillHooks, createToolGuardHooks } from './hooks/index.js';

export function createHooks({ config, capabilityIndex, projectRoot, capabilities, skills }) {
  const disabledHooks = new Set(config?.disabled?.hooks ?? []);
  const capabilitySummary = summarizeRuntimeCapabilities(capabilities);
  const hookConfig = config?.hooks ?? {};
  const allHooks = [
    ...createSessionHooks({
      projectRoot,
      capabilitySummary,
      workflowKernel: config.__runtime?.workflowKernel,
      sessionStateManager: config.__runtime?.sessionStateManager,
      continuationStateManager: config.__runtime?.continuationStateManager,
    }),
    ...createToolGuardHooks({
      workflowKernel: config.__runtime?.workflowKernel,
      config: hookConfig,
    }),
    ...createContinuationHooks({
      sessionStateManager: config.__runtime?.sessionStateManager,
      workflowKernel: config.__runtime?.workflowKernel,
      continuationStateManager: config.__runtime?.continuationStateManager,
      config: hookConfig,
    }),
    ...createSkillHooks({
      skills: skills.skills,
      config: hookConfig,
    }),
  ].filter((hook) => !disabledHooks.has(hook.id));
  const safeHooks = createCoreHooks({ hooks: allHooks });

  return {
    hookList: safeHooks,
    hooks: Object.fromEntries(safeHooks.map((hook) => [hook.id, hook])),
  };
}
