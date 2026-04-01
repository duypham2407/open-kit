import { createCapabilityIndex, listRuntimeCapabilities } from './capability-registry.js';
import { loadRuntimeCommands } from './commands/index.js';
import { createContextInjection } from './context/index.js';
import { createRuntimeConfig } from './create-config.js';
import { createHooks } from './create-hooks.js';
import { createManagers } from './create-managers.js';
import { createRuntimeInterface } from './create-runtime-interface.js';
import { createTools } from './create-tools.js';
import { createMcpPlatform } from './mcp/index.js';
import { createModelRuntime } from './models/index.js';
import { createCategoryRuntime } from './categories/index.js';
import { createSkillRegistry } from './skills/index.js';
import { createSpecialistRegistry } from './specialists/index.js';

export function bootstrapRuntimeFoundation({ projectRoot = process.cwd(), env = process.env, mode = 'read-write' } = {}) {
  const configResult = createRuntimeConfig({ projectRoot, env });
  const capabilities = listRuntimeCapabilities({ config: configResult.config });
  const capabilityIndex = createCapabilityIndex({ config: configResult.config });
  const skills = createSkillRegistry({ projectRoot, env });
  const categories = createCategoryRuntime(configResult.config);
  const specialists = createSpecialistRegistry(configResult.config);
  const managers = createManagers({
    config: configResult.config,
    capabilityIndex,
    projectRoot,
    configResult,
    mode,
    specialists: specialists.specialists,
    env,
  });
  const modelRuntime = createModelRuntime({
    categories,
    specialists,
    config: {
      ...configResult.config,
      __runtime: {
        ...(configResult.config.__runtime ?? {}),
        actionModelStateManager: managers.actionModelStateManager,
        agentProfileSwitchManager: managers.agentProfileSwitchManager,
      },
    },
  });
  managers.skillMcpManager.registerSkillBindings(skills.skills);
  const mcpPlatform = createMcpPlatform({
    projectRoot,
    env,
    config: configResult.config,
  });
  const tools = createTools({
    config: configResult.config,
    capabilityIndex,
    projectRoot,
    managers,
    mcpPlatform,
    modelRuntime,
  });
  const hooks = createHooks({
    config: {
      ...configResult.config,
      __runtime: {
        workflowKernel: managers.workflowKernel,
        sessionStateManager: managers.sessionStateManager,
        continuationStateManager: managers.continuationStateManager,
      },
    },
    capabilityIndex,
    projectRoot,
    capabilities,
    skills,
  });
  const commands = loadRuntimeCommands({ projectRoot });
  const contextInjection = createContextInjection({ projectRoot });
  const runtimeInterface = createRuntimeInterface({
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
  });

  return {
    projectRoot,
    configResult,
    capabilities,
    capabilityIndex,
    categories,
    specialists,
    modelRuntime,
    skills,
    commands,
    contextInjection,
    managers,
    mcpPlatform,
    tools,
    hooks,
    runtimeInterface,
  };
}

export function createRuntimeFoundationEnvironment(runtimeFoundation) {
  return {
    ...runtimeFoundation.runtimeInterface.environment,
  };
}
