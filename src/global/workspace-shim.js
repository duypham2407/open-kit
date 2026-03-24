import fs from 'node:fs';
import path from 'node:path';

function removePathIfPresent(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

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

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relativeTarget(fromPath, toPath) {
  return path.relative(path.dirname(fromPath), toPath) || '.';
}

function createSymlinkOrCopy({ linkPath, targetPath, type = 'file' }) {
  ensureParent(linkPath);

  try {
    if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) {
      removePathIfPresent(linkPath);
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

function createIfMissing(createdPaths, { linkPath, targetPath, type = 'file' }) {
  if (fs.existsSync(linkPath)) {
    return null;
  }

  const mode = createSymlinkOrCopy({ linkPath, targetPath, type });
  createdPaths.push(linkPath);
  return mode;
}

export function ensureWorkspaceShim(paths) {
  const createdPaths = [];

  fs.mkdirSync(paths.workspaceShimDir, { recursive: true });

  createIfMissing(createdPaths, {
    linkPath: paths.workspaceShimAgentsPath,
    targetPath: path.join(paths.kitRoot, 'AGENTS.md'),
    type: 'file',
  });

  createIfMissing(createdPaths, {
    linkPath: paths.workspaceShimContextDir,
    targetPath: path.join(paths.kitRoot, 'context'),
    type: 'dir',
  });

  createIfMissing(createdPaths, {
    linkPath: paths.workspaceShimTemplatesDir,
    targetPath: path.join(paths.kitRoot, 'docs', 'templates'),
    type: 'dir',
  });

  createIfMissing(createdPaths, {
    linkPath: paths.workspaceShimWorkflowStatePath,
    targetPath: paths.workflowStatePath,
    type: 'file',
  });

  if (fs.existsSync(paths.workflowStatePath)) {
    writeJson(paths.workspaceShimWorkflowStatePath, readJson(paths.workflowStatePath));
  }

  const workflowCli = `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

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

  if (!fs.existsSync(paths.workspaceShimWorkflowCliPath)) {
    writeFile(paths.workspaceShimWorkflowCliPath, workflowCli, 0o755);
    createdPaths.push(paths.workspaceShimWorkflowCliPath);
  }

  createIfMissing(createdPaths, {
    linkPath: path.join(paths.projectRoot, 'AGENTS.md'),
    targetPath: paths.workspaceShimAgentsPath,
    type: 'file',
  });

  createIfMissing(createdPaths, {
    linkPath: path.join(paths.projectRoot, 'context'),
    targetPath: paths.workspaceShimContextDir,
    type: 'dir',
  });

  createIfMissing(createdPaths, {
    linkPath: path.join(paths.projectRoot, '.opencode', 'workflow-state.json'),
    targetPath: paths.workspaceShimWorkflowStatePath,
    type: 'file',
  });

  const rootWorkflowStatePath = path.join(paths.projectRoot, '.opencode', 'workflow-state.json');
  if (!fs.existsSync(rootWorkflowStatePath)) {
    createdPaths.push(rootWorkflowStatePath);
  }
  if (fs.existsSync(paths.workflowStatePath)) {
    writeJson(rootWorkflowStatePath, readJson(paths.workflowStatePath));
  }

  if (!fs.existsSync(path.join(paths.projectRoot, '.opencode', 'workflow-state.js'))) {
    const rootWorkflowCli = `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const rawArgs = process.argv.slice(2);
const command = rawArgs[0];
const aliasMap = new Map([
  ['get', 'show'],
  ['--help', 'help'],
  ['-h', 'help'],
]);
const normalizedArgs = rawArgs.length === 0 ? ['help'] : [aliasMap.get(command) ?? command, ...rawArgs.slice(1)];
const result = spawnSync(process.execPath, [${JSON.stringify(path.join(paths.kitRoot, '.opencode', 'workflow-state.js'))}, '--state', ${JSON.stringify(paths.workflowStatePath)}, ...normalizedArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
`;

    const rootWorkflowCliPath = path.join(paths.projectRoot, '.opencode', 'workflow-state.js');
    writeFile(rootWorkflowCliPath, rootWorkflowCli, 0o755);
    createdPaths.push(rootWorkflowCliPath);
  }

  if (!fs.existsSync(path.join(paths.projectRoot, '.opencode', 'work-items'))) {
    createIfMissing(createdPaths, {
      linkPath: path.join(paths.projectRoot, '.opencode', 'work-items'),
      targetPath: paths.workItemsDir,
      type: 'dir',
    });
  }

  return {
    paths,
    createdPaths,
  };
}

export function cleanupWorkspaceShim(shim) {
  if (!shim?.createdPaths) {
    return;
  }

  for (const createdPath of [...shim.createdPaths].reverse()) {
    removePathIfPresent(createdPath);
  }

  const maybeShimDir = shim.paths?.workspaceShimDir;
  if (maybeShimDir && fs.existsSync(maybeShimDir)) {
    try {
      const entries = fs.readdirSync(maybeShimDir);
      if (entries.length === 0) {
        removePathIfPresent(maybeShimDir);
      }
    } catch {
      // ignore cleanup misses
    }
  }
}
