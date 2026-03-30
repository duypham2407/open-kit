export function createInteractiveBashTool() {
  return {
    id: 'tool.interactive-bash',
    execute(command) {
      return {
        status: 'planned',
        command,
      };
    },
  };
}
