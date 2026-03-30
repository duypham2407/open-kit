import { createToolRegistry } from './tools/index.js';

export function createTools({ config, capabilityIndex, projectRoot, managers }) {
  const registry = createToolRegistry({ projectRoot, managers, config });
  const toolList = registry.toolList.map((tool) => ({
    id: tool.id,
    name: tool.id,
    description: 'runtime tool',
    stage: 'foundation',
    capabilityStatus: capabilityIndex['capability.tool-registry']?.status ?? 'missing',
  }));

  return {
    ...registry,
    toolMetadata: toolList,
  };
}
