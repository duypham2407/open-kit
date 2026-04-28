export function createSyntaxLocateTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-locate',
    name: 'Syntax Locate Tool',
    description: 'Finds nodes of a given syntax type in supported files.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'runtime_tooling',
    async execute(input = {}) {
      const result = await syntaxIndexManager.locateType(
        typeof input === 'string' ? input : input.filePath,
        typeof input === 'string' ? 'program' : input.nodeType
      );
      return {
        validationSurface: 'runtime_tooling',
        capabilityState: result?.status === 'unsupported-language' || result?.status === 'invalid-path' ? 'degraded' : 'available',
        caveats: result?.status === 'unsupported-language' ? ['Unsupported language; syntax locate is unavailable for this file.'] : [],
        ...result,
      };
    },
  };
}
