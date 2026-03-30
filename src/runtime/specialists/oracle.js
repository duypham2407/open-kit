export function createOracleSpecialist() {
  return {
    id: 'specialist.oracle',
    name: 'Oracle',
    defaultModel: 'openai/gpt-5.4',
    permissions: ['read'],
    role: 'architecture-and-debugging-consultant',
  };
}
