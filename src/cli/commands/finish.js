import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { finishSession } from '../../runtime/sessions/finish.js';
import { resolveSession } from '../../runtime/sessions/session-resolver.js';
import {
  SessionRequiredError,
  SessionNotFoundError,
  SessionStateMismatchError,
} from '../../runtime/sessions/errors.js';
import { sessionMirrorPath } from '../../runtime/sessions/session-paths.js';

function help() {
  return [
    'Usage: openkit finish [--json]',
    '',
    'Finish the current OpenKit session by squash-merging the feature branch back',
    'into the target branch (full / migration lanes) and closing both indexes.',
    'Quick lane skips the git op and only flips work_item.status=done.',
    '',
    'The session is resolved from OPENKIT_SESSION_ID. The lane gate must already',
    'have been approved (quick_verified | qa_to_done | migration_verified).',
    '',
    'Options:',
    '  --json        Emit machine-readable JSON.',
    '  --help, -h    Show this help.',
  ].join('\n');
}

/**
 * Default git runner — wraps spawnSync with utf8 encoding so finish.js can
 * trade { status, stdout, stderr } objects with us.
 */
function defaultGit({ cwd, args }) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Default worktree remover. Returns one of:
 *   { status: 'missing' }  — worktreePath does not exist on disk.
 *   { status: 'removed' }  — git worktree remove succeeded.
 * Throws on unexpected git failure so the caller can surface OK_FINISH_*.
 */
function defaultWorktreeRemover({ worktreePath }) {
  if (!worktreePath || !fs.existsSync(worktreePath)) {
    return { status: 'missing' };
  }
  const remove = spawnSync('git', ['worktree', 'remove', worktreePath], {
    encoding: 'utf8',
  });
  if ((remove.status ?? 1) !== 0) {
    const err = new Error(
      `git worktree remove failed for '${worktreePath}': ${(remove.stderr ?? '').trim() || 'non-zero exit'}`,
    );
    err.code = 'OK_WORKTREE_REMOVE_FAILED';
    throw err;
  }
  return { status: 'removed' };
}

/**
 * Default workflow-state reader for finishSession. Mirrors the lookup order
 * used by `openkit sessions show`: prefer the per-session mirror, fall back
 * to the work item's state.json. Returns `{}` (empty state) when neither
 * exists — finish.js will then refuse with OK_FINISH_GATE_NOT_MET.
 */
function defaultReadWorkflowState(baseDir, workItemId, sessionId) {
  const candidates = [];
  if (sessionId) candidates.push(sessionMirrorPath(baseDir, sessionId));
  if (workItemId) candidates.push(path.join(baseDir, 'work-items', workItemId, 'state.json'));
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      // Try the next candidate.
    }
  }
  return {};
}

function takeBoolFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

function helpRequested(args) {
  return args.includes('--help') || args.includes('-h');
}

export const finishCommand = {
  name: 'finish',
  /**
   * @param {string[]} args
   * @param {{stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream, stdin?: NodeJS.ReadableStream}} io
   * @param {object} [context]
   * @param {object} [context.deps] - test-only injection point
   */
  async run(args = [], io, context = {}) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = takeBoolFlag(argv, '--json');

    const stray = argv.filter((a) => !a.startsWith('--'));
    if (stray.length > 0) {
      io.stderr.write(`Unknown argument: ${stray[0]}\nRun \`openkit finish --help\` for usage.\n`);
      return 1;
    }

    const deps = context.deps ?? {};
    const env = deps.env ?? process.env;
    const repoRoot = deps.repoRoot ?? process.cwd();
    const git = deps.git ?? defaultGit;
    const worktreeRemover = deps.worktreeRemover ?? defaultWorktreeRemover;
    const readWorkflowState = deps.readWorkflowState ?? defaultReadWorkflowState;

    let resolved;
    try {
      resolved = resolveSession({ env, repoRoot });
    } catch (error) {
      if (
        error instanceof SessionRequiredError ||
        error instanceof SessionNotFoundError ||
        error instanceof SessionStateMismatchError
      ) {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
      io.stderr.write(`${error.message}\n`);
      return 1;
    }

    try {
      const result = await finishSession({
        baseDir: resolved.baseDir,
        sessionId: resolved.sessionId,
        git,
        worktreeRemover,
        readWorkflowState: (b, wid) => readWorkflowState(b, wid, resolved.sessionId),
      });

      if (json) {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (result.lane === 'quick') {
        io.stdout.write(
          `Finished session ${result.sessionId} (quick lane). Work item ${result.workItemId} marked done.\n`,
        );
      } else {
        io.stdout.write(
          `Finished session ${result.sessionId}. Squash-merged ${result.lane} lane into target branch as: ${result.mergedCommit}\n` +
            `Worktree: ${result.worktreeRemoved}. Work item ${result.workItemId} marked done.\n`,
        );
      }
      return 0;
    } catch (error) {
      // finishSession surfaces typed errors via .code. Print the message
      // (already user-friendly) and exit 1 — the caller can read the code
      // from the JSON branch if they need to switch on it.
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
