export function createAstReplaceTool() {
  return {
    id: 'tool.ast-replace',
    execute({ pattern, replacement }) {
      return { status: 'planned', pattern, replacement };
    },
  };
}
