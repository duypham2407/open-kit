import { pollBackgroundRun } from '../background/task-poller.js';
import { TaskOutputStore } from '../background/task-output-store.js';
import { spawnBackgroundRun } from '../background/task-spawner.js';

export class BackgroundManager {
  constructor({ enabled = false, concurrencyManager = null, workItemBridge = null, persistentStore = null } = {}) {
    this.enabled = enabled;
    this.concurrencyManager = concurrencyManager;
    this.workItemBridge = workItemBridge;
    this.persistentStore = persistentStore;
    this.runs = new Map();
    this.outputStore = new TaskOutputStore();
  }

  spawn({ title, payload, workItemId = null, taskId = null, customStatePath = null }) {
    if (!this.enabled) {
      return null;
    }

    const run = spawnBackgroundRun(this.runs, { title, payload });
    run.workflowRunId = null;
    run.link = this.workItemBridge?.linkRunToWorkItem({
      runId: run.id,
      workItemId,
      taskId,
      customStatePath,
    }) ?? null;
    run.customStatePath = customStatePath;
    run.workflowRunId = this.workItemBridge?.onRunStarted?.({
      runId: run.id,
      title,
      payload,
      workItemId,
      taskId,
      customStatePath,
    }) ?? null;
    this.persistentStore?.save(run);
    return run;
  }

  complete(runId, output = null, customStatePath = null) {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = 'completed';
    run.updatedAt = new Date().toISOString();
    run.output = this.outputStore.write(runId, output);
    this.workItemBridge?.onRunCompleted?.({
      runId,
      workflowRunId: run.workflowRunId,
      output,
      taskId: run.link?.taskId ?? null,
      workItemId: run.link?.workItemId ?? null,
      customStatePath: customStatePath ?? run.customStatePath ?? run.link?.customStatePath ?? null,
    });
    this.persistentStore?.save(run);
    return run;
  }

  cancel(runId, customStatePath = null) {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = 'cancelled';
    run.updatedAt = new Date().toISOString();
    this.workItemBridge?.onRunCancelled?.({
      runId,
      workflowRunId: run.workflowRunId,
      customStatePath: customStatePath ?? run.customStatePath ?? run.link?.customStatePath ?? null,
    });
    this.persistentStore?.save(run);
    return run;
  }

  get(runId) {
    return this.runs.get(runId) ?? this.persistentStore?.load(runId) ?? null;
  }

  list() {
    const inMemory = [...this.runs.values()].map((run) => pollBackgroundRun(run));
    const persisted = this.persistentStore?.list() ?? [];
    return persisted.length > 0 ? persisted : inMemory;
  }

  dispose() {
    this.runs.clear();
  }
}
