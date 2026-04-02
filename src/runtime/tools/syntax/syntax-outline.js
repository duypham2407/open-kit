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
    async execute(input = {}) {
      // Project-wide scan mode
      if (input.projectWide === true) {
        return syntaxIndexManager.getProjectOutline({
          maxFiles: input.maxFiles ?? 500,
        });
      }

      // Single-file mode (original behavior)
      return syntaxIndexManager.getOutline(typeof input === 'string' ? input : input.filePath);
    },
  };
}
