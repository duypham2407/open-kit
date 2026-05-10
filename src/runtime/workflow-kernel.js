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
    advanceStage() {
      return null;
    },
    setApproval() {
      return null;
    },
    getState() {
      return null;
    },
    getWorkItem() {
      return null;
    },
    recordIssue() {
      return null;
    },
    resolveIssue() {
      return null;
    },
    recordEvidence() {
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

export function createWorkflowKernelAdapter({ projectRoot, env = process.env, stateManager = null }) {
  const controllerPath = resolveControllerPath(projectRoot, env);
  const projectStatePath = path.join(projectRoot, '.opencode', 'workflow-state.json');
  // Always resolve to the project state path — bootstrap will create the file when needed.
  // Previously this was null when the file didn't exist, which blocked bootstrap.
  const defaultStatePath = env.OPENKIT_WORKFLOW_STATE
    ? path.resolve(env.OPENKIT_WORKFLOW_STATE)
    : projectStatePath;
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
    const statePath = withStatePath(customStatePath);
    if (!statePath) {
      return false;
    }
    // Writes (other than bootstrap) require that a workflow state file already
    // exists. Bootstrap is a separate code path that creates the file directly
    // via the controller; see bootstrapWorkflow() in this module.
    return fs.existsSync(statePath);
  }

  function safeCall(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      // Log the swallowed exception so a SQLite lock, disk full, malformed
      // JSON, or any other controller-layer failure is observable to the
      // operator. We still return the fallback to preserve caller behavior
      // (callers treat null as "no value"), but silent swallowing was the
      // root cause of audit finding [1-H-1].
      const message = err?.message ?? String(err);
      process.stderr.write(`[workflow-kernel] safeCall swallowed exception: ${message}\n`);
      return fallback;
    }
  }

  // Audit fix [2026-05-10 Finding 3]: Return structured error results so
  // callers can distinguish "no value" from "controller failed". The result
  // preserves the original shape ({ statePath, state }) on success and adds
  // an .error property on failure, maintaining backward compatibility with
  // existing null-checking code while exposing error details for inspection.
  function safeCallWithStructuredError(fn, nullShape) {
    try {
      return fn();
    } catch (err) {
      const message = err?.message ?? String(err);
      process.stderr.write(`[workflow-kernel] controller exception: ${message}\n`);
      return {
        ...nullShape,
        error: {
          reason: 'controller_exception',
          code: err?.code ?? 'unknown',
          message,
        },
      };
    }
  }

  function showState(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCallWithStructuredError(
      () => controller.showState(withStatePath(customStatePath)),
      { statePath: null, state: null }
    );
  }

  function showRuntimeStatus(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCallWithStructuredError(
      () => controller.getRuntimeStatus(withStatePath(customStatePath)),
      { state: null }
    );
  }

  function showRuntimeStatusRelaxed(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return null;
    }
    return safeCallWithStructuredError(
      () => controller.getRuntimeStatus(withStatePath(customStatePath), { relaxed: true }),
      { state: null }
    );
  }

  function listBackgroundRuns(customStatePath = null) {
    if (!canReadState(customStatePath)) {
      return { projectRoot, runs: [] };
    }
    return safeCall(() => controller.getBackgroundRuns(withStatePath(customStatePath)), { projectRoot, runs: [] });
  }

  // Audit fix [1-M-3]: write methods on a fresh project (no
  // workflow-state.json yet) used to silently return null. Callers had no
  // way to distinguish "no value" from "needs bootstrap". The shared
  // helper below logs a clear stderr line so an operator can diagnose;
  // the return remains null for backward compatibility with existing
  // callers that treat null as "write skipped". Tools should call
  // tool.bootstrap-workflow first on a fresh project.
  function noteNeedsBootstrap(callerLabel, customStatePath) {
    const statePath = withStatePath(customStatePath);
    process.stderr.write(
      `[workflow-kernel] ${callerLabel} skipped: no workflow state at ${statePath}. Call tool.bootstrap-workflow first.\n`,
    );
  }

  function startBackgroundRun({ title, payload = {}, workItemId = null, taskId = null, customStatePath = null }) {
    if (!canWriteState(customStatePath)) {
      noteNeedsBootstrap('startBackgroundRun', customStatePath);
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
      noteNeedsBootstrap('completeBackgroundRun', customStatePath);
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
      noteNeedsBootstrap('cancelBackgroundRun', customStatePath);
      return null;
    }
    return safeCall(() => controller.cancelBackgroundRun(runId, withStatePath(customStatePath)), null);
  }

  function recordVerificationEvidence(entry, customStatePath = null) {
    if (!canWriteState(customStatePath)) {
      noteNeedsBootstrap('recordVerificationEvidence', customStatePath);
      return null;
    }
    return safeCall(() => controller.recordVerificationEvidence(normalizeEvidenceEntry(entry), withStatePath(customStatePath)), null);
  }

  // ── WorkflowStateManager delegation ───────────────────────────────────────

  function advanceStage(targetStage, newOwner, metadata = {}) {
    if (!stateManager) {
      return null;
    }
    return stateManager.advanceStage(targetStage, newOwner, metadata);
  }

  function setApproval(gateName, approved, approver, metadata = {}) {
    if (!stateManager) {
      return null;
    }
    return stateManager.setApproval(gateName, approved, approver, metadata);
  }

  function getState() {
    if (!stateManager) {
      return null;
    }
    return stateManager.getState();
  }

  function recordIssue(issue) {
    if (!stateManager) {
      return null;
    }
    return stateManager.recordIssue(issue);
  }

  function resolveIssue(issueId, resolution) {
    if (!stateManager) {
      return null;
    }
    return stateManager.resolveIssue(issueId, resolution);
  }

  function recordEvidence(evidence) {
    if (!stateManager) {
      return null;
    }
    return stateManager.recordEvidence(evidence);
  }

  function getWorkItem(workItemId) {
    if (!stateManager) {
      return null;
    }
    return stateManager.getWorkItem(workItemId);
  }

  // ── End WorkflowStateManager delegation ───────────────────────────────────

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

  /**
   * Bootstrap a new workflow for the given lane.
   * Works on fresh projects where no state file exists yet.
   * Uses OPENKIT_WORKFLOW_STATE if set, otherwise the project state path.
   */
  function bootstrapWorkflow({ lane, description, featureSlug, archivePrior = false } = {}) {
    // Use the resolved default path (respects OPENKIT_WORKFLOW_STATE env var),
    // falling back to projectStatePath for fresh projects where defaultStatePath is null.
    const statePath = defaultStatePath ?? projectStatePath;
    return controller.bootstrapWorkflow({
      lane,
      description,
      featureSlug,
      statePath,
      archivePrior,
    });
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
    advanceStage,
    setApproval,
    getState,
    getWorkItem,
    recordIssue,
    resolveIssue,
    recordEvidence,
    listTasks,
    claimTask,
    assignQaOwner,
    setTaskStatus,
    validateTaskAllocation,
    getWorkflowMetrics,
    getOpsSummary,
    runDoctor,
    bootstrapWorkflow,
    canWriteState,
  };
}
