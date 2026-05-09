/**
 * Bootstrap Workflow Tool
 *
 * MCP tool that MasterOrchestrator calls to initialize workflow-state.json
 * for a new task. Works on fresh projects before any state file exists.
 *
 * Input:
 *   { lane, description, featureSlug?, archivePrior? }
 *
 * Output:
 *   On created:  { status: 'created', feature_id, feature_slug, lane, archived }
 *   On conflict: { status: 'conflict', activeWorkflow: { mode, current_stage, ... } }
 *   On error:    { status: 'error', message }
 */

export function createBootstrapWorkflowTool({ workflowKernel }) {
  return {
    id: 'tool.bootstrap-workflow',
    description: 'Bootstrap workflow-state.json for a fresh lane. MasterOrchestrator MUST call this on the first command in a project to initialize state.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { lane, description, featureSlug, archivePrior = false } = typeof input === 'string' ? {} : (input || {});

      if (!lane || !['quick', 'full', 'migration'].includes(lane)) {
        return {
          status: 'error',
          message: `lane is required and must be one of: quick, full, migration. Got: ${lane ?? '(missing)'}`,
        };
      }

      if (!description || typeof description !== 'string') {
        return {
          status: 'error',
          message: 'description is required — provide the user\'s raw task request text.',
        };
      }

      if (!workflowKernel?.bootstrapWorkflow) {
        return {
          status: 'error',
          message: 'Workflow kernel is unavailable. Ensure the OpenKit controller is installed.',
        };
      }

      try {
        const result = workflowKernel.bootstrapWorkflow({
          lane,
          description,
          featureSlug,
          archivePrior,
        });
        return result;
      } catch (err) {
        return {
          status: 'error',
          message: err.message,
        };
      }
    },
  };
}
