import fs from 'node:fs';
import path from 'node:path';

import { normalizeRuntimeSessionId } from '../runtime-session-id.js';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export class SessionStateManager {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.root = path.join(runtimeRoot, '.opencode', 'runtime-sessions');
    this.indexPath = path.join(this.root, 'index.json');
  }

  record(session) {
    if (this.mode === 'read-only') {
      return {
        ...session,
        projectRoot: this.projectRoot,
        runtimeRoot: this.runtimeRoot,
      };
    }

    ensureDir(this.root);
    const sessions = this.list();
    const nextSession = {
      ...session,
      projectRoot: this.projectRoot,
      runtimeRoot: this.runtimeRoot,
    };
    sessions.push(nextSession);
    fs.writeFileSync(this.indexPath, `${JSON.stringify({ sessions }, null, 2)}\n`, 'utf8');
    return nextSession;
  }

  upsert(session) {
    const runtimeSessionId = normalizeRuntimeSessionId(session?.session_id);
    if (!runtimeSessionId) {
      throw new Error('upsert requires a runtime session id.');
    }

    const nextSession = {
      ...session,
      session_id: runtimeSessionId,
      projectRoot: this.projectRoot,
      runtimeRoot: this.runtimeRoot,
    };

    if (this.mode === 'read-only') {
      return nextSession;
    }

    ensureDir(this.root);
    const sessions = this.list();
    const existingIndex = sessions.findIndex((entry) => entry?.session_id === runtimeSessionId);
    const nextSessions = existingIndex === -1
      ? [...sessions, nextSession]
      : sessions.map((entry, index) => index === existingIndex ? { ...entry, ...nextSession } : entry);
    fs.writeFileSync(this.indexPath, `${JSON.stringify({ sessions: nextSessions }, null, 2)}\n`, 'utf8');
    return nextSession;
  }

  buildRuntimeSessionSnapshot({
    sessionId = null,
    source = 'runtime-launcher',
    launcher = 'managed',
    workflowKernel = null,
    backgroundManager = null,
    continuationStateManager = null,
    args = [],
    exitCode = null,
    status = null,
    running = null,
    activeAgentModelProfile = null,
  } = {}) {
    const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
    const backgroundRuns = workflowKernel?.listBackgroundRuns?.()?.runs ?? backgroundManager?.list?.() ?? [];
    const continuation = continuationStateManager?.summary?.() ?? null;
    const runtimeSessionId = normalizeRuntimeSessionId(sessionId);
    if (!runtimeSessionId) {
      throw new Error('recordRuntimeSession requires a pre-generated runtime session id.');
    }

    return {
      session_id: runtimeSessionId,
      recorded_at: new Date().toISOString(),
      source,
      launcher,
      args,
      exitCode,
      ...(typeof status === 'string' ? { status } : {}),
      ...(typeof running === 'boolean' ? { running } : {}),
      activeAgentModelProfile,
      mode: runtimeStatus?.state?.mode ?? null,
      stage: runtimeStatus?.state?.current_stage ?? null,
      workflowStatus: runtimeStatus?.state?.status ?? null,
      currentOwner: runtimeStatus?.state?.current_owner ?? null,
      activeWorkItemId: runtimeStatus?.runtimeContext?.activeWorkItemId ?? null,
      nextAction: runtimeStatus?.runtimeContext?.nextAction ?? null,
      taskBoardPresent: runtimeStatus?.runtimeContext?.taskBoardPresent ?? false,
      taskBoardSummary: runtimeStatus?.runtimeContext?.taskBoardSummary ?? null,
      backgroundRunCount: backgroundRuns.length,
      continuationStatus: continuation?.status ?? 'idle',
      continuationRemainingCount: continuation?.remainingActionCount ?? 0,
      continuationStopReason: continuation?.stoppedReason ?? null,
      resumeRecommendation: continuation?.current?.handoffSummary ?? continuation?.current?.reason ?? null,
    };
  }

  upsertRuntimeSession(options = {}) {
    return this.upsert(this.buildRuntimeSessionSnapshot(options));
  }

  recordRuntimeSession({
    sessionId = null,
    source = 'runtime-launcher',
    launcher = 'managed',
    workflowKernel = null,
    backgroundManager = null,
    continuationStateManager = null,
    args = [],
    exitCode = null,
    activeAgentModelProfile = null,
  } = {}) {
    return this.record(this.buildRuntimeSessionSnapshot({
      sessionId,
      source,
      launcher,
      workflowKernel,
      backgroundManager,
      continuationStateManager,
      args,
      exitCode,
      activeAgentModelProfile,
    }));
  }

  list() {
    if (!fs.existsSync(this.indexPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(this.indexPath, 'utf8')).sessions ?? [];
    } catch {
      return [];
    }
  }

  latest() {
    const sessions = this.list();
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  }
}
