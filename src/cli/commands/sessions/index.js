import { listCmd } from './list.js';
import { showCmd } from './show.js';
import { resumeCmd } from './resume.js';
import { abandonCmd } from './abandon.js';
import { killCmd } from './kill.js';
import { downgradeIndexCmd } from './downgrade-index.js';

export const sessionsSubcommands = {
  list: listCmd,
  show: showCmd,
  resume: resumeCmd,
  abandon: abandonCmd,
  kill: killCmd,
  'downgrade-index': downgradeIndexCmd,
};

function topHelp() {
  return [
    'Usage: openkit sessions <subcommand> [options]',
    '',
    'Inspect and manage OpenKit sessions for the current project.',
    '',
    'Subcommands:',
    '  list             List sessions (default: active+orphan).',
    '  show <id>        Show meta + heartbeat + workflow stage for a session.',
    '  resume <id>      Re-bind a session and emit shell env to attach.',
    '  abandon <id>     Mark work item abandoned, drop session, optional worktree cleanup.',
    '  kill <id>        SIGTERM/SIGKILL a hung session; mark orphan when dead.',
    '  downgrade-index  Maintainer-only v3 → v2 rollback for work-items/index.json.',
    '',
    'Run `openkit sessions <subcommand> --help` for per-command flags.',
  ].join('\n');
}

/**
 * Programmatic dispatcher (mirrors plan §Task 23).
 * Throws on unknown subcommand so callers can choose how to surface it.
 */
export async function sessionsDispatch(argv, ctx = {}) {
  const [name, ...rest] = argv;
  const fn = sessionsSubcommands[name];
  if (!fn) throw new Error(`unknown subcommand: openkit sessions ${name}`);
  return fn.run(rest, ctx.io ?? defaultIo(), ctx);
}

function defaultIo() {
  return { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin };
}

/**
 * CLI command shape consumed by `bin/openkit.js`'s top-level dispatcher.
 */
export const sessionsCommand = {
  name: 'sessions',
  async run(args = [], io = defaultIo(), context = {}) {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      io.stdout.write(`${topHelp()}\n`);
      return 0;
    }

    const [name, ...rest] = args;
    const sub = sessionsSubcommands[name];
    if (!sub) {
      io.stderr.write(
        `Unknown subcommand: openkit sessions ${name}\nRun \`openkit sessions --help\` for usage.\n`,
      );
      return 1;
    }

    return sub.run(rest, io, context);
  },
};
