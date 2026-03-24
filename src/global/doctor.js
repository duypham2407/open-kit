import fs from 'node:fs';
import path from 'node:path';

import { readJsonIfPresent, validateGlobalInstallState } from './install-state.js';
import { ensureWorkspaceBootstrap, readWorkspaceMeta } from './workspace-state.js';
import { getGlobalPaths, getWorkspacePaths } from './paths.js';

function isOpenCodeAvailable(env = process.env) {
  const pathValue = env.PATH ?? '';
  return pathValue.split(path.delimiter).some((segment) => segment && fs.existsSync(path.join(segment, 'opencode')));
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

  const workspace = readWorkspaceMeta({ projectRoot, env });
  ensureWorkspaceBootstrap({ projectRoot, env });

  return withGuidance({
    status: issues.length === 0 ? 'healthy' : 'workspace-ready-with-issues',
    canRunCleanly: issues.length === 0,
    globalPaths,
    workspacePaths,
    workspace,
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

  return `${lines.join('\n')}\n`;
}
