/**
 * Action Gateway Tool
 *
 * Advisory MCP tool that validates whether a proposed action is allowed
 * for the current role and stage. Non-blocking — it provides guidance
 * rather than enforcement (enforcement is done by the Role Guard Hook).
 *
 * Input:
 *   { action, description? }
 *
 * Output:
 *   { allowed, currentRole, currentStage, guidance, suggestedApproach }
 */

import { isToolAllowed, getAllowedTools, suggestOwnerForTool } from '../../workflow/role-permissions.js';
import { getValidNextStages, getStageOwner } from '../../workflow/state-machine.js';
import { formatWorkflowStateError, unwrapWorkflowStateResult } from '../../workflow/state-result.js';

const ACTION_TO_TOOLS = {
  edit_code: ['tool.hashline-edit', 'tool.codemod-apply'],
  write_file: ['tool.hashline-edit'],
  run_bash: ['tool.interactive-bash'],
  run_tests: ['tool.test-run'],
  type_check: ['tool.typecheck'],
  lint: ['tool.lint'],
  code_review: ['tool.rule-scan', 'tool.security-scan'],
  browser_test: ['tool.browser-verify'],
  search_code: ['tool.semantic-search', 'tool.find-symbol', 'tool.ast-grep-search'],
  read_code: ['tool.look-at', 'tool.syntax-outline'],
  advance_stage: ['tool.advance-stage'],
  capture_evidence: ['tool.evidence-capture'],
};

export function createActionGatewayTool({ workflowKernel }) {
  return {
    id: 'tool.check-action',
    description: 'Advisory check: Is a proposed action allowed for the current role and stage? Returns guidance without blocking.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { action, description = null } = typeof input === 'string' ? { action: input } : input;

      if (!action) {
        return {
          status: 'error',
          reason: 'action is required. Specify what you want to do (e.g., "edit_code", "run_tests").',
          knownActions: Object.keys(ACTION_TO_TOOLS),
        };
      }

      // Read current state
      const stateResult = workflowKernel?.showState?.() ?? null;
      const { state, error: workflowStateError } = unwrapWorkflowStateResult(stateResult);

      if (workflowStateError) {
        return {
          status: 'error',
          allowed: false,
          reason: formatWorkflowStateError(workflowStateError),
          workflowStateError,
        };
      }

      if (!state || !state.current_owner) {
        return {
          status: 'ok',
          allowed: true,
          reason: 'No workflow state — all actions are permissive.',
          currentRole: null,
          currentStage: null,
        };
      }

      const { current_owner: role, current_stage: stage, mode } = state;

      // Map action to tools
      const relatedTools = ACTION_TO_TOOLS[action] ?? [];
      if (relatedTools.length === 0) {
        return {
          status: 'ok',
          allowed: true,
          reason: `Unknown action "${action}" — no tool mapping found. Proceeding permissively.`,
          currentRole: role,
          currentStage: stage,
          mode,
          knownActions: Object.keys(ACTION_TO_TOOLS),
        };
      }

      // Check each related tool
      const blocked = [];
      const allowed = [];
      for (const toolId of relatedTools) {
        const result = isToolAllowed(role, toolId);
        if (result.allowed) {
          allowed.push(toolId);
        } else {
          blocked.push({ toolId, reason: result.reason, suggestedOwner: result.suggestedOwner });
        }
      }

      if (blocked.length === 0) {
        return {
          status: 'ok',
          allowed: true,
          action,
          description,
          currentRole: role,
          currentStage: stage,
          mode,
          guidance: `Action "${action}" is allowed for ${role} in ${stage}.`,
          allowedTools: allowed,
        };
      }

      // Action is blocked
      const nextStages = getValidNextStages(mode, stage);
      const suggestedOwner = blocked[0].suggestedOwner;
      const suggestedStage = suggestedOwner ? findStageForOwner(mode, suggestedOwner, nextStages) : null;

      return {
        status: 'blocked',
        allowed: false,
        action,
        description,
        currentRole: role,
        currentStage: stage,
        mode,
        blockedTools: blocked.map((b) => b.toolId),
        reason: blocked.map((b) => b.reason).join(' '),
        suggestedApproach: buildSuggestedApproach(role, action, suggestedOwner, suggestedStage, mode),
        allowedActions: getActionsForRole(role),
        validNextStages: nextStages,
      };
    },
  };
}

function findStageForOwner(mode, owner, nextStages) {
  for (const stage of nextStages) {
    if (getStageOwner(mode, stage) === owner) return stage;
  }
  return null;
}

function getActionsForRole(role) {
  const allowedTools = getAllowedTools(role);
  if (allowedTools.includes('*')) return Object.keys(ACTION_TO_TOOLS);

  const actions = [];
  for (const [action, tools] of Object.entries(ACTION_TO_TOOLS)) {
    const anyAllowed = tools.some((toolId) => {
      const result = isToolAllowed(role, toolId);
      return result.allowed;
    });
    if (anyAllowed) actions.push(action);
  }
  return actions;
}

function buildSuggestedApproach(role, action, suggestedOwner, suggestedStage, mode) {
  const lines = [];
  lines.push(`${role} cannot perform "${action}".`);

  if (suggestedOwner) {
    lines.push(`The correct agent for this is ${suggestedOwner}.`);
    if (suggestedStage) {
      lines.push(`Call tool.advance-stage({ targetStage: '${suggestedStage}' }) to reach the stage where ${suggestedOwner} becomes the owner.`);
    }
  }

  return lines.join(' ');
}
