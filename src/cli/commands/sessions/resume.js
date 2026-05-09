import { resumeSession } from '../../../runtime/sessions/resume.js';
import {
  SessionNotFoundError,
  WorktreeMissingError,
  SessionStateMismatchError,
} from '../../../runtime/sessions/errors.js';
import {
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeFlagValue,
} from './_shared.js';

function help() {
  return [
    'Usage: openkit sessions resume <session_id> [--json]',
    '',
    'Re-bind an existing session to the current process and emit the env vars',
    'that should be exported into the user shell. The CLI does not actually',
    'attach a shell — instead, it prints the env block produced by',
    'resumeSession so wrappers (or humans) can re-launch with it.',
    '',
    'Options:',
    '  --json        Emit machine-readable JSON (env block).',
    '  --help, -h    Show this help.',
  ].join('\n');
}

function formatExport(env) {
  return Object.entries(env)
    .map(([k, v]) => `export ${k}=${JSON.stringify(v ?? '')}`)
    .join('\n');
}

export const resumeCmd = {
  name: 'resume',
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
      io.stderr.write('Usage: openkit sessions resume <session_id> [--json]\n');
      return 1;
    }
    const sessionId = positional[0];
    const baseDir = resolveBaseDir({ baseDirFlag });

    try {
      // CLI surface: do not actually attach a shell. The injected `spawn`
      // is a no-op so resumeSession can finish its index updates and return
      // the env block, which we emit for wrapper scripts.
      const result = await resumeSession({
        baseDir,
        sessionId,
        newPid: process.pid,
        spawn: async () => ({ status: 'cli-noop' }),
      });

      if (json) {
        io.stdout.write(
          `${JSON.stringify({ sessionId, meta: result.meta, env: result.env }, null, 2)}\n`,
        );
      } else {
        io.stdout.write(
          `Resumed session ${sessionId}. Export the following before re-attaching your shell:\n`,
        );
        io.stdout.write(`${formatExport(result.env)}\n`);
      }
      return 0;
    } catch (error) {
      if (
        error instanceof SessionNotFoundError ||
        error instanceof WorktreeMissingError ||
        error instanceof SessionStateMismatchError
      ) {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
