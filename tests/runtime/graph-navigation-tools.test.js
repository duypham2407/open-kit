import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';
import { createGraphGotoDefinitionTool } from '../../src/runtime/tools/graph/goto-definition.js';
import { createGraphFindReferencesTool } from '../../src/runtime/tools/graph/find-references.js';
import { createGraphCallHierarchyTool } from '../../src/runtime/tools/graph/call-hierarchy.js';
import { createGraphRenamePreviewTool } from '../../src/runtime/tools/graph/rename-preview.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-nav-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function makeManager(dir) {
  return new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: new SyntaxIndexManager({ projectRoot: dir }),
    dbPath: ':memory:',
  });
}

// ---------------------------------------------------------------------------
// Setup: a mini multi-file project for navigation tests
// ---------------------------------------------------------------------------

function setupProject() {
  const dir = makeTempDir();

  writeFile(dir, 'src/math.js', `
/** Adds two numbers */
export function add(a, b) {
  return a + b;
}

export function multiply(x, y) {
  return x * y;
}
`);

  writeFile(dir, 'src/utils.js', `
import { add } from './math.js';

export function doubleAdd(a, b) {
  const result = add(a, b);
  return result * 2;
}
`);

  writeFile(dir, 'src/index.js', `
import { add, multiply } from './math.js';
import { doubleAdd } from './utils.js';

const total = add(1, 2);
const product = multiply(3, 4);
const doubled = doubleAdd(5, 6);
console.log(total, product, doubled);
`);

  return dir;
}

// ---------------------------------------------------------------------------
// goto-definition tests
// ---------------------------------------------------------------------------

test('graph-goto-definition tool has correct metadata', () => {
  const tool = createGraphGotoDefinitionTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-goto-definition');
  assert.equal(tool.family, 'graph');
  assert.equal(tool.status, 'degraded');
});

test('graph-goto-definition finds symbol definitions', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphGotoDefinitionTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'add' });

  assert.equal(result.status, 'ok');
  assert.ok(result.definitions.length >= 1, 'should find at least 1 definition of add');

  const addDef = result.definitions.find((d) => d.kind === 'function' && d.isExport);
  assert.ok(addDef, 'should find exported function definition');
  assert.ok(addDef.path.includes('math.js'));
  assert.ok(addDef.signature, 'should include signature');

  mgr.dispose();
});

test('graph-goto-definition accepts string input', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphGotoDefinitionTool({ projectGraphManager: mgr });
  const result = await tool.execute('multiply');

  assert.equal(result.status, 'ok');
  assert.ok(result.definitions.length >= 1);
  mgr.dispose();
});

test('graph-goto-definition with exportOnly filters non-exported', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', `
export function foo() {}
`);
  writeFile(dir, 'src/b.js', `
function foo() {} // not exported
`);
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphGotoDefinitionTool({ projectGraphManager: mgr });

  const all = await tool.execute({ symbol: 'foo' });
  assert.ok(all.definitions.length >= 2, 'should find both definitions');

  const exportOnly = await tool.execute({ symbol: 'foo', exportOnly: true });
  assert.equal(exportOnly.definitions.length, 1, 'should only find exported definition');
  assert.ok(exportOnly.definitions[0].path.includes('a.js'));

  mgr.dispose();
});

test('graph-goto-definition requires symbol', async () => {
  const tool = createGraphGotoDefinitionTool({ projectGraphManager: { available: true, findSymbol: () => ({ status: 'ok', matches: [] }) } });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
});

test('graph-goto-definition returns unavailable when manager is null', async () => {
  const tool = createGraphGotoDefinitionTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'x' });
  assert.equal(result.status, 'unavailable');
});

// ---------------------------------------------------------------------------
// find-references tests
// ---------------------------------------------------------------------------

test('graph-find-references tool has correct metadata', () => {
  const tool = createGraphFindReferencesTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-find-references');
  assert.equal(tool.family, 'graph');
});

test('graph-find-references finds usages across files', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphFindReferencesTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'add' });

  assert.equal(result.status, 'ok');
  assert.equal(result.symbol, 'add');
  assert.ok(result.totalCount > 0, 'should find some references');

  // Should have definitions (from math.js)
  assert.ok(result.definitions.length >= 1, 'should have at least 1 definition');

  // Should have usages (from utils.js and index.js)
  assert.ok(result.usages.length >= 1 || result.imports.length >= 1, 'should have usages or imports');

  mgr.dispose();
});

test('graph-find-references accepts string input', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphFindReferencesTool({ projectGraphManager: mgr });
  const result = await tool.execute('doubleAdd');

  assert.equal(result.status, 'ok');
  assert.ok(result.totalCount > 0);
  mgr.dispose();
});

test('graph-find-references requires symbol', async () => {
  const tool = createGraphFindReferencesTool({
    projectGraphManager: { available: true, findSymbol: () => ({ status: 'ok', matches: [] }), findReferences: () => ({ status: 'ok', references: [] }) },
  });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
});

// ---------------------------------------------------------------------------
// call-hierarchy tests
// ---------------------------------------------------------------------------

test('graph-call-hierarchy tool has correct metadata', () => {
  const tool = createGraphCallHierarchyTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-call-hierarchy');
  assert.equal(tool.family, 'graph');
});

test('graph-call-hierarchy incoming shows callers', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphCallHierarchyTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'add', direction: 'incoming' });

  assert.equal(result.status, 'ok');
  assert.equal(result.direction, 'incoming');
  // add is called from doubleAdd (utils.js) and from <module> (index.js)
  assert.ok(result.calls.length >= 1, 'should find at least 1 incoming call to add');
});

test('graph-call-hierarchy outgoing shows callees', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphCallHierarchyTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'doubleAdd', direction: 'outgoing' });

  assert.equal(result.status, 'ok');
  assert.equal(result.direction, 'outgoing');
  // doubleAdd calls add
  assert.ok(result.calls.length >= 1, 'should find at least 1 outgoing call from doubleAdd');
  const addCall = result.calls.find((c) => c.calleeName === 'add');
  assert.ok(addCall, 'doubleAdd should call add');
});

test('graph-call-hierarchy defaults to incoming', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphCallHierarchyTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'add' });

  assert.equal(result.direction, 'incoming');
  mgr.dispose();
});

test('graph-call-hierarchy requires symbol', async () => {
  const tool = createGraphCallHierarchyTool({
    projectGraphManager: { available: true },
  });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
});

test('graph-call-hierarchy rejects invalid direction', async () => {
  const tool = createGraphCallHierarchyTool({
    projectGraphManager: { available: true },
  });
  const result = await tool.execute({ symbol: 'x', direction: 'sideways' });
  assert.equal(result.status, 'error');
});

// ---------------------------------------------------------------------------
// rename-preview tests
// ---------------------------------------------------------------------------

test('graph-rename-preview tool has correct metadata', () => {
  const tool = createGraphRenamePreviewTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-rename-preview');
  assert.equal(tool.family, 'graph');
});

test('graph-rename-preview shows all occurrences across files', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphRenamePreviewTool({ projectGraphManager: mgr });
  const result = await tool.execute({ symbol: 'add', newName: 'sum' });

  assert.equal(result.status, 'preview-ready');
  assert.equal(result.symbol, 'add');
  assert.equal(result.newName, 'sum');
  assert.ok(result.totalOccurrences > 0, 'should find occurrences');
  assert.ok(result.changes.length >= 1, 'should have changes in at least 1 file');
  assert.deepEqual(result.conflicts, []);

  // Verify line content is populated
  const someEdit = result.changes[0].edits[0];
  assert.ok(someEdit.lineContent !== undefined, 'should have lineContent');

  mgr.dispose();
});

test('graph-rename-preview detects naming conflicts', async () => {
  const dir = setupProject();
  const mgr = makeManager(dir);
  await mgr.indexProject();

  const tool = createGraphRenamePreviewTool({ projectGraphManager: mgr });
  // Rename add -> multiply (multiply already exists)
  const result = await tool.execute({ symbol: 'add', newName: 'multiply' });

  assert.equal(result.status, 'conflict');
  assert.ok(result.conflicts.length >= 1, 'should detect naming conflict');

  mgr.dispose();
});

test('graph-rename-preview requires both symbol and newName', async () => {
  const tool = createGraphRenamePreviewTool({
    projectGraphManager: { available: true },
  });

  const r1 = await tool.execute({ newName: 'foo' });
  assert.equal(r1.status, 'error');

  const r2 = await tool.execute({ symbol: 'foo' });
  assert.equal(r2.status, 'error');

  const r3 = await tool.execute({ symbol: 'foo', newName: 'foo' });
  assert.equal(r3.status, 'error');
});

test('graph-rename-preview returns unavailable when manager is null', async () => {
  const tool = createGraphRenamePreviewTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'x', newName: 'y' });
  assert.equal(result.status, 'unavailable');
});
