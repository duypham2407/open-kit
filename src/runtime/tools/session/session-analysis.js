function normalizeLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sortNewestFirst(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left?.recorded_at ?? 0).getTime();
    const rightTime = new Date(right?.recorded_at ?? 0).getTime();
    return rightTime - leftTime;
  });
}

export function summarizeSession(entry) {
  const continuationStatus = entry?.continuationStatus ?? 'idle';
  const continuationRemainingCount = entry?.continuationRemainingCount ?? 0;
  const resumable = Boolean(
    entry?.nextAction ||
    entry?.activeWorkItemId ||
    (entry?.backgroundRunCount ?? 0) > 0 ||
    continuationStatus === 'active' ||
    continuationStatus === 'handoff-ready'
  );
  const needsAttention = Boolean(
    (entry?.exitCode ?? 0) !== 0 ||
    continuationStatus === 'stopped' ||
    continuationRemainingCount > 0
  );

  return {
    sessionId: entry?.session_id ?? null,
    recordedAt: entry?.recorded_at ?? null,
    launcher: entry?.launcher ?? null,
    source: entry?.source ?? null,
    mode: entry?.mode ?? null,
    stage: entry?.stage ?? null,
    workflowStatus: entry?.workflowStatus ?? null,
    activeWorkItemId: entry?.activeWorkItemId ?? null,
    nextAction: entry?.nextAction ?? null,
    backgroundRunCount: entry?.backgroundRunCount ?? 0,
    continuationStatus,
    continuationRemainingCount,
    continuationStopReason: entry?.continuationStopReason ?? null,
    resumeRecommendation: entry?.resumeRecommendation ?? null,
    resumable,
    needsAttention,
    exitCode: entry?.exitCode ?? null,
  };
}

export function analyzeSessions(sessions = [], options = {}) {
  const limit = normalizeLimit(options.limit, 10);
  const modeFilter = typeof options.mode === 'string' ? options.mode : null;
  const workItemFilter = typeof options.activeWorkItemId === 'string' ? options.activeWorkItemId : null;
  const onlyResumable = options.onlyResumable === true;
  const query = typeof options.query === 'string' ? options.query.trim().toLowerCase() : '';

  const filtered = sortNewestFirst(sessions)
    .filter((entry) => !modeFilter || entry?.mode === modeFilter)
    .filter((entry) => !workItemFilter || entry?.activeWorkItemId === workItemFilter)
    .filter((entry) => !onlyResumable || summarizeSession(entry).resumable)
    .filter((entry) => {
      if (!query) {
        return true;
      }
      return JSON.stringify(entry).toLowerCase().includes(query);
    });

  const summaries = filtered.map((entry) => summarizeSession(entry));
  const resumeCandidates = summaries
    .filter((entry) => entry.resumable)
    .slice(0, limit);

  return {
    total: sessions.length,
    filtered: filtered.length,
    filters: {
      mode: modeFilter,
      activeWorkItemId: workItemFilter,
      onlyResumable,
      query: query || null,
      limit,
    },
    sessions: summaries.slice(0, limit),
    resumeCandidates,
  };
}
