export function unwrapWorkflowStateResult(stateResult) {
  if (!stateResult) {
    return { state: null, error: null, statePath: null };
  }

  if (typeof stateResult !== 'object') {
    return { state: stateResult, error: null, statePath: null };
  }

  const isWrappedResult = Object.hasOwn(stateResult, 'state') || Object.hasOwn(stateResult, 'statePath');
  if (isWrappedResult && stateResult.error) {
    return {
      state: null,
      error: stateResult.error,
      statePath: stateResult.statePath ?? null,
    };
  }

  if (isWrappedResult) {
    return {
      state: stateResult.state ?? null,
      error: null,
      statePath: stateResult.statePath ?? null,
    };
  }

  return { state: stateResult, error: null, statePath: null };
}

export function formatWorkflowStateError(error) {
  const message = error?.message ?? String(error ?? 'unknown workflow state error');
  const code = error?.code ? ` (${error.code})` : '';
  return `Workflow state unavailable${code}: ${message}`;
}
