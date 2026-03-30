import { createIssueClosureHook } from './tool-guards/issue-closure-hook.js';
import { createParallelSafetyHook } from './tool-guards/parallel-safety-hook.js';
import { createStageReadinessHook } from './tool-guards/stage-readiness-hook.js';
import { createToolOutputTruncationHook } from './tool-guards/tool-output-truncation-hook.js';
import { createVerificationClaimHook } from './tool-guards/verification-claim-hook.js';
import { createWriteGuardHook } from './tool-guards/write-guard-hook.js';

export function createToolGuardHooks({ workflowKernel, config = {} }) {
  return [
    createStageReadinessHook({ workflowKernel }),
    createVerificationClaimHook({ workflowKernel }),
    createIssueClosureHook({ workflowKernel }),
    createParallelSafetyHook({ workflowKernel }),
    createWriteGuardHook({ workflowKernel }),
    createToolOutputTruncationHook(config.toolOutputTruncation),
  ];
}
