import fs from 'node:fs';
import path from 'node:path';

import { listSessions } from '../../runtime/sessions/sessions-index.js';
import { readSessionMeta } from '../../runtime/sessions/session-meta.js';
import { sessionMirrorPath } from '../../runtime/sessions/session-paths.js';
import {
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeFlagValue,
} from './sessions/_shared.js';

const DEFAULT_CLOSED_LIMIT = 5;

function help() {
  return [
    'Usage: openkit dashboard [--json] [--closed-limit N] [--base-dir <path>]',
    '',
    'Cross-session view of every OpenKit session for the current project.',
    'Reads sessions/index.json, each session\'s meta.json, and the per-session',
    'workflow-state mirror to display the active stage.',
    '',
    'Sections:',
    '  Active sessions   live tabs with a fresh heartbeat',
    '  Orphan sessions   stale heartbeat / dead PID, recoverable via `sessions resume`',
    '  Closed sessions   recently finished sessions (most-recent first)',
    '',
    'Options:',
    '  --closed-limit N  Number of closed sessions to show (default: 5).',
    '  --json            Emit machine-readable JSON.',
    '  --base-dir <p>    Override the resolved <project>/.opencode dir.',
    '  --help, -h        Show this help.',
  ].join('\n');
}

/**
 * Read the current stage for a session from its workflow-state mirror, falling
 * back to the work item's state.json. Mirrors `sessions show` so both surfaces
 * report the same value. Returns null when nothing is parseable.
 */
function readCurrentStage(baseDir, sessionId, workItemId) {
  const candidates = [sessionMirrorPath(baseDir, sessionId)];
  if (workItemId) {
    candidates.push(path.join(baseDir, 'work-items', workItemId, 'state.json'));
  }
  for (const candidate of candidates) {
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
      // try next
    }
  }
  return null;
}

function safeReadMeta(baseDir, sessionId) {
  try {
    return readSessionMeta(baseDir, sessionId);
  } catch {
    return null;
  }
}

/**
 * Decorate each session entry with meta + stage so the renderer is purely a
 * formatter. Exported for the test surface.
 */
export function buildDashboardModel(baseDir, { closedLimit = DEFAULT_CLOSED_LIMIT } = {}) {
  const all = listSessions(baseDir, { status: 'all' });

  const decorate = (entry) => {
    const meta = safeReadMeta(baseDir, entry.session_id);
    const stage = readCurrentStage(baseDir, entry.session_id, entry.work_item_id ?? meta?.work_item_id ?? null);
    return {
      session_id: entry.session_id,
      status: entry.status,
      lane: entry.lane ?? meta?.lane ?? null,
      work_item_id: entry.work_item_id ?? meta?.work_item_id ?? null,
      worktree_path: entry.worktree_path ?? meta?.worktree_path ?? null,
      pid: entry.pid ?? null,
      started_at: entry.started_at ?? meta?.started_at ?? null,
      last_seen_at: entry.last_seen_at ?? null,
      current_stage: stage?.currentStage ?? null,
      workflow_status: stage?.status ?? null,
    };
  };

  const active = all.filter((s) => s.status === 'active').map(decorate);
  const orphan = all.filter((s) => s.status === 'orphan').map(decorate);

  // Closed: most recent first, capped.
  const closedAll = all
    .filter((s) => s.status === 'closed')
    .slice()
    .sort((a, b) => {
      const ax = a.last_seen_at ?? a.started_at ?? '';
      const bx = b.last_seen_at ?? b.started_at ?? '';
      if (ax === bx) return 0;
      return ax < bx ? 1 : -1;
    });
  const closedTotal = closedAll.length;
  const closed = closedAll.slice(0, closedLimit).map(decorate);

  return {
    active,
    orphan,
    closed,
    counts: {
      active: active.length,
      orphan: orphan.length,
      closed: closedTotal,
    },
  };
}

const HEADER_WIDTH = 78;

function pad(s, n) {
  s = String(s ?? '');
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function renderRow(s) {
  return [
    pad(s.session_id, 14),
    pad(s.lane ?? '-', 8),
    pad(s.work_item_id ?? '-', 28),
    pad(s.current_stage ?? '-', 22),
  ].join(' ');
}

function boxLine(label, count) {
  const inner = ` ${label} (${count}) `;
  const dashes = HEADER_WIDTH - inner.length - 2; // borders
  const trailing = dashes < 1 ? 1 : dashes;
  return `┌─${inner}${'─'.repeat(trailing)}┐`;
}

function bottomBorder() {
  return `└${'─'.repeat(HEADER_WIDTH - 2)}┘`;
}

function renderSection(label, sessions, { emptyMsg, totalCount } = {}) {
  const count = totalCount ?? sessions.length;
  const lines = [boxLine(label, count)];
  if (sessions.length === 0) {
    lines.push(`  ${emptyMsg ?? 'none'}`);
  } else {
    lines.push(`  ${pad('SESSION_ID', 14)} ${pad('LANE', 8)} ${pad('WORK_ITEM_ID', 28)} ${pad('STAGE', 22)}`);
    for (const s of sessions) {
      lines.push(`  ${renderRow(s)}`);
    }
    if (totalCount !== undefined && totalCount > sessions.length) {
      lines.push(`  ... ${totalCount - sessions.length} more (raise --closed-limit to see them)`);
    }
  }
  lines.push(bottomBorder());
  return lines.join('\n');
}

export function renderDashboard(model) {
  const sections = [
    renderSection('Active sessions', model.active, {
      emptyMsg: 'No active sessions. Launch one with `openkit run`.',
    }),
    renderSection('Orphan sessions', model.orphan, {
      emptyMsg: 'No orphan sessions.',
    }),
    renderSection('Closed sessions', model.closed, {
      emptyMsg: 'No recently closed sessions.',
      totalCount: model.counts.closed,
    }),
  ];
  return `${sections.join('\n')}\n`;
}

export const dashboardCommand = {
  name: 'dashboard',
  async run(args = [], io) {
    const argv = [...args];

    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const baseDirFlag = takeFlagValue(argv, '--base-dir');
    const closedLimitFlag = takeFlagValue(argv, '--closed-limit');

    if (argv.length > 0) {
      io.stderr.write(`Unknown argument(s): ${argv.join(' ')}\n`);
      io.stderr.write('Run `openkit dashboard --help` for usage.\n');
      return 1;
    }

    let closedLimit = DEFAULT_CLOSED_LIMIT;
    if (closedLimitFlag !== null) {
      const parsed = Number.parseInt(closedLimitFlag, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        io.stderr.write(`Invalid --closed-limit: ${closedLimitFlag}. Use a non-negative integer.\n`);
        return 1;
      }
      closedLimit = parsed;
    }

    const baseDir = resolveBaseDir({ baseDirFlag });

    try {
      const model = buildDashboardModel(baseDir, { closedLimit });
      if (json) {
        io.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
      } else {
        io.stdout.write(renderDashboard(model));
      }
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
