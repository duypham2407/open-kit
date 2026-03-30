export function createExploreSpecialist() {
  return {
    id: 'specialist.explore',
    name: 'Explore',
    defaultModel: 'anthropic/claude-haiku-4-5',
    permissions: ['read'],
    role: 'fast-codebase-explorer',
  };
}
