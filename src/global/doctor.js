import fs from 'node:fs';
import path from 'node:path';

import { readJsonIfPresent, validateGlobalInstallState } from './install-state.js';
import { inspectWorkspaceMeta } from './workspace-state.js';
import { getGlobalPaths, getWorkspacePaths } from './paths.js';
import { isCommandAvailable } from '../command-detection.js';
import { DEFAULT_ENTRY_COMMAND, getCommandInstructionContract } from '../runtime/instruction-contracts.js';
import { bootstrapRuntimeFoundation } from '../runtime/index.js';
import { readAgentModelSettings } from './agent-models.js';

function isOpenCodeAvailable(env = process.env) {
  return isCommandAvailable('opencode', { env });
}

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

  if (!isOpenCodeAvailable(env)) {
    issues.push('OpenCode executable is not available on PATH.');
  }

  const agentModelSettings = readAgentModelSettings(globalPaths.agentModelSettingsPath);
  for (const warning of agentModelSettings.warnings ?? []) {
    issues.push(`Agent model settings warning: ${warning}`);
  }

  const workspace = inspectWorkspaceMeta({ projectRoot, env });

  try {
    runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot, env });
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
    issues,
  }, issues.length === 0 ? 'Run openkit run.' : 'Review the issues above before relying on this workspace.', issues.length === 0 ? 'openkit run' : null);
}

export function renderGlobalDoctorSummary(result) {
  const lines = [
    `Status: ${result.status}`,
    `Global kit root: ${result.globalPaths.kitRoot}`,
    `Workspace root: ${result.workspacePaths.workspaceRoot}`,
    `Project root: ${result.workspacePaths.projectRoot}`,
    `Workspace id: ${result.workspacePaths.workspaceId}`,
    `Can run cleanly: ${result.canRunCleanly ? 'yes' : 'no'}`,
  ];

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

    if (runtimeInterface.configPaths.project || runtimeInterface.configPaths.user) {
      lines.push(
        `Runtime config: project=${runtimeInterface.configPaths.project ?? 'none'} | user=${runtimeInterface.configPaths.user ?? 'none'}`
      );
    }
  }

  const defaultEntry = getCommandInstructionContract('task');
  if (defaultEntry) {
    lines.push(`Default session entrypoint: ${DEFAULT_ENTRY_COMMAND}`);
    lines.push(`Next action after launch: ${defaultEntry.nextAction}`);
  }

  return `${lines.join('\n')}\n`;
}
