export function createMomusSpecialist() {
  return {
    id: 'specialist.momus',
    name: 'Momus',
    defaultModel: 'openai/gpt-5.4',
    permissions: ['read'],
    role: 'plan-review-consultant',
    systemPromptPath: 'prompts/momus-system-prompt.md',
    tools: [
      'tool.runtime-summary',
      'tool.workflow-state',
      'tool.semantic-search',
      'tool.find-dependencies',
    ],
  };
}
