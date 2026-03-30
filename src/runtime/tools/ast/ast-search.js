export function createAstSearchTool() {
  return {
    id: 'tool.ast-search',
    execute(pattern) {
      return { status: 'planned', pattern };
    },
  };
}
