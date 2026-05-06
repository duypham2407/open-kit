import { createRuntimeCommandHandlers } from './command-handlers.js';

export function createRuntimeCommandExecutor({ projectRoot }) {
  const handlers = createRuntimeCommandHandlers();

  return {
    handlers,
    async execute(commandName, input = {}) {
      const handler = handlers[commandName];
      if (!handler) {
        return {
          status: 'unknown-command',
          command: commandName,
          validation_surface: 'runtime_tooling',
          message: `No runtime-backed handler is registered for ${commandName}.`,
        };
      }

      return handler.execute({
        ...input,
        projectRoot,
        commandName,
      });
    },
  };
}
