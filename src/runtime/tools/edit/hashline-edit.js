export function createHashlineEditTool() {
  return {
    id: 'tool.hashline-edit',
    execute({ filePath, anchor, replacement }) {
      return {
        filePath,
        anchor,
        replacement,
        strategy: 'hashline-anchor',
      };
    },
  };
}
