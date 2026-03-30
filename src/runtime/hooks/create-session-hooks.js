import { createResumeContextHook } from './session/resume-context-hook.js';
import { createRuntimeStatusHook } from './session/runtime-status-hook.js';

export function createSessionHooks({ projectRoot, capabilitySummary }) {
  return [
    createResumeContextHook({ projectRoot }),
    createRuntimeStatusHook({ capabilitySummary }),
  ];
}
