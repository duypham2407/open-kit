import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { buildFileGraph } from '../../src/runtime/analysis/import-graph-builder.js';
import { extractReferences } from '../../src/runtime/analysis/reference-tracker.js';
import { extractCallEdges } from '../../src/runtime/analysis/call-graph-builder.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-ref-tracker-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

// ---------------------------------------------------------------------------
// Reference tracker tests
// ---------------------------------------------------------------------------

test('extractReferences finds usage references', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `
const x = 10;
const y = x + 5;
console.log(y);
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const refs = extractReferences({ tree: parsed.tree, source: parsed.source });

  // x is used in the second line
  const xRefs = refs.filter((r) => r.name === 'x' && r.refKind === 'usage');
  assert.ok(xRefs.length >= 1, 'should find at least 1 usage of x');

  // y is used in console.log
  const yRefs = refs.filter((r) => r.name === 'y' && r.refKind === 'usage');
  assert.ok(yRefs.length >= 1, 'should find at least 1 usage of y');
});

test('extractReferences classifies assignment refs', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/assign.js', `
let counter = 0;
counter = counter + 1;
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const refs = extractReferences({ tree: parsed.tree, source: parsed.source });

  const assignmentRefs = refs.filter((r) => r.name === 'counter' && r.refKind === 'assignment');
  assert.ok(assignmentRefs.length >= 1, 'should find assignment of counter');
});

test('extractReferences skips declaration names', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/decl.js', `
function myFunc() {
  return 42;
}
const result = myFunc();
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const refs = extractReferences({ tree: parsed.tree, source: parsed.source });

  // myFunc should appear as usage (call) but NOT as declaration
  const myFuncRefs = refs.filter((r) => r.name === 'myFunc');
  // The declaration name should not appear as a ref
  assert.ok(myFuncRefs.length >= 1, 'should find at least 1 reference to myFunc');
  // All should be usage (not declaration)
  for (const r of myFuncRefs) {
    assert.ok(r.refKind === 'usage', `myFunc ref should be 'usage', got '${r.refKind}'`);
  }
});

test('extractReferences returns line and col', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/loc.js', `const a = 1;
const b = a;
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const refs = extractReferences({ tree: parsed.tree, source: parsed.source });

  const aRef = refs.find((r) => r.name === 'a' && r.refKind === 'usage');
  assert.ok(aRef);
  assert.equal(aRef.line, 2); // 1-indexed
  assert.ok(typeof aRef.col === 'number');
});

// ---------------------------------------------------------------------------
// Call graph builder tests
// ---------------------------------------------------------------------------

test('extractCallEdges finds direct function calls', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/calls.js', `
function helper() { return 1; }
function main() {
  const x = helper();
  console.log(x);
}
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const calls = extractCallEdges({ tree: parsed.tree, source: parsed.source });

  const helperCall = calls.find((c) => c.calleeName === 'helper');
  assert.ok(helperCall, 'should find call to helper');
  assert.equal(helperCall.callerSymbolName, 'main');
  assert.ok(helperCall.line > 0);

  const logCall = calls.find((c) => c.calleeName === 'console.log');
  assert.ok(logCall, 'should find call to console.log');
  assert.equal(logCall.callerSymbolName, 'main');
});

test('extractCallEdges identifies module-level calls', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/toplevel.js', `
doSetup();
const result = compute(42);
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const calls = extractCallEdges({ tree: parsed.tree, source: parsed.source });

  const setupCall = calls.find((c) => c.calleeName === 'doSetup');
  assert.ok(setupCall);
  assert.equal(setupCall.callerSymbolName, '<module>');

  const computeCall = calls.find((c) => c.calleeName === 'compute');
  assert.ok(computeCall);
  assert.equal(computeCall.callerSymbolName, '<module>');
});

test('extractCallEdges finds calls inside arrow functions', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/arrow.js', `
const handler = () => {
  process();
};
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const parsed = await mgr.readFile(filePath);
  const calls = extractCallEdges({ tree: parsed.tree, source: parsed.source });

  const processCall = calls.find((c) => c.calleeName === 'process');
  assert.ok(processCall, 'should find call inside arrow function');
  assert.equal(processCall.callerSymbolName, 'handler');
});

// ---------------------------------------------------------------------------
// Enriched symbol extraction tests (via buildFileGraph)
// ---------------------------------------------------------------------------

test('buildFileGraph returns enriched symbol metadata', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/enriched.js', `
/** Adds two numbers */
export function add(a, b) {
  return a + b;
}

export class Calculator {
  multiply(x, y) {
    return x * y;
  }
}

const PI = 3.14159;
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  assert.ok(result);

  // Check function enrichment
  const addSym = result.symbols.find((s) => s.name === 'add');
  assert.ok(addSym);
  assert.ok(addSym.signature, 'should have a signature');
  assert.ok(addSym.signature.includes('('), 'signature should include params');
  assert.ok(addSym.startLine > 0, 'should have startLine');
  assert.ok(addSym.endLine >= addSym.startLine, 'endLine >= startLine');
  assert.equal(addSym.scope, 'module');

  // Check class enrichment
  const calcSym = result.symbols.find((s) => s.name === 'Calculator');
  assert.ok(calcSym);
  assert.equal(calcSym.kind, 'class');
  assert.ok(calcSym.startLine > 0);

  // Check class method extraction
  const multiplySym = result.symbols.find((s) => s.name === 'multiply');
  assert.ok(multiplySym, 'should extract class method');
  assert.equal(multiplySym.kind, 'method');
  assert.equal(multiplySym.scope, 'Calculator');
});

test('buildFileGraph returns refs and callEdges', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function helper() { return 1; }');
  const filePath = writeFile(dir, 'src/main.js', `
import { helper } from './utils.js';
const result = helper();
console.log(result);
`);
  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  assert.ok(result);
  assert.ok(Array.isArray(result.refs), 'should have refs array');
  assert.ok(result.refs.length > 0, 'should have at least 1 reference');

  assert.ok(Array.isArray(result.callEdges), 'should have callEdges array');
  const helperCall = result.callEdges.find((c) => c.calleeName === 'helper');
  assert.ok(helperCall, 'should have call to helper');
});

// ---------------------------------------------------------------------------
// DB integration: refs and call edges stored and retrieved
// ---------------------------------------------------------------------------

import { ProjectGraphDb } from '../../src/runtime/analysis/project-graph-db.js';

test('ProjectGraphDb stores and retrieves symbol_refs', () => {
  const db = new ProjectGraphDb(':memory:');

  const node = db.upsertNode({ filePath: '/p/a.js', kind: 'module', mtime: 1 });
  db.replaceRefsFor(node.id, [
    { name: 'foo', line: 5, col: 3, refKind: 'usage' },
    { name: 'Bar', line: 8, col: 0, refKind: 'type-ref' },
  ]);

  const refs = db.getRefsByNode(node.id);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].name, 'foo');
  assert.equal(refs[0].ref_kind, 'usage');
  assert.equal(refs[1].name, 'Bar');
  assert.equal(refs[1].ref_kind, 'type-ref');

  // Query by name
  const fooRefs = db.getRefsByName('foo');
  assert.equal(fooRefs.length, 1);
  assert.equal(fooRefs[0].path, '/p/a.js');

  // Stats
  const stats = db.stats();
  assert.equal(stats.refs, 2);

  db.close();
});

test('ProjectGraphDb stores and retrieves call_edges', () => {
  const db = new ProjectGraphDb(':memory:');

  const node = db.upsertNode({ filePath: '/p/a.js', kind: 'module', mtime: 1 });
  db.replaceCallEdgesFor(node.id, [
    { callerSymbolName: 'main', calleeName: 'helper', line: 10 },
    { callerSymbolName: 'main', calleeName: 'console.log', line: 12 },
  ]);

  const callerEdges = db.getCallEdgesByCaller(node.id);
  assert.equal(callerEdges.length, 2);
  assert.equal(callerEdges[0].callee_name, 'helper');
  assert.equal(callerEdges[1].callee_name, 'console.log');

  const helperCallers = db.getCallEdgesByCallee('helper');
  assert.equal(helperCallers.length, 1);
  assert.equal(helperCallers[0].caller_symbol_name, 'main');

  const stats = db.stats();
  assert.equal(stats.callEdges, 2);

  db.close();
});

test('ProjectGraphDb indexFile stores refs and callEdges via transaction', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/p/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'foo', kind: 'function', isExport: true, line: 1 }],
    refs: [
      { name: 'bar', line: 5, col: 0, refKind: 'usage' },
    ],
    callEdges: [
      { callerSymbolName: 'foo', calleeName: 'bar', line: 5 },
    ],
  });

  const stats = db.stats();
  assert.equal(stats.refs, 1);
  assert.equal(stats.callEdges, 1);

  db.close();
});

test('ProjectGraphDb cascade deletes refs and call_edges when node is deleted', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/p/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'x', kind: 'variable', isExport: false, line: 1 }],
    refs: [{ name: 'y', line: 2, col: 0, refKind: 'usage' }],
    callEdges: [{ callerSymbolName: 'x', calleeName: 'y', line: 3 }],
  });

  assert.equal(db.stats().refs, 1);
  assert.equal(db.stats().callEdges, 1);

  db.deleteNode('/p/a.js');

  assert.equal(db.stats().refs, 0);
  assert.equal(db.stats().callEdges, 0);

  db.close();
});

test('ProjectGraphDb enriched symbols round-trip', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/p/a.js',
    mtime: 1,
    edges: [],
    symbols: [{
      name: 'add',
      kind: 'function',
      isExport: true,
      line: 3,
      signature: 'add(a, b)',
      docComment: '/** Adds two numbers */',
      scope: 'module',
      startLine: 3,
      endLine: 5,
    }],
  });

  const node = db.getNode('/p/a.js');
  const syms = db.getSymbolsByNode(node.id);
  assert.equal(syms.length, 1);
  assert.equal(syms[0].signature, 'add(a, b)');
  assert.equal(syms[0].doc_comment, '/** Adds two numbers */');
  assert.equal(syms[0].scope, 'module');
  assert.equal(syms[0].start_line, 3);
  assert.equal(syms[0].end_line, 5);

  // findSymbolByName also returns enriched columns
  const found = db.findSymbolByName('add');
  assert.equal(found.length, 1);
  assert.equal(found[0].signature, 'add(a, b)');

  db.close();
});

test('ProjectGraphDb schema version is set', () => {
  const db = new ProjectGraphDb(':memory:');
  // Access the raw db to check user_version
  const version = db._db.pragma('user_version', { simple: true });
  assert.equal(version, 1);
  db.close();
});
