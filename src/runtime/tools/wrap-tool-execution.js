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

  return !/failed|error|missing|invalid|unsupported|degraded/i.test(result.status);
}

export function wrapToolExecution(tool, { actionModelStateManager, invocationLogger } = {}) {
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
