import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function createEmptyState() {
  return {
    schema: 'openkit/action-model-state@1',
    stateVersion: 1,
    updatedAt: new Date().toISOString(),
    actions: {},
  };
}

function createActionKey(subjectId, actionKey) {
  return `${subjectId}::${actionKey}`;
}

export class ActionModelStateManager {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.filePath = path.join(runtimeRoot, '.opencode', 'action-model-state.json');
  }

  readState() {
    const state = readJsonIfExists(this.filePath);
    return isPlainObject(state) && isPlainObject(state.actions)
      ? {
          schema: 'openkit/action-model-state@1',
          stateVersion: 1,
          updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null,
          actions: state.actions,
        }
      : createEmptyState();
  }

  writeState(state) {
    if (this.mode === 'read-only') {
      return state;
    }

    writeJson(this.filePath, {
      schema: 'openkit/action-model-state@1',
      stateVersion: 1,
      updatedAt: new Date().toISOString(),
      actions: state.actions,
    });
    return state;
  }

  get(subjectId, actionKey) {
    const state = this.readState();
    return state.actions[createActionKey(subjectId, actionKey)] ?? null;
  }

  list() {
    return Object.values(this.readState().actions);
  }

  record({ subjectId, actionKey, success, detail = null }) {
    if (!subjectId || !actionKey) {
      return null;
    }

    const state = this.readState();
    const key = createActionKey(subjectId, actionKey);
    const current = state.actions[key] ?? {
      subjectId,
      actionKey,
      consecutiveFailures: 0,
      attempts: 0,
      lastStatus: null,
      lastError: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
    const timestamp = new Date().toISOString();
    const next = {
      ...current,
      subjectId,
      actionKey,
      attempts: (current.attempts ?? 0) + 1,
      lastStatus: success ? 'success' : 'failure',
      lastAttemptAt: timestamp,
      lastError: success ? null : detail,
      consecutiveFailures: success ? 0 : (current.consecutiveFailures ?? 0) + 1,
      ...(success ? { lastSuccessAt: timestamp } : { lastFailureAt: timestamp }),
    };
    state.actions[key] = next;
    this.writeState(state);
    return next;
  }

  recordSuccess({ subjectId, actionKey, detail = null }) {
    return this.record({ subjectId, actionKey, success: true, detail });
  }

  recordFailure({ subjectId, actionKey, detail = null }) {
    return this.record({ subjectId, actionKey, success: false, detail });
  }
}
