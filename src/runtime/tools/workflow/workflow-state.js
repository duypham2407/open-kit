/**
 * Workflow State Tool
 *
 * MCP tool that provides read-only access to current workflow state.
 * Supports querying either the current active state or a specific work item
 * by ID.
 *
 * Input:
 *   { workItemId? }  — optional; when omitted, returns current workflow state
 *
 * Output:
 *   On success: the full state object for inspection
 *   On error:   { status: 'error', reason }
 */

export function createWorkflowStateTool({ workflowKernel }) {
  return {
    id: 'tool.workflow-state',
    description: 'Get current workflow state for inspection',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    execute(input = {}) {
      const normalizedInput = typeof input === 'object' && input !== null ? input : {};
      const hasWorkItemId = 'workItemId' in normalizedInput;
      const { workItemId } = normalizedInput;

      try {
        if (hasWorkItemId) {
          if (typeof workItemId !== 'string' || !workItemId.trim()) {
            return {
              status: 'error',
              reason: 'workItemId must be a non-empty string when provided.',
            };
          }
          return workflowKernel.getWorkItem(workItemId);
        }

        return workflowKernel.getState();
      } catch (err) {
        return {
          status: 'error',
          reason: err?.message ?? String(err),
        };
      }
    },
  };
}
