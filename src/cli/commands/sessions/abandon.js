import { abandonSession } from '../../../runtime/sessions/abandon.js';
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
    'Usage: openkit sessions abandon <session_id> [--force-remove-dirty] [--keep-worktree] [--remove-worktree] [--json]',
    '',
    'Abandon a session: mark its work item abandoned, clear current_session_id,',
    'delete sessions/<id>/, and remove its index entry. Then optionally clean up',
    'the worktree (default: prompt the user).',
    '',
    'Options:',
    '  --force-remove-dirty  Allow removing a worktree that has uncommitted changes.',
    '  --keep-worktree       Skip the prompt and keep the worktree on disk.',
    '  --remove-worktree     Skip the prompt and remove the worktree (subject to dirty check).',
    '  --json                Emit machine-readable JSON.',
    '  --help, -h            Show this help.',
  ].join('\n');
}

export const abandonCmd = {
  name: 'abandon',
  async run(args = [], io) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const baseDirFlag = takeFlagValue(argv, '--base-dir');
    const forceRemoveDirty = takeBoolFlag(argv, '--force-remove-dirty');
    const keepWorktree = takeBoolFlag(argv, '--keep-worktree');
    const removeWorktree = takeBoolFlag(argv, '--remove-worktree');

    if (keepWorktree && removeWorktree) {
      io.stderr.write('Use at most one of --keep-worktree, --remove-worktree.\n');
      return 1;
    }

    const positional = argv.filter((a) => !a.startsWith('--'));
    if (positional.length !== 1) {
      io.stderr.write('Usage: openkit sessions abandon <session_id> [options]\n');
      return 1;
    }
    const sessionId = positional[0];
    const baseDir = resolveBaseDir({ baseDirFlag });

    let prompt;
    if (keepWorktree) prompt = () => 'keep';
    else if (removeWorktree) prompt = () => 'remove';
    else prompt = defaultKeepRemovePrompt(io);

    try {
      const result = await abandonSession({
        baseDir,
        sessionId,
        forceRemoveDirty,
        worktreeRemover: defaultWorktreeRemover,
        prompt,
      });
      if (json) {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        io.stdout.write(
          `Abandoned session ${result.sessionId}` +
            (result.workItemId ? ` (work item ${result.workItemId})` : '') +
            `. Worktree: ${result.worktreeAction}.\n`,
        );
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
