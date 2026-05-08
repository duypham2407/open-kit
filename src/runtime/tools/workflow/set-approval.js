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

      // Call workflowKernel.setApproval()
      try {
        workflowKernel.setApproval(gateName, approved, approver, {
          setBy: 'tool.set-approval',
        });

        return {
          status: 'ok',
          gateName,
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
