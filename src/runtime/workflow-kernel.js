import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function resolveControllerPath(projectRoot, env = process.env) {
  const candidates = [];

  if (env.OPENKIT_KIT_ROOT) {
    candidates.push(path.join(env.OPENKIT_KIT_ROOT, '.opencode', 'lib', 'workflow-state-controller.js'));
  }

  candidates.push(path.join(projectRoot, '.opencode', 'lib', 'workflow-state-controller.js'));
  candidates.push(path.join(packageRoot, '.opencode', 'lib', 'workflow-state-controller.js'));

  for (const candidate of candidates) {
    try {
      require.resolve(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }

  return null;
}

function createUnavailableKernel(projectRoot) {
  return {
    available: false,
    projectRoot,
    showState() {
      return null;
    },
    showRuntimeStatus() {
      return null;
    },
    showRuntimeStatusRelaxed() {
      return null;
    },
    listBackgroundRuns() {
      return { projectRoot, runs: [] };
    },
    startBackgroundRun() {
      return null;
    },
    completeBackgroundRun() {
      return null;
    },
    cancelBackgroundRun() {
      return null;
    },
    recordVerificationEvidence() {
      return null;
    },
    listTasks() {
      return { projectRoot, tasks: [] };
    },
    claimTask() {
      return null;
    },
    assignQaOwner() {
      return null;
    },
    setTaskStatus() {
      return null;
    },
    validateTaskAllocation() {
      return null;
    },
    getWorkflowMetrics() {
      return null;
    },
    getOpsSummary() {
      return null;
    },
    runDoctor() {
      return null;
    },
  };
}

function normalizeEvidenceEntry(entry = {}) {
  return {
    artifact_refs: [],
    command: null,
    exit_status: null,
    ...entry,
  };
}

export function createWorkflowKernelAdapter({ projectRoot, env = process.env }) {
  const controllerPath = resolveControllerPath(projectRoot, env);
  const projectStatePath = path.join(projectRoot, '.opencode', 'workflow-state.json');
  const defaultStatePath = env.OPENKIT_WORKFLOW_STATE
    ? path.resolve(env.OPENKIT_WORKFLOW_STATE)
    : fs.existsSync(projectStatePath)
      ? projectStatePath
      : null;
  if (!controllerPath) {
    return createUnavailableKernel(projectRoot);
  }

  const controller = require(controllerPath);

  function withStatePath(customStatePath = null) {
    return customStatePath ?? defaultStatePath;
  }

  function canReadState(customStatePath = null) {
    const statePath = withStatePath(customStatePath);
    return Boolean(statePath && fs.existsSync(statePath));
  }

  function canWriteState(customStatePath = null) {
    return Boolean(withStatePath(customStatePath));
  }

  function safeCall(fn, fallback) {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }

  function showState(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.showState(withStatePath(customStatePath)), null);
  }

  function showRuntimeStatus(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.getRuntimeStatus(withStatePath(customStatePath)), null);
  }

  function showRuntimeStatusRelaxed(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.getRuntimeStatus(withStatePath(customStatePath), { relaxed: true }), null);
  }

  function listBackgroundRuns(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return { projectRoot, runs: [] };
    }
    return safeCall(() => controller.getBackgroundRuns(withStatePath(customStatePath)), { projectRoot, runs: [] });
  }

  function startBackgroundRun({ title, payload = {}, workItemId = null, taskId = null, customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(
      () =>
        controller.startBackgroundRun(
          title,
          JSON.stringify(payload ?? {}),
          workItemId ?? null,
          taskId ?? null,
          withStatePath(customStatePath)
        ),
      null
    );
  }

  function completeBackgroundRun({ runId, output = null, customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(
      () =>
        controller.completeBackgroundRun(
          runId,
          output === null || output === undefined ? null : JSON.stringify(output),
          withStatePath(customStatePath)
        ),
      null
    );
  }

  function cancelBackgroundRun({ runId, customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.cancelBackgroundRun(runId, withStatePath(customStatePath)), null);
  }

  function recordVerificationEvidence(entry, customStatePath = null) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.recordVerificationEvidence(normalizeEvidenceEntry(entry), withStatePath(customStatePath)), null);
  }

  function listTasks(workItemId, customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return { projectRoot, tasks: [] };
    }
    return safeCall(() => controller.listTasks(workItemId, withStatePath(customStatePath)), { projectRoot, tasks: [] });
  }

  function claimTask({ workItemId, taskId, owner, requestedBy = 'MasterOrchestrator', customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.claimTask(workItemId, taskId, owner, withStatePath(customStatePath), { requestedBy }), null);
  }

  function assignQaOwner({ workItemId, taskId, qaOwner, requestedBy = 'MasterOrchestrator', customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(
      () => controller.assignQaOwner(workItemId, taskId, qaOwner, withStatePath(customStatePath), { requestedBy }),
      null
    );
  }

  function setTaskStatus({ workItemId, taskId, status, customStatePath = null, options = {} }) {
    if (!canWriteState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.setTaskStatus(workItemId, taskId, status, withStatePath(customStatePath), options), null);
  }

  function validateTaskAllocation(workItemId, customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.validateTaskAllocation(workItemId, withStatePath(customStatePath)), null);
  }

  function getWorkflowMetrics(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.getWorkflowMetrics(withStatePath(customStatePath)), null);
  }

  function getOpsSummary(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.getOpsSummary(withStatePath(customStatePath)), null);
  }

  function runDoctor(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCall(() => controller.runDoctor(withStatePath(customStatePath)), null);
  }

  return {
    available: true,
    projectRoot,
    showState,
    showRuntimeStatus,
    showRuntimeStatusRelaxed,
    listBackgroundRuns,
    startBackgroundRun,
    completeBackgroundRun,
    cancelBackgroundRun,
    recordVerificationEvidence,
    listTasks,
    claimTask,
    assignQaOwner,
    setTaskStatus,
    validateTaskAllocation,
    getWorkflowMetrics,
    getOpsSummary,
    runDoctor,
  };
}
