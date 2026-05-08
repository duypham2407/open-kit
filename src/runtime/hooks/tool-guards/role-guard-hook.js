/**
 * Role Guard Hook
 *
 * Pre-execution guard that checks whether the current workflow owner
 * is permitted to call a specific tool. Consumes the role permission
 * matrix and the active workflow state to make the decision.
 *
 * When a tool call is blocked, the response includes:
 * - reason: human-readable explanation
 * - blockedBy: machine-readable block source
 * - suggestedOwner: which agent should do this instead
 * - allowedTools: what the current role CAN do
 * - guidance: step-by-step guidance on how to proceed
 */

import { isToolAllowed, getKnownRoles } from '../../workflow/role-permissions.js';

export function createRoleGuardHook({ workflowKernel }) {
  return {
    id: 'hook.role-guard',
    name: 'Role Permission Guard',
    stage: 'active',
    run({ toolId, args } = {}) {
      if (!toolId) {
        return { allowed: true };
      }

      // Read current workflow state
      const stateResult = workflowKernel?.showState?.() ?? null;
      const state = stateResult?.state ?? stateResult ?? null;

      // No workflow state → permissive mode (don't block during setup)
      if (!state || !state.current_owner) {
        return { allowed: true };
      }

      const currentOwner = state.current_owner;
      const currentStage = state.current_stage ?? 'unknown';
      const currentMode = state.mode ?? 'unknown';

      // Unknown role → permissive with warning
      if (!getKnownRoles().includes(currentOwner)) {
        return {
          allowed: true,
          warning: `Unknown role '${currentOwner}' — role guard is permissive for unrecognized roles.`,
        };
      }

      const result = isToolAllowed(currentOwner, toolId);

      if (result.allowed) {
        return { allowed: true };
      }

      // Build structured block response with self-healing guidance
      const guidance = buildGuidance(currentOwner, currentStage, currentMode, toolId, result.suggestedOwner);

      return {
        allowed: false,
        blocked: true,
        blockedBy: ['role-permission'],
        reason: result.reason,
        currentOwner,
        currentStage,
        currentMode,
        suggestedOwner: result.suggestedOwner,
        allowedTools: result.allowedTools,
        guidance,
      };
    },
  };
}

function buildGuidance(currentOwner, currentStage, currentMode, toolId, suggestedOwner) {
  const lines = [];
  lines.push(`You are currently acting as ${currentOwner} in stage ${currentStage} (${currentMode} mode).`);
  lines.push(`${currentOwner} is not permitted to use ${toolId}.`);

  if (suggestedOwner) {
    lines.push(`The correct agent for this action is ${suggestedOwner}.`);

    if (currentMode === 'quick') {
      lines.push('In quick mode, QuickAgent owns all stages. If you need this tool, ensure workflow state shows QuickAgent as owner.');
    } else if (currentMode === 'full') {
      const stageHint = getSuggestedStageForOwner(suggestedOwner);
      if (stageHint) {
        lines.push(`Call tool.advance-stage to reach ${stageHint} where ${suggestedOwner} becomes the owner.`);
      }
    } else if (currentMode === 'migration') {
      const stageHint = getMigrationStageForOwner(suggestedOwner);
      if (stageHint) {
        lines.push(`Call tool.advance-stage to reach ${stageHint} where ${suggestedOwner} becomes the owner.`);
      }
    }
  }

  return lines.join(' ');
}

function getSuggestedStageForOwner(owner) {
  const map = {
    ProductLead: 'full_product',
    SolutionLead: 'full_solution',
    FullstackAgent: 'full_implementation',
    CodeReviewer: 'full_code_review',
    QAAgent: 'full_qa',
  };
  return map[owner] ?? null;
}

function getMigrationStageForOwner(owner) {
  const map = {
    SolutionLead: 'migration_strategy',
    FullstackAgent: 'migration_upgrade',
    CodeReviewer: 'migration_code_review',
    QAAgent: 'migration_verify',
  };
  return map[owner] ?? null;
}
