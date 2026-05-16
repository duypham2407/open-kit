/**
 * Set Approval Tool
 *
 * MCP tool that allows agents to set gate approvals through WorkflowStateManager.
 * Validates gate existence via GateRegistry and approver authority before updating state.
 *
 * Input:
 *   { gateName, approved, approver }
 *
 * Output:
 *   On success: { status: 'ok', gateName, approved }
 *   On error:   { status: 'error', reason }
 */

const GATE_ALIASES = {
  quick_verified: 'quick.verified',
  product_to_solution: 'full.product_to_solution',
  solution_to_fullstack: 'full.solution_to_implementation',
  fullstack_to_code_review: 'full.code_review_passed',
  code_review_to_qa: 'full.qa_passed',
  qa_to_done: 'full.qa_passed',
  baseline_to_strategy: 'migration.baseline_verified',
  strategy_to_upgrade: 'migration.strategy_approved',
  upgrade_to_code_review: 'migration.code_review_passed',
  code_review_to_verify: 'migration.parity_verified',
  migration_verified: 'migration.parity_verified',
};

const APPROVER_ALIASES = {
  QuickAgent: 'quick-agent',
  'Quick Agent': 'quick-agent',
  CodeReviewer: 'code-reviewer',
  'Code Reviewer': 'code-reviewer',
  QAAgent: 'qa-agent',
  'QA Agent': 'qa-agent',
  SolutionLead: 'solution-lead-agent',
  'Solution Lead': 'solution-lead-agent',
};

function normalizeGateName(gateName) {
  return GATE_ALIASES[gateName] ?? gateName;
}

function normalizeApprover(approver) {
  return APPROVER_ALIASES[approver] ?? approver;
}

export function createSetApprovalTool({ workflowKernel }) {
  return {
    id: 'tool.set-approval',
    description: 'Set approval for a workflow gate. Validates gate existence and approver authority before writing state.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { gateName, approved, approver } = typeof input === 'string' ? {} : input;

      // Input validation
      if (!gateName || typeof gateName !== 'string') {
        return {
          status: 'error',
          reason: 'gateName is required and must be a string.',
        };
      }

      if (typeof approved !== 'boolean') {
        return {
          status: 'error',
          reason: 'approved is required and must be a boolean.',
        };
      }

      if (!approver || typeof approver !== 'string') {
        return {
          status: 'error',
          reason: 'approver is required and must be a string.',
        };
      }

      const normalizedGateName = normalizeGateName(gateName);
      const normalizedApprover = normalizeApprover(approver);

      // Call workflowKernel.setApproval()
      try {
        workflowKernel.setApproval(normalizedGateName, approved, normalizedApprover, {
          setBy: 'tool.set-approval',
          requestedGateName: gateName,
          requestedApprover: approver,
        });

        return {
          status: 'ok',
          gateName: normalizedGateName,
          approved,
        };
      } catch (err) {
        return {
          status: 'error',
          reason: err?.message ?? String(err),
        };
      }
    },
  };
}
