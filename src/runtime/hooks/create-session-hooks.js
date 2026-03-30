import { createResumeContextHook } from './session/resume-context-hook.js';
import { createRuntimeStatusHook } from './session/runtime-status-hook.js';

export function createSessionHooks({ projectRoot, capabilitySummary, workflowKernel, sessionStateManager, continuationStateManager }) {
  return [
    createResumeContextHook({ projectRoot, workflowKernel, sessionStateManager, continuationStateManager }),
    createRuntimeStatusHook({ capabilitySummary, workflowKernel, sessionStateManager }),
  ];
}
