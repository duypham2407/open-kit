export function createMomusSpecialist() {
  return {
    id: 'specialist.momus',
    name: 'Momus',
    defaultModel: 'openai/gpt-5.4',
    permissions: ['read'],
    role: 'plan-review-consultant',
  };
}
