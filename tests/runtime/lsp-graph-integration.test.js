import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';
import { toSymbolInfo, toLocation, toReferenceLocation, toWorkspaceEdit } from '../../src/runtime/analysis/lsp-formatters.js';
import { FileWatcher } from '../../src/runtime/analysis/file-watcher.js';

// LSP tool factories
import { createLspSymbolsTool } from '../../src/runtime/tools/lsp/lsp-symbols.js';
import { createLspGotoDefinitionTool } from '../../src/runtime/tools/lsp/lsp-goto-definition.js';
import { createLspFindReferencesTool } from '../../src/runtime/tools/lsp/lsp-find-references.js';
import { createLspDiagnosticsTool } from '../../src/runtime/tools/lsp/lsp-diagnostics.js';
import { createLspPrepareRenameTool } from '../../src/runtime/tools/lsp/lsp-prepare-rename.js';
import { createLspRenameTool } from '../../src/runtime/tools/lsp/lsp-rename.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-lsp-graph-'));
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
    'export function formatValue(val) {\n' +
    '  return String(val);\n' +
    '}\n'
  );

  writeFile(dir, 'src/main.js',
    'import { formatValue } from \'./utils.js\';\n' +
    'export function main() {\n' +
    '  return formatValue(42);\n' +
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
  return { dir, manager, sim };
}

// ---------------------------------------------------------------------------
// LSP Formatter tests
// ---------------------------------------------------------------------------

test('toSymbolInfo converts DB row to LSP-compatible symbol', () => {
  const row = {
    name: 'MyFunc',
    kind: 'function',
    path: '/project/src/utils.js',
    line: 5,
    is_export: 1,
    signature: '(x: number): string',
    doc_comment: '/** My func */',
  };
  const result = toSymbolInfo(row, '/project');
  assert.equal(result.symbol, 'MyFunc');
  assert.equal(result.kind, 'function');
  assert.equal(result.filePath, 'src/utils.js');
  assert.equal(result.line, 5);
  assert.equal(result.isExport, true);
  assert.equal(result.signature, '(x: number): string');
});

test('toLocation converts DB row to LSP Location', () => {
  const row = { path: '/project/src/a.js', line: 10, start_line: 10, end_line: 20 };
  const loc = toLocation(row, '/project');
  assert.equal(loc.uri, 'src/a.js');
  assert.equal(loc.range.start.line, 9); // 0-indexed
  assert.equal(loc.range.end.line, 19);
});

test('toReferenceLocation converts ref to LSP Location', () => {
  const ref = { path: '/project/src/b.js', line: 5, col: 3 };
  const loc = toReferenceLocation(ref, '/project');
  assert.equal(loc.uri, 'src/b.js');
  assert.equal(loc.range.start.line, 4);
  assert.equal(loc.range.start.character, 3);
});

test('toWorkspaceEdit converts rename preview', () => {
  const preview = {
    changes: [
      {
        path: 'src/a.js',
        edits: [{ line: 5, oldText: 'foo', newText: 'bar' }],
      },
    ],
  };
  const edit = toWorkspaceEdit(preview);
  assert.ok(edit.changes['src/a.js']);
  assert.equal(edit.changes['src/a.js'][0].newText, 'bar');
});

// ---------------------------------------------------------------------------
// LSP tools with graph fallback tests
// ---------------------------------------------------------------------------

test('lsp-symbols uses graph-backed provider when graph is available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspSymbolsTool({ projectRoot: dir, projectGraphManager: manager });

  assert.equal(tool.status, 'active');
  const result = tool.execute({ symbol: 'formatValue' });
  assert.equal(result.status, 'graph-backed');
  assert.equal(result.provider, 'project-graph');
  assert.ok(result.symbols.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-symbols falls back to heuristic without graph', () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export function hello() {}\n');

  const tool = createLspSymbolsTool({ projectRoot: dir, projectGraphManager: null });
  assert.equal(tool.status, 'degraded');
  const result = tool.execute({});
  assert.equal(result.status, 'heuristic');

  fs.rmSync(dir, { recursive: true });
});

test('lsp-goto-definition uses graph-backed when available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspGotoDefinitionTool({ projectRoot: dir, projectGraphManager: manager });

  assert.equal(tool.status, 'active');
  const result = tool.execute({ symbol: 'formatValue' });
  assert.equal(result.status, 'graph-backed');
  assert.ok(result.definitions.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-goto-definition falls back to heuristic without graph', () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export function hello() {}\n');

  const tool = createLspGotoDefinitionTool({ projectRoot: dir });
  const result = tool.execute({ symbol: 'hello' });
  assert.equal(result.status, 'heuristic');

  fs.rmSync(dir, { recursive: true });
});

test('lsp-find-references uses graph-backed when available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspFindReferencesTool({ projectRoot: dir, projectGraphManager: manager });

  assert.equal(tool.status, 'active');
  const result = tool.execute({ symbol: 'formatValue' });
  assert.equal(result.status, 'graph-backed');
  assert.ok(result.definitions);
  assert.ok(typeof result.totalCount === 'number');
  assert.equal(result.scopeFiltered, true);
  assert.equal(result.importScoped, true);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-find-references requires symbol', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspFindReferencesTool({ projectRoot: dir, projectGraphManager: manager });
  const result = tool.execute({});
  assert.equal(result.status, 'error');
  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-diagnostics reports graph-aware status when graph available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspDiagnosticsTool({ projectRoot: dir, projectGraphManager: manager });

  assert.equal(tool.status, 'active');
  const result = tool.execute();
  assert.equal(result.status, 'graph-aware');
  assert.equal(result.provider, 'heuristic+graph');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-prepare-rename uses graph-backed when available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspPrepareRenameTool({ projectRoot: dir, projectGraphManager: manager });

  const result = tool.execute({ symbol: 'formatValue', newName: 'formatVal' });
  assert.equal(result.status, 'graph-backed');
  assert.ok(result.definitions);
  assert.equal(result.scopeFiltered, true);
  assert.equal(result.importScoped, true);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('lsp-rename uses graph-backed when available', async () => {
  const { dir, manager } = await createIndexedProject();
  const tool = createLspRenameTool({ projectRoot: dir, projectGraphManager: manager });

  const result = tool.execute({ symbol: 'formatValue', newName: 'formatVal' });
  assert.equal(result.status, 'preview-only');
  assert.equal(result.provider, 'project-graph');
  assert.ok(result.definitions);
  assert.ok(typeof result.filesAffected === 'number');
  assert.equal(result.scopeFiltered, true);
  assert.equal(result.importScoped, true);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// File Watcher tests
// ---------------------------------------------------------------------------

test('FileWatcher starts and stops cleanly', () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');

  const watcher = new FileWatcher({
    projectRoot: dir,
    projectGraphManager: { available: false },
    debounceMs: 50,
  });

  watcher.start();
  const desc = watcher.describe();
  assert.equal(desc.active, true);

  watcher.stop();
  assert.equal(watcher.describe().active, false);

  fs.rmSync(dir, { recursive: true });
});

test('FileWatcher debounces file changes', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');

  let indexCount = 0;
  const mockManager = {
    available: true,
    async indexFile() { indexCount++; },
  };

  const watcher = new FileWatcher({
    projectRoot: dir,
    projectGraphManager: mockManager,
    debounceMs: 50,
    watchDirs: [dir],
  });

  watcher.start();

  // Simulate rapid file changes by calling _onFileChange directly
  const filePath = path.join(dir, 'src/a.js');
  watcher._onFileChange(filePath);
  watcher._onFileChange(filePath);
  watcher._onFileChange(filePath);

  // Wait for debounce
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Should have called indexFile only once (debounced)
  assert.equal(indexCount, 1, 'Should debounce to a single index call');

  watcher.stop();
  fs.rmSync(dir, { recursive: true });
});

test('FileWatcher ignores non-source files', () => {
  const dir = makeTempDir();
  const watcher = new FileWatcher({
    projectRoot: dir,
    projectGraphManager: { available: true },
    debounceMs: 50,
  });

  watcher.start();

  // These should not create pending entries
  watcher._onFileChange(path.join(dir, 'README.md'));
  watcher._onFileChange(path.join(dir, 'package.json'));
  watcher._onFileChange(path.join(dir, 'image.png'));
  assert.equal(watcher.describe().pendingUpdates, 0);

  // This should create a pending entry
  watcher._onFileChange(path.join(dir, 'src/a.js'));
  assert.equal(watcher.describe().pendingUpdates, 1);

  watcher.stop();
});

test('FileWatcher ignores node_modules and .git', () => {
  const dir = makeTempDir();
  const watcher = new FileWatcher({
    projectRoot: dir,
    projectGraphManager: { available: true },
    debounceMs: 50,
  });

  watcher.start();
  watcher._onFileChange(path.join(dir, 'node_modules/foo/index.js'));
  watcher._onFileChange(path.join(dir, '.git/hooks/pre-commit.js'));
  watcher._onFileChange(path.join(dir, '.opencode/workflow-state.js'));
  assert.equal(watcher.describe().pendingUpdates, 0);
  watcher.stop();
});
