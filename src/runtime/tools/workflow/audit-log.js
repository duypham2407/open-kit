import { unwrapWorkflowStateResult } from '../../workflow/state-result.js';

/**
 * Audit Log Tool
 *
 * MCP tool that returns a summary of workflow events:
 * - Stage transitions
 * - Tool call blocks
 * - Violations by role
 * - Evidence captured
 *
 * Aggregates data from the invocation logger and workflow state.
 */

export function createAuditLogTool({ workflowKernel, invocationLogger }) {
  return {
    id: 'tool.workflow-audit',
    description: 'Returns an audit log of workflow events: stage transitions, blocked tool calls, violations by role, and evidence captured.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { limit = 50, filter = null } = typeof input === 'string' ? { filter: input } : input;

      const audit = {
        timestamp: new Date().toISOString(),
        summary: {
          totalInvocations: 0,
          blockedCalls: 0,
          stageTransitions: 0,
          evidenceItems: 0,
          violationsByRole: {},
        },
        recentEvents: [],
      };

      // Aggregate from invocation logger if available
      if (invocationLogger?.getEntries) {
        try {
          const entries = invocationLogger.getEntries({ limit });
          audit.summary.totalInvocations = entries.length;

          for (const entry of entries) {
            const event = {
              timestamp: entry.timestamp,
              toolId: entry.toolId,
              role: entry.role ?? 'unknown',
              status: entry.blocked ? 'blocked' : 'allowed',
              blockedBy: entry.blockedBy ?? null,
              reason: entry.reason ?? null,
            };

            if (entry.blocked) {
              audit.summary.blockedCalls++;
              const role = entry.role ?? 'unknown';
              audit.summary.violationsByRole[role] = (audit.summary.violationsByRole[role] ?? 0) + 1;
            }

            if (!filter || event.status === filter || event.toolId === filter || event.role === filter) {
              audit.recentEvents.push(event);
            }
          }
        } catch {
          audit.loggerStatus = 'error reading invocation log';
        }
      } else {
        audit.loggerStatus = 'invocation logger not available';
      }

      // Read workflow state for evidence and transitions
      const stateResult = workflowKernel?.showState?.() ?? null;
      const { state, error: workflowStateError } = unwrapWorkflowStateResult(stateResult);

      if (workflowStateError) {
        audit.workflowStateError = workflowStateError;
      } else if (state) {
        audit.currentState = {
          mode: state.mode,
          stage: state.current_stage,
          owner: state.current_owner,
        };

        // Count evidence items
        if (Array.isArray(state.verification_evidence)) {
          audit.summary.evidenceItems = state.verification_evidence.length;

          // Count stage transitions from evidence
          const transitions = state.verification_evidence.filter(
            (e) => e.type === 'stage_transition',
          );
          audit.summary.stageTransitions = transitions.length;

          // Add transition events
          for (const transition of transitions) {
            audit.recentEvents.push({
              timestamp: transition.timestamp ?? transition.transition?.timestamp,
              toolId: 'tool.advance-stage',
              role: transition.transition?.previousOwner ?? 'unknown',
              status: 'transition',
              from: transition.transition?.from,
              to: transition.transition?.to,
              newOwner: transition.transition?.newOwner,
            });
          }
        }
      }

      // Sort events by timestamp (newest first)
      audit.recentEvents.sort((a, b) => {
        const ta = a.timestamp ?? '';
        const tb = b.timestamp ?? '';
        return tb.localeCompare(ta);
      });

      // Limit events
      if (audit.recentEvents.length > limit) {
        audit.recentEvents = audit.recentEvents.slice(0, limit);
      }

      return audit;
    },
  };
}
