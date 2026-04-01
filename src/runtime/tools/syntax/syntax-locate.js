export function createSyntaxLocateTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-locate',
    name: 'Syntax Locate Tool',
    description: 'Finds nodes of a given syntax type in supported files.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    async execute(input = {}) {
      return syntaxIndexManager.locateType(
        typeof input === 'string' ? input : input.filePath,
        typeof input === 'string' ? 'program' : input.nodeType
      );
    },
  };
}
