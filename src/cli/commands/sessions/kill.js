import { killSession } from '../../../runtime/sessions/kill.js';
import { SessionNotFoundError } from '../../../runtime/sessions/errors.js';
import {
  defaultKeepRemovePrompt,
  defaultWorktreeRemover,
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeBoolFlag,
  takeFlagValue,
} from './_shared.js';

function help() {
  return [
    'Usage: openkit sessions kill <session_id> [--abandon] [--force-remove-dirty] [--keep-worktree] [--remove-worktree] [--json]',
    '',
    'Kill a hung session: SIGTERM → wait → SIGKILL. After the PID is confirmed',
    'dead, the entry is marked status=orphan so the user can resume or abandon.',
    '',
    'Options:',
    '  --abandon             After kill, run abandon in the same command.',
    '  --force-remove-dirty  Forwarded to abandon when --abandon is set.',
    '  --keep-worktree       Forwarded to abandon: skip prompt and keep the worktree.',
    '  --remove-worktree     Forwarded to abandon: skip prompt and remove the worktree.',
    '  --json                Emit machine-readable JSON.',
    '  --help, -h            Show this help.',
  ].join('\n');
}

export const killCmd = {
  name: 'kill',
  async run(args = [], io) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const baseDirFlag = takeFlagValue(argv, '--base-dir');
    const abandon = takeBoolFlag(argv, '--abandon');
    const forceRemoveDirty = takeBoolFlag(argv, '--force-remove-dirty');
    const keepWorktree = takeBoolFlag(argv, '--keep-worktree');
    const removeWorktree = takeBoolFlag(argv, '--remove-worktree');

    if (keepWorktree && removeWorktree) {
      io.stderr.write('Use at most one of --keep-worktree, --remove-worktree.\n');
      return 1;
    }

    const positional = argv.filter((a) => !a.startsWith('--'));
    if (positional.length !== 1) {
      io.stderr.write('Usage: openkit sessions kill <session_id> [options]\n');
      return 1;
    }
    const sessionId = positional[0];
    const baseDir = resolveBaseDir({ baseDirFlag });

    let prompt;
    if (keepWorktree) prompt = () => 'keep';
    else if (removeWorktree) prompt = () => 'remove';
    else prompt = defaultKeepRemovePrompt(io);

    try {
      const result = await killSession({
        baseDir,
        sessionId,
        abandon,
        forceRemoveDirty,
        worktreeRemover: defaultWorktreeRemover,
        prompt,
      });
      if (json) {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        io.stdout.write(
          `Killed session ${result.sessionId} (pid ${result.pid}` +
            `${result.escalated ? '; escalated to SIGKILL' : ''}).\n`,
        );
        if (result.abandon) {
          io.stdout.write(
            `Then abandoned: worktree ${result.abandon.worktreeAction}.\n`,
          );
        } else {
          io.stdout.write(
            `Session is now status=orphan. Run \`openkit sessions resume ${result.sessionId}\` or \`openkit sessions abandon ${result.sessionId}\`.\n`,
          );
        }
      }
      return 0;
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
      // killSession surfaces typed errors via .code.
      if (error?.code === 'OK_KILL_PID_DEAD' || error?.code === 'OK_KILL_TIMEOUT') {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
