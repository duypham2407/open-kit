/**
 * Bootstrap Workflow Tool
 *
 * MCP tool that MasterOrchestrator calls to initialize workflow-state.json
 * for a new task. Works on fresh projects before any state file exists.
 *
 * Lane-binding behavior (multi-session isolation, spec §7.2):
 *   When OPENKIT_SESSION_ID is set in env, the tool:
 *     1. Bootstraps the workflow as before.
 *     2. Calls bindSessionMeta() on the current session's meta.json so that
 *        future resolveSession() calls map this tab to the new work item.
 *     3. Sets current_session_id on the v3 work-items index so cross-session
 *        consumers can see the binding.
 *   If the session is already bound to another work item, the tool refuses
 *   with status: 'session_already_bound' instead of clobbering the binding.
 *
 * Input:
 *   { lane, description, featureSlug?, archivePrior? }
 *
 * Output:
 *   On created:  { status: 'created', feature_id, feature_slug, lane, archived }
 *   On conflict: { status: 'conflict', activeWorkflow: { mode, current_stage, ... } }
 *   On bound:    { status: 'session_already_bound', work_item_id, lane }
 *   On error:    { status: 'error', message }
 */

import fs from 'node:fs';
import path from 'node:path';
import { bindSessionMeta, readSessionMeta } from '../../sessions/session-meta.js';
import { workItemsIndexPath } from '../../sessions/session-paths.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from '../../sessions/constants.js';
import { SessionAlreadyBoundError, SessionNotFoundError } from '../../sessions/errors.js';

// Synchronous variant of setCurrentSessionId (work-items-index.js exports the
// async, lockfile-protected one). Bootstrap runs once per session at startup
// and the slash-command tools are not invoked concurrently inside one tab, so
// a tmp+rename without a cross-process lock is acceptable here.
function setCurrentSessionIdSync(baseDir, workItemId, sessionId) {
  const file = workItemsIndexPath(baseDir);
  const cur = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] };
  const next = {
    ...cur,
    schema: cur.schema ?? WORK_ITEMS_INDEX_SCHEMA_V3,
    work_items: (cur.work_items ?? []).map((wi) =>
      wi.work_item_id === workItemId ? { ...wi, current_session_id: sessionId } : wi,
    ),
  };
  const tmp = `${file}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function createBootstrapWorkflowTool({ workflowKernel, env = process.env, projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.bootstrap-workflow',
    description: 'Bootstrap workflow-state.json for a fresh lane. MasterOrchestrator MUST call this on the first command in a project to initialize state.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { lane, description, featureSlug, archivePrior = false } = typeof input === 'string' ? {} : (input || {});

      if (!lane || !['quick', 'full', 'migration'].includes(lane)) {
        return {
          status: 'error',
          message: `lane is required and must be one of: quick, full, migration. Got: ${lane ?? '(missing)'}`,
        };
      }

      if (!description || typeof description !== 'string') {
        return {
          status: 'error',
          message: 'description is required — provide the user\'s raw task request text.',
        };
      }

      if (!workflowKernel?.bootstrapWorkflow) {
        return {
          status: 'error',
          message: 'Workflow kernel is unavailable. Ensure the OpenKit controller is installed.',
        };
      }

      // If we're inside a session and that session is already bound to a
      // different work item, refuse before doing anything destructive.
      const sessionId = env?.OPENKIT_SESSION_ID ?? null;
      const sessionProjectRoot = env?.OPENKIT_PROJECT_ROOT ?? projectRoot;
      const baseDir = path.join(sessionProjectRoot, '.opencode');
      let sessionMeta = null;
      if (sessionId) {
        try {
          sessionMeta = readSessionMeta(baseDir, sessionId);
        } catch (err) {
          if (!(err instanceof SessionNotFoundError)) throw err;
          // The session env var is set but the meta is missing; treat as
          // no-session for lane-binding purposes (best-effort backwards compat).
          sessionMeta = null;
        }

        if (sessionMeta && (sessionMeta.work_item_id || sessionMeta.lane)) {
          const bound = new SessionAlreadyBoundError(sessionMeta.work_item_id, sessionMeta.lane);
          return {
            status: 'session_already_bound',
            work_item_id: sessionMeta.work_item_id,
            lane: sessionMeta.lane,
            message: bound.message,
          };
        }
      }

      let result;
      try {
        result = workflowKernel.bootstrapWorkflow({
          lane,
          description,
          featureSlug,
          archivePrior,
        });
      } catch (err) {
        return {
          status: 'error',
          message: err.message,
        };
      }

      // After successful bootstrap, bind the work item to the current session
      // (if any). work_item_id is derived from feature_id via the same slug
      // rules used by deriveWorkItemId in work-item-store.js.
      if (result?.status === 'created' && sessionId && sessionMeta) {
        const workItemId = String(result.feature_id ?? '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        try {
          bindSessionMeta(baseDir, sessionId, {
            workItemId,
            lane: result.lane,
            // worktree_path/branches are filled in by the worktree manager for
            // full/migration lanes; quick lanes leave them null.
            worktreePath: null,
            targetBranch: null,
            featureBranch: null,
          });
          setCurrentSessionIdSync(baseDir, workItemId, sessionId);
        } catch (err) {
          // Bootstrap already succeeded; surface the binding failure but
          // don't pretend nothing happened.
          return {
            ...result,
            session_bind_warning: err.message,
          };
        }
      }

      return result;
    },
  };
}
