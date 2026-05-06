export function createCommandRunnerTool({ commandExecutor }) {
  return {
    id: 'tool.command-runner',
    name: 'tool.command-runner',
    description: 'Runs runtime-backed OpenKit commands through the runtime executor.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'runtime_tooling',
    async execute(input = {}) {
      const command = typeof input === 'string' ? input : input?.command ?? null;
      const args = typeof input === 'object' && input !== null ? (input.args ?? {}) : {};

      if (typeof command !== 'string' || command.trim().length === 0) {
        return {
          status: 'invalid-input',
          validation_surface: 'runtime_tooling',
          message: 'tool.command-runner requires a command string.',
        };
      }

      if (!commandExecutor || typeof commandExecutor.execute !== 'function') {
        return {
          status: 'unavailable',
          command,
          validation_surface: 'runtime_tooling',
          message: 'No runtime command executor is available in this session.',
        };
      }

      const result = await commandExecutor.execute(command, args);
      return {
        ...result,
        requestedCommand: command,
        validation_surface: result?.validation_surface ?? 'runtime_tooling',
      };
    },
  };
}
