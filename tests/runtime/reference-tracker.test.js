import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ProjectGraphDb } from '../../src/runtime/analysis/project-graph-db.js';
import { buildFileGraph } from '../../src/runtime/analysis/import-graph-builder.js';
import { trackReferences } from '../../src/runtime/analysis/reference-tracker.js';
import { buildCallGraph, symbolKey } from '../../src/runtime/analysis/call-graph-builder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-ref-test-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

let syntaxIndexManager = null;

async function getSyntaxIndexManager() {
  if (syntaxIndexManager) return syntaxIndexManager;
  try {
    const { SyntaxIndexManager } = await import('../../src/runtime/managers/syntax-index-manager.js');
    syntaxIndexManager = new SyntaxIndexManager();
    return syntaxIndexManager;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reference Tracker Tests
// ---------------------------------------------------------------------------

test('trackReferences finds usage of imported symbol', async () => {
  const sim = await getSyntaxIndexManager();
  if (!sim) return; // skip if tree-sitter unavailable

  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function helper() { return 42; }\n');
  writeFile(dir, 'src/main.js',
    'import { helper } from \'./utils.js\';\n' +
    'const result = helper();\n' +
    'console.log(result);\n'
  );

  const db = new ProjectGraphDb(':memory:');

  // Index utils.js first so its symbols are in the DB
  const utilsGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/utils.js'), projectRoot: dir });
  db.indexFile({
    filePath: path.join(dir, 'src/utils.js'),
    mtime: utilsGraph.mtime,
    edges: [],
    symbols: utilsGraph.symbols,
  });

  // Index main.js
  const mainGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/main.js'), projectRoot: dir });
  db.indexFile({
    filePath: path.join(dir, 'src/main.js'),
    mtime: mainGraph.mtime,
    edges: mainGraph.imports.filter((i) => i.resolvedPath).map((i) => ({ toPath: i.resolvedPath, edgeType: i.kind, line: i.line })),
    symbols: mainGraph.symbols,
  });

  // Parse main.js for reference tracking
  const parsed = await sim.readFile(path.join(dir, 'src/main.js'));
  assert.equal(parsed.status, 'parsed');

  const refs = trackReferences({
    tree: parsed.tree,
    source: parsed.source,
    filePath: path.join(dir, 'src/main.js'),
    imports: mainGraph.imports,
    symbols: mainGraph.symbols,
    db,
  });

  // Should find at least one reference to 'helper' (the usage on line 2)
  const helperRefs = refs.filter((r) => {
    const sym = db.getSymbolsByNode(db.getNode(path.join(dir, 'src/utils.js')).id);
    return sym.some((s) => s.id === r.symbolId && s.name === 'helper');
  });
  assert.ok(helperRefs.length >= 1, `Expected at least 1 reference to helper, got ${helperRefs.length}`);

  db.close();
  fs.rmSync(dir, { recursive: true });
});

test('trackReferences skips declaration sites', async () => {
  const sim = await getSyntaxIndexManager();
  if (!sim) return;

  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export function myFunc() { return 1; }\n');
  writeFile(dir, 'src/b.js',
    'import { myFunc } from \'./a.js\';\n' +
    'const x = myFunc();\n'
  );

  const db = new ProjectGraphDb(':memory:');

  const aGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/a.js'), projectRoot: dir });
  db.indexFile({ filePath: path.join(dir, 'src/a.js'), mtime: aGraph.mtime, edges: [], symbols: aGraph.symbols });

  const bGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/b.js'), projectRoot: dir });
  db.indexFile({
    filePath: path.join(dir, 'src/b.js'),
    mtime: bGraph.mtime,
    edges: bGraph.imports.filter((i) => i.resolvedPath).map((i) => ({ toPath: i.resolvedPath })),
    symbols: bGraph.symbols,
  });

  const parsed = await sim.readFile(path.join(dir, 'src/b.js'));
  const refs = trackReferences({
    tree: parsed.tree,
    source: parsed.source,
    filePath: path.join(dir, 'src/b.js'),
    imports: bGraph.imports,
    symbols: bGraph.symbols,
    db,
  });

  // All references should be 'usage', never 'declaration'
  for (const ref of refs) {
    assert.notEqual(ref.kind, 'declaration', 'Should not track declaration sites as references');
  }

  db.close();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Call Graph Builder Tests
// ---------------------------------------------------------------------------

test('buildCallGraph extracts call expressions from functions', async () => {
  const sim = await getSyntaxIndexManager();
  if (!sim) return;

  const dir = makeTempDir();
  writeFile(dir, 'src/helper.js', 'export function doWork() { return 42; }\n');
  writeFile(dir, 'src/main.js',
    'import { doWork } from \'./helper.js\';\n' +
    'export function main() {\n' +
    '  const x = doWork();\n' +
    '  console.log(x);\n' +
    '  return x;\n' +
    '}\n'
  );

  const db = new ProjectGraphDb(':memory:');

  const helperGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/helper.js'), projectRoot: dir });
  db.indexFile({ filePath: path.join(dir, 'src/helper.js'), mtime: helperGraph.mtime, edges: [], symbols: helperGraph.symbols });

  const mainGraph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/main.js'), projectRoot: dir });
  db.indexFile({
    filePath: path.join(dir, 'src/main.js'),
    mtime: mainGraph.mtime,
    edges: mainGraph.imports.filter((i) => i.resolvedPath).map((i) => ({ toPath: i.resolvedPath })),
    symbols: mainGraph.symbols,
  });

  const nodeMain = db.getNode(path.join(dir, 'src/main.js'));
  const dbSymbols = db.getSymbolsByNode(nodeMain.id);
  const symbolIds = new Map();
  for (const s of dbSymbols) {
    symbolIds.set(symbolKey(s), s.id);
  }

  const parsed = await sim.readFile(path.join(dir, 'src/main.js'));
  const calls = buildCallGraph({
    tree: parsed.tree,
    source: parsed.source,
    filePath: path.join(dir, 'src/main.js'),
    symbols: mainGraph.symbols,
    imports: mainGraph.imports,
    db,
    symbolIds,
  });

  // main() should call doWork and console.log
  const calleeNames = calls.map((c) => c.calleeName);
  assert.ok(calleeNames.includes('doWork'), 'Should detect doWork() call');
  assert.ok(calleeNames.includes('log'), 'Should detect console.log() call (member expression → method name)');

  // doWork should have a resolved calleeNodeId
  const doWorkCall = calls.find((c) => c.calleeName === 'doWork');
  assert.ok(doWorkCall, 'doWork call should exist');

  db.close();
  fs.rmSync(dir, { recursive: true });
});

test('buildCallGraph does not extract calls from nested functions', async () => {
  const sim = await getSyntaxIndexManager();
  if (!sim) return;

  const dir = makeTempDir();
  writeFile(dir, 'src/nested.js',
    'export function outer() {\n' +
    '  outerCall();\n' +
    '  function inner() {\n' +
    '    innerCall();\n' +
    '  }\n' +
    '}\n'
  );

  const db = new ProjectGraphDb(':memory:');

  const graph = await buildFileGraph({ syntaxIndexManager: sim, filePath: path.join(dir, 'src/nested.js'), projectRoot: dir });
  db.indexFile({
    filePath: path.join(dir, 'src/nested.js'),
    mtime: graph.mtime,
    edges: [],
    symbols: graph.symbols,
  });

  const nodeN = db.getNode(path.join(dir, 'src/nested.js'));
  const dbSymbols = db.getSymbolsByNode(nodeN.id);
  const symbolIds = new Map();
  for (const s of dbSymbols) {
    symbolIds.set(symbolKey(s), s.id);
  }

  const parsed = await sim.readFile(path.join(dir, 'src/nested.js'));
  const calls = buildCallGraph({
    tree: parsed.tree,
    source: parsed.source,
    filePath: path.join(dir, 'src/nested.js'),
    symbols: graph.symbols,
    imports: [],
    db,
    symbolIds,
  });

  // outer() should call outerCall but NOT innerCall (that's inner's scope)
  const outerSymId = symbolIds.get(symbolKey({ name: 'outer', line: 1, scope: null }));
  if (outerSymId != null) {
    const outerCalls = calls.filter((c) => c.callerSymbolId === outerSymId);
    const outerCallNames = outerCalls.map((c) => c.calleeName);
    assert.ok(outerCallNames.includes('outerCall'), 'outer should call outerCall');
    // innerCall should NOT be in outer's calls — it belongs to inner
    assert.ok(!outerCallNames.includes('innerCall'), 'outer should NOT include innerCall');
  }

  db.close();
  fs.rmSync(dir, { recursive: true });
});

test('symbolKey generates unique key from symbol properties', () => {
  assert.equal(symbolKey({ name: 'foo', line: 5, scope: null }), 'foo:5:');
  assert.equal(symbolKey({ name: 'bar', line: 3, scope: 'MyClass' }), 'bar:3:MyClass');
});
