import { summarizeRuntimeCapabilities } from './capability-registry.js';
import { inspectWorkflowDoctor } from './doctor/workflow-doctor.js';
import { recoverSessionState } from './recovery/session-recovery.js';

export function createRuntimeInterface({
  projectRoot,
  configResult,
  capabilities,
  managers,
  tools,
  hooks,
  mcpPlatform,
  categories,
  specialists,
  modelRuntime,
  skills,
  commands,
  contextInjection,
}) {
  const capabilityIds = capabilities.map((capability) => capability.id);
  const capabilitySummary = summarizeRuntimeCapabilities(capabilities);
  const latestSession = managers.sessionStateManager?.latest?.() ?? null;
  const workflowDoctor = inspectWorkflowDoctor(managers.workflowKernel);
  const recovery = recoverSessionState(latestSession, {
    workflowRuntime: managers.workflowKernel,
    backgroundManager: managers.backgroundManager,
    continuationStateManager: managers.continuationStateManager,
  });

  return {
    foundationVersion: 1,
    projectRoot,
    configPaths: {
      project: configResult.projectConfigPath,
      user: configResult.userConfigPath,
    },
    warnings: [...(configResult.warnings ?? [])],
    capabilityIds,
    capabilitySummary,
    managers: managers.managerList,
    tools: tools.toolMetadata ?? tools.toolList,
    hooks: hooks.hookList.map((hook) => ({ id: hook.id, name: hook.name, stage: hook.stage })),
    mcps: mcpPlatform.builtin,
    categories: categories.categories,
    specialists: specialists.specialists,
    models: modelRuntime.resolvedModels,
    skills: skills.skills,
    commands,
    contextInjection,
    runtimeState: {
      persistedSessions: managers.sessionStateManager?.list?.().length ?? 0,
      backgroundRuns: managers.backgroundManager?.list?.().length ?? 0,
      skillMcpBindings: managers.skillMcpManager?.listBindings?.().length ?? 0,
      latestSession,
      recovery,
      continuation: managers.continuationStateManager?.summary?.() ?? null,
      workflowDoctor,
    },
    environment: {
      OPENKIT_RUNTIME_FOUNDATION: '1',
      OPENKIT_RUNTIME_FOUNDATION_VERSION: '1',
      OPENKIT_RUNTIME_CONFIG_CONTENT: JSON.stringify(configResult.config),
      OPENKIT_RUNTIME_CAPABILITIES: JSON.stringify(capabilityIds),
      OPENKIT_RUNTIME_MCPS: JSON.stringify(mcpPlatform.builtin.map((entry) => entry.id)),
    },
  };
}
