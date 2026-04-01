import { createToolRegistry } from './tools/index.js';

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

export function createTools({ config, capabilityIndex, projectRoot, managers, mcpPlatform, modelRuntime }) {
  const registry = createToolRegistry({ projectRoot, managers, config, mcpPlatform, modelRuntime });
  const toolList = registry.toolList.map((tool) => ({
    id: tool.id,
    name: tool.name ?? tool.id,
    description: tool.description ?? 'runtime tool',
    stage: tool.stage ?? 'foundation',
    status: tool.status ?? 'foundation',
    family: tool.family ?? 'misc',
    capabilityStatus: capabilityIndex['capability.tool-registry']?.status ?? 'missing',
  }));

  return {
    ...registry,
    toolMetadata: toolList,
    toolFamilies: summarizeToolFamilies(toolList),
  };
}
