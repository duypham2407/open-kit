import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

  recordRuntimeSession({
    source = 'runtime-launcher',
    launcher = 'managed',
    workflowKernel = null,
    backgroundManager = null,
    continuationStateManager = null,
    args = [],
    exitCode = null,
  } = {}) {
    const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
    const backgroundRuns = workflowKernel?.listBackgroundRuns?.()?.runs ?? backgroundManager?.list?.() ?? [];
    const continuation = continuationStateManager?.summary?.() ?? null;

    return this.record({
      session_id: `session_${crypto.randomBytes(4).toString('hex')}`,
      recorded_at: new Date().toISOString(),
      source,
      launcher,
      args,
      exitCode,
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
    });
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
