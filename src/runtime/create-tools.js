import { createRequire } from 'node:module';
import { STANDARD_CAPABILITY_STATES, VALIDATION_SURFACES } from './capability-registry.js';
import { createToolRegistry } from './tools/index.js';
import { resolvePathContext } from '../../.opencode/lib/runtime-paths.js';

const require = createRequire(import.meta.url);
const { createInvocationLogger } = require('../../.opencode/lib/invocation-log.js');
const { readWorkItemIndex } = require('../../.opencode/lib/work-item-store.js');

function summarizeToolFamilies(toolList = []) {
  const families = new Map();

  for (const tool of toolList) {
    const family = tool.family ?? 'misc';
    const entry = families.get(family) ?? {
      family,
      total: 0,
      active: 0,
      degraded: 0,
      foundation: 0,
      tools: [],
    };
    entry.total += 1;
    if (tool.status === 'active') {
      entry.active += 1;
    }
    if (tool.status === 'degraded') {
      entry.degraded += 1;
    }
    if (tool.stage === 'foundation') {
      entry.foundation += 1;
    }
    entry.tools.push(tool.id);
    families.set(family, entry);
  }

  return [...families.values()].sort((left, right) => left.family.localeCompare(right.family));
}

function normalizeToolCapabilityState(tool) {
  if (STANDARD_CAPABILITY_STATES.includes(tool.capabilityState)) {
    return tool.capabilityState;
  }

  if (tool.status === 'active' || tool.status === 'ok') {
    return 'available';
  }

  if (tool.status === 'degraded') {
    return 'degraded';
  }

  if (tool.status === 'unavailable' || tool.status === 'dependency-missing') {
    return 'unavailable';
  }

  if (tool.status === 'not_configured' || tool.status === 'not-configured') {
    return 'not_configured';
  }

  if (tool.status === 'preview' || tool.status === 'preview-only' || tool.status === 'preview-ready') {
    return 'preview';
  }

  return tool.stage === 'foundation' ? 'preview' : 'degraded';
}

function normalizeToolValidationSurface(tool) {
  if (VALIDATION_SURFACES.includes(tool.validationSurface)) {
    return tool.validationSurface;
  }

  return 'runtime_tooling';
}

export function createTools({ config, capabilityIndex, projectRoot, managers, mcpPlatform, modelRuntime, hooks = null, env = process.env }) {
  let invocationLogger = null;
  try {
    const pathContext = resolvePathContext(env.OPENKIT_WORKFLOW_STATE ?? null, env);
    // Use a dynamic getter so the invocation logger writes to the
    // per-work-item log of the currently active work item.  This
    // ensures runtime tool invocations are visible to the policy
    // engine which reads per-work-item logs during stage transitions.
    function getActiveWorkItemId() {
      try {
        const index = readWorkItemIndex(pathContext.runtimeRoot);
        return index?.active_work_item_id ?? null;
      } catch {
        return null;
      }
    }

    invocationLogger = createInvocationLogger({
      runtimeRoot: pathContext.runtimeRoot,
      getWorkItemId: getActiveWorkItemId,
    });
  } catch {
    // Invocation logger creation is best-effort; runtime should still function without it
  }

  // Extract guard hooks for tool-execution gating
  const guardHooks = hooks?.hookList?.filter((hook) => hook.id === 'hook.bash-guard') ?? null;

  const registry = createToolRegistry({ projectRoot, managers, config, mcpPlatform, modelRuntime, invocationLogger, guardHooks, env });
  const toolList = registry.toolList.map((tool) => ({
    id: tool.id,
    name: tool.name ?? tool.id,
    description: tool.description ?? 'runtime tool',
    stage: tool.stage ?? 'foundation',
    status: tool.status ?? 'foundation',
    family: tool.family ?? 'misc',
    capabilityState: normalizeToolCapabilityState(tool),
    validationSurface: normalizeToolValidationSurface(tool),
    capabilityStatus: capabilityIndex['capability.tool-registry']?.status ?? 'missing',
  }));

  return {
    ...registry,
    toolMetadata: toolList,
    toolFamilies: summarizeToolFamilies(toolList),
  };
}
