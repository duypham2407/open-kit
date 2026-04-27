import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { createMcpPlatform } from '../../src/runtime/mcp/index.js';
import { createContextInjection } from '../../src/runtime/context/index.js';
import { createSkillRegistry } from '../../src/runtime/skills/index.js';
import { loadRuntimeCommands } from '../../src/runtime/commands/index.js';
import { wrapToolExecution } from '../../src/runtime/tools/wrap-tool-execution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-runtime-platform-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function createIsolatedWorkflowStateRoot() {
  const sourceRoot = repoRoot;
  const projectRoot = makeTempDir();
  const opencodeRoot = path.join(projectRoot, '.opencode');

  copyDir(path.join(sourceRoot, '.opencode', 'work-items'), path.join(opencodeRoot, 'work-items'));
  writeText(
    path.join(opencodeRoot, 'workflow-state.json'),
    fs.readFileSync(path.join(sourceRoot, '.opencode', 'workflow-state.json'), 'utf8')
  );

  return {
    projectRoot,
    statePath: path.join(opencodeRoot, 'workflow-state.json'),
    sourceRoot,
  };
}

test('runtime foundation exposes categories, specialists, models, and mcp platform', () => {
  const projectRoot = makeTempDir();
  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: makeTempDir() } });

  assert.ok(result.categories.categories.some((entry) => entry.id === 'deep'));
  assert.ok(result.specialists.specialists.some((entry) => entry.id === 'specialist.oracle'));
  const oracle = result.specialists.specialists.find((entry) => entry.id === 'specialist.oracle');
  assert.equal(typeof oracle.systemPromptPath, 'string');
  assert.equal(Array.isArray(oracle.tools), true);
  assert.equal(typeof oracle.systemPrompt, 'string');
  assert.ok(oracle.systemPrompt.length > 0);
  assert.ok(result.modelRuntime.resolvedModels.length > 0);
  assert.ok(result.mcpPlatform.builtin.some((entry) => entry.id === 'mcp.websearch'));
});

test('background manager can spawn, complete, and cancel runs', () => {
  const projectRoot = makeTempDir();
  const foundation = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  const run = foundation.managers.backgroundManager.spawn({
    title: 'index codebase',
    payload: { type: 'explore' },
  });

  assert.equal(run, null);

  foundation.managers.backgroundManager.enabled = true;
  const liveRun = foundation.managers.backgroundManager.spawn({
    title: 'index codebase',
    payload: { type: 'explore' },
    workItemId: 'FEATURE-1',
  });
  assert.ok(liveRun.id.startsWith('bg_'));
  assert.equal(liveRun.workflowRunId, null);
  foundation.managers.backgroundManager.complete(liveRun.id, { summary: 'done' });
  assert.equal(foundation.managers.backgroundManager.get(liveRun.id).status, 'completed');
  assert.equal(foundation.managers.backgroundManager.list().length, 1);
  foundation.managers.backgroundManager.cancel(liveRun.id);
  assert.equal(foundation.managers.backgroundManager.get(liveRun.id).status, 'cancelled');
});

test('action model state manager tracks consecutive failures per action and resets on success', () => {
  const projectRoot = makeTempDir();
  const foundation = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  foundation.managers.actionModelStateManager.recordFailure({
    subjectId: 'specialist.oracle',
    actionKey: 'tool.mcp-dispatch:websearch',
    detail: 'timeout 1',
  });
  foundation.managers.actionModelStateManager.recordFailure({
    subjectId: 'specialist.oracle',
    actionKey: 'tool.mcp-dispatch:websearch',
    detail: 'timeout 2',
  });

  let state = foundation.managers.actionModelStateManager.get('specialist.oracle', 'tool.mcp-dispatch:websearch');
  assert.equal(state.consecutiveFailures, 2);
  assert.equal(state.lastStatus, 'failure');

  foundation.managers.actionModelStateManager.recordSuccess({
    subjectId: 'specialist.oracle',
    actionKey: 'tool.mcp-dispatch:websearch',
  });

  state = foundation.managers.actionModelStateManager.get('specialist.oracle', 'tool.mcp-dispatch:websearch');
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.lastStatus, 'success');
});

test('skill and command loaders discover added runtime surfaces', () => {
  const projectRoot = makeTempDir();
  writeText(path.join(projectRoot, 'README.md'), '# project');
  writeText(path.join(projectRoot, 'AGENTS.md'), '# agents');
  writeText(path.join(projectRoot, 'skills', 'custom-skill', 'SKILL.md'), '# custom-skill');
  writeText(path.join(projectRoot, 'commands', 'init-deep.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'refactor.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'start-work.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'handoff.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'stop-continuation.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'browser-verify.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'switch.md'), '# Command');

  const skillRegistry = createSkillRegistry({ projectRoot, env: { HOME: makeTempDir() } });
  const commands = loadRuntimeCommands({ projectRoot });
  const context = createContextInjection({ projectRoot, mode: 'full', category: 'deep' });

  assert.ok(skillRegistry.skills.some((entry) => entry.name === 'custom-skill'));
  assert.equal(commands.length, 7);
  assert.ok(commands.some((entry) => entry.name === '/browser-verify' && entry.compatibility === 'builtin-compatible'));
  assert.ok(commands.some((entry) => entry.name === '/switch' && entry.compatibility === 'builtin-compatible'));
  assert.ok(skillRegistry.skills.some((entry) => entry.name === 'custom-skill' && entry.compatibility === 'project-local'));
  assert.equal(context.agentsPath, path.join(projectRoot, 'AGENTS.md'));
  assert.equal(context.readmePath, path.join(projectRoot, 'README.md'));
  assert.equal(context.rules.mode, 'full');
});

test('mcp platform loads builtin mcps and optional config file', async () => {
  const projectRoot = makeTempDir();
  writeText(
    path.join(projectRoot, '.mcp.json'),
    JSON.stringify({ token: '${TEST_TOKEN}', servers: ['custom'] })
  );

  const platform = createMcpPlatform({
    projectRoot,
    env: {
      TEST_TOKEN: 'fixture-placeholder-value',
    },
    config: {
      mcps: {
        builtin: {
          websearch: true,
          docsSearch: false,
        },
      },
    },
  });

  assert.equal(platform.builtin.length, 3);
  assert.equal(platform.loaded.config.token, 'fixture-placeholder-value');
  assert.equal(platform.loaded.source, '.mcp.json');
  assert.equal(platform.loadedServers.length, 1);
  assert.equal(platform.loadedServers[0].name, 'custom');
  assert.ok(platform.enabledBuiltinIds.includes('mcp.websearch'));
  const dispatched = await platform.dispatch('websearch', { query: 'openkit' });
  assert.equal(typeof dispatched.status, 'string');
});

test('profile switch tool can list, set, toggle, and clear agent profile selections', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "agents": {
        "specialist.oracle": {
          "profiles": [
            { "model": "openai/gpt-5.4", "variant": "high" },
            { "model": "azure/gpt-5.4", "variant": "high" }
          ]
        }
      }
    }`
  );

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });

  const tool = result.tools.tools['tool.profile-switch'];
  const listing = tool.execute({ action: 'list' });
  assert.equal(listing.status, 'ok');
  assert.equal(listing.items.length >= 1, true);
  assert.equal(listing.items.some((entry) => entry.agentId === 'specialist.oracle'), true);

  let current = tool.execute({ action: 'get', agentId: 'specialist.oracle' });
  assert.equal(current.status, 'ok');
  assert.equal(current.selectedProfileIndex, 0);

  current = tool.execute({ action: 'set', agentId: 'specialist.oracle', profileIndex: 1 });
  assert.equal(current.status, 'ok');
  assert.equal(current.selectedProfileIndex, 1);
  assert.equal(current.manualSelection.profileIndex, 1);

  current = tool.execute({ action: 'get', agentId: 'specialist.oracle' });
  assert.equal(current.status, 'ok');
  assert.equal(current.selectedProfileIndex, 1);

  const refreshedListing = tool.execute({ action: 'list' });
  assert.equal(refreshedListing.items.find((entry) => entry.agentId === 'specialist.oracle').selectedProfileIndex, 1);

  current = tool.execute({ action: 'toggle', agentId: 'specialist.oracle' });
  assert.equal(current.status, 'ok');
  assert.equal(current.selectedProfileIndex, 0);

  current = tool.execute({ action: 'clear', agentId: 'specialist.oracle' });
  assert.equal(current.status, 'ok');
  assert.equal(current.selectedProfileIndex, 0);
  assert.equal(current.manualSelection, null);
});

test('profile switch tool returns structured errors', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();
  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: homeRoot } });
  const tool = result.tools.tools['tool.profile-switch'];

  assert.equal(tool.execute({ action: 'get' }).status, 'invalid-input');
  assert.equal(tool.execute({ action: 'get', agentId: 'missing.agent' }).status, 'unknown-agent');
});

test('delegated task planning exposes specialist action state for profile switching', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-RUNTIME-ACTION',
        title: 'Implement runtime bridge',
        summary: 'Expose action tracking in delegated plan',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-RUNTIME-ACTION',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  result.managers.actionModelStateManager.recordFailure({
    subjectId: 'specialist.oracle',
    actionKey: 'delegation-task:TASK-RUNTIME-ACTION',
    detail: 'provider timeout',
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.plan.specialistId, 'specialist.oracle');
  assert.equal(dispatch.plan.actionKey, 'delegation-task:TASK-RUNTIME-ACTION');
  assert.equal(dispatch.plan.actionState.consecutiveFailures, 1);
});

test('runtime foundation exposes workflow-backed tools, supervisor, and persisted skill MCP bindings when kernel is available', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const workflowStateTool = result.tools.tools['tool.workflow-state'];
  const runtimeSummaryTool = result.tools.tools['tool.runtime-summary'];
  const evidenceTool = result.tools.tools['tool.evidence-capture'];
  const delegationTool = result.tools.tools['tool.delegation-task'];
  const parallelHook = result.hooks.hooks['hook.parallel-safety-guard'];
  const writeHook = result.hooks.hooks['hook.write-guard'];
  const issueHook = result.hooks.hooks['hook.issue-closure-guard'];
  const stageHook = result.hooks.hooks['hook.stage-readiness-guard'];
  const verificationHook = result.hooks.hooks['hook.verification-claim-guard'];
  const continuationHook = result.hooks.hooks['hook.continuation-runtime'];
  const truncationHook = result.hooks.hooks['hook.tool-output-truncation'];
  const rulesHook = result.hooks.hooks['hook.rules-injector'];
  const sessionListTool = result.tools.tools['tool.session-list'];
  const continuationStatusTool = result.tools.tools['tool.continuation-status'];

  const status = workflowStateTool.execute({ command: 'status', customStatePath: statePath });
  assert.ok(status.state.current_stage);
  const runtimeSummaryResult = runtimeSummaryTool.execute({ customStatePath: statePath });
  assert.equal(runtimeSummaryResult.status, 'ok');
  assert.ok(runtimeSummaryResult.runtimeContext);
  assert.equal(runtimeSummaryResult.runtimeContext.capabilityGuidance.validationSurface, 'runtime_tooling');
  assert.ok(runtimeSummaryResult.runtimeContext.capabilityGuidanceLines.some((line) => /advisory only; no skill or MCP was auto-activated/i.test(line)));
  assert.equal(runtimeSummaryResult.runtimeContext.capabilityGuidance.targetProjectValidation.status, 'unavailable');
  const scanEvidenceDetails = {
    validation_surface: 'runtime_tooling',
    scan_evidence: {
      evidence_type: 'direct_tool',
      direct_tool: {
        tool_id: 'tool.rule-scan',
        availability_state: 'available',
        result_state: 'succeeded',
        reason: null,
      },
      substitute: null,
      scan_kind: 'rule',
      target_scope_summary: 'changed runtime workflow files',
      rule_config_source: 'bundled',
      finding_counts: {
        total: 3,
        blocking: 0,
        non_blocking_noise: 2,
        false_positive: 1,
        unclassified: 0,
      },
      severity_summary: {
        WARNING: 2,
        INFO: 1,
      },
      triage_summary: {
        groupCount: 2,
        blockingCount: 0,
        nonBlockingNoiseCount: 1,
        falsePositiveCount: 1,
        followUpCount: 0,
        unclassifiedCount: 0,
        groups: [
          {
            ruleId: 'openkit.noisy-quality-rule',
            severity: 'WARNING',
            classification: 'non_blocking_noise',
            count: 2,
            rationale: 'Fixture warning unrelated to changed workflow evidence capture.',
          },
          {
            ruleId: 'openkit.fixture-token',
            severity: 'INFO',
            classification: 'false_positive',
            count: 1,
            rationale: 'Test-only placeholder with no production exposure.',
          },
        ],
      },
      false_positive_summary: {
        count: 1,
        items: [
          {
            rule_id: 'openkit.fixture-token',
            file: 'tests/fixtures/token.js',
            context: 'test fixture placeholder',
            rationale: 'Not a real secret and not loaded by runtime code.',
            impact: 'No production or runtime security impact.',
            follow_up: 'none',
          },
        ],
      },
      manual_override: null,
    },
  };
  assert.equal(evidenceTool.execute({
    id: 'runtime-platform-test',
    kind: 'automated',
    scope: 'full_code_review',
    summary: 'runtime platform scan evidence',
    source: 'tool.rule-scan',
    artifact_refs: ['artifacts/rule-scan.json'],
    details: scanEvidenceDetails,
    customStatePath: statePath,
  }).recorded, true);

  const persistedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const persistedEvidence = persistedState.verification_evidence.find((entry) => entry.id === 'runtime-platform-test');
  assert.deepEqual(persistedEvidence.details.scan_evidence, scanEvidenceDetails.scan_evidence);
  assert.equal(persistedEvidence.details.validation_surface, 'runtime_tooling');
  assert.notEqual(persistedEvidence.details.validation_surface, 'target_project_app');

  const scanRuntimeSummary = runtimeSummaryTool.execute({ customStatePath: statePath });
  const compactScanEvidence = scanRuntimeSummary.runtimeContext.scanEvidence.find((entry) => entry.evidence_id === 'runtime-platform-test');
  assert.equal(compactScanEvidence.validation_surface, 'runtime_tooling');
  assert.equal(compactScanEvidence.evidence_type, 'direct_tool');
  assert.equal(compactScanEvidence.direct_tool.tool_id, 'tool.rule-scan');
  assert.equal(compactScanEvidence.direct_tool.availability_state, 'available');
  assert.equal(compactScanEvidence.direct_tool.result_state, 'succeeded');
  assert.equal(compactScanEvidence.finding_counts.total, 3);
  assert.equal(compactScanEvidence.classification_summary.non_blocking_noise_count, 1);
  assert.equal(compactScanEvidence.classification_summary.false_positive_count, 1);
  assert.equal(compactScanEvidence.false_positive_summary.count, 1);
  assert.deepEqual(compactScanEvidence.artifact_refs, ['artifacts/rule-scan.json']);
  assert.ok(scanRuntimeSummary.runtimeContext.scanEvidenceLines.some((line) => (
    line.includes('runtime-platform-test') &&
    line.includes('direct tool.rule-scan available/succeeded') &&
    line.includes('surface runtime_tooling') &&
    line.includes('findings total=3') &&
    line.includes('false-positive count=1')
  )));
  assert.equal(Array.isArray(result.managers.skillMcpManager.listBindings()), true);
  assert.equal(result.runtimeInterface.runtimeState.skillMcpBindings >= 0, true);
  assert.equal(result.runtimeInterface.capabilityPack.guidance.validationSurface, 'runtime_tooling');
  assert.ok(result.runtimeInterface.capabilityPack.guidance.renderedLines.length <= result.runtimeInterface.capabilityPack.guidance.limits.maxLines);
  assert.equal(stageHook.run({ requiredStages: [status.state.current_stage] }).ready, true);
  assert.equal(stageHook.run({ requiredStages: ['quick_implement'] }).blocked, true);
  assert.match(stageHook.run({ requiredStages: ['quick_implement'] }).reason, /allowed stage set/);
  assert.equal(parallelHook.run({ parallelMode: 'fanout' }).blocked, true);
  assert.equal(writeHook.run({ taskId: 'TASK-1' }).allowed, true);
  assert.equal(verificationHook.run({ hasEvidence: false }).allowed, true);
  assert.equal(issueHook.run({ openIssues: 0 }).allowed, true);
  assert.equal(
    ['attention-required', 'continuable', 'planned'].includes(continuationHook.run().status),
    true
  );
  assert.equal(truncationHook.run({ output: 'short output' }).truncated, false);
  assert.deepEqual(rulesHook.run({ mode: 'full', category: 'deep' }).rules, []);
  assert.ok(Array.isArray(result.tools.toolFamilies));
  assert.equal(sessionListTool.execute().total >= 0, true);
  assert.ok(continuationStatusTool.execute().continuation);
  const dispatched = delegationTool.execute({
    dispatchReadyTask: true,
    workItemId: 'FEATURE-DOES-NOT-EXIST',
    customStatePath: statePath,
  });
  assert.equal(dispatched.dispatched, false);
});

test('tool output truncation hook enforces configured string and array limits', () => {
  const projectRoot = makeTempDir();
  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "hooks": {
        "toolOutputTruncation": {
          "maxChars": 10,
          "maxItems": 3
        }
      }
    }`
  );

  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: makeTempDir() } });
  const hook = result.hooks.hooks['hook.tool-output-truncation'];

  const longString = hook.run({ output: 'abcdefghijklmnop' });
  assert.equal(longString.truncated, true);
  assert.equal(longString.limits.maxChars, 10);
  assert.match(longString.output, /truncated 6 chars/);

  const longArray = hook.run({ output: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(longArray.truncated, true);
  assert.deepEqual(longArray.output, ['a', 'b', 'c']);
  assert.equal(longArray.stats.omittedItems, 2);
});

test('rules injector hook returns configured always, mode, and category rules', () => {
  const projectRoot = makeTempDir();
  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "hooks": {
        "rulesInjector": {
          "always": ["Preserve workflow-state semantics."],
          "byMode": {
            "full": ["Require explicit QA evidence."]
          },
          "byCategory": {
            "deep": ["Favor deliberate architecture tradeoffs."]
          }
        }
      }
    }`
  );

  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: makeTempDir() } });
  const hook = result.hooks.hooks['hook.rules-injector'];
  const injected = hook.run({ mode: 'full', category: 'deep' });

  assert.equal(injected.status, 'configured');
  assert.deepEqual(injected.rules, [
    'Preserve workflow-state semantics.',
    'Require explicit QA evidence.',
    'Favor deliberate architecture tradeoffs.',
  ]);
  assert.deepEqual(injected.sources.mode, ['Require explicit QA evidence.']);
  assert.deepEqual(injected.sources.category, ['Favor deliberate architecture tradeoffs.']);
});

test('continuation hook escalates to attention-required when risks are present and can be relaxed by config', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

  state.mode = 'full';
  state.current_stage = 'full_implementation';
  state.status = 'in_progress';
  state.current_owner = 'FullstackAgent';
  state.verification_evidence = [];
  writeJson(statePath, state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', state.work_item_id, 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', state.work_item_id, 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-HOOK-RISK',
        title: 'Blocked implementation task',
        summary: 'No ready or active tasks remain',
        kind: 'implementation',
        status: 'blocked',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-HOOK-RISK',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z'
      }
    ],
    issues: [],
  });

  const attentive = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });
  const attentiveHook = attentive.hooks.hooks['hook.continuation-runtime'];
  const attentiveResult = attentiveHook.run();

  assert.equal(attentiveResult.status, 'attention-required');
  assert.equal(attentiveResult.needsAttention, true);
  assert.ok(attentiveResult.continuationRisk.includes('missing-verification-evidence'));
  assert.ok(attentiveResult.continuationRisk.includes('no-ready-or-active-tasks'));
  assert.ok(attentiveResult.guidance.length >= 1);

  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "hooks": {
        "continuationRuntime": {
          "attentionOnRisk": false
        }
      }
    }`
  );

  const relaxed = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });
  const relaxedResult = relaxed.hooks.hooks['hook.continuation-runtime'].run();

  assert.equal(relaxedResult.status, 'continuable');
  assert.equal(relaxedResult.needsAttention, false);
  assert.ok(relaxedResult.continuationRisk.length >= 1);
});

test('session, continuation, browser, safer-edit, ast, syntax, and lsp tools expose runtime depth without mutating workflow state', async () => {
  const projectRoot = makeTempDir();
  writeText(path.join(projectRoot, 'src', 'sample.js'), 'export function greet() {\n  return "hi";\n}\n');
  writeText(path.join(projectRoot, 'src', 'consumer.js'), 'import { greet } from "./sample.js";\nexport const message = greet();\n');
  writeText(path.join(projectRoot, 'config.jsonc'), '{\n  // comment\n  "feature": { "enabled": true },\n  "name": "demo"\n}\n');
  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "browserAutomation": { "provider": "playwright-cli" }
    }`
  );

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      PATH: '',
    },
  });

  result.managers.continuationStateManager.start({
    reason: 'resume implementation',
    remainingActions: ['verify browser flow', 'record QA evidence'],
    maxPasses: 2,
  });
  result.managers.sessionStateManager.recordRuntimeSession({
    launcher: 'managed',
    workflowKernel: result.managers.workflowKernel,
    backgroundManager: result.managers.backgroundManager,
    continuationStateManager: result.managers.continuationStateManager,
    args: ['--mode', 'full'],
    exitCode: 0,
  });

  const sessionList = result.tools.tools['tool.session-list'].execute({ onlyResumable: true });
  const sessionSearch = result.tools.tools['tool.session-search'].execute({ query: 'resume implementation' });
  const sessionRead = result.tools.tools['tool.session-read'].execute(0);
  const continuationStart = result.tools.tools['tool.continuation-start'].execute({
    reason: 'continue deeper analysis',
    remainingActions: ['inspect symbols'],
    maxPasses: 1,
  });
  const continuationHandoff = result.tools.tools['tool.continuation-handoff'].execute({
    summary: 'handoff summary',
    remainingActions: ['finish QA'],
    notes: ['watch browser provider'],
  });
  const continuationStatus = result.tools.tools['tool.continuation-status'].execute();
  const continuationStop = result.tools.tools['tool.continuation-stop'].execute({ reason: 'manual pause' });
  const browserVerify = result.tools.tools['tool.browser-verify'].execute({ target: '/onboarding' });
  const hashlineEdit = result.tools.tools['tool.hashline-edit'].execute({
    filePath: 'src/sample.js',
    anchor: 'return "hi";',
    replacement: 'return "hello";',
  });
  const syntaxOutline = await result.tools.tools['tool.syntax-outline'].execute({ filePath: 'src/sample.js' });
  const syntaxContext = await result.tools.tools['tool.syntax-context'].execute({ filePath: 'src/sample.js', line: 1, column: 0, depth: 1 });
  const syntaxLocate = await result.tools.tools['tool.syntax-locate'].execute({ filePath: 'src/sample.js', nodeType: 'function_declaration' });
  const astSearch = result.tools.tools['tool.ast-search'].execute({ filePath: 'config.jsonc', query: { key: 'enabled', value: 'true' } });
  const astReplace = result.tools.tools['tool.ast-replace'].execute({
    filePath: 'config.jsonc',
    pointer: '/feature/enabled',
    replacement: false,
  });
  const lspSymbols = result.tools.tools['tool.lsp-symbols'].execute({ symbol: 'greet' });
  const lspDiagnostics = result.tools.tools['tool.lsp-diagnostics'].execute();
  const lspDefinition = result.tools.tools['tool.lsp-goto-definition'].execute({ symbol: 'greet' });
  const lspReferences = result.tools.tools['tool.lsp-find-references'].execute({ symbol: 'greet' });
  const lspPrepareRename = result.tools.tools['tool.lsp-prepare-rename'].execute({ symbol: 'greet', newName: 'welcome' });
  const lspRename = result.tools.tools['tool.lsp-rename'].execute({ symbol: 'greet', newName: 'welcome' });

  assert.equal(sessionList.filtered >= 1, true);
  assert.equal(sessionList.resumeCandidates.length >= 1, true);
  assert.equal(sessionSearch.filtered >= 1, true);
  assert.equal(sessionRead.summary.resumable, true);
  assert.equal(continuationStart.status, 'active');
  assert.equal(continuationHandoff.status, 'handoff-ready');
  assert.equal(continuationStatus.continuation.remainingActionCount >= 1, true);
  assert.equal(continuationStop.status, 'stopped');
  assert.equal(browserVerify.available, false);
  assert.equal(browserVerify.providerStatus, 'dependency-missing');
  assert.equal(hashlineEdit.status, 'preview-ready');
  assert.equal(hashlineEdit.preview.after.includes('hello'), true);
  assert.equal(syntaxOutline.status, 'ok');
  assert.equal(syntaxOutline.language, 'javascript');
  assert.equal(syntaxOutline.nodeCount >= 1, true);
  assert.equal(syntaxContext.status, 'ok');
  assert.equal(syntaxContext.language, 'javascript');
  assert.ok(syntaxContext.node);
  assert.equal(syntaxLocate.status, 'ok');
  assert.equal(syntaxLocate.matchCount >= 1, true);
  assert.equal(['ok', 'degraded'].includes(astSearch.status), true);
  assert.equal(astSearch.tooling.providerStatus === 'available' || astSearch.tooling.providerStatus === 'fallback-active', true);
  assert.equal(astSearch.language, 'jsonc');
  assert.equal(astSearch.matchCount, 1);
  assert.equal(astSearch.matches.length, 1);
  assert.equal(['preview-ready', 'preview-degraded'].includes(astReplace.status), true);
  assert.equal(astReplace.tooling.providerStatus === 'available' || astReplace.tooling.providerStatus === 'fallback-active', true);
  assert.equal(astReplace.language, 'jsonc');
  assert.equal(astReplace.after, false);
  assert.equal(lspSymbols.symbols.length >= 1, true);
  assert.equal(Array.isArray(lspDiagnostics.diagnostics), true);
  assert.equal(lspDefinition.definitions.length >= 1, true);
  assert.equal(lspReferences.references.length >= 2, true);
  assert.equal(lspPrepareRename.ready, true);
  assert.equal(lspRename.replacements.length >= 1, true);
});

test('ast tools report degraded fallback status honestly when ast-grep is unavailable', () => {
  const projectRoot = makeTempDir();
  writeText(path.join(projectRoot, 'config.jsonc'), '{"feature":{"enabled":true}}');

  const originalPath = process.env.PATH;
  const originalOpenCodeHome = process.env.OPENCODE_HOME;
  process.env.PATH = '';
  process.env.OPENCODE_HOME = path.join(projectRoot, 'empty-opencode-home');

  try {
    const result = bootstrapRuntimeFoundation({
      projectRoot,
      env: {
        ...process.env,
        HOME: makeTempDir(),
      },
    });

    const astSearch = result.tools.tools['tool.ast-search'].execute({ filePath: 'config.jsonc', query: { key: 'enabled', value: 'true' } });
    const astReplace = result.tools.tools['tool.ast-replace'].execute({
      filePath: 'config.jsonc',
      pointer: '/feature/enabled',
      replacement: false,
    });

    assert.equal(astSearch.status, 'degraded');
    assert.equal(astSearch.tooling.providerStatus, 'fallback-active');
    assert.equal(astReplace.status, 'preview-degraded');
    assert.equal(astReplace.tooling.providerStatus, 'fallback-active');
  } finally {
    process.env.PATH = originalPath;
    process.env.OPENCODE_HOME = originalOpenCodeHome;
  }
});

test('syntax tools report unsupported languages honestly', async () => {
  const projectRoot = makeTempDir();
  writeText(path.join(projectRoot, 'notes.txt'), 'plain text');

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  const outline = await result.tools.tools['tool.syntax-outline'].execute({ filePath: 'notes.txt' });
  assert.equal(outline.status, 'unsupported-language');
  assert.equal(outline.language, null);
});

test('syntax tools return structured invalid-path and missing-file responses', async () => {
  const projectRoot = makeTempDir();
  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: makeTempDir() } });

  const invalidPath = await result.tools.tools['tool.syntax-outline'].execute({ filePath: '../outside.js' });
  const missingFile = await result.tools.tools['tool.syntax-outline'].execute({ filePath: 'missing.js' });

  assert.equal(invalidPath.status, 'invalid-path');
  assert.equal(missingFile.status, 'missing-file');
});

test('wrapToolExecution records degraded, unavailable, not_configured, and invalid statuses as failures', async () => {
  const calls = [];
  const wrapped = wrapToolExecution(
    {
      id: 'tool.example',
      execute(input) {
        return input;
      },
    },
    {
      actionModelStateManager: {
        recordSuccess(payload) {
          calls.push({ type: 'success', payload });
        },
        recordFailure(payload) {
          calls.push({ type: 'failure', payload });
        },
      },
    }
  );

  wrapped.execute({ status: 'invalid-input' });
  wrapped.execute({ status: 'dependency-missing' });
  wrapped.execute({ status: 'unavailable' });
  wrapped.execute({ status: 'not_configured' });
  wrapped.execute({ status: 'ok' });

  assert.equal(calls[0].type, 'failure');
  assert.equal(calls[0].payload.detail, 'invalid-input');
  assert.equal(calls[1].type, 'failure');
  assert.equal(calls[1].payload.detail, 'dependency-missing');
  assert.equal(calls[2].type, 'failure');
  assert.equal(calls[2].payload.detail, 'unavailable');
  assert.equal(calls[3].type, 'failure');
  assert.equal(calls[3].payload.detail, 'not_configured');
  assert.equal(calls[4].type, 'success');
});

test('delegated implementation runs round-trip task status through the workflow kernel', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-RUNTIME-1',
        title: 'Implement runtime bridge',
        summary: 'Drive a delegated implementation task through runtime orchestration',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: 'QA-Agent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-RUNTIME-1',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, true);
  assert.ok(dispatch.run.id.startsWith('bg_'));
  assert.ok(dispatch.run.workflowRunId?.startsWith('bg_'));

  let task = result.managers.workflowKernel.listTasks(workItemId, statePath).tasks[0];
  assert.equal(task.status, 'in_progress');
  assert.equal(task.primary_owner, 'FullstackAgent');

  result.managers.backgroundManager.complete(dispatch.run.id, { summary: 'done' });

  task = result.managers.workflowKernel.listTasks(workItemId, statePath).tasks[0];
  assert.equal(task.status, 'qa_ready');

  const output = result.tools.tools['tool.background-output'].execute(dispatch.run.id);
  assert.equal(output.status, 'completed');
  assert.deepEqual(output.output, { summary: 'done' });
  assert.ok(output.workflowRunId?.startsWith('bg_'));

  const runtimeStatus = result.managers.workflowKernel.showRuntimeStatus(statePath);
  assert.equal(runtimeStatus.runtimeContext.backgroundRunSummary.completed >= 1, true);
  assert.equal(runtimeStatus.runtimeContext.verificationEvidenceLines.length >= 1, true);
});

test('delegation supervisor can route QA handoff tasks without spawning a background run', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_qa';
  baseState.status = 'in_progress';
  baseState.current_owner = 'QAAgent';
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_qa',
    tasks: [
      {
        task_id: 'TASK-QA-1',
        title: 'Verify runtime bridge',
        summary: 'Move a dev-complete task into QA execution',
        kind: 'qa',
        status: 'dev_done',
        primary_owner: 'FullstackAgent',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-QA-1',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'QAAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.mode, 'qa-handoff');
  assert.equal(dispatch.qaOwner, 'QAAgent');

  const task = result.managers.workflowKernel.listTasks(workItemId, statePath).tasks[0];
  assert.equal(task.qa_owner, 'QAAgent');
  assert.equal(task.status, 'qa_in_progress');
  assert.equal(result.managers.backgroundManager.list().length, 0);
});

test('delegation supervisor reports no dispatchable task when dependencies keep work queued', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-BLOCKER',
        title: 'Complete prerequisite',
        summary: 'Still in progress',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-BLOCKER',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      {
        task_id: 'TASK-BLOCKED',
        title: 'Implement after prerequisite',
        summary: 'Should remain undispatchable until dependency clears',
        kind: 'implementation',
        status: 'queued',
        primary_owner: null,
        qa_owner: null,
        depends_on: ['TASK-BLOCKER'],
        blocked_by: ['TASK-BLOCKER'],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-BLOCKED',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-dependencies');
  assert.equal(dispatch.taskId, 'TASK-BLOCKED');
  assert.deepEqual(dispatch.unresolvedDependencies, ['TASK-BLOCKER']);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'active');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /active execution tasks/);
});

test('delegation supervisor reports stage-advance wait when no implementation dispatch remains', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-DONE-1',
        title: 'Implementation complete',
        summary: 'Waits for integration checkpoint and stage advance',
        kind: 'implementation',
        status: 'dev_done',
        primary_owner: 'FullstackAgent',
        qa_owner: 'QA-Agent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-DONE-1',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-stage-advance');
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'waiting-stage-advance');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /waiting for the work item to advance/);
});

test('delegation supervisor defers exclusive work until the execution window is clear', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  baseState.parallelization = {
    parallel_mode: 'limited',
    why: 'exclusive-window-test',
    safe_parallel_zones: baseState.parallelization?.safe_parallel_zones ?? [],
    sequential_constraints: baseState.parallelization?.sequential_constraints ?? [],
    integration_checkpoint: baseState.parallelization?.integration_checkpoint ?? null,
    max_active_execution_tracks: 2,
  };
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-ACTIVE',
        title: 'Parallel work already running',
        summary: 'Keeps the exclusive task from starting immediately',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      {
        task_id: 'TASK-EXCLUSIVE',
        title: 'Run exclusive migration step',
        summary: 'Should wait for an exclusive window',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-EXCLUSIVE',
        concurrency_class: 'exclusive',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-exclusive-window');
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'waiting-exclusive-window');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /exclusive task/);
});

test('delegation supervisor defers parallel-limited work when an active task owns the same artifact surface', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  baseState.parallelization = {
    parallel_mode: 'limited',
    why: 'shared-artifact-window-test',
    safe_parallel_zones: ['src/contracts/'],
    sequential_constraints: baseState.parallelization?.sequential_constraints ?? [],
    integration_checkpoint: baseState.parallelization?.integration_checkpoint ?? null,
    max_active_execution_tracks: 2,
  };
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-ACTIVE-ARTIFACT',
        title: 'Update shared API contract',
        summary: 'Owns the shared artifact surface right now',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/contracts/api.ts'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-ACTIVE-ARTIFACT',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      {
        task_id: 'TASK-PARALLEL-LIMITED',
        title: 'Adapt consumer to shared API contract',
        summary: 'Should wait until the shared artifact surface is clear',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/contracts/api.ts'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-PARALLEL-LIMITED',
        concurrency_class: 'parallel_limited',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-shared-artifact');
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'waiting-shared-artifact-window');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /shared artifact ownership/);
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.recommendedAction, /TASK-ACTIVE-ARTIFACT/);
});

test('delegation supervisor defers parallel-limited work outside declared safe parallel zones', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  baseState.parallelization = {
    parallel_mode: 'limited',
    why: 'safe-parallel-zones-test',
    safe_parallel_zones: ['src/ui/'],
    sequential_constraints: [],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  };
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-ACTIVE-ZONED',
        title: 'UI work already running',
        summary: 'Keeps the board active while another bounded task is considered',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/ui/button.tsx'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-ACTIVE-ZONED',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      {
        task_id: 'TASK-PARALLEL-OUTSIDE-ZONE',
        title: 'API work outside allowed zone',
        summary: 'Should remain sequential because its artifacts are outside the safe zones',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/api.ts'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-PARALLEL-OUTSIDE-ZONE',
        concurrency_class: 'parallel_limited',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-safe-parallel-zone');
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'waiting-safe-parallel-zone');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /outside the declared safe parallel zones/);
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.recommendedAction, /src\/server\/api.ts/);
});

test('delegation supervisor defers stage-ready work blocked by sequential constraints', () => {
  const { projectRoot, statePath, sourceRoot } = createIsolatedWorkflowStateRoot();
  const workItemId = 'feature-001';
  const workItemStatePath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json');
  const taskBoardPath = path.join(projectRoot, '.opencode', 'work-items', workItemId, 'tasks.json');
  const baseState = JSON.parse(fs.readFileSync(workItemStatePath, 'utf8'));

  baseState.current_stage = 'full_implementation';
  baseState.status = 'in_progress';
  baseState.current_owner = 'FullstackAgent';
  baseState.parallelization = {
    parallel_mode: 'enabled',
    why: 'sequential-constraint-test',
    safe_parallel_zones: [],
    sequential_constraints: ['TASK-SEQUENTIAL-1 -> TASK-SEQUENTIAL-2'],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  };
  writeJson(statePath, baseState);
  writeJson(workItemStatePath, baseState);
  writeJson(taskBoardPath, {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-SEQUENTIAL-1',
        title: 'First task in ordered chain',
        summary: 'Must finish before the second task starts',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/first.ts'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-SEQUENTIAL-1',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      {
        task_id: 'TASK-SEQUENTIAL-2',
        title: 'Second task in ordered chain',
        summary: 'Should wait on solution-level sequential order',
        kind: 'implementation',
        status: 'queued',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/second.ts'],
        plan_refs: ['docs/solution/2026-03-20-task-intake-dashboard.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-SEQUENTIAL-2',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-21T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeText(path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'), `{"backgroundTask":{"enabled":true}}`);

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      OPENKIT_KIT_ROOT: sourceRoot,
      OPENKIT_WORKFLOW_STATE: statePath,
    },
  });

  const dispatch = result.tools.tools['tool.delegation-task'].execute({
    dispatchReadyTask: true,
    workItemId,
    owner: 'FullstackAgent',
    customStatePath: statePath,
  });

  assert.equal(dispatch.dispatched, false);
  assert.equal(dispatch.reason, 'queued-by-sequential-constraint');
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.status, 'waiting-sequential-constraint');
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.reason, /sequential constraint order/);
  assert.match(result.runtimeInterface.runtimeState.workflowDoctor.orchestrationHealth.recommendedAction, /TASK-SEQUENTIAL-1/);
});
