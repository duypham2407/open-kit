/**
 * comprehensive-context tool (Phase 5)
 *
 * Exposes the ContextAssemblyManager via a runtime tool surface.  Callers
 * supply a task description, optional focus paths, depth hint, token budget,
 * and optional intent type.  The tool delegates to the manager's
 * `gatherTaskContext` and returns the assembled context package as-is.
 *
 * When the manager is unavailable (e.g. project graph missing), the tool
 * reports `status: 'unavailable'` so callers can degrade gracefully.
 */
export function createComprehensiveContextTool({ contextAssemblyManager } = {}) {
  return {
    id: 'tool.comprehensive-context',
    name: 'Comprehensive Context Tool',
    description:
      'Assemble multi-layer context (structural, semantic, intent) for a ' +
      'task. Pass { task, focus?, depth?, budget?, intentType? } to receive ' +
      'a ranked, budget-bound context package with metadata describing ' +
      'layer coverage and confidence.',
    family: 'context',
    stage: 'integration',
    status: contextAssemblyManager ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!contextAssemblyManager || typeof contextAssemblyManager.gatherTaskContext !== 'function') {
        return {
          status: 'unavailable',
          reason:
            'Context assembly manager is not available. Run openkit doctor for details.',
        };
      }

      const {
        task,
        focus = [],
        depth = 'medium',
        budget = 8000,
        intentType = null,
      } = input;

      if (!task || typeof task !== 'string') {
        return { status: 'error', reason: 'task is required.' };
      }

      return contextAssemblyManager.gatherTaskContext({
        task,
        focus,
        depth,
        budget,
        intentType,
      });
    },
  };
}
