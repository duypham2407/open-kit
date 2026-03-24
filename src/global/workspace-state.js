import fs from 'node:fs';
import path from 'node:path';

import { getWorkspacePaths } from './paths.js';
import { ensureWorkspaceShim } from './workspace-shim.js';
import { getOpenKitVersion } from '../version.js';

const WORKSPACE_STATE_SCHEMA = 'openkit/workspace-state@1';

function createPendingGate() {
  return {
    status: 'pending',
    approved_by: null,
    approved_at: null,
    notes: null,
  };
}

function createEmptyArtifacts() {
  return {
    task_card: null,
    brief: null,
    spec: null,
    architecture: null,
    plan: null,
    migration_report: null,
    qa_report: null,
    adr: [],
  };
}

function createDefaultRoutingProfile(mode, selectionReason) {
  if (mode === 'quick') {
    return {
      work_intent: 'maintenance',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'low_local',
      scope_shape: 'local',
      selection_reason: selectionReason,
    };
  }

  if (mode === 'migration') {
    return {
      work_intent: 'modernization',
      behavior_delta: 'preserve',
      dominant_uncertainty: 'compatibility',
      scope_shape: 'adjacent',
      selection_reason: selectionReason,
    };
  }

  return {
    work_intent: 'feature',
    behavior_delta: 'extend',
    dominant_uncertainty: 'product',
    scope_shape: 'cross_boundary',
    selection_reason: selectionReason,
  };
}

function createEmptyApprovals(mode) {
  if (mode === 'quick') {
    return {
      quick_verified: createPendingGate(),
    };
  }

  if (mode === 'migration') {
    return {
      baseline_to_strategy: createPendingGate(),
      strategy_to_upgrade: createPendingGate(),
      upgrade_to_verify: createPendingGate(),
      migration_verified: createPendingGate(),
    };
  }

  return {
    pm_to_ba: createPendingGate(),
    ba_to_architect: createPendingGate(),
    architect_to_tech_lead: createPendingGate(),
    tech_lead_to_fullstack: createPendingGate(),
    fullstack_to_qa: createPendingGate(),
    qa_to_done: createPendingGate(),
  };
}

export function createInitialWorkflowState({ mode = 'quick', selectionReason = 'Initialized by OpenKit global workspace bootstrap.' } = {}) {
  const currentStage = mode === 'migration' ? 'migration_intake' : mode === 'full' ? 'full_intake' : 'quick_intake';
  return {
    feature_id: null,
    feature_slug: null,
    mode,
    mode_reason: selectionReason,
    routing_profile: createDefaultRoutingProfile(mode, selectionReason),
    current_stage: currentStage,
    status: 'idle',
    current_owner: 'MasterOrchestrator',
    artifacts: createEmptyArtifacts(),
    approvals: createEmptyApprovals(mode),
    issues: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: new Date().toISOString(),
    work_item_id: null,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function createWorkspaceMeta({ projectRoot, workspaceId, kitVersion = getOpenKitVersion(), profile = 'openkit' }) {
  return {
    schema: WORKSPACE_STATE_SCHEMA,
    stateVersion: 1,
    projectRoot,
    workspaceId,
    profile,
    kitVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ensureWorkspaceBootstrap(options = {}) {
  const paths = getWorkspacePaths(options);

  fs.mkdirSync(paths.opencodeDir, { recursive: true });
  fs.mkdirSync(paths.workItemsDir, { recursive: true });

  if (!fs.existsSync(paths.workspaceMetaPath)) {
    writeJson(
      paths.workspaceMetaPath,
      createWorkspaceMeta({
        projectRoot: paths.projectRoot,
        workspaceId: paths.workspaceId,
      }),
    );
  }

  if (!fs.existsSync(paths.workItemIndexPath)) {
    writeJson(paths.workItemIndexPath, {
      active_work_item_id: null,
      work_items: [],
    });
  }

  if (!fs.existsSync(paths.workflowStatePath)) {
    writeJson(paths.workflowStatePath, createInitialWorkflowState({}));
  }

  const shim = ensureWorkspaceShim(paths);

  return {
    ...paths,
    workspaceShim: shim,
  };
}

export function readWorkspaceMeta(options = {}) {
  const paths = ensureWorkspaceBootstrap(options);
  return {
    paths,
    meta: readJson(paths.workspaceMetaPath),
    index: readJson(paths.workItemIndexPath),
  };
}

export function inspectWorkspaceMeta(options = {}) {
  const paths = getWorkspacePaths(options);

  return {
    paths,
    meta: fs.existsSync(paths.workspaceMetaPath) ? readJson(paths.workspaceMetaPath) : null,
    index: fs.existsSync(paths.workItemIndexPath) ? readJson(paths.workItemIndexPath) : null,
  };
}
