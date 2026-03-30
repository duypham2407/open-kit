export function createMetisSpecialist() {
  return {
    id: 'specialist.metis',
    name: 'Metis',
    defaultModel: 'anthropic/claude-opus-4-6',
    permissions: ['read'],
    role: 'planning-ambiguity-consultant',
  };
}
