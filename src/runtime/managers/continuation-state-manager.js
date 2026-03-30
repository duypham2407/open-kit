import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function defaultState() {
  return {
    schema: 'openkit/continuation-state@1',
    stateVersion: 1,
    updatedAt: null,
    status: 'idle',
    current: null,
    stop: null,
    history: [],
  };
}

function appendHistoryEntry(state, entry) {
  const history = [...(state.history ?? []), entry];
  return history.slice(-25);
}

function normalizeActionList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
}

function normalizeLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export class ContinuationStateManager {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.root = path.join(runtimeRoot, '.opencode');
    this.statePath = path.join(this.root, 'continuation-state.json');
  }

  read() {
    if (!fs.existsSync(this.statePath)) {
      return defaultState();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      return {
        ...defaultState(),
        ...parsed,
        history: Array.isArray(parsed?.history) ? parsed.history : [],
      };
    } catch {
      return {
        ...defaultState(),
        status: 'invalid',
        stop: {
          reason: 'malformed-continuation-state',
          stoppedAt: new Date().toISOString(),
          stoppedBy: 'runtime',
        },
      };
    }
  }

  write(state) {
    const nextState = {
      ...defaultState(),
      ...state,
      updatedAt: new Date().toISOString(),
      history: Array.isArray(state?.history) ? state.history.slice(-25) : [],
    };

    if (this.mode === 'read-only') {
      return nextState;
    }

    ensureDir(this.root);
    fs.writeFileSync(this.statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    return nextState;
  }

  start({
    source = 'manual',
    reason = null,
    workItemId = null,
    taskId = null,
    mode = null,
    stage = null,
    remainingActions = [],
    notes = [],
    learnings = [],
    maxPasses = 1,
  } = {}) {
    const previous = this.read();
    const startedAt = new Date().toISOString();
    const nextState = {
      ...previous,
      status: 'active',
      current: {
        source,
        reason,
        workItemId,
        taskId,
        mode,
        stage,
        startedAt,
        handoffSummary: previous.current?.handoffSummary ?? null,
        remainingActions: normalizeActionList(remainingActions),
        notes: normalizeActionList(notes),
        learnings: normalizeActionList(learnings),
        currentPasses: 0,
        maxPasses: normalizeLimit(maxPasses, 1),
      },
      stop: null,
      history: appendHistoryEntry(previous, {
        at: startedAt,
        type: 'started',
        source,
        reason,
        workItemId,
        taskId,
      }),
    };

    return this.write(nextState);
  }

  handoff({ summary = null, remainingActions = [], notes = [], learnings = [] } = {}) {
    const previous = this.read();
    const handoffAt = new Date().toISOString();
    const nextState = {
      ...previous,
      status: 'handoff-ready',
      current: {
        ...(previous.current ?? {}),
        handoffSummary: summary,
        remainingActions: normalizeActionList(remainingActions),
        notes: normalizeActionList(notes),
        learnings: normalizeActionList(learnings),
      },
      stop: null,
      history: appendHistoryEntry(previous, {
        at: handoffAt,
        type: 'handoff',
        summary,
        remainingActions: normalizeActionList(remainingActions),
      }),
    };

    return this.write(nextState);
  }

  stop({ reason = 'operator-stop', stoppedBy = 'operator' } = {}) {
    const previous = this.read();
    const stoppedAt = new Date().toISOString();
    const nextState = {
      ...previous,
      status: 'stopped',
      stop: {
        reason,
        stoppedAt,
        stoppedBy,
      },
      history: appendHistoryEntry(previous, {
        at: stoppedAt,
        type: 'stopped',
        reason,
        stoppedBy,
      }),
    };

    return this.write(nextState);
  }

  recordLoopPass({ note = null } = {}) {
    const previous = this.read();
    const current = previous.current;
    if (!current) {
      return previous;
    }

    const recordedAt = new Date().toISOString();
    const currentPasses = normalizeLimit(current.currentPasses, 0) + 1;
    const maxPasses = normalizeLimit(current.maxPasses, 1);
    const exhausted = currentPasses >= maxPasses;
    const nextState = {
      ...previous,
      status: exhausted ? 'stopped' : previous.status,
      current: {
        ...current,
        currentPasses,
        maxPasses,
      },
      stop: exhausted
        ? {
            reason: 'loop-budget-exhausted',
            stoppedAt: recordedAt,
            stoppedBy: 'runtime',
          }
        : previous.stop,
      history: appendHistoryEntry(previous, {
        at: recordedAt,
        type: exhausted ? 'loop-budget-exhausted' : 'loop-pass',
        note,
        currentPasses,
        maxPasses,
      }),
    };

    return this.write(nextState);
  }

  summary() {
    const state = this.read();
    return {
      ...state,
      remainingActionCount: state.current?.remainingActions?.length ?? 0,
      noteCount: state.current?.notes?.length ?? 0,
      learningCount: state.current?.learnings?.length ?? 0,
      stoppedReason: state.stop?.reason ?? null,
      historyCount: state.history?.length ?? 0,
    };
  }
}
