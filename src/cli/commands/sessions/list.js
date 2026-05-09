import { listSessions } from '../../../runtime/sessions/sessions-index.js';
import {
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeFlagValue,
} from './_shared.js';

const ALLOWED_STATUSES = new Set(['active', 'orphan', 'closed', 'all']);

function help() {
  return [
    'Usage: openkit sessions list [--status active|orphan|closed|all] [--json]',
    '',
    'List sessions recorded in <project>/.opencode/sessions/index.json.',
    'Defaults to --status active+orphan (the live and recoverable subsets).',
    '',
    'Options:',
    '  --status <state>   Filter (active|orphan|closed|all). Default: active+orphan.',
    '  --json             Emit machine-readable JSON.',
    '  --help, -h         Show this help.',
  ].join('\n');
}

function formatHuman(sessions) {
  if (sessions.length === 0) {
    return 'No sessions match the requested filter.';
  }
  const lines = ['SESSION_ID            STATUS    LANE       WORK_ITEM_ID         PID      LAST_SEEN'];
  for (const s of sessions) {
    lines.push(
      [
        (s.session_id ?? '').padEnd(21),
        (s.status ?? '').padEnd(9),
        (s.lane ?? '').padEnd(10),
        (s.work_item_id ?? '').padEnd(20),
        String(s.pid ?? '').padEnd(8),
        s.last_seen_at ?? '',
      ].join(' '),
    );
  }
  return lines.join('\n');
}

export const listCmd = {
  name: 'list',
  async run(args = [], io) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const statusFlag = takeFlagValue(argv, '--status');
    const baseDirFlag = takeFlagValue(argv, '--base-dir');

    if (argv.length > 0) {
      io.stderr.write(`Unknown argument(s): ${argv.join(' ')}\n`);
      io.stderr.write('Run `openkit sessions list --help` for usage.\n');
      return 1;
    }

    if (statusFlag !== null && !ALLOWED_STATUSES.has(statusFlag)) {
      io.stderr.write(`Invalid --status: ${statusFlag}. Use active|orphan|closed|all.\n`);
      return 1;
    }

    const baseDir = resolveBaseDir({ baseDirFlag });

    try {
      let sessions;
      if (!statusFlag) {
        // Default: active + orphan (the live and recoverable subsets).
        const all = listSessions(baseDir, { status: 'all' });
        sessions = all.filter((s) => s.status === 'active' || s.status === 'orphan');
      } else if (statusFlag === 'all') {
        sessions = listSessions(baseDir, { status: 'all' });
      } else {
        sessions = listSessions(baseDir, { status: statusFlag });
      }

      if (json) {
        io.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
      } else {
        io.stdout.write(`${formatHuman(sessions)}\n`);
      }
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
