export function createLibrarianSpecialist() {
  return {
    id: 'specialist.librarian',
    name: 'Librarian',
    defaultModel: 'google/gemini-3-flash',
    permissions: ['read'],
    role: 'documentation-and-code-search-consultant',
    systemPromptPath: 'prompts/librarian-system-prompt.md',
    tools: [
      'tool.semantic-search',
      'tool.mcp-dispatch',
      'tool.session-search',
      'tool.syntax-outline',
      'tool.find-symbol',
    ],
  };
}
