#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(SCRIPT_DIR, '..');

function resolveKitRoot(projectRoot, statePath) {
  if (process.env.OPENKIT_KIT_ROOT) {
    return path.resolve(process.env.OPENKIT_KIT_ROOT);
  }

  const candidates = [
    projectRoot,
    path.dirname(path.resolve(statePath)),
    DEFAULT_KIT_ROOT,
  ];

  for (const candidate of candidates) {
    const manifestPath = path.join(candidate, '.opencode', 'opencode.json');
    if (fs.existsSync(manifestPath)) {
      return candidate;
    }
  }

  return DEFAULT_KIT_ROOT;
}

function print(line = '') {
  process.stdout.write(`${line}\n`);
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, value: null, malformed: false };
  }

  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      malformed: false,
    };
  } catch {
    return {
      exists: true,
      value: null,
      malformed: true,
    };
  }
}

function resolveRuntimeContext(runtimeSummaryModulePath, runtimeRoot, state) {
  try {
    const { getRuntimeContext } = require(runtimeSummaryModulePath);
    return getRuntimeContext(runtimeRoot, state);
  } catch {
    const workItemId = state?.work_item_id;
    if (!workItemId) {
      return null;
    }

    const boardPath = path.join(runtimeRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
    if (!fs.existsSync(boardPath)) {
      return null;
    }

    try {
      const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      const tasks = Array.isArray(board.tasks) ? board.tasks : [];
      const activeStatuses = new Set(['claimed', 'in_progress', 'qa_in_progress']);
      const activeTasks = tasks.filter((task) => activeStatuses.has(task.status));
      const formattedActiveTasks = activeTasks.map((task) => {
        if (task.status === 'qa_in_progress' && task.qa_owner) {
          return `${task.task_id} (${task.status}, qa: ${task.qa_owner})`;
        }

        if (task.primary_owner) {
          return `${task.task_id} (${task.status}, primary: ${task.primary_owner})`;
        }

        return `${task.task_id} (${task.status})`;
      });

      return {
        taskBoardSummary: {
          total: tasks.length,
          ready: tasks.filter((task) => task.status === 'ready').length,
          active: activeTasks.length,
          activeTasks: formattedActiveTasks,
        },
      };
    } catch {
      return null;
    }
  }
}

function renderResumeHint(state, runtimeSummaryModulePath, statePath) {
  const mode = state?.mode;
  const stage = state?.current_stage;
  const status = state?.status;
  const owner = state?.current_owner;
  const featureId = state?.feature_id;
  const featureSlug = state?.feature_slug;
  const workItemId = state?.work_item_id;

  if (!mode || !stage || !status || !owner) {
    return;
  }

  const runtimeRoot = path.dirname(path.dirname(path.resolve(statePath)));
  const runtimeContext = mode === 'full' && workItemId
    ? resolveRuntimeContext(runtimeSummaryModulePath, runtimeRoot, state)
    : null;
  const boardSummary = runtimeContext?.taskBoardSummary ?? null;
  const activeTasks = boardSummary?.activeTasks ?? [];

  print('<workflow_resume_hint>');
  print('OpenKit workflow resume context detected.');
  print(`mode: ${mode}`);
  print(`stage: ${stage}`);
  print(`status: ${status}`);
  print(`owner: ${owner}`);
  if (featureId && featureSlug) {
    print(`work item: ${featureId} (${featureSlug})`);
  }
  if (workItemId) {
    print(`active work item id: ${workItemId}`);
  }
  if (boardSummary) {
    print(`task board: ${boardSummary.total ?? 0} tasks | ready ${boardSummary.ready ?? 0} | active ${boardSummary.active ?? 0}`);
  }
  if (activeTasks.length > 0) {
    print(`active tasks: ${activeTasks.join('; ')}`);
  }
  print('Read first: AGENTS.md -> context/navigation.md -> context/core/workflow.md -> .opencode/workflow-state.json');
  print('Then run `node .opencode/workflow-state.js resume-summary` or load resume guidance from context/core/session-resume.md.');
  if (mode === 'full' && activeTasks.length > 0) {
    print('Parallel task support is not yet assumed safe by this hook; confirm with `node .opencode/workflow-state.js doctor` before relying on it.');
  }
  print('</workflow_resume_hint>');
}

const projectRoot = process.env.OPENKIT_PROJECT_ROOT ? path.resolve(process.env.OPENKIT_PROJECT_ROOT) : process.cwd();
const statePath = process.env.OPENKIT_WORKFLOW_STATE
  ? path.resolve(process.env.OPENKIT_WORKFLOW_STATE)
  : path.join(projectRoot, '.opencode', 'workflow-state.json');
const kitRoot = resolveKitRoot(projectRoot, statePath);
const workspaceRoot = path.dirname(path.dirname(statePath));
const compatibilityShimRoot = path.join(projectRoot, '.opencode');
const workspaceShimRoot = path.join(projectRoot, '.opencode', 'openkit');
const metaSkillPath = path.join(kitRoot, 'skills', 'using-skills', 'SKILL.md');
const toolSubstitutionRulesPath = path.join(kitRoot, 'context', 'core', 'tool-substitution-rules.md');
const manifestPath = path.join(kitRoot, '.opencode', 'opencode.json');
const runtimeSummaryModulePath = path.join(kitRoot, '.opencode', 'lib', 'runtime-summary.js');

let kitName = 'OpenKit AI Software Factory';
let kitVersion = 'unknown';
let entryAgent = 'unknown';
let jsonHelperStatus = 'ok';

const manifestResult = readJsonIfPresent(manifestPath);
if (manifestResult.malformed) {
  jsonHelperStatus = 'degraded';
} else if (manifestResult.value?.kit) {
  kitName = manifestResult.value.kit.name || kitName;
  kitVersion = manifestResult.value.kit.version || kitVersion;
  entryAgent = manifestResult.value.kit.entryAgent || entryAgent;
}

let skillStatus = 'missing';
if (process.env.OPENKIT_SESSION_START_NO_SKILL) {
  skillStatus = 'skipped';
} else if (fs.existsSync(metaSkillPath)) {
  skillStatus = 'loaded';
}

const stateResult = readJsonIfPresent(statePath);
if (stateResult.malformed) {
  jsonHelperStatus = 'degraded';
}

print('<openkit_runtime_status>');
print(`kit: ${kitName} v${kitVersion}`);
print(`entry agent: ${entryAgent}`);
print(`project root: ${projectRoot}`);
print(`global kit root: ${kitRoot}`);
print(`workspace root: ${workspaceRoot}`);
print(`compatibility shim root: ${compatibilityShimRoot}`);
print(`workspace shim root: ${workspaceShimRoot}`);
print(`state file: ${statePath}`);
print(`startup skill: ${skillStatus}`);
print(`json helper: ${jsonHelperStatus}`);
print('path model: config loads from the global kit root, runtime state lives under the workspace root, and project .opencode paths are compatibility shims.');
print('help: node .opencode/workflow-state.js status');
print('doctor: node .opencode/workflow-state.js doctor');
print('show: node .opencode/workflow-state.js show');
print('resume: node .opencode/workflow-state.js resume-summary');
print('</openkit_runtime_status>');

if (!process.env.OPENKIT_SESSION_START_NO_SKILL && fs.existsSync(metaSkillPath)) {
  const metaSkill = fs.readFileSync(metaSkillPath, 'utf8');
  print('<skill_system_instruction>');
  print('You are running within the Open Kit AI Software Factory framework.');
  print('Below are the rules for how you must discover and invoke your skills.');
  print();
  process.stdout.write(metaSkill);
  if (!metaSkill.endsWith('\n')) {
    print();
  }
  print('</skill_system_instruction>');
}

if (!process.env.OPENKIT_SESSION_START_NO_TOOL_RULES && fs.existsSync(toolSubstitutionRulesPath)) {
  const toolRules = fs.readFileSync(toolSubstitutionRulesPath, 'utf8');
  print('<openkit_tool_substitution_rules>');
  print('IMPORTANT: The following tool substitution rules are enforced by the OpenKit runtime.');
  print('Bash calls for blocked OS commands will be rejected.  Use the suggested tools instead.');
  print();
  process.stdout.write(toolRules);
  if (!toolRules.endsWith('\n')) {
    print();
  }
  print('</openkit_tool_substitution_rules>');
}

if (jsonHelperStatus === 'ok' && !stateResult.malformed && stateResult.value) {
  renderResumeHint(stateResult.value, runtimeSummaryModulePath, statePath);
}
