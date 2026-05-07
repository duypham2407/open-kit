import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ENFORCEMENT_LEVELS = new Set(['strict', 'moderate', 'permissive']);
const BLOCKED_CATEGORIES = [
  'search',
  'file-discovery',
  'file-read',
  'file-read-partial',
  'text-transform',
  'file-write',
  'line-count',
  'directory-list',
];

const BLOCKED_COMMANDS = ['grep', 'find', 'cat', 'head', 'tail', 'sed', 'awk', 'echo', 'wc', 'ls'];

function resolveToolEnforcement(mode) {
  const envLevel = process.env.OPENKIT_ENFORCEMENT_LEVEL;
  if (typeof envLevel === 'string' && ENFORCEMENT_LEVELS.has(envLevel)) {
    return {
      level: envLevel,
      source: 'env_override',
    };
  }

  return {
    level: mode === 'migration' ? 'moderate' : 'strict',
    source: 'mode_default',
  };
}

function resolveToolEnforcementPluginPath(runtimeStatus) {
  const candidatePaths = [];

  if (runtimeStatus?.kitRoot) {
    candidatePaths.push(path.join(runtimeStatus.kitRoot, '.opencode', 'plugins', 'tool-enforcement.js'));
  }

  candidatePaths.push(path.join(PACKAGE_ROOT, '.opencode', 'plugins', 'tool-enforcement.js'));

  return candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) ?? null;
}

export function inspectWorkflowDoctor(workflowKernel) {
  const runtimeStatus = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;
  const runtimeContext = runtimeStatus?.runtimeContext ?? null;
  const mode = runtimeStatus?.state?.mode ?? null;
  const toolEnforcement = resolveToolEnforcement(mode);
  const pluginPath = resolveToolEnforcementPluginPath(runtimeStatus);
  const activeTasks = runtimeContext?.taskBoardSummary?.activeTasks ?? [];
  const parallelization = runtimeContext?.parallelization ?? null;
  const orchestrationHealth = runtimeContext?.orchestrationHealth ?? {
    blocked: false,
    dispatchable: false,
    reason: null,
    recommendedAction: null,
  };

  return {
    status: workflowKernel?.available ? (runtimeStatus ? 'connected' : 'configured') : 'unavailable',
    mode,
    stage: runtimeStatus?.state?.current_stage ?? null,
    activeWorkItemId: runtimeStatus?.runtimeContext?.activeWorkItemId ?? null,
    nextAction: runtimeStatus?.runtimeContext?.nextAction ?? null,
    taskBoardPresent: runtimeContext?.taskBoardPresent ?? false,
    taskBoardSummary: runtimeContext?.taskBoardSummary ?? null,
    migrationSliceBoardPresent: runtimeContext?.migrationSliceBoardPresent ?? false,
    migrationSliceSummary: runtimeContext?.migrationSliceSummary ?? null,
    migrationSliceReadiness: runtimeContext?.migrationSliceReadiness ?? null,
    migrationSliceBoardValid: runtimeContext?.migrationSliceBoardValid ?? null,
    migrationSliceBoardError: runtimeContext?.migrationSliceBoardError ?? null,
    activeTasks,
    parallelization,
    backgroundRunSummary: runtimeContext?.backgroundRunSummary ?? null,
    verificationReadiness: runtimeContext?.verificationReadiness ?? null,
    issueTelemetry: runtimeContext?.issueTelemetry ?? null,
    orchestrationHealth,
    toolEnforcement: {
      ...toolEnforcement,
      blockedCategories: BLOCKED_CATEGORIES,
      blocked_commands: BLOCKED_COMMANDS,
      tool_substitution_level: toolEnforcement.level,
      pluginActive: pluginPath ? fs.existsSync(pluginPath) : false,
      guardHookActive: true,
      plugin_active: pluginPath ? fs.existsSync(pluginPath) : false,
      guard_hook_active: true,
    },
  };
}
