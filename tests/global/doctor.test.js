import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectGlobalDoctor, renderGlobalDoctorSummary } from '../../src/global/doctor.js';
import { materializeGlobalInstall } from '../../src/global/materialize.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-global-doctor-'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('global doctor reports next steps for install-missing', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 'install-missing');
  assert.equal(result.nextStep, 'Run openkit run for first-time setup.');
  assert.equal(result.recommendedCommand, 'openkit run');

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Next: Run openkit run for first-time setup\./);
  assert.match(output, /Recommended command: openkit run/);
  assert.match(output, /Default session entrypoint: \/task/);
});

test('global doctor reports next steps for healthy installs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.nextStep, 'Run openkit run.');
  assert.equal(result.recommendedCommand, 'openkit run');
  assert.equal(result.workspace.paths.workspaceRoot.includes('workspaces'), true);
  assert.equal(result.workspace.meta, null);
  assert.equal(result.workspace.index, null);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'workspaces')), false);

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Default session entrypoint: \/task/);
  assert.match(output, /Workspace state path:/);
  assert.match(output, /Compatibility shim root:/);
  assert.match(output, /Workspace shim root:/);
  assert.match(output, /Path model: config loads from the global kit root, runtime state lives under the workspace root, and project \.opencode paths are compatibility shims\./);
  assert.match(output, /Next action after launch:/);
  assert.match(output, /Runtime foundation: v1/);
  assert.match(output, /Runtime sessions:/);
  assert.match(output, /Continuation state:/);
  assert.match(output, /Tool families \(total\/active\/degraded\):/);
  assert.match(output, /Workflow runtime:/);
  assert.match(output, /capabilities/);
});

test('global doctor summary surfaces workflow recommendations for stalled full-delivery work', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const state = {
    feature_id: 'FEATURE-777',
    feature_slug: 'global-doctor-risk',
    mode: 'full',
    mode_reason: 'global doctor fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'global doctor fixture',
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
    work_item_id: 'feature-777',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'integration review',
      max_active_execution_tracks: 2,
    },
  };

  const resultBefore = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const workflowStatePath = resultBefore.workspacePaths.workflowStatePath;
  writeJson(workflowStatePath, state);
  writeJson(resultBefore.workspacePaths.workItemIndexPath, {
    active_work_item_id: 'feature-777',
    work_items: [
      {
        work_item_id: 'feature-777',
        feature_id: 'FEATURE-777',
        feature_slug: 'global-doctor-risk',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-777/state.json',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-777', 'state.json'), state);
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-777', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-777',
        title: 'Blocked runtime task',
        summary: 'Needs unblocking before dispatch can continue',
        kind: 'implementation',
        status: 'blocked',
        primary_owner: 'Dev-A',
        qa_owner: 'QA-Agent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-777',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Orchestration health: blocked/);
  assert.match(output, /Workflow recommendation: Unblock or replan blocked task 'TASK-777'/);
  assert.match(output, /Continuation recommendation: Unblock or replan blocked task 'TASK-777'/);
  assert.match(output, /Continuation risk: missing-verification-evidence, no-ready-or-active-tasks/);
});

test('global doctor recommends upgrade for invalid installs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  writeJson(path.join(tempHome, 'kits', 'openkit', 'install-state.json'), {
    schema: 'wrong-schema',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.10',
    },
    installation: {
      profile: 'openkit',
      status: 'installed',
      installedAt: '2026-03-24T00:00:00.000Z',
    },
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: process.env.PATH ?? '',
    },
  });

  assert.equal(result.status, 'install-invalid');
  assert.equal(result.nextStep, 'Run openkit upgrade to refresh the global install.');
  assert.equal(result.recommendedCommand, 'openkit upgrade');
});

test('global doctor reports workspace issues with guidance', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 'workspace-ready-with-issues');
  assert.equal(result.nextStep, 'Review the issues above before relying on this workspace.');
  assert.equal(result.recommendedCommand, null);
  assert.match(result.issues.join('\n'), /OpenCode executable is not available on PATH/);
  assert.equal(result.workspace.meta, null);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
});

test('global doctor summary surfaces shared-artifact waits and long-running runs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const state = {
    feature_id: 'FEATURE-778',
    feature_slug: 'global-doctor-shared-artifact',
    mode: 'full',
    mode_reason: 'global doctor shared artifact fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'global doctor shared artifact fixture',
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
    work_item_id: 'feature-778',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: ['src/contracts/'],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  const resultBefore = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const workflowStatePath = resultBefore.workspacePaths.workflowStatePath;
  writeJson(workflowStatePath, state);
  writeJson(resultBefore.workspacePaths.workItemIndexPath, {
    active_work_item_id: 'feature-778',
    work_items: [
      {
        work_item_id: 'feature-778',
        feature_id: 'FEATURE-778',
        feature_slug: 'global-doctor-shared-artifact',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-778/state.json',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-778', 'state.json'), state);
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-778', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-778-ACTIVE',
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
        branch_or_worktree: '.worktrees/runtime/TASK-778-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        task_id: 'TASK-778-LIMITED',
        title: 'Wait on shared artifact surface',
        summary: 'Ready task should wait for the shared artifact surface to clear',
        kind: 'implementation',
        status: 'ready',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/contracts/api.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-778-LIMITED',
        concurrency_class: 'parallel_limited',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });
  writeJson(path.join(resultBefore.workspacePaths.opencodeDir, 'background-runs', 'index.json'), {
    runs: [
      {
        run_id: 'bg_778_long',
        title: 'Long running fixture run',
        status: 'running',
        work_item_id: 'feature-778',
        task_id: 'TASK-778-ACTIVE',
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.opencodeDir, 'background-runs', 'bg_778_long.json'), {
    run_id: 'bg_778_long',
    title: 'Long running fixture run',
    status: 'running',
    work_item_id: 'feature-778',
    task_id: 'TASK-778-ACTIVE',
    created_at: '2026-03-29T00:00:00.000Z',
    updated_at: '2026-03-29T00:00:00.000Z',
    output: null,
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Orchestration health: waiting/);
  assert.match(output, /Shared-artifact waits: TASK-778-LIMITED <- TASK-778-ACTIVE \| refs=src\/contracts\/api.ts/);
  assert.match(output, /Long-running runs: bg_778_long/);
});

test('global doctor summary surfaces sequential-constraint waits', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const resultBefore = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const state = {
    feature_id: 'FEATURE-779',
    feature_slug: 'global-doctor-sequential-constraint',
    mode: 'full',
    mode_reason: 'global sequential constraint fixture',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'global sequential constraint fixture',
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
    work_item_id: 'feature-779',
    parallelization: {
      parallel_mode: 'enabled',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: ['TASK-779-ACTIVE -> TASK-779-WAITING'],
      integration_checkpoint: null,
      max_active_execution_tracks: 2,
    },
  };

  writeJson(resultBefore.workspacePaths.workflowStatePath, state);
  writeJson(resultBefore.workspacePaths.workItemIndexPath, {
    active_work_item_id: 'feature-779',
    work_items: [
      {
        work_item_id: 'feature-779',
        feature_id: 'FEATURE-779',
        feature_slug: 'global-doctor-sequential-constraint',
        mode: 'full',
        status: 'in_progress',
        state_path: '.opencode/work-items/feature-779/state.json',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-779', 'state.json'), state);
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'feature-779', 'tasks.json'), {
    mode: 'full',
    current_stage: 'full_implementation',
    tasks: [
      {
        task_id: 'TASK-779-ACTIVE',
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
        branch_or_worktree: '.worktrees/runtime/TASK-779-ACTIVE',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        task_id: 'TASK-779-WAITING',
        title: 'Second ordered task',
        summary: 'Should wait on solution-level sequential order',
        kind: 'implementation',
        status: 'queued',
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['src/server/second.ts'],
        plan_refs: ['docs/solution/fixture.md'],
        branch_or_worktree: '.worktrees/runtime/TASK-779-WAITING',
        concurrency_class: 'parallel_safe',
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Sequential-constraint waits: TASK-779-WAITING <- TASK-779-ACTIVE/);
  assert.match(output, /Orchestration health: waiting/);
});

test('global doctor summary surfaces migration slice summary for migration work', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const resultBefore = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const state = {
    feature_id: 'MIGRATE-780',
    feature_slug: 'global-doctor-migration-summary',
    mode: 'migration',
    mode_reason: 'global migration summary fixture',
    routing_profile: {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: 'global migration summary fixture',
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
    work_item_id: 'migrate-780',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'parity smoke',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(resultBefore.workspacePaths.workflowStatePath, state);
  writeJson(resultBefore.workspacePaths.workItemIndexPath, {
    active_work_item_id: 'migrate-780',
    work_items: [
      {
        work_item_id: 'migrate-780',
        feature_id: 'MIGRATE-780',
        feature_slug: 'global-doctor-migration-summary',
        mode: 'migration',
        status: 'in_progress',
        state_path: '.opencode/work-items/migrate-780/state.json',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'migrate-780', 'state.json'), state);
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'migrate-780', 'migration-slices.json'), {
    mode: 'migration',
    current_stage: 'migration_upgrade',
    parallel_mode: 'limited',
    slices: [
      {
        slice_id: 'SLICE-780-ACTIVE',
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
        slice_id: 'SLICE-780-READY',
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
      {
        slice_id: 'SLICE-780-BLOCKED',
        title: 'Verify parity drift',
        summary: 'Blocked migration slice',
        kind: 'verification',
        status: 'blocked',
        primary_owner: null,
        qa_owner: null,
        depends_on: ['SLICE-780-READY'],
        blocked_by: ['SLICE-780-READY'],
        artifact_refs: ['docs/qa/migration-parity.md'],
        preserved_invariants: ['existing runtime behavior'],
        compatibility_risks: ['parity gap'],
        verification_targets: ['parity smoke'],
        rollback_notes: ['hold verification rollout'],
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      {
        slice_id: 'SLICE-780-VERIFIED',
        title: 'Record parity evidence',
        summary: 'Verified migration slice',
        kind: 'verification',
        status: 'verified',
        primary_owner: 'FullstackAgent',
        qa_owner: 'QAAgent',
        depends_on: [],
        blocked_by: [],
        artifact_refs: ['docs/qa/migration-parity-complete.md'],
        preserved_invariants: ['existing runtime behavior'],
        compatibility_risks: ['none'],
        verification_targets: ['parity smoke'],
        rollback_notes: ['no rollback needed'],
        created_by: 'SolutionLead',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
    ],
    issues: [],
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Workflow runtime: connected \| mode=migration \| stage=migration_upgrade \| active=migrate-780/);
  assert.match(output, /Migration slices: total=4 \| ready=1 \| active=1 \| blocked=1 \| verified=1 \| incomplete=3/);
  assert.match(output, /Active migration slices: SLICE-780-ACTIVE/);
  assert.match(output, /Blocked migration slices: SLICE-780-BLOCKED/);
  assert.match(output, /Migration slice readiness: review-blocked \| next gate=migration_code_review \| blocked=yes/);
  assert.match(output, /Migration slice blocker: active migration slices remain before migration_code_review: SLICE-780-ACTIVE/);
});

test('global doctor summary surfaces invalid migration slice board diagnostics', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const resultBefore = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const state = {
    feature_id: 'MIGRATE-781',
    feature_slug: 'global-doctor-invalid-migration-board',
    mode: 'migration',
    mode_reason: 'global invalid migration board fixture',
    routing_profile: {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: 'global invalid migration board fixture',
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
    work_item_id: 'migrate-781',
    parallelization: {
      parallel_mode: 'limited',
      why: 'fixture',
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: 'parity smoke',
      max_active_execution_tracks: 2,
    },
  };

  writeJson(resultBefore.workspacePaths.workflowStatePath, state);
  writeJson(resultBefore.workspacePaths.workItemIndexPath, {
    active_work_item_id: 'migrate-781',
    work_items: [
      {
        work_item_id: 'migrate-781',
        feature_id: 'MIGRATE-781',
        feature_slug: 'global-doctor-invalid-migration-board',
        mode: 'migration',
        status: 'in_progress',
        state_path: '.opencode/work-items/migrate-781/state.json',
      },
    ],
  });
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'migrate-781', 'state.json'), state);
  writeJson(path.join(resultBefore.workspacePaths.workItemsDir, 'migrate-781', 'migration-slices.json'), {
    mode: 'migration',
    current_stage: 'migration_strategy',
    parallel_mode: 'limited',
    slices: [
      {
        slice_id: 'SLICE-781-BROKEN',
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

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Workflow runtime: connected \| mode=migration \| stage=migration_strategy \| active=migrate-781/);
  assert.match(output, /Migration slice board: invalid \| Migration slice 'SLICE-781-BROKEN' in 'in_progress' status requires a primary_owner/);
});
