export function createSyntaxContextTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-context',
    name: 'Syntax Context Tool',
    description: 'Returns the nearest syntax node, parent, and children around a position.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    async execute(input = {}) {
      if (typeof input === 'string') {
        return syntaxIndexManager.getContext(input, {});
      }

      return syntaxIndexManager.getContext(input.filePath, {
        line: input.line,
        column: input.column,
        depth: input.depth,
      });
    },
  };
}
