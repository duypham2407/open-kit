import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';
import { createImportGraphTool } from '../../src/runtime/tools/graph/import-graph.js';
import { createFindDependenciesTool } from '../../src/runtime/tools/graph/find-dependencies.js';
import { createFindDependentsTool } from '../../src/runtime/tools/graph/find-dependents.js';
import { createFindSymbolTool } from '../../src/runtime/tools/graph/find-symbol.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-graph-tools-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function makeManager(projectRoot) {
  const syntaxIndexManager = new SyntaxIndexManager({ projectRoot });
  return new ProjectGraphManager({
    projectRoot,
    syntaxIndexManager,
    dbPath: ':memory:',
  });
}

function createTools(projectRoot) {
  const mgr = makeManager(projectRoot);
  return {
    manager: mgr,
    importGraph: createImportGraphTool({ projectGraphManager: mgr }),
    findDeps: createFindDependenciesTool({ projectGraphManager: mgr }),
    findDependents: createFindDependentsTool({ projectGraphManager: mgr }),
    findSymbol: createFindSymbolTool({ projectGraphManager: mgr }),
  };
}

// ---------------------------------------------------------------------------
// tool.import-graph
// ---------------------------------------------------------------------------

test('import-graph tool has correct metadata', () => {
  const dir = makeTempDir();
  const { importGraph, manager } = createTools(dir);

  assert.equal(importGraph.id, 'tool.import-graph');
  assert.equal(importGraph.family, 'graph');
  assert.equal(importGraph.stage, 'foundation');
  assert.equal(importGraph.status, 'active');
  manager.dispose();
});

test('import-graph tool returns status when action is status', async () => {
  const dir = makeTempDir();
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute({ action: 'status' });
  assert.equal(result.status, 'active');
  assert.equal(typeof result.dbPath, 'string');
  manager.dispose();
});

test('import-graph tool defaults to status action', async () => {
  const dir = makeTempDir();
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute();
  assert.equal(result.status, 'active');
  manager.dispose();
});

test('import-graph tool indexes a single file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/main.js', 'export function main() { return 1; }\n');
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute({ action: 'index-file', filePath: path.join(dir, 'src', 'main.js') });
  assert.equal(result.status, 'indexed');
  manager.dispose();
});

test('import-graph tool requires filePath for index-file action', async () => {
  const dir = makeTempDir();
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute({ action: 'index-file' });
  assert.equal(result.status, 'error');
  assert.match(result.reason, /filePath.*required/i);
  manager.dispose();
});

test('import-graph tool returns summary', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  const { importGraph, manager } = createTools(dir);

  await importGraph.execute({ action: 'index-file', filePath: path.join(dir, 'src', 'a.js') });
  const result = await importGraph.execute({ action: 'summary' });
  assert.equal(result.status, 'ok');
  assert.equal(result.nodes >= 1, true);
  manager.dispose();
});

test('import-graph tool indexes project', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  writeFile(dir, 'src/b.js', 'import { a } from "./a.js";\nexport const b = a + 1;\n');
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute({ action: 'index' });
  assert.equal(result.status, 'complete');
  assert.equal(result.total >= 2, true);
  assert.equal(result.indexed >= 2, true);
  manager.dispose();
});

test('import-graph tool returns error for unknown action', async () => {
  const dir = makeTempDir();
  const { importGraph, manager } = createTools(dir);

  const result = await importGraph.execute({ action: 'bogus' });
  assert.equal(result.status, 'error');
  assert.match(result.reason, /unknown action/i);
  manager.dispose();
});

test('import-graph tool returns unavailable when manager is null', async () => {
  const tool = createImportGraphTool({ projectGraphManager: null });
  assert.equal(tool.status, 'degraded');

  const result = await tool.execute({ action: 'status' });
  assert.equal(result.status, 'unavailable');
});

// ---------------------------------------------------------------------------
// tool.find-dependencies
// ---------------------------------------------------------------------------

test('find-dependencies tool has correct metadata', () => {
  const dir = makeTempDir();
  const { findDeps, manager } = createTools(dir);

  assert.equal(findDeps.id, 'tool.find-dependencies');
  assert.equal(findDeps.family, 'graph');
  assert.equal(findDeps.status, 'active');
  manager.dispose();
});

test('find-dependencies tool returns dependencies of an indexed file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  writeFile(dir, 'src/b.js', 'import { a } from "./a.js";\nexport const b = a + 1;\n');
  const { findDeps, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'a.js'));
  await manager.indexFile(path.join(dir, 'src', 'b.js'));

  const result = await findDeps.execute({ filePath: path.join(dir, 'src', 'b.js') });
  assert.equal(result.status, 'ok');
  assert.equal(result.dependencies.length >= 1, true);
  assert.ok(result.dependencies.some((d) => d.path.includes('a.js')));
  manager.dispose();
});

test('find-dependencies tool accepts string input', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  const { findDeps, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'a.js'));
  const result = await findDeps.execute(path.join(dir, 'src', 'a.js'));
  assert.equal(result.status, 'ok');
  manager.dispose();
});

test('find-dependencies tool requires filePath', async () => {
  const dir = makeTempDir();
  const { findDeps, manager } = createTools(dir);

  const result = await findDeps.execute({});
  assert.equal(result.status, 'error');
  assert.match(result.reason, /filePath.*required/i);
  manager.dispose();
});

test('find-dependencies tool returns unavailable when manager is null', async () => {
  const tool = createFindDependenciesTool({ projectGraphManager: null });
  const result = await tool.execute({ filePath: '/some/file.js' });
  assert.equal(result.status, 'unavailable');
});

// ---------------------------------------------------------------------------
// tool.find-dependents
// ---------------------------------------------------------------------------

test('find-dependents tool returns reverse dependencies', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  writeFile(dir, 'src/b.js', 'import { a } from "./a.js";\nexport const b = a + 1;\n');
  const { findDependents, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'a.js'));
  await manager.indexFile(path.join(dir, 'src', 'b.js'));

  const result = await findDependents.execute({ filePath: path.join(dir, 'src', 'a.js') });
  assert.equal(result.status, 'ok');
  assert.equal(result.dependents.length >= 1, true);
  assert.ok(result.dependents.some((d) => d.path.includes('b.js')));
  manager.dispose();
});

test('find-dependents tool requires filePath', async () => {
  const dir = makeTempDir();
  const { findDependents, manager } = createTools(dir);

  const result = await findDependents.execute({});
  assert.equal(result.status, 'error');
  assert.match(result.reason, /filePath.*required/i);
  manager.dispose();
});

test('find-dependents tool returns unavailable when manager is null', async () => {
  const tool = createFindDependentsTool({ projectGraphManager: null });
  const result = await tool.execute({ filePath: '/some/file.js' });
  assert.equal(result.status, 'unavailable');
});

// ---------------------------------------------------------------------------
// tool.find-symbol
// ---------------------------------------------------------------------------

test('find-symbol tool locates exported symbol by name', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/helpers.js', 'export function greet() { return "hi"; }\nexport class Formatter {}\n');
  const { findSymbol, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'helpers.js'));

  const result = await findSymbol.execute({ name: 'greet' });
  assert.equal(result.status, 'ok');
  assert.equal(result.name, 'greet');
  assert.equal(result.matches.length >= 1, true);
  assert.ok(result.matches.some((m) => m.path.includes('helpers.js') && m.kind === 'function'));
  manager.dispose();
});

test('find-symbol tool accepts string input', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/helpers.js', 'export function greet() { return "hi"; }\n');
  const { findSymbol, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'helpers.js'));

  const result = await findSymbol.execute('greet');
  assert.equal(result.status, 'ok');
  assert.equal(result.matches.length >= 1, true);
  manager.dispose();
});

test('find-symbol tool requires name', async () => {
  const dir = makeTempDir();
  const { findSymbol, manager } = createTools(dir);

  const result = await findSymbol.execute({});
  assert.equal(result.status, 'error');
  assert.match(result.reason, /name.*required/i);
  manager.dispose();
});

test('find-symbol tool returns unavailable when manager is null', async () => {
  const tool = createFindSymbolTool({ projectGraphManager: null });
  const result = await tool.execute({ name: 'foo' });
  assert.equal(result.status, 'unavailable');
});

test('find-symbol tool returns empty matches for unknown symbol', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  const { findSymbol, manager } = createTools(dir);

  await manager.indexFile(path.join(dir, 'src', 'a.js'));

  const result = await findSymbol.execute({ name: 'nonexistent' });
  assert.equal(result.status, 'ok');
  assert.equal(result.matches.length, 0);
  manager.dispose();
});
