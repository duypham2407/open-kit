import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Returns OpenKit-managed worktrees of the given repo as
 * Array<{workItemId, worktreePath, repoRoot}>.
 *
 * Detection: worktrees whose path lives under <repoRoot>/.claude/worktrees/.
 * The work item id is derived from the leaf directory name.
 */
export function listOpenKitWorktrees(repoRoot, { spawn = spawnSync } = {}) {
  const result = spawn('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) return [];
  const stdout = result.stdout ?? '';
  const out = [];
  const prefix = path.join(repoRoot, '.claude', 'worktrees') + path.sep;
  for (const block of stdout.split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('worktree '));
    if (!line) continue;
    const wtPath = line.slice('worktree '.length).trim();
    if (!wtPath.startsWith(prefix)) continue;
    const workItemId = path.basename(wtPath);
    out.push({ workItemId, worktreePath: wtPath, repoRoot });
  }
  return out;
}
