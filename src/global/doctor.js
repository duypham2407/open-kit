import fs from 'node:fs';
import path from 'node:path';

import { readJsonIfPresent, validateGlobalInstallState } from './install-state.js';
import { inspectWorkspaceMeta } from './workspace-state.js';
import { getGlobalPaths, getWorkspacePaths } from './paths.js';
import { isCommandAvailable } from '../command-detection.js';
import { isAstGrepAvailable, isCodemodAvailable, isSemgrepAvailable } from './tooling.js';
import { DEFAULT_ENTRY_COMMAND, getCommandInstructionContract } from '../runtime/instruction-contracts.js';
import { bootstrapRuntimeFoundation } from '../runtime/index.js';
import { inspectBackgroundDoctor } from '../runtime/doctor/background-doctor.js';
import { inspectCapabilityDoctor } from '../runtime/doctor/capability-doctor.js';
import { inspectMcpDoctor } from '../runtime/doctor/mcp-doctor.js';
import { inspectModelDoctor } from '../runtime/doctor/model-doctor.js';
import { inspectWorkflowDoctor } from '../runtime/doctor/workflow-doctor.js';
import { readAgentModelSettings } from './agent-models.js';
import { getOpenKitVersion } from '../version.js';

function isOpenCodeAvailable(env = process.env) {
  return isCommandAvailable('opencode', { env });
}

function isAstToolingAvailable(env = process.env) {
  return isAstGrepAvailable({ env });
}

function isRuleAuditToolingAvailable(env = process.env) {
  return isSemgrepAvailable({ env });
}

const REQUIRED_GLOBAL_KIT_TEMPLATE_PATHS = [
  'docs/templates/solution-package-template.md',
  'docs/templates/migration-solution-package-template.md',
  'docs/templates/migration-report-template.md',
  'docs/templates/scope-package-template.md',
]

function withGuidance(result, nextStep, recommendedCommand = null) {
  return {
    ...result,
    nextStep,
    recommendedCommand,
  };
}

export function inspectGlobalDoctor({ projectRoot = process.cwd(), env = process.env } = {}) {
  const globalPaths = getGlobalPaths({ env });
  const workspacePaths = getWorkspacePaths({ projectRoot, env });
  const globalInstallState = readJsonIfPresent(globalPaths.installStatePath);
  const profileManifest = readJsonIfPresent(globalPaths.profileManifestPath);
  let runtimeFoundation = null;
  let runtimeDoctor = null;

  const issues = [];

  if (!globalInstallState) {
    return withGuidance({
      status: 'install-missing',
      canRunCleanly: false,
      globalPaths,
      workspacePaths,
      issues: ['Global OpenKit install was not found.'],
    }, 'Run openkit run for first-time setup.', 'openkit run');
  }

  const installStateErrors = validateGlobalInstallState(globalInstallState);
  if (installStateErrors.length > 0) {
    return withGuidance({
      status: 'install-invalid',
      canRunCleanly: false,
      globalPaths,
      workspacePaths,
      issues: installStateErrors,
    }, 'Run openkit upgrade to refresh the global install.', 'openkit upgrade');
  }

  if (!profileManifest) {
    issues.push('OpenCode profile manifest for openkit is missing.');
  }

  if (!fs.existsSync(path.join(globalPaths.kitRoot, '.opencode', 'workflow-state.js'))) {
    issues.push('Global workflow-state CLI is missing from the installed kit.');
  }

  const missingKitTemplates = REQUIRED_GLOBAL_KIT_TEMPLATE_PATHS.filter(
    (relativePath) => !fs.existsSync(path.join(globalPaths.kitRoot, relativePath))
  );

  for (const relativePath of missingKitTemplates) {
    issues.push(`Global kit is missing required template: ${relativePath}`);
  }

  if (missingKitTemplates.length > 0) {
    issues.push('This usually means the global OpenKit install is stale or drifted. Run openkit upgrade before retrying the affected lane.');
  }

  if (!isOpenCodeAvailable(env)) {
    issues.push('OpenCode executable is not available on PATH.');
  }

  if (!isAstToolingAvailable(env)) {
    issues.push('ast-grep executable is not available on PATH or the OpenKit tooling bin path.');
  }

  if (!isRuleAuditToolingAvailable(env)) {
    issues.push('semgrep executable is not available on PATH or the OpenKit tooling bin path.');
  }

  if (!isCodemodAvailable()) {
    issues.push('jscodeshift package is not installed; codemod tools will report dependency-missing.');
  }

  const agentModelSettings = readAgentModelSettings(globalPaths.agentModelSettingsPath);
  for (const warning of agentModelSettings.warnings ?? []) {
    issues.push(`Agent model settings warning: ${warning}`);
  }

  const workspace = inspectWorkspaceMeta({ projectRoot, env });
  const runtimeBootstrapEnv = {
    ...env,
    OPENKIT_GLOBAL_MODE: '1',
    OPENKIT_PROJECT_ROOT: workspacePaths.projectRoot,
    OPENKIT_WORKFLOW_STATE: workspacePaths.workflowStatePath,
    OPENKIT_KIT_ROOT: globalPaths.kitRoot,
  };

  try {
    runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot, env: runtimeBootstrapEnv, mode: 'read-only' });
    runtimeDoctor = {
      workflow: inspectWorkflowDoctor(runtimeFoundation?.managers?.workflowKernel),
      capabilities: inspectCapabilityDoctor(runtimeFoundation),
      background: inspectBackgroundDoctor(runtimeFoundation?.managers?.backgroundManager, runtimeFoundation?.managers?.workflowKernel),
      mcp: inspectMcpDoctor(runtimeFoundation?.mcpPlatform),
      models: inspectModelDoctor(runtimeFoundation?.modelRuntime),
      continuation: runtimeFoundation?.runtimeInterface?.runtimeState?.recovery ?? null,
      commands: runtimeFoundation?.commands ?? [],
      skills: runtimeFoundation?.skills?.skills ?? [],
      toolFamilies: runtimeFoundation?.tools?.toolFamilies ?? [],
    };
  } catch (error) {
    issues.push(`Runtime foundation error: ${error.message}`);
  }

  return withGuidance({
    status: issues.length === 0 ? 'healthy' : 'workspace-ready-with-issues',
    canRunCleanly: issues.length === 0,
    globalPaths,
    workspacePaths,
    workspace,
    runtimeFoundation,
    runtimeDoctor,
    issues,
  }, issues.length === 0 ? 'Run openkit run.' : 'Review the issues above before relying on this workspace. If templates are missing from the global kit, run openkit upgrade.', issues.length === 0 ? 'openkit run' : null);
}

export function renderGlobalDoctorSummary(result) {
  const workspaceShimRoot = path.join(result.workspacePaths.projectRoot, '.opencode', 'openkit');
  const compatibilityShimRoot = path.join(result.workspacePaths.projectRoot, '.opencode');
  const lines = [
    `OpenKit version: ${getOpenKitVersion()}`,
    `Status: ${result.status}`,
    `Global kit root: ${result.globalPaths.kitRoot}`,
    `Workspace root: ${result.workspacePaths.workspaceRoot}`,
    `Project root: ${result.workspacePaths.projectRoot}`,
    `Workspace state path: ${result.workspacePaths.workflowStatePath}`,
    `Compatibility shim root: ${compatibilityShimRoot}`,
    `Workspace shim root: ${workspaceShimRoot}`,
    `Workspace id: ${result.workspacePaths.workspaceId}`,
    `Can run cleanly: ${result.canRunCleanly ? 'yes' : 'no'}`,
  ];

  lines.push(
    'Path model: config loads from the global kit root, runtime state lives under the workspace root, and project .opencode paths are compatibility shims.'
  );

  if (Array.isArray(result.issues) && result.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  if (result.nextStep) {
    lines.push(`Next: ${result.nextStep}`);
  }

  if (result.recommendedCommand) {
    lines.push(`Recommended command: ${result.recommendedCommand}`);
  }

  if (result.runtimeFoundation?.runtimeInterface) {
    const runtimeInterface = result.runtimeFoundation.runtimeInterface;
    lines.push(
      `Runtime foundation: v${runtimeInterface.foundationVersion} | capabilities ${runtimeInterface.capabilitySummary.total} | managers ${runtimeInterface.managers.filter((entry) => entry.enabled).length} | tools ${runtimeInterface.tools.length} | hooks ${runtimeInterface.hooks.length}`
    );
      lines.push(
        `Runtime sessions: ${runtimeInterface.runtimeState.persistedSessions} | background runs: ${runtimeInterface.runtimeState.backgroundRuns} | skill MCP bindings: ${runtimeInterface.runtimeState.skillMcpBindings}`
      );

      if (runtimeInterface.runtimeState.continuation) {
        lines.push(
          `Continuation state: ${runtimeInterface.runtimeState.continuation.status} | remaining=${runtimeInterface.runtimeState.continuation.remainingActionCount ?? 0} | stop=${runtimeInterface.runtimeState.continuation.stoppedReason ?? 'none'}`
        );
      }

      if (runtimeInterface.configPaths.project || runtimeInterface.configPaths.user) {
        lines.push(
        `Runtime config: project=${runtimeInterface.configPaths.project ?? 'none'} | user=${runtimeInterface.configPaths.user ?? 'none'}`
      );
    }
  }

  if (result.runtimeDoctor?.workflow) {
    const workflow = result.runtimeDoctor.workflow;
    lines.push(
      `Workflow runtime: ${workflow.status} | mode=${workflow.mode ?? 'none'} | stage=${workflow.stage ?? 'none'} | active=${workflow.activeWorkItemId ?? 'none'}`
    );

    if (workflow.taskBoardSummary) {
      lines.push(
        `Task board: total=${workflow.taskBoardSummary.total} | ready=${workflow.taskBoardSummary.ready} | active=${workflow.taskBoardSummary.active}`
      );

      if ((workflow.taskBoardSummary.dispatchable ?? 0) > 0) {
        lines.push(`Dispatchable tasks: ${workflow.taskBoardSummary.dispatchableTaskIds.join(', ')}`);
      }

      if ((workflow.taskBoardSummary.dependencyBlocked ?? 0) > 0) {
        lines.push(`Dependency-blocked tasks: ${workflow.taskBoardSummary.dependencyBlockedTaskIds.join(', ')}`);
      }

      if ((workflow.taskBoardSummary.sequentialConstraintQueuedTaskIds ?? []).length > 0) {
        const queuedTaskId = workflow.taskBoardSummary.sequentialConstraintQueuedTaskIds[0];
        const sequentialDeps = workflow.taskBoardSummary.sequentialConstraintDepsByTaskId?.[queuedTaskId] ?? [];
        lines.push(
          `Sequential-constraint waits: ${queuedTaskId}${sequentialDeps.length > 0 ? ` <- ${sequentialDeps.join(', ')}` : ''}`
        );
      }

      if ((workflow.taskBoardSummary.qaPending ?? 0) > 0) {
        lines.push(`QA-pending tasks: ${workflow.taskBoardSummary.qaPendingTaskIds.join(', ')}`);
      }

      if ((workflow.taskBoardSummary.sharedArtifactQueuedTaskIds ?? []).length > 0) {
        const queuedTaskId = workflow.taskBoardSummary.sharedArtifactQueuedTaskIds[0];
        const conflictingTaskIds = workflow.taskBoardSummary.sharedArtifactConflictTaskIdsByTaskId?.[queuedTaskId] ?? [];
        const conflictingArtifactRefs = workflow.taskBoardSummary.sharedArtifactConflictRefsByTaskId?.[queuedTaskId] ?? [];
        lines.push(
          `Shared-artifact waits: ${queuedTaskId}${conflictingTaskIds.length > 0 ? ` <- ${conflictingTaskIds.join(', ')}` : ''}${conflictingArtifactRefs.length > 0 ? ` | refs=${conflictingArtifactRefs.join(', ')}` : ''}`
        );
      }
    }

    if (workflow.migrationSliceSummary) {
      lines.push(
        `Migration slices: total=${workflow.migrationSliceSummary.total} | ready=${workflow.migrationSliceSummary.ready} | active=${workflow.migrationSliceSummary.active} | blocked=${workflow.migrationSliceSummary.blocked} | verified=${workflow.migrationSliceSummary.verified} | incomplete=${workflow.migrationSliceSummary.incomplete ?? 0}`
      );

      if ((workflow.migrationSliceSummary.activeSliceIds ?? []).length > 0) {
        lines.push(`Active migration slices: ${workflow.migrationSliceSummary.activeSliceIds.join(', ')}`);
      }

      if ((workflow.migrationSliceSummary.blockedSliceIds ?? []).length > 0) {
        lines.push(`Blocked migration slices: ${workflow.migrationSliceSummary.blockedSliceIds.join(', ')}`);
      }
    }

    if (workflow.migrationSliceReadiness?.nextGate) {
      lines.push(
        `Migration slice readiness: ${workflow.migrationSliceReadiness.status} | next gate=${workflow.migrationSliceReadiness.nextGate} | blocked=${workflow.migrationSliceReadiness.nextGateBlocked ? 'yes' : 'no'}`
      );

      for (const blocker of workflow.migrationSliceReadiness.blockers ?? []) {
        lines.push(`Migration slice blocker: ${blocker}`);
      }
    }

    if (workflow.migrationSliceBoardPresent && workflow.migrationSliceBoardValid === false) {
      lines.push(`Migration slice board: invalid | ${workflow.migrationSliceBoardError ?? 'unknown error'}`);
    } else if (workflow.migrationSliceBoardPresent && workflow.migrationSliceBoardValid === true) {
      lines.push('Migration slice board: valid');
    }

    if (workflow.orchestrationHealth?.reason) {
      lines.push(
        `Orchestration health: ${workflow.orchestrationHealth.blocked ? 'blocked' : workflow.orchestrationHealth.dispatchable ? 'dispatchable' : 'waiting'} | ${workflow.orchestrationHealth.reason}`
      );
    }

    if (workflow.orchestrationHealth?.recommendedAction) {
      lines.push(`Workflow recommendation: ${workflow.orchestrationHealth.recommendedAction}`);
    }

    if (workflow.backgroundRunSummary) {
      lines.push(
        `Workflow background runs: total=${workflow.backgroundRunSummary.total} | running=${workflow.backgroundRunSummary.running} | completed=${workflow.backgroundRunSummary.completed} | cancelled=${workflow.backgroundRunSummary.cancelled}`
      );

      if ((workflow.backgroundRunSummary.staleLinkedRunIds ?? []).length > 0) {
        lines.push(`Stale linked runs: ${workflow.backgroundRunSummary.staleLinkedRunIds.join(', ')}`);
      }

      if ((workflow.backgroundRunSummary.longRunningRunIds ?? []).length > 0) {
        lines.push(`Long-running runs: ${workflow.backgroundRunSummary.longRunningRunIds.join(', ')}`);
      }
    }
  }

  if (result.runtimeFoundation?.runtimeInterface?.runtimeState?.recovery) {
    const recovery = result.runtimeFoundation.runtimeInterface.runtimeState.recovery;
    if (Array.isArray(recovery.continuationRisk) && recovery.continuationRisk.length > 0) {
      lines.push(`Continuation risk: ${recovery.continuationRisk.join(', ')}`);
    }

    if (recovery.recommendedAction) {
      lines.push(`Continuation recommendation: ${recovery.recommendedAction}`);
    }
  }

  if (result.runtimeDoctor?.capabilities?.toolFamilies?.length) {
    const familySummary = result.runtimeDoctor.capabilities.toolFamilies
      .map((entry) => `${entry.family}:${entry.total}/${entry.active}/${entry.degraded}`)
      .join(', ');
    lines.push(`Tool families (total/active/degraded): ${familySummary}`);
  }

  if (result.runtimeDoctor?.commands?.length) {
    const browserCommand = result.runtimeDoctor.commands.find((entry) => entry.name === '/browser-verify');
    if (browserCommand) {
      lines.push(`Compatibility commands loaded: ${result.runtimeDoctor.commands.length} | browser verification path available`);
    }
  }

  const defaultEntry = getCommandInstructionContract('task');
  if (defaultEntry) {
    lines.push(`Default session entrypoint: ${DEFAULT_ENTRY_COMMAND}`);
    lines.push(`Next action after launch: ${defaultEntry.nextAction}`);
  }

  return `${lines.join('\n')}\n`;
}
