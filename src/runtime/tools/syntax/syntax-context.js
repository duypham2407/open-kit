export function createSyntaxContextTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-context',
    name: 'Syntax Context Tool',
    description: 'Returns the nearest syntax node, parent, and children around a position.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'runtime_tooling',
    async execute(input = {}) {
      let result;
      if (typeof input === 'string') {
        result = await syntaxIndexManager.getContext(input, {});
      } else {
        result = await syntaxIndexManager.getContext(input.filePath, {
          line: input.line,
          column: input.column,
          depth: input.depth,
        });
      }
      return {
        validationSurface: 'runtime_tooling',
        capabilityState: result?.status === 'unsupported-language' || result?.status === 'invalid-path' ? 'degraded' : 'available',
        caveats: result?.status === 'unsupported-language' ? ['Unsupported language; syntax context is unavailable for this file.'] : [],
        ...result,
      };
    },
  };
}
