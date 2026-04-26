import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getGlobalPaths } from './paths.js';
import { isCommandAvailable } from '../command-detection.js';
import { createRequire } from 'node:module';

export const AST_GREP_PACKAGE = '@ast-grep/cli';
export const SEMGREP_PACKAGE = 'semgrep';

const _require = createRequire(import.meta.url);

export function isBetterSqliteAvailable() {
  try {
    _require('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

export function isSyntaxParsingAvailable() {
  try {
    _require.resolve('web-tree-sitter');
    _require.resolve('web-tree-sitter/web-tree-sitter.wasm');
    _require.resolve('tree-sitter-javascript');
    _require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm');
    _require.resolve('tree-sitter-typescript');
    _require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm');
    _require.resolve('tree-sitter-typescript/tree-sitter-tsx.wasm');
    return true;
  } catch {
    return false;
  }
}

function listWindowsExecutableExtensions(env) {
  const raw = env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
  return raw
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveCommandPaths(command, { env = process.env, platform = process.platform } = {}) {
  const pathValue = env.PATH ?? '';
  const segments = pathValue.split(path.delimiter).filter(Boolean);
  const hasExtension = path.extname(command).length > 0;
  const suffixes = platform === 'win32' && !hasExtension ? ['', ...listWindowsExecutableExtensions(env)] : [''];
  const matches = [];

  for (const segment of segments) {
    for (const suffix of suffixes) {
      const candidate = path.join(segment, `${command}${suffix}`);
      if (fs.existsSync(candidate)) {
        matches.push(candidate);
      }
    }
  }

  return matches;
}

function resolveCommandPath(command, { env = process.env, platform = process.platform } = {}) {
  return resolveCommandPaths(command, { env, platform })[0] ?? null;
}

function isSelfRecursiveShellShim(commandPath) {
  try {
    const contents = fs.readFileSync(commandPath, 'utf8');
    return contents.includes(`exec ${JSON.stringify(commandPath)} "$@"`);
  } catch {
    return false;
  }
}

function semgrepVersionSucceeds(command, args, env) {
  const result = spawnSync(command, [...args, '--version'], {
    env,
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
  });

  return result.status === 0;
}

export function findUsableSemgrepCommand({ env = process.env, platform = process.platform } = {}) {
  const toolingEnv = getToolingEnv(env);
  const semgrepPath = resolveCommandPaths('semgrep', { env: toolingEnv, platform })
    .find((candidate) => fs.existsSync(candidate) && !isSelfRecursiveShellShim(candidate));
  if (semgrepPath && fs.existsSync(semgrepPath) && !isSelfRecursiveShellShim(semgrepPath)) {
    return { command: semgrepPath, args: [], source: 'PATH', path: semgrepPath };
  }

  if (isCommandAvailable('npx', { env, platform }) && semgrepVersionSucceeds('npx', ['--no-install', 'semgrep'], env)) {
    return { command: 'npx', args: ['--no-install', 'semgrep'], source: 'npx', path: null };
  }

  if (isCommandAvailable('python3', { env, platform }) && semgrepVersionSucceeds('python3', ['-m', 'semgrep'], env)) {
    return { command: 'python3', args: ['-m', 'semgrep'], source: 'python-module', path: null };
  }

  return null;
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function linkLocalAstGrepPackage(globalPaths) {
  const localPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/@ast-grep/cli');
  if (!fs.existsSync(localPackageRoot)) {
    return false;
  }

  writeExecutable(path.join(globalPaths.toolingBinRoot, 'ast-grep'), `#!/bin/sh
exec ${JSON.stringify(path.join(localPackageRoot, 'ast-grep'))} "$@"
`);
  writeExecutable(path.join(globalPaths.toolingBinRoot, 'sg'), `#!/bin/sh
exec ${JSON.stringify(path.join(localPackageRoot, 'sg'))} "$@"
`);
  return true;
}

function ensureAstGrepShims(globalPaths, env = process.env) {
  fs.mkdirSync(globalPaths.toolingBinRoot, { recursive: true });
  const astGrepPath = resolveCommandPath('ast-grep', { env }) ?? resolveCommandPath('sg', { env });
  const sgPath = resolveCommandPath('sg', { env }) ?? astGrepPath;
  if (!astGrepPath || !sgPath) {
    return false;
  }

  writeExecutable(path.join(globalPaths.toolingBinRoot, 'ast-grep'), `#!/bin/sh
exec ${JSON.stringify(astGrepPath)} "$@"
`);
  writeExecutable(path.join(globalPaths.toolingBinRoot, 'sg'), `#!/bin/sh
exec ${JSON.stringify(sgPath)} "$@"
`);
  return true;
}

function linkExistingCommand(globalPaths, command, aliases = [command], env = process.env) {
  fs.mkdirSync(globalPaths.toolingBinRoot, { recursive: true });
  const commandPath = resolveCommandPath(command, { env }) ?? aliases.slice(1).map((alias) => resolveCommandPath(alias, { env })).find(Boolean);
  if (!commandPath) {
    return false;
  }

  for (const alias of aliases) {
    writeExecutable(path.join(globalPaths.toolingBinRoot, alias), `#!/bin/sh
exec ${JSON.stringify(commandPath)} "$@"
`);
  }
  return true;
}

function resolveNpmCommand(env = process.env, platform = process.platform) {
  const nodeDir = path.dirname(process.execPath);
  const siblingNpm = platform === 'win32' ? path.join(nodeDir, 'npm.cmd') : path.join(nodeDir, 'npm');
  if (fs.existsSync(siblingNpm)) {
    return siblingNpm;
  }

  if (platform === 'win32') {
    return isCommandAvailable('npm.cmd', { env, platform }) ? 'npm.cmd' : 'npm';
  }

  return 'npm';
}

export function getToolingEnv(env = process.env) {
  const globalPaths = getGlobalPaths({ env });
  const currentPath = env.PATH ?? '';
  return {
    ...env,
    PATH: [globalPaths.toolingBinRoot, currentPath].filter(Boolean).join(path.delimiter),
  };
}

export function isAstGrepAvailable({ env = process.env, platform = process.platform } = {}) {
  const toolingEnv = getToolingEnv(env);
  const astGrepPath = resolveCommandPath('ast-grep', { env: toolingEnv, platform });
  const sgPath = resolveCommandPath('sg', { env: toolingEnv, platform });
  const isRunnableShim = (candidate) => {
    if (!candidate || !fs.existsSync(candidate)) {
      return false;
    }

    try {
      const contents = fs.readFileSync(candidate, 'utf8');
      if (contents.startsWith('#!/bin/sh') && process.execPath && !fs.existsSync(process.execPath)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  return isRunnableShim(astGrepPath) || isRunnableShim(sgPath);
}

export function isSemgrepAvailable({ env = process.env, platform = process.platform } = {}) {
  return Boolean(findUsableSemgrepCommand({ env, platform }));
}

export function isCodemodAvailable() {
  const localPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/jscodeshift');
  if (fs.existsSync(localPackageRoot)) {
    return true;
  }

  const kitRoot = process.env.OPENKIT_KIT_ROOT;
  if (typeof kitRoot === 'string' && kitRoot.length > 0) {
    return fs.existsSync(path.join(kitRoot, 'node_modules', 'jscodeshift'));
  }

  return false;
}

export function ensureAstGrepInstalled({ env = process.env, platform = process.platform, spawn = spawnSync } = {}) {
  const globalPaths = getGlobalPaths({ env, platform });
  const toolingEnv = getToolingEnv(env);
  fs.mkdirSync(globalPaths.toolingBinRoot, { recursive: true });

  if (ensureAstGrepShims(globalPaths, env) || linkLocalAstGrepPackage(globalPaths) || isAstGrepAvailable({ env, platform })) {
    return {
      action: 'installed',
      installed: true,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
    };
  }

  fs.mkdirSync(globalPaths.toolingRoot, { recursive: true });
  const packageJsonPath = path.join(globalPaths.toolingRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify({
        name: 'openkit-tooling',
        private: true,
      }, null, 2)}\n`,
      'utf8'
    );
  }

  const npmCommand = resolveNpmCommand(toolingEnv, platform);
  const result = spawn(npmCommand, ['install', '--no-save', AST_GREP_PACKAGE], {
    cwd: globalPaths.toolingRoot,
    env: toolingEnv,
    encoding: 'utf8',
  });

  if (result.error) {
    return {
      action: 'failed',
      installed: false,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
      reason: result.error.message ?? 'spawn error',
    };
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    return {
      action: 'failed',
      installed: false,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
      exitCode: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }

  ensureAstGrepShims(globalPaths, getToolingEnv(env));

  return {
    action: 'installed',
    installed: true,
    toolingRoot: globalPaths.toolingRoot,
    toolingBinRoot: globalPaths.toolingBinRoot,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function ensureSemgrepInstalled({ env = process.env, platform = process.platform, spawn = spawnSync } = {}) {
  const globalPaths = getGlobalPaths({ env, platform });
  const toolingEnv = getToolingEnv(env);
  fs.mkdirSync(globalPaths.toolingBinRoot, { recursive: true });

  if (linkExistingCommand(globalPaths, 'semgrep', ['semgrep'], env) || isSemgrepAvailable({ env, platform })) {
    return {
      action: 'installed',
      installed: true,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
    };
  }

  const result = spawn('python3', ['-m', 'pip', 'install', '--target', globalPaths.toolingRoot, SEMGREP_PACKAGE], {
    cwd: globalPaths.toolingRoot,
    env: toolingEnv,
    encoding: 'utf8',
  });

  if (result.error) {
    return {
      action: 'failed',
      installed: false,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
      reason: result.error.message ?? 'spawn error',
    };
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    return {
      action: 'failed',
      installed: false,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
      exitCode: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }

  writeExecutable(path.join(globalPaths.toolingBinRoot, 'semgrep'), `#!/bin/sh
exec python3 -m semgrep "$@"
`);

  return {
    action: 'installed',
    installed: true,
    toolingRoot: globalPaths.toolingRoot,
    toolingBinRoot: globalPaths.toolingBinRoot,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
