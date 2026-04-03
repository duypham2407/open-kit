import { createBashGuardHook } from './tool-guards/bash-guard-hook.js';
import { createIssueClosureHook } from './tool-guards/issue-closure-hook.js';
import { createParallelSafetyHook } from './tool-guards/parallel-safety-hook.js';
import { createStageReadinessHook } from './tool-guards/stage-readiness-hook.js';
import { createToolOutputTruncationHook } from './tool-guards/tool-output-truncation-hook.js';
import { createVerificationClaimHook } from './tool-guards/verification-claim-hook.js';
import { createWriteGuardHook } from './tool-guards/write-guard-hook.js';

function resolveEnforcementLevel(workflowKernel) {
  if (process.env.OPENKIT_ENFORCEMENT_LEVEL) {
    return process.env.OPENKIT_ENFORCEMENT_LEVEL;
  }
  return 'strict';
}

export function createToolGuardHooks({ workflowKernel, config = {} }) {
  const enforcementLevel = resolveEnforcementLevel(workflowKernel);

  return [
    createStageReadinessHook({ workflowKernel }),
    createVerificationClaimHook({ workflowKernel }),
    createIssueClosureHook({ workflowKernel }),
    createParallelSafetyHook({ workflowKernel }),
    createWriteGuardHook({ workflowKernel }),
    createBashGuardHook({ enforcementLevel }),
    createToolOutputTruncationHook(config.toolOutputTruncation),
  ];
}
