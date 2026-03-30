import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectManagedDoctor } from '../../src/runtime/doctor.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-doctor-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function materializeManagedInstall(projectRoot) {
  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'global-openkit-install',
      installReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.8',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });
}

test('doctor reports install missing when managed install files are absent', () => {
  const projectRoot = makeTempDir();

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => false,
  });

  assert.equal(result.status, 'install-missing');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.managed, []);
  assert.match(result.summary, /managed install was not found/i);
  assert.match(result.summary, /openkit run cannot proceed cleanly/i);
});

test('doctor reports install incomplete when install state is missing', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'global-openkit-install',
      installReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.match(result.summary, /install is incomplete/i);
  assert.deepEqual(result.issues, [
    'Missing required managed asset: .openkit/openkit-install.json',
  ]);
});

test('doctor reports install incomplete for a partial install when install state exists but install entrypoint is missing', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.8',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.match(result.summary, /install is incomplete/i);
  assert.match(result.issues.join('\n'), /Missing required managed asset: opencode\.json/);
});

test('doctor reports drift when a managed asset changed on disk', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'changed-wrapper-surface',
      installReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['opencode.json']);
  assert.match(result.summary, /managed asset drift was detected/i);
  assert.match(result.issues[0], /Drift detected for managed asset: opencode\.json/);
});

test('doctor reports drift for managed install-state assets it owns in phase 1', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.8',
    },
    installation: {
      profile: 'custom-profile',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['.openkit/openkit-install.json']);
  assert.match(result.summary, /managed asset drift was detected/i);
  assert.match(
    result.issues.join('\n'),
    /Drift detected for managed asset: \.openkit\/openkit-install\.json/
  );
});

test('doctor reports malformed install manifest JSON as diagnosable drift instead of crashing', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeText(path.join(projectRoot, 'opencode.json'), '{"installState": ');

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['opencode.json']);
  assert.match(result.issues.join('\n'), /Managed asset JSON is malformed: opencode\.json/);
});

test('doctor reports malformed managed install-state JSON as diagnosable drift instead of crashing', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeText(path.join(projectRoot, '.openkit', 'openkit-install.json'), '{"schema": ');

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['.openkit/openkit-install.json']);
  assert.match(
    result.issues.join('\n'),
    /Managed asset JSON is malformed: \.openkit\/openkit-install\.json/
  );
});

test('doctor reports runtime prerequisites missing when install is intact but launcher prerequisites are absent', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => false,
  });

  assert.equal(result.status, 'runtime-prerequisites-missing');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, []);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.match(result.summary, /runtime launch prerequisites are missing/i);
  assert.match(result.issues.join('\n'), /Missing runtime manifest: \.opencode\/opencode\.json/);
  assert.match(result.issues.join('\n'), /OpenCode executable is not available on PATH/);
});

test('doctor reports healthy state when install is intact and launcher prerequisites are available', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.canRunCleanly, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.driftedAssets, []);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.ok(result.runtimeDoctor.continuation);
  assert.deepEqual(result.runtimeDoctor.continuation.continuationRisk, []);
  assert.match(result.summary, /managed install is healthy/i);
  assert.match(result.summary, /openkit run can proceed cleanly/i);
});

test('doctor surfaces orchestration-health risk for stalled full-delivery boards', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-900',
    feature_slug: 'doctor-risk',
    mode: 'full',
    mode_reason: 'doctor risk fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor risk fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-900',
    parallelization: {
      parallel_mode: 'bounded',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'integration review',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-900',
    work_items: [
      {
        work_item_id: 'feature-900',
        feature_id: 'FEATURE-900',
        feature_slug: 'doctor-risk',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-900/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-900', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-900', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-900',
        title: 'Stalled task',
        summary: 'No ready or active tasks remain',
        kind: 'implementation',
        status: 'blocked',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-900',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, true);
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /no ready or active tasks/);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'blocked-by-tasks');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.recommendedAction, /Unblock or replan blocked task/);
  assert.ok(result.runtimeDoctor.continuation.continuationRisk.includes('missing-verification-evidence'));
  assert.ok(result.runtimeDoctor.continuation.continuationRisk.includes('no-ready-or-active-tasks'));
  assert.match(result.runtimeDoctor.continuation.recommendedAction, /Unblock or replan blocked task/);
  assert.ok(result.runtimeDoctor.continuation.guidance.some((entry) => /verification evidence/i.test(entry)));
});

test('doctor surfaces waiting-stage-advance health without marking the board blocked', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-901',
    feature_slug: 'doctor-stage-wait',
    mode: 'full',
    mode_reason: 'doctor stage wait fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor stage wait fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-901',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'integration review',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-901',
    work_items: [
      {
        work_item_id: 'feature-901',
        feature_id: 'FEATURE-901',
        feature_slug: 'doctor-stage-wait',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-901/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-901', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-901', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-901',
        title: 'Implementation complete',
        summary: 'Ready for integration checkpoint and stage advance',
        kind: 'implementation',
        status: 'dev_done',
        primary_owner: 'Dev-A',
        qa_owner: 'QA-Agent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-901',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'waiting-integration-checkpoint');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /integration checkpoint/);
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.recommendedAction, /integration checkpoint/);
  assert.equal(result.runtimeDoctor.continuation.continuationRisk.includes('no-ready-or-active-tasks'), false);
  assert.match(result.runtimeDoctor.continuation.recommendedAction, /integration checkpoint/);
});

test('doctor surfaces stale background runs linked to no-longer-active tasks', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-902',
    feature_slug: 'doctor-stale-run',
    mode: 'full',
    mode_reason: 'doctor stale run fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor stale run fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-902',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: ['src/contracts/'],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-902',
    work_items: [
      {
        work_item_id: 'feature-902',
        feature_id: 'FEATURE-902',
        feature_slug: 'doctor-stale-run',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-902/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-902', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-902', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-902',
        title: 'Blocked by stale background run',
        summary: 'The task is no longer active but a run still appears to be running',
        kind: 'implementation',
        status: 'blocked',
        primary_owner: 'Dev-A',
        qa_owner: 'QA-Agent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-902',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeJson(path.join(projectRoot, '.opencode', 'background-runs', 'index.json'), {
    runs: [
      {
        run_id: 'bg_stale_fixture',
        title: 'Stale fixture run',
        status: 'running',
        work_item_id: 'feature-902',
        task_id: 'TASK-902',
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'background-runs', 'bg_stale_fixture.json'), {
    run_id: 'bg_stale_fixture',
    title: 'Stale fixture run',
    status: 'running',
    work_item_id: 'feature-902',
    task_id: 'TASK-902',
    created_at: '2026-03-29T00:00:00.000Z',
    updated_at: '2026-03-29T00:00:00.000Z',
    output: null,
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, true);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'stale-running-runs');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /background runs still need inspection/);
  assert.deepEqual(result.runtimeDoctor.workflow.orchestrationHealth.staleRunningRunIds, ['bg_stale_fixture']);
  assert.deepEqual(result.runtimeDoctor.workflow.backgroundRunSummary.staleLinkedRunIds, ['bg_stale_fixture']);
  assert.deepEqual(result.runtimeDoctor.workflow.backgroundRunSummary.longRunningRunIds, ['bg_stale_fixture']);
  assert.match(result.runtimeDoctor.continuation.recommendedAction, /Inspect background run 'bg_stale_fixture'/);
});

test('doctor background summary surfaces long-running active runs separately from stale-linked runs', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-903',
    feature_slug: 'doctor-long-running-run',
    mode: 'full',
    mode_reason: 'doctor long running run fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor long running run fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-903',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: ['src/contracts/'],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-903',
    work_items: [
      {
        work_item_id: 'feature-903',
        feature_id: 'FEATURE-903',
        feature_slug: 'doctor-long-running-run',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-903/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-903', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-903', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-903',
        title: 'Still actively running',
        summary: 'The task remains active while the run is long-running',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-903',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeJson(path.join(projectRoot, '.opencode', 'background-runs', 'index.json'), {
    runs: [
      {
        run_id: 'bg_long_running_fixture',
        title: 'Long-running active fixture run',
        status: 'running',
        work_item_id: 'feature-903',
        task_id: 'TASK-903',
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'background-runs', 'bg_long_running_fixture.json'), {
    run_id: 'bg_long_running_fixture',
    title: 'Long-running active fixture run',
    status: 'running',
    work_item_id: 'feature-903',
    task_id: 'TASK-903',
    created_at: '2026-03-29T00:00:00.000Z',
    updated_at: '2026-03-29T00:00:00.000Z',
    output: null,
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'active');
  assert.deepEqual(result.runtimeDoctor.workflow.backgroundRunSummary.staleLinkedRunIds, []);
  assert.deepEqual(result.runtimeDoctor.workflow.backgroundRunSummary.longRunningRunIds, ['bg_long_running_fixture']);
  assert.deepEqual(result.runtimeDoctor.background.staleLinkedRuns, []);
  assert.deepEqual(result.runtimeDoctor.background.longRunningRuns, ['bg_long_running_fixture']);
  assert.deepEqual(result.runtimeDoctor.background.staleRunningRuns, ['bg_long_running_fixture']);
});

test('doctor surfaces shared-artifact waiting health without marking the board blocked', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-904',
    feature_slug: 'doctor-shared-artifact-window',
    mode: 'full',
    mode_reason: 'doctor shared artifact fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor shared artifact fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-904',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: ['src/contracts/'],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-904',
    work_items: [
      {
        work_item_id: 'feature-904',
        feature_id: 'FEATURE-904',
        feature_slug: 'doctor-shared-artifact-window',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-904/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-904', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-904', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-904-ACTIVE',
        title: 'Own shared artifact surface',
        summary: 'Active task currently owns the shared artifact surface',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/contracts/api.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-904-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        task_id: 'TASK-904-LIMITED',
        title: 'Wait on shared artifact surface',
        summary: 'Ready work that should wait for the shared artifact surface to clear',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/contracts/api.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-904-LIMITED',
        concurrency_class: 'parallel_limited',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'waiting-shared-artifact-window');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /shared artifact ownership/);
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.recommendedAction, /TASK-904-ACTIVE/);
});

test('doctor surfaces safe-parallel-zone waiting health without marking the board blocked', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-905',
    feature_slug: 'doctor-safe-parallel-zone',
    mode: 'full',
    mode_reason: 'doctor safe parallel zone fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor safe parallel zone fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-905',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: ['src/ui/'],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-905',
    work_items: [
      {
        work_item_id: 'feature-905',
        feature_id: 'FEATURE-905',
        feature_slug: 'doctor-safe-parallel-zone',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-905/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-905', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-905', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-905-ACTIVE',
        title: 'Active work inside allowed zone',
        summary: 'Keeps the board active while bounded overlap is considered',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/ui/button.tsx'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-905-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        task_id: 'TASK-905-LIMITED',
        title: 'Parallel-limited task outside allowed zone',
        summary: 'Ready work should wait because its artifacts are outside safe_parallel_zones',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/api.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-905-LIMITED',
        concurrency_class: 'parallel_limited',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'waiting-safe-parallel-zone');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /outside the declared safe parallel zones/);
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.recommendedAction, /src\/server\/api.ts/);
});

test('doctor surfaces sequential-constraint waiting health without marking the board blocked', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'FEATURE-906',
    feature_slug: 'doctor-sequential-constraint',
    mode: 'full',
    mode_reason: 'doctor sequential constraint fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'doctor sequential constraint fixture',
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/fixture.md',
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      solution_to_fullstack: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'feature-906',
    parallelization: {
      parallel_mode: 'enabled',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: ['TASK-906-ACTIVE -> TASK-906-WAITING'],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'feature-906',
    work_items: [
      {
        work_item_id: 'feature-906',
        feature_id: 'FEATURE-906',
        feature_slug: 'doctor-sequential-constraint',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-906/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-906', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'feature-906', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-906-ACTIVE',
        title: 'First ordered task',
        summary: 'Must finish before the second task starts',
        kind: 'implementation',
        status: 'in_progress',
        primary_owner: 'Dev-A',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/first.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-906-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        task_id: 'TASK-906-WAITING',
        title: 'Second ordered task',
        summary: 'Ready work should wait for the sequential constraint order',
        kind: 'implementation',
        status: 'queued',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/second.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-906-WAITING',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.blocked, false);
  assert.equal(result.runtimeDoctor.workflow.orchestrationHealth.status, 'waiting-sequential-constraint');
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.reason, /sequential constraint order/);
  assert.match(result.runtimeDoctor.workflow.orchestrationHealth.recommendedAction, /TASK-906-ACTIVE/);
});

test('doctor surfaces invalid migration slice boards without collapsing read-only workflow visibility', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'MIGRATE-907',
    feature_slug: 'doctor-invalid-migration-board',
    mode: 'migration',
    mode_reason: 'doctor invalid migration board fixture',
    routing_profile: {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: 'doctor invalid migration board fixture',
    },
    current_stage: 'migration_strategy',
    status: 'in_progress',
    current_owner: 'SolutionLead',
    artifacts: {
      task_card: null,
      scope_package: null,
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      baseline_to_strategy: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      strategy_to_upgrade: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      upgrade_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_verify: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      migration_verified: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'migrate-907',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'parity smoke',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'migrate-907',
    work_items: [
      {
        work_item_id: 'migrate-907',
        feature_id: 'MIGRATE-907',
        feature_slug: 'doctor-invalid-migration-board',
        mode: 'migration',
        status: 'in_progress',
        state_path: '.opencode/work-items/migrate-907/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'migrate-907', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'migrate-907', 'migration-slices.json'), {
    mode: 'migration',
    current_stage: 'migration_strategy',
    parallel_mode: 'limited',
    slices: [
      {
        slice_id: 'SLICE-907-BROKEN',
        title: 'Broken migration slice',
        summary: 'Missing primary owner makes the board invalid',
        kind: 'compatibility',
        status: 'in_progress',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/adapters/seam.ts'],
        preserved_invariants: ['existing runtime behavior'],
        compatibility_risks: ['seam drift'],
        verification_targets: ['parity smoke'],
        rollback_notes: ['revert seam changes'],
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.mode, 'migration');
  assert.equal(result.runtimeDoctor.workflow.migrationSliceBoardPresent, true);
  assert.equal(result.runtimeDoctor.workflow.migrationSliceBoardValid, false);
  assert.match(result.runtimeDoctor.workflow.migrationSliceBoardError, /requires a primary_owner/);
  assert.equal(result.runtimeDoctor.workflow.migrationSliceSummary, null);
});

test('doctor surfaces migration slice readiness when review is blocked by incomplete slices', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'MIGRATE-909',
    feature_slug: 'doctor-migration-readiness',
    mode: 'migration',
    mode_reason: 'doctor migration readiness fixture',
    routing_profile: {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: 'doctor migration readiness fixture',
    },
    current_stage: 'migration_upgrade',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: null,
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      baseline_to_strategy: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      strategy_to_upgrade: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      upgrade_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_verify: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      migration_verified: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'migrate-909',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'parity smoke',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'migrate-909',
    work_items: [
      {
        work_item_id: 'migrate-909',
        feature_id: 'MIGRATE-909',
        feature_slug: 'doctor-migration-readiness',
        mode: 'migration',
        status: 'in_progress',
        state_path: '.opencode/work-items/migrate-909/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'migrate-909', 'state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'migrate-909', 'migration-slices.json'), {
    mode: 'migration',
    current_stage: 'migration_upgrade',
    parallel_mode: 'limited',
    slices: [
      {
        slice_id: 'SLICE-909-ACTIVE',
        title: 'Create adapter seam',
        summary: 'Active migration slice',
        kind: 'compatibility',
        status: 'in_progress',
        primary_owner: 'FullstackAgent',
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/adapters/seam.ts'],
        preserved_invariants: ['existing runtime behavior'],
        compatibility_risks: ['seam drift'],
        verification_targets: ['parity smoke'],
        rollback_notes: ['revert seam changes'],
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        slice_id: 'SLICE-909-READY',
        title: 'Adopt adapter seam',
        summary: 'Ready migration slice',
        kind: 'compatibility',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/consumers/seam-user.ts'],
        preserved_invariants: ['existing runtime behavior'],
        compatibility_risks: ['consumer mismatch'],
        verification_targets: ['parity smoke'],
        rollback_notes: ['revert consumer changes'],
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.migrationSliceSummary.incomplete, 2);
  assert.equal(result.runtimeDoctor.workflow.migrationSliceReadiness.status, 'review-blocked');
  assert.equal(result.runtimeDoctor.workflow.migrationSliceReadiness.nextGate, 'migration_code_review');
  assert.equal(result.runtimeDoctor.workflow.migrationSliceReadiness.nextGateBlocked, true);
  assert.match(result.runtimeDoctor.workflow.migrationSliceReadiness.blockers.join('\n'), /SLICE-909-ACTIVE/);
});

test('doctor surfaces model-resolution trace for runtime category and specialist overrides', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "categories": {
        "deep": {
          "model": "anthropic/claude-opus-4-6",
          "fallback_models": ["openai/gpt-5.4"]
        }
      },
      "agents": {
        "specialist.oracle": {
          "model": "openai/gpt-5.4",
          "fallback_models": [{ "model": "anthropic/claude-sonnet-4-6", "variant": "high" }],
          "prompt_append": "Architecture-first review mode."
        }
      }
    }`
  );

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.ok(Array.isArray(result.runtimeDoctor.models.resolutionTrace));
  assert.ok(result.runtimeDoctor.models.resolutionTrace.some((entry) => entry.subjectId === 'deep' && entry.selectedFrom === 'category-config'));
  assert.ok(
    result.runtimeDoctor.models.resolutionTrace.some(
      (entry) => entry.subjectId === 'specialist.oracle' && entry.fallbackEntries.some((fallback) => fallback.model === 'anthropic/claude-sonnet-4-6')
    )
  );
});

test('doctor keeps workflow visibility when migration slice board JSON is malformed', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  const state = {
    feature_id: 'MIGRATE-908',
    feature_slug: 'doctor-malformed-migration-board',
    mode: 'migration',
    mode_reason: 'doctor malformed migration board fixture',
    routing_profile: {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: 'doctor malformed migration board fixture',
    },
    current_stage: 'migration_strategy',
    status: 'in_progress',
    current_owner: 'SolutionLead',
    artifacts: {
      task_card: null,
      scope_package: null,
      solution_package: 'docs/solution/fixture.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      baseline_to_strategy: { status: 'approved', approved_by: 'user', approved_at: '2026-03-30', notes: 'ok' },
      strategy_to_upgrade: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      upgrade_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_verify: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      migration_verified: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: '2026-03-30T00:00:00.000Z',
    work_item_id: 'migrate-908',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'parity smoke',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: 'migrate-908',
    work_items: [
      {
        work_item_id: 'migrate-908',
        feature_id: 'MIGRATE-908',
        feature_slug: 'doctor-malformed-migration-board',
        mode: 'migration',
        status: 'in_progress',
        state_path: '.opencode/work-items/migrate-908/state.json',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'migrate-908', 'state.json'), state);
  writeText(
    path.join(projectRoot, '.opencode', 'work-items', 'migrate-908', 'migration-slices.json'),
    '{"mode":"migration",'
  );

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.runtimeDoctor.workflow.mode, 'migration');
  assert.equal(result.runtimeDoctor.workflow.migrationSliceBoardPresent, true);
  assert.equal(result.runtimeDoctor.workflow.migrationSliceBoardValid, false);
  assert.match(result.runtimeDoctor.workflow.migrationSliceBoardError, /Malformed JSON/);
  assert.equal(result.runtimeDoctor.workflow.migrationSliceSummary, null);
});

test('doctor does not report healthy when an adopted root manifest is incompatible with the install contract', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    plugin: ['existing-plugin'],
    productSurface: {
      current: 'custom-surface',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.8',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [
        {
          assetId: 'runtime.opencode-manifest',
          path: 'opencode.json',
          adoptedFrom: 'user-existing',
          status: 'adopted',
        },
      ],
    },
    warnings: [],
    conflicts: [
      {
        assetId: 'runtime.opencode-manifest',
        path: 'opencode.json',
        reason: 'unsupported-top-level-key',
        resolution: 'manual-review-required',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.adopted, ['opencode.json']);
  assert.match(result.summary, /install contract is incomplete/i);
  assert.match(result.issues.join('\n'), /adopted root manifest is incompatible with the managed install contract/i);
});

test('doctor can report healthy when an adopted root manifest still satisfies the install contract', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    plugin: ['existing-plugin'],
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'global-openkit-install',
      installReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.8',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [
        {
          assetId: 'runtime.opencode-manifest',
          path: 'opencode.json',
          adoptedFrom: 'user-existing',
          status: 'adopted',
        },
      ],
    },
    warnings: [],
    conflicts: [],
  });
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.canRunCleanly, true);
  assert.deepEqual(result.ownedAssets.adopted, ['opencode.json']);
  assert.deepEqual(result.issues, []);
});
