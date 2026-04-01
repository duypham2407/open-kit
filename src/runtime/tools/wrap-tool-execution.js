function resolveActionTracking(input, tool) {
  if (input && typeof input === 'object' && !Array.isArray(input) && input.__actionTracking) {
    return input.__actionTracking;
  }

  return {
    subjectId: tool.id,
    actionKey: tool.id,
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

export function wrapToolExecution(tool, { actionModelStateManager } = {}) {
  if (!tool || typeof tool.execute !== 'function' || !actionModelStateManager) {
    return tool;
  }

  const execute = tool.execute.bind(tool);

  return {
    ...tool,
    execute(...args) {
      const tracking = resolveActionTracking(args[0], tool);
      const sanitizedArgs = args.map((entry, index) => (index === 0 ? sanitizeInput(entry) : entry));

      try {
        const result = execute(...sanitizedArgs);
        if (result && typeof result.then === 'function') {
          return result
            .then((value) => {
              if (shouldRecordSuccess(value)) {
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
              return value;
            })
            .catch((error) => {
              actionModelStateManager.recordFailure({
                subjectId: tracking.subjectId,
                actionKey: tracking.actionKey,
                detail: error instanceof Error ? error.message : String(error),
              });
              throw error;
            });
        }

        if (shouldRecordSuccess(result)) {
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
        return result;
      } catch (error) {
        actionModelStateManager.recordFailure({
          subjectId: tracking.subjectId,
          actionKey: tracking.actionKey,
          detail: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
