import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-graph-mgr-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function makeManager(projectRoot) {
  const syntaxIndexManager = new SyntaxIndexManager({ projectRoot });
  // Use in-memory DB for tests
  const mgr = new ProjectGraphManager({
    projectRoot,
    syntaxIndexManager,
    dbPath: ':memory:',
  });
  return mgr;
}

test('ProjectGraphManager.available is true when better-sqlite3 is available', () => {
  const dir = makeTempDir();
  const mgr = makeManager(dir);
  assert.equal(mgr.available, true);
  mgr.dispose();
});

test('ProjectGraphManager.describe returns active status', () => {
  const dir = makeTempDir();
  const mgr = makeManager(dir);
  const desc = mgr.describe();
  assert.equal(desc.status, 'active');
  assert.ok(desc.stats);
  mgr.dispose();
});

test('indexFile returns indexed for a valid JS file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/index.js', `
import { foo } from './utils.js';
export function main() {}
`);
  const mgr = makeManager(dir);
  const result = await mgr.indexFile(path.join(dir, 'src', 'index.js'));
  assert.equal(result.status, 'indexed');
  mgr.dispose();
});

test('indexFile reuses parsed tree from buildFileGraph (no second readFile)', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `export function one() { return 1; }`);
  const mgr = makeManager(dir);

  let readFileCount = 0;
  const originalReadFile = mgr.syntaxIndexManager.readFile.bind(mgr.syntaxIndexManager);
  mgr.syntaxIndexManager.readFile = async (...args) => {
    readFileCount++;
    return originalReadFile(...args);
  };

  const result = await mgr.indexFile(filePath);
  assert.equal(result.status, 'indexed');
  assert.equal(readFileCount, 1, 'Expected readFile to be called exactly once');

  mgr.dispose();
});

test('indexFile returns unchanged when mtime has not changed', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `export function x() {}`);
  const mgr = makeManager(dir);

  const first = await mgr.indexFile(filePath);
  assert.equal(first.status, 'indexed');

  const second = await mgr.indexFile(filePath);
  assert.equal(second.status, 'unchanged');
  mgr.dispose();
});

test('getDependencies returns imports of a file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function x() {}');
  const indexPath = writeFile(dir, 'src/index.js', `
import { x } from './utils.js';
`);
  const mgr = makeManager(dir);
  await mgr.indexFile(indexPath);
  await mgr.indexFile(path.join(dir, 'src', 'utils.js'));

  const deps = mgr.getDependencies(indexPath);
  assert.equal(deps.status, 'ok');
  assert.ok(deps.dependencies.length > 0);
  const depPaths = deps.dependencies.map((d) => d.path);
  assert.ok(depPaths.some((p) => p.includes('utils.js')));
  mgr.dispose();
});

test('getDependents returns files that import a file', async () => {
  const dir = makeTempDir();
  const utilsPath = writeFile(dir, 'src/utils.js', 'export function x() {}');
  const indexPath = writeFile(dir, 'src/index.js', `
import { x } from './utils.js';
`);
  const mgr = makeManager(dir);
  await mgr.indexFile(indexPath);
  await mgr.indexFile(utilsPath);

  const deps = mgr.getDependents(utilsPath);
  assert.equal(deps.status, 'ok');
  assert.ok(deps.dependents.length > 0);
  const depPaths = deps.dependents.map((d) => d.path);
  assert.ok(depPaths.some((p) => p.includes('index.js')));
  mgr.dispose();
});

test('getDependencies returns not-indexed for unknown file', () => {
  const dir = makeTempDir();
  const mgr = makeManager(dir);
  const result = mgr.getDependencies(path.join(dir, 'src', 'unknown.js'));
  assert.equal(result.status, 'not-indexed');
  mgr.dispose();
});

test('findSymbol locates exported symbol', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/utils.js', `
export function mySpecialFn() {}
`);
  const mgr = makeManager(dir);
  await mgr.indexFile(filePath);

  const result = mgr.findSymbol('mySpecialFn');
  assert.equal(result.status, 'ok');
  assert.ok(result.matches.length > 0);
  const match = result.matches[0];
  assert.ok(match.path.includes('utils.js'));
  assert.equal(match.kind, 'function');
  assert.equal(match.isExport, true);
  mgr.dispose();
});

test('indexProject indexes all JS files and returns summary', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', `export function a() {}`);
  writeFile(dir, 'src/b.js', `import { a } from './a.js'; export function b() {}`);
  writeFile(dir, 'src/c.ts', `export class C {}`);

  const mgr = makeManager(dir);
  const result = await mgr.indexProject({ maxFiles: 100 });
  assert.equal(result.status, 'complete');
  assert.ok(result.indexed >= 3);
  assert.equal(result.failed, 0);
  mgr.dispose();
});

test('getGraphSummary returns node/edge/symbol counts', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', `export const x = 1;`);
  const mgr = makeManager(dir);
  await mgr.indexFile(path.join(dir, 'src', 'utils.js'));

  const summary = mgr.getGraphSummary();
  assert.equal(summary.status, 'ok');
  assert.ok(summary.nodes >= 1);
  mgr.dispose();
});

test('getDependencies with depth=2 traverses transitively', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/c.js', `export const c = 3;`);
  writeFile(dir, 'src/b.js', `import { c } from './c.js'; export const b = 2;`);
  const aPath = writeFile(dir, 'src/a.js', `import { b } from './b.js'; export const a = 1;`);

  const mgr = makeManager(dir);
  await mgr.indexProject({ maxFiles: 50 });

  const result = mgr.getDependencies(aPath, { depth: 2 });
  assert.equal(result.status, 'ok');
  const depPaths = result.dependencies.map((d) => d.path);
  assert.ok(depPaths.some((p) => p.includes('b.js')));
  assert.ok(depPaths.some((p) => p.includes('c.js')));
  mgr.dispose();
});
