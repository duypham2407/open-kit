function resolveActionTracking(input, tool) {
  if (input && typeof input === 'object' && !Array.isArray(input) && input.__actionTracking) {
    return input.__actionTracking;
  }

  return {
    subjectId: tool.id,
    actionKey: tool.id,
    stage: null,
    owner: null,
  };
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.__actionTracking) {
    return input;
  }

  const next = { ...input };
  delete next.__actionTracking;
  return next;
}

function shouldRecordSuccess(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return true;
  }

  if (typeof result.status !== 'string') {
    return true;
  }

  return !/failed|error|missing|invalid|unsupported|degraded|unavailable|not[_-]?configured/i.test(result.status);
}

/**
 * Dispatch pre-execution guard hooks.
 *
 * Each guard receives { toolId, args } and returns an advisory object.
 * If any guard sets `allowed: false` or `blocked: true`, the tool call
 * is blocked and a structured result is returned instead.
 */
function dispatchGuardHooks(guardHooks, toolId, args) {
  if (!guardHooks || guardHooks.length === 0) {
    return null;
  }

  for (const hook of guardHooks) {
    if (!hook || typeof hook.run !== 'function') {
      continue;
    }

    try {
      const result = hook.run({ toolId, args });
      if (result && (result.allowed === false || result.blocked === true)) {
        return {
          status: 'blocked',
          hookId: hook.id ?? 'unknown',
          blockedBy: result.blockedBy ?? [hook.id ?? 'guard-hook'],
          reason: result.reason ?? 'Tool call blocked by guard hook.',
        };
      }
    } catch {
      // Guard hooks are best-effort; do not block execution on hook errors
    }
  }

  return null;
}

export function wrapToolExecution(tool, { actionModelStateManager, invocationLogger, guardHooks } = {}) {
  if (!tool || typeof tool.execute !== 'function' || !actionModelStateManager) {
    return tool;
  }

  const execute = tool.execute.bind(tool);

  function recordInvocation(status, startTime, tracking) {
    if (!invocationLogger) {
      return;
    }

    try {
      invocationLogger.record({
        toolId: tool.id,
        status,
        durationMs: Date.now() - startTime,
        stage: tracking.stage ?? null,
        owner: tracking.owner ?? null,
      });
    } catch {
      // Invocation logging is best-effort; do not block tool execution
    }
  }

  return {
    ...tool,
    execute(...args) {
      const tracking = resolveActionTracking(args[0], tool);
      const sanitizedArgs = args.map((entry, index) => (index === 0 ? sanitizeInput(entry) : entry));

      // --- Guard hook dispatch ---
      const guardResult = dispatchGuardHooks(guardHooks, tool.id, sanitizedArgs[0]);
      if (guardResult) {
        // Record the block as a failure
        actionModelStateManager.recordFailure({
          subjectId: tracking.subjectId,
          actionKey: tracking.actionKey,
          detail: `blocked:${guardResult.hookId}`,
        });
        return guardResult;
      }

      const startTime = Date.now();

      try {
        const result = execute(...sanitizedArgs);
        if (result && typeof result.then === 'function') {
          return result
            .then((value) => {
              const success = shouldRecordSuccess(value);
              if (success) {
                actionModelStateManager.recordSuccess({
                  subjectId: tracking.subjectId,
                  actionKey: tracking.actionKey,
                });
              } else {
                actionModelStateManager.recordFailure({
                  subjectId: tracking.subjectId,
                  actionKey: tracking.actionKey,
                  detail: value.status,
                });
              }
              recordInvocation(success ? 'success' : 'failure', startTime, tracking);
              return value;
            })
            .catch((error) => {
              actionModelStateManager.recordFailure({
                subjectId: tracking.subjectId,
                actionKey: tracking.actionKey,
                detail: error instanceof Error ? error.message : String(error),
              });
              recordInvocation('error', startTime, tracking);
              throw error;
            });
        }

        const success = shouldRecordSuccess(result);
        if (success) {
          actionModelStateManager.recordSuccess({
            subjectId: tracking.subjectId,
            actionKey: tracking.actionKey,
          });
        } else {
          actionModelStateManager.recordFailure({
            subjectId: tracking.subjectId,
            actionKey: tracking.actionKey,
            detail: result.status,
          });
        }
        recordInvocation(success ? 'success' : 'failure', startTime, tracking);
        return result;
      } catch (error) {
        actionModelStateManager.recordFailure({
          subjectId: tracking.subjectId,
          actionKey: tracking.actionKey,
          detail: error instanceof Error ? error.message : String(error),
        });
        recordInvocation('error', startTime, tracking);
        throw error;
      }
    },
  };
}
