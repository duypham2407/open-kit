export class OpenKitSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class SessionRequiredError extends OpenKitSessionError {
  constructor() {
    super(
      'OPENKIT_SESSION_ID is not set. Run `openkit run` to start a session, or `openkit sessions resume <id>` to attach to an existing one.',
      'OK_SESSION_REQUIRED',
    );
  }
}

export class SessionNotFoundError extends OpenKitSessionError {
  constructor(sessionId) {
    super(`Session '${sessionId}' was not found in sessions/index.json or its meta.json is missing.`, 'OK_SESSION_NOT_FOUND');
    this.sessionId = sessionId;
  }
}

export class SessionStateMismatchError extends OpenKitSessionError {
  constructor(envSessionId, workItemId, indexSessionId) {
    super(
      `Env OPENKIT_SESSION_ID=${envSessionId} but work item '${workItemId}' is bound to session '${indexSessionId ?? 'none'}' in work-items/index.json.`,
      'OK_SESSION_STATE_MISMATCH',
    );
    this.envSessionId = envSessionId;
    this.workItemId = workItemId;
    this.indexSessionId = indexSessionId;
  }
}

export class SessionAlreadyBoundError extends OpenKitSessionError {
  constructor(workItemId, lane) {
    super(
      `Session is bound to work item ${workItemId} (lane=${lane}). Open a new tab for a different work item.`,
      'OK_SESSION_ALREADY_BOUND',
    );
    this.workItemId = workItemId;
    this.lane = lane;
  }
}

export class WorktreeMissingError extends OpenKitSessionError {
  constructor(worktreePath) {
    super(`Worktree at '${worktreePath}' is missing on disk. Recommend abandoning the session.`, 'OK_WORKTREE_MISSING');
    this.worktreePath = worktreePath;
  }
}

export class IndexLockTimeoutError extends OpenKitSessionError {
  constructor(filePath, timeoutMs) {
    super(`Could not acquire advisory lock on '${filePath}' within ${timeoutMs}ms.`, 'OK_INDEX_LOCK_TIMEOUT');
    this.filePath = filePath;
    this.timeoutMs = timeoutMs;
  }
}
