export function createMetisSpecialist() {
  return {
    id: 'specialist.metis',
    name: 'Metis',
    defaultModel: 'anthropic/claude-opus-4-6',
    permissions: ['read'],
    role: 'planning-ambiguity-consultant',
    systemPromptPath: 'prompts/metis-system-prompt.md',
    tools: [
      'tool.runtime-summary',
      'tool.workflow-state',
      'tool.semantic-search',
      'tool.rule-scan',
    ],
  };
}
