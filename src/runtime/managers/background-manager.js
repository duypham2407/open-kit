import { pollBackgroundRun } from '../background/task-poller.js';
import { TaskOutputStore } from '../background/task-output-store.js';
import { spawnBackgroundRun } from '../background/task-spawner.js';

export class BackgroundManager {
  constructor({ enabled = false, concurrencyManager = null, workItemBridge = null } = {}) {
    this.enabled = enabled;
    this.concurrencyManager = concurrencyManager;
    this.workItemBridge = workItemBridge;
    this.runs = new Map();
    this.outputStore = new TaskOutputStore();
  }

  spawn({ title, payload, workItemId = null, taskId = null }) {
    if (!this.enabled) {
      return null;
    }

    const run = spawnBackgroundRun(this.runs, { title, payload });
    run.link = this.workItemBridge?.linkRunToWorkItem({
      runId: run.id,
      workItemId,
      taskId,
    }) ?? null;
    return run;
  }

  complete(runId, output = null) {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = 'completed';
    run.updatedAt = new Date().toISOString();
    run.output = this.outputStore.write(runId, output);
    return run;
  }

  cancel(runId) {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = 'cancelled';
    run.updatedAt = new Date().toISOString();
    return run;
  }

  get(runId) {
    return this.runs.get(runId) ?? null;
  }

  list() {
    return [...this.runs.values()].map((run) => pollBackgroundRun(run));
  }

  dispose() {
    this.runs.clear();
  }
}
