export function createSyntaxOutlineTool({ syntaxIndexManager }) {
  return {
    id: 'tool.syntax-outline',
    name: 'Syntax Outline Tool',
    description:
      'Returns a Tree-sitter-derived outline for supported files. ' +
      'Pass { filePath } for a single file, or { projectWide: true } for a condensed project-wide symbol map.',
    family: 'syntax',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'runtime_tooling',
    async execute(input = {}) {
      // Project-wide scan mode
      if (input.projectWide === true) {
        const result = await syntaxIndexManager.getProjectOutline({
          maxFiles: input.maxFiles ?? 500,
        });
        return {
          validationSurface: 'runtime_tooling',
          capabilityState: result?.status === 'unsupported-language' || result?.status === 'invalid-path' ? 'degraded' : 'available',
          caveats: result?.status === 'unsupported-language' ? ['Unsupported language; syntax outline is unavailable for this file set.'] : [],
          ...result,
        };
      }

      // Single-file mode (original behavior)
      const result = await syntaxIndexManager.getOutline(typeof input === 'string' ? input : input.filePath);
      return {
        validationSurface: 'runtime_tooling',
        capabilityState: result?.status === 'unsupported-language' || result?.status === 'invalid-path' ? 'degraded' : 'available',
        caveats: result?.status === 'unsupported-language' ? ['Unsupported language; syntax outline is unavailable for this file.'] : [],
        ...result,
      };
    },
  };
}
