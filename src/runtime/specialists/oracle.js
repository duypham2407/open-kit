export function createOracleSpecialist() {
  return {
    id: 'specialist.oracle',
    name: 'Oracle',
    defaultModel: 'openai/gpt-5.4',
    permissions: ['read'],
    role: 'architecture-and-debugging-consultant',
    systemPromptPath: 'prompts/oracle-system-prompt.md',
    tools: [
      'tool.semantic-search',
      'tool.find-symbol',
      'tool.graph-goto-definition',
      'tool.graph-find-references',
      'tool.graph-call-hierarchy',
      'tool.graph-rename-preview',
    ],
  };
}
