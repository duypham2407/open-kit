import fs from 'node:fs';
import path from 'node:path';
import { readSessionMeta } from '../../../runtime/sessions/session-meta.js';
import { readHeartbeat } from '../../../runtime/sessions/heartbeat.js';
import { readSessionsIndex } from '../../../runtime/sessions/sessions-index.js';
import { readWorkItemsIndex } from '../../../runtime/sessions/work-items-index.js';
import { sessionMirrorPath } from '../../../runtime/sessions/session-paths.js';
import { SessionNotFoundError } from '../../../runtime/sessions/errors.js';
import {
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeFlagValue,
} from './_shared.js';

function help() {
  return [
    'Usage: openkit sessions show <session_id> [--json]',
    '',
    'Display meta.json + heartbeat + current workflow stage for a session.',
    '',
    'Options:',
    '  --json        Emit machine-readable JSON.',
    '  --help, -h    Show this help.',
  ].join('\n');
}

function readCurrentStage(baseDir, sessionId, workItemId) {
  // Prefer the per-session mirror for the active stage, fall back to the
  // work item's state.json. We swallow read errors and return null so the
  // CLI is informative without crashing on missing/corrupt mirrors.
  const mirror = sessionMirrorPath(baseDir, sessionId);
  for (const candidate of [mirror, ...(workItemId ? [path.join(baseDir, 'work-items', workItemId, 'state.json')] : [])]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const state = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return {
        source: candidate,
        currentStage: state.current_stage ?? null,
        status: state.status ?? null,
        currentOwner: state.current_owner ?? null,
      };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function formatHuman({ meta, heartbeat, indexEntry, stage }) {
  const lines = [];
  lines.push(`Session: ${meta.session_id}`);
  lines.push(`  Lane:           ${meta.lane ?? 'unbound'}`);
  lines.push(`  Work item:      ${meta.work_item_id ?? '(unbound)'}`);
  lines.push(`  Status:         ${indexEntry?.status ?? 'unknown'}`);
  lines.push(`  Repo root:      ${meta.repo_root}`);
  lines.push(`  Worktree path:  ${meta.worktree_path ?? '(none — quick lane)'}`);
  lines.push(`  Target branch:  ${meta.target_branch ?? '-'}`);
  lines.push(`  Feature branch: ${meta.feature_branch ?? '-'}`);
  lines.push(`  Started at:     ${meta.started_at}`);
  if (indexEntry) {
    lines.push(`  PID:            ${indexEntry.pid ?? '-'}`);
    lines.push(`  Last seen:      ${indexEntry.last_seen_at ?? '-'}`);
  }
  lines.push('Heartbeat:');
  if (heartbeat) {
    lines.push(`  PID:        ${heartbeat.pid ?? '-'}`);
    lines.push(`  Last beat:  ${heartbeat.last_beat_at ?? '-'}`);
  } else {
    lines.push('  (none on disk)');
  }
  lines.push('Workflow:');
  if (stage) {
    lines.push(`  Source:         ${stage.source}`);
    lines.push(`  Current stage:  ${stage.currentStage ?? '-'}`);
    lines.push(`  Status:         ${stage.status ?? '-'}`);
    lines.push(`  Current owner:  ${stage.currentOwner ?? '-'}`);
  } else {
    lines.push('  (no workflow state mirror or work-item state.json found)');
  }
  return lines.join('\n');
}

export const showCmd = {
  name: 'show',
  async run(args = [], io) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const baseDirFlag = takeFlagValue(argv, '--base-dir');

    const positional = argv.filter((a) => !a.startsWith('--'));
    if (positional.length !== 1) {
      io.stderr.write('Usage: openkit sessions show <session_id> [--json]\n');
      return 1;
    }
    const sessionId = positional[0];
    const baseDir = resolveBaseDir({ baseDirFlag });

    try {
      const meta = readSessionMeta(baseDir, sessionId);
      const heartbeat = readHeartbeat(baseDir, sessionId);
      const indexEntry = readSessionsIndex(baseDir).sessions.find((s) => s.session_id === sessionId) ?? null;
      const stage = readCurrentStage(baseDir, sessionId, meta.work_item_id);
      // Surface the work item's index row too (status, current_session_id pointer).
      const workItem = meta.work_item_id
        ? readWorkItemsIndex(baseDir).work_items.find((w) => w.work_item_id === meta.work_item_id) ?? null
        : null;

      if (json) {
        io.stdout.write(
          `${JSON.stringify({ meta, heartbeat, indexEntry, workItem, stage }, null, 2)}\n`,
        );
      } else {
        io.stdout.write(`${formatHuman({ meta, heartbeat, indexEntry, stage })}\n`);
      }
      return 0;
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
