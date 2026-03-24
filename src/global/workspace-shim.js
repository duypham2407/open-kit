import fs from 'node:fs';
import path from 'node:path';

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, content, mode) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
  if (typeof mode === 'number') {
    fs.chmodSync(filePath, mode);
  }
}

function relativeTarget(fromPath, toPath) {
  return path.relative(path.dirname(fromPath), toPath) || '.';
}

function createSymlinkOrCopy({ linkPath, targetPath, type = 'file' }) {
  ensureParent(linkPath);

  try {
    if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup misses
  }

  try {
    fs.symlinkSync(relativeTarget(linkPath, targetPath), linkPath, type);
    return 'symlink';
  } catch {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.cpSync(targetPath, linkPath, { recursive: true });
    } else {
      fs.copyFileSync(targetPath, linkPath);
    }
    return 'copy';
  }
}

export function ensureWorkspaceShim(paths) {
  fs.mkdirSync(paths.workspaceShimDir, { recursive: true });

  createSymlinkOrCopy({
    linkPath: paths.workspaceShimAgentsPath,
    targetPath: path.join(paths.kitRoot, 'AGENTS.md'),
    type: 'file',
  });

  createSymlinkOrCopy({
    linkPath: paths.workspaceShimContextDir,
    targetPath: path.join(paths.kitRoot, 'context'),
    type: 'dir',
  });

  createSymlinkOrCopy({
    linkPath: paths.workspaceShimTemplatesDir,
    targetPath: path.join(paths.kitRoot, 'docs', 'templates'),
    type: 'dir',
  });

  createSymlinkOrCopy({
    linkPath: paths.workspaceShimWorkflowStatePath,
    targetPath: paths.workflowStatePath,
    type: 'file',
  });

  const workflowCli = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [${JSON.stringify(path.join(paths.kitRoot, '.opencode', 'workflow-state.js'))}, '--state', ${JSON.stringify(paths.workflowStatePath)}, ...args], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
`;

  writeFile(paths.workspaceShimWorkflowCliPath, workflowCli, 0o755);

  const gitDir = path.join(paths.projectRoot, '.git');
  if (fs.existsSync(gitDir)) {
    const excludePath = path.join(gitDir, 'info', 'exclude');
    const entry = '.opencode/openkit/';
    let current = '';
    if (fs.existsSync(excludePath)) {
      current = fs.readFileSync(excludePath, 'utf8');
    }
    if (!current.split(/\r?\n/).includes(entry)) {
      writeFile(excludePath, `${current}${current.endsWith('\n') || current.length === 0 ? '' : '\n'}${entry}\n`);
    }
  }

  return paths;
}
