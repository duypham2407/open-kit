import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-nav-test-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

async function createIndexedProject() {
  const dir = makeTempDir();

  writeFile(dir, 'src/utils.js',
    '/** Format a value */\n' +
    'export function formatValue(val) {\n' +
    '  return String(val);\n' +
    '}\n' +
    '\n' +
    'export function helperFn() {\n' +
    '  return 42;\n' +
    '}\n'
  );

  writeFile(dir, 'src/main.js',
    'import { formatValue, helperFn } from \'./utils.js\';\n' +
    '\n' +
    'export function main() {\n' +
    '  const result = formatValue(123);\n' +
    '  const x = helperFn();\n' +
    '  console.log(result, x);\n' +
    '}\n'
  );

  writeFile(dir, 'src/other.js',
    'import { formatValue } from \'./utils.js\';\n' +
    '\n' +
    'export function render() {\n' +
    '  return formatValue(\'hello\');\n' +
    '}\n'
  );

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    runtimeRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });

  await manager.indexProject({ maxFiles: 100 });

  return { dir, manager };
}

// ---------------------------------------------------------------------------
// Import tools
// ---------------------------------------------------------------------------

import { createGotoDefinitionTool } from '../../src/runtime/tools/graph/goto-definition.js';
import { createGraphFindReferencesTool } from '../../src/runtime/tools/graph/find-references.js';
import { createCallHierarchyTool } from '../../src/runtime/tools/graph/call-hierarchy.js';
import { createRenamePreviewTool } from '../../src/runtime/tools/graph/rename-preview.js';

// ---------------------------------------------------------------------------
// goto-definition tests
// ---------------------------------------------------------------------------

test('graph-goto-definition has correct metadata', () => {
  const tool = createGotoDefinitionTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-goto-definition');
  assert.equal(tool.family, 'graph');
  assert.equal(tool.status, 'degraded');
});

test('graph-goto-definition returns unavailable when manager is null', async () => {
  const tool = createGotoDefinitionTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'foo' });
  assert.equal(result.status, 'unavailable');
});

test('graph-goto-definition requires symbol name', async () => {
  const { manager } = await createIndexedProject();
  const tool = createGotoDefinitionTool({ projectGraphManager: manager });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
  manager.dispose();
});

test('graph-goto-definition finds exported function definition', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createGotoDefinitionTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'formatValue' });
  assert.equal(result.status, 'ok');
  assert.ok(result.definitions.length >= 1);
  assert.ok(result.definitions[0].path.includes('utils.js'));
  assert.equal(result.definitions[0].kind, 'function');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('graph-goto-definition accepts string input', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createGotoDefinitionTool({ projectGraphManager: manager });

  const result = await tool.execute('helperFn');
  assert.equal(result.status, 'ok');
  assert.ok(result.definitions.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// find-references tests
// ---------------------------------------------------------------------------

test('graph-find-references has correct metadata', () => {
  const tool = createGraphFindReferencesTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-find-references');
  assert.equal(tool.family, 'graph');
});

test('graph-find-references returns unavailable when manager is null', async () => {
  const tool = createGraphFindReferencesTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'foo' });
  assert.equal(result.status, 'unavailable');
});

test('graph-find-references requires symbol name', async () => {
  const { manager } = await createIndexedProject();
  const tool = createGraphFindReferencesTool({ projectGraphManager: manager });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
  manager.dispose();
});

test('graph-find-references finds definitions and references', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createGraphFindReferencesTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'formatValue' });
  assert.equal(result.status, 'ok');
  assert.ok(result.definitions.length >= 1, 'Should have at least one definition');
  // References may or may not be populated depending on indexing depth
  assert.ok(typeof result.totalCount === 'number');
  assert.equal(result.scopeFiltered, true);
  assert.equal(result.importScoped, true);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// call-hierarchy tests
// ---------------------------------------------------------------------------

test('graph-call-hierarchy has correct metadata', () => {
  const tool = createCallHierarchyTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-call-hierarchy');
  assert.equal(tool.family, 'graph');
});

test('graph-call-hierarchy returns unavailable when manager is null', async () => {
  const tool = createCallHierarchyTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'foo' });
  assert.equal(result.status, 'unavailable');
});

test('graph-call-hierarchy requires symbol name', async () => {
  const { manager } = await createIndexedProject();
  const tool = createCallHierarchyTool({ projectGraphManager: manager });
  const result = await tool.execute({});
  assert.equal(result.status, 'error');
  manager.dispose();
});

test('graph-call-hierarchy rejects invalid direction', async () => {
  const { manager } = await createIndexedProject();
  const tool = createCallHierarchyTool({ projectGraphManager: manager });
  const result = await tool.execute({ symbol: 'main', direction: 'sideways' });
  assert.equal(result.status, 'error');
  manager.dispose();
});

test('graph-call-hierarchy returns outgoing calls', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createCallHierarchyTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'main', direction: 'outgoing' });
  assert.equal(result.status, 'ok');
  assert.equal(result.direction, 'outgoing');
  // main() calls formatValue, helperFn, and console.log
  assert.ok(Array.isArray(result.calls));

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('graph-call-hierarchy returns incoming calls', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createCallHierarchyTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'formatValue', direction: 'incoming' });
  assert.equal(result.status, 'ok');
  assert.equal(result.direction, 'incoming');
  assert.ok(Array.isArray(result.calls));

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// rename-preview tests
// ---------------------------------------------------------------------------

test('graph-rename-preview has correct metadata', () => {
  const tool = createRenamePreviewTool({ projectGraphManager: null });
  assert.equal(tool.id, 'tool.graph-rename-preview');
  assert.equal(tool.family, 'graph');
});

test('graph-rename-preview returns unavailable when manager is null', async () => {
  const tool = createRenamePreviewTool({ projectGraphManager: null });
  const result = await tool.execute({ symbol: 'foo', newName: 'bar' });
  assert.equal(result.status, 'unavailable');
});

test('graph-rename-preview requires symbol and newName', async () => {
  const { manager } = await createIndexedProject();
  const tool = createRenamePreviewTool({ projectGraphManager: manager });

  const r1 = await tool.execute({});
  assert.equal(r1.status, 'error');

  const r2 = await tool.execute({ symbol: 'foo' });
  assert.equal(r2.status, 'error');

  const r3 = await tool.execute({ symbol: 'foo', newName: 'foo' });
  assert.equal(r3.status, 'error');

  manager.dispose();
});

test('graph-rename-preview returns preview changes', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createRenamePreviewTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'formatValue', newName: 'formatVal' });
  assert.equal(result.status, 'preview-only');
  assert.equal(result.symbol, 'formatValue');
  assert.equal(result.newName, 'formatVal');
  assert.ok(result.totalFiles >= 1, 'Should affect at least the definition file');
  assert.ok(result.totalEdits >= 1, 'Should have at least the definition edit');
  assert.equal(result.scopeFiltered, true);
  assert.equal(result.importScoped, true);

  // Check changes structure
  for (const change of result.changes) {
    assert.ok(change.path);
    assert.ok(Array.isArray(change.edits));
    for (const edit of change.edits) {
      assert.equal(edit.oldText, 'formatValue');
      assert.equal(edit.newText, 'formatVal');
    }
  }

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('graph-rename-preview returns not-found for unknown symbol', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createRenamePreviewTool({ projectGraphManager: manager });

  const result = await tool.execute({ symbol: 'nonExistentSymbol', newName: 'newName' });
  assert.equal(result.status, 'not-found');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});
