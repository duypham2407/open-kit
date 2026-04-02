export function createExploreSpecialist() {
  return {
    id: 'specialist.explore',
    name: 'Explore',
    defaultModel: 'anthropic/claude-haiku-4-5',
    permissions: ['read'],
    role: 'fast-codebase-explorer',
    systemPromptPath: 'prompts/explore-system-prompt.md',
    tools: [
      'tool.syntax-outline',
      'tool.syntax-context',
      'tool.find-dependencies',
      'tool.find-dependents',
      'tool.import-graph',
      'tool.find-symbol',
    ],
  };
}
