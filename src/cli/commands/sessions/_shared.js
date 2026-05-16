import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { resolveSessionBaseDir } from '../../../runtime/sessions/session-base-dir.js';

/**
 * Resolve the sessions baseDir for CLI commands.
 *
 * Order of precedence:
 *   1. explicit `--base-dir` flag (already extracted by the caller)
 *   2. OPENKIT_REPOSITORY_ROOT env var → <repoRoot>/.opencode
 *   3. OPENKIT_PROJECT_ROOT env var → <projectRoot>/.opencode
 *   4. ctx.cwd → <cwd>/.opencode (defaults to process.cwd())
 */
export function resolveBaseDir({ baseDirFlag, env = process.env, cwd = process.cwd() } = {}) {
  return resolveSessionBaseDir({ baseDir: baseDirFlag, env, cwd });
}

/**
 * Default git-backed worktree remover used by abandon/kill CLI surfaces.
 *
 * Returns:
 *   { status: 'missing' }       — worktreePath does not exist on disk.
 *   { status: 'refused-dirty' } — worktree has uncommitted changes and force=false.
 *   { status: 'removed' }       — git worktree remove succeeded (force forwarded).
 *
 * Throws on unexpected git failures so the caller can surface them — abandon's
 * spec only treats 'removed' | 'refused-dirty' | 'missing' as success.
 */
export function defaultWorktreeRemover({ worktreePath, force = false } = {}) {
  if (!worktreePath || !fs.existsSync(worktreePath)) {
    return { status: 'missing' };
  }

  if (!force) {
    const status = spawnSync('git', ['-C', worktreePath, 'status', '--porcelain'], {
      encoding: 'utf8',
    });
    if ((status.status ?? 1) === 0 && (status.stdout ?? '').trim().length > 0) {
      return { status: 'refused-dirty' };
    }
  }

  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(worktreePath);

  const remove = spawnSync('git', args, { encoding: 'utf8' });
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
 * Default keep/remove prompt used by abandon/kill CLI surfaces. Defaults to
 * 'keep' on EOF / empty / unrecognised input — abandon is already committed by
 * the time we ask, so the safe default is to leave the worktree on disk.
 */
export function defaultKeepRemovePrompt(io) {
  return ({ worktreePath }) =>
    new Promise((resolve) => {
      const rl = readline.createInterface({ input: io.stdin, output: io.stdout });
      rl.question(
        `Worktree '${worktreePath}' is still on disk. Keep it or remove? [keep]: `,
        (answer) => {
          rl.close();
          const normalized = String(answer ?? '').trim().toLowerCase();
          if (normalized === 'remove' || normalized === 'r') resolve('remove');
          else resolve('keep');
        },
      );
    });
}

/**
 * Parse a flag value pair like `--status active`. Returns the value or null.
 *
 * Handles both `--flag value` and `--flag=value` forms.
 */
export function takeFlagValue(args, flag) {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === flag) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) return null;
      args.splice(i, 2);
      return v;
    }
    if (a.startsWith(`${flag}=`)) {
      const v = a.slice(flag.length + 1);
      args.splice(i, 1);
      return v;
    }
  }
  return null;
}

export function takeBoolFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

export function isJsonFlag(args) {
  return takeBoolFlag(args, '--json');
}

export function helpRequested(args) {
  return args.includes('--help') || args.includes('-h');
}
