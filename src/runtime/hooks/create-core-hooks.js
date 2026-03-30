import { createSafeHook } from './safe-hook.js';

export function createCoreHooks({ hooks }) {
  return hooks.map((hook) => createSafeHook(hook));
}
