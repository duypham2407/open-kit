import { summarizeRuntimeCapabilities, summarizeSkillCatalog } from './capability-registry.js';
import { inspectWorkflowDoctor } from './doctor/workflow-doctor.js';
import { recoverSessionState } from './recovery/session-recovery.js';
import { buildCapabilityGuidance } from './tools/capability/capability-router-summary.js';

function getSupervisorManagerHealth(supervisorDialogueManager) {
  const description = supervisorDialogueManager?.describe?.() ?? null;
  if (!description) {
    return null;
  }

  const enabled = description.enabled === true;
  const configured = description.adapter?.configured === true;
  const availability = enabled && configured ? 'available' : 'not_configured';
  const status = enabled ? (configured ? 'available' : 'unconfigured') : 'disabled';

  return {
    ...description,
    validation_surface: 'runtime_tooling',
    health: {
      status,
      availability,
      attention_state: 'none',
    },
  };
}

export function createRuntimeInterface({
  projectRoot,
  projectRootResolution = null,
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
  const capabilityPackInventory = managers.capabilityRegistryManager?.listCapabilities?.({ scope: 'openkit' }) ?? { mcps: [], skills: [] };
  const capabilityGuidance = buildCapabilityGuidance({
    workflowState: managers.workflowKernel?.showState?.()?.state ?? managers.workflowKernel?.showRuntimeStatusRelaxed?.()?.state ?? null,
    capabilities: capabilityPackInventory,
    source: 'runtime_summary',
  });
  const capabilityPack = {
    catalogVersion: 1,
    mcpSummary: summarizePackEntries(capabilityPackInventory.mcps, 'capabilityState'),
    skillSummary: summarizeSkillCatalog(capabilityPackInventory.skills),
    keySummary: summarizeKeyState(capabilityPackInventory.mcps),
    guidance: capabilityGuidance,
  };
  const latestSession = managers.sessionStateManager?.latest?.() ?? null;
  const workflowDoctor = inspectWorkflowDoctor(managers.workflowKernel);
  const supervisorDialogue = getSupervisorManagerHealth(managers.supervisorDialogueManager);
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
    capabilityPack,
    managers: managers.managerList,
    tools: tools.toolMetadata ?? tools.toolList,
    hooks: hooks.hookList.map((hook) => ({ id: hook.id, name: hook.name, stage: hook.stage })),
    mcps: mcpPlatform.builtin,
    categories: categories.categories,
    specialists: specialists.specialists,
    models: modelRuntime.resolvedModels,
    modelExecution: modelRuntime.executionState ?? [],
    skills: skills.skills,
    commands,
    contextInjection,
    runtimeState: {
      persistedSessions: managers.sessionStateManager?.list?.().length ?? 0,
      backgroundRuns: managers.backgroundManager?.list?.().length ?? 0,
      actionModelState: managers.actionModelStateManager?.list?.() ?? [],
      syntaxIndex: managers.syntaxIndexManager?.describe?.() ?? null,
      projectGraph: managers.projectGraphManager?.getGraphSummary?.() ?? null,
      supervisorDialogue,
      skillMcpBindings: managers.skillMcpManager?.listBindings?.().length ?? 0,
      latestSession,
      recovery,
      continuation: managers.continuationStateManager?.summary?.() ?? null,
      workflowDoctor,
      projectRootResolution,
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

function summarizePackEntries(entries, stateKey) {
  const states = {
    available: 0,
    unavailable: 0,
    degraded: 0,
    preview: 0,
    compatibility_only: 0,
    not_configured: 0,
  };
  for (const entry of entries ?? []) {
    const state = entry[stateKey];
    if (Object.hasOwn(states, state)) {
      states[state] += 1;
    }
  }
  return {
    total: entries?.length ?? 0,
    enabledOpenKit: (entries ?? []).filter((entry) => entry.enabled).length,
    states,
  };
}

function summarizeKeyState(mcps) {
  let required = 0;
  let presentRedacted = 0;
  let missing = 0;
  for (const mcp of mcps ?? []) {
    for (const value of Object.values(mcp.keyState ?? {})) {
      required += 1;
      if (value === 'present_redacted') {
        presentRedacted += 1;
      } else {
        missing += 1;
      }
    }
  }
  return { required, presentRedacted, missing };
}
