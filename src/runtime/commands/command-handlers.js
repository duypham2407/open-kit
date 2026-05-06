import { createInitDeepHandler } from './handlers/init-deep.js';

export function createRuntimeCommandHandlers() {
  const handlers = [
    createInitDeepHandler(),
  ];

  return Object.fromEntries(handlers.map((handler) => [handler.name, handler]));
}
