export function createSyntaxOutlineTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-outline',
    name: 'Syntax Outline Tool',
    description: 'Returns a Tree-sitter-derived outline for supported files.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    async execute(input = {}) {
      return syntaxIndexManager.getOutline(typeof input === 'string' ? input : input.filePath);
    },
  };
}
