import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectGraphDb } from '../../src/runtime/analysis/project-graph-db.js';

// ---------------------------------------------------------------------------
// Phase 3: Enhanced symbols schema tests
// ---------------------------------------------------------------------------

test('symbols table accepts signature, doc_comment, scope, start_line, end_line', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1000,
    edges: [],
    symbols: [
      {
        name: 'doSomething',
        kind: 'function',
        isExport: true,
        line: 5,
        signature: '(x: number, y: string): boolean',
        docComment: '/** Does something */',
        scope: null,
        startLine: 5,
        endLine: 15,
      },
    ],
  });

  const node = db.getNode('/project/src/a.js');
  const syms = db.getSymbolsByNode(node.id);
  assert.equal(syms.length, 1);
  assert.equal(syms[0].name, 'doSomething');
  assert.equal(syms[0].signature, '(x: number, y: string): boolean');
  assert.equal(syms[0].doc_comment, '/** Does something */');
  assert.equal(syms[0].scope, null);
  assert.equal(syms[0].start_line, 5);
  assert.equal(syms[0].end_line, 15);
  db.close();
});

test('symbols with class scope store scope correctly', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1000,
    edges: [],
    symbols: [
      { name: 'MyClass', kind: 'class', isExport: true, line: 1, startLine: 1, endLine: 20 },
      { name: 'myMethod', kind: 'method', isExport: false, line: 5, scope: 'MyClass', startLine: 5, endLine: 10 },
      { name: 'myProp', kind: 'property', isExport: false, line: 12, scope: 'MyClass', startLine: 12, endLine: 12 },
    ],
  });

  const node = db.getNode('/project/src/b.js');
  const syms = db.getSymbolsByNode(node.id);
  assert.equal(syms.length, 3);

  const method = syms.find((s) => s.name === 'myMethod');
  assert.ok(method);
  assert.equal(method.scope, 'MyClass');
  assert.equal(method.kind, 'method');

  const prop = syms.find((s) => s.name === 'myProp');
  assert.ok(prop);
  assert.equal(prop.scope, 'MyClass');
  assert.equal(prop.kind, 'property');
  db.close();
});

test('findSymbolByName returns enhanced metadata', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/utils.js',
    mtime: 1,
    edges: [],
    symbols: [
      {
        name: 'formatDate',
        kind: 'function',
        isExport: true,
        line: 3,
        signature: '(date: Date): string',
        docComment: '/** Format a date to ISO string */',
        startLine: 3,
        endLine: 8,
      },
    ],
  });

  const rows = db.findSymbolByName('formatDate');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].signature, '(date: Date): string');
  assert.equal(rows[0].doc_comment, '/** Format a date to ISO string */');
  assert.equal(rows[0].start_line, 3);
  assert.equal(rows[0].end_line, 8);
  db.close();
});

// ---------------------------------------------------------------------------
// Phase 3: symbol_references table tests
// ---------------------------------------------------------------------------

test('replaceRefsForNode stores and retrieves references', () => {
  const db = new ProjectGraphDb(':memory:');

  // File a.js exports foo
  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'foo', kind: 'function', isExport: true, line: 1 }],
  });

  // File b.js imports and uses foo
  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/a.js', edgeType: 'import', line: 1 }],
    symbols: [],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');
  const syms = db.getSymbolsByNode(nodeA.id);
  const fooSymbol = syms.find((s) => s.name === 'foo');
  assert.ok(fooSymbol);

  // Record that b.js references foo at line 5
  db.replaceRefsForNode(nodeB.id, [
    { symbolId: fooSymbol.id, line: 5, col: 2, kind: 'usage' },
    { symbolId: fooSymbol.id, line: 10, col: 0, kind: 'usage' },
  ]);

  const refs = db.getRefsBySymbol(fooSymbol.id);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].line, 5);
  assert.equal(refs[0].col, 2);
  assert.equal(refs[0].kind, 'usage');
  assert.equal(refs[0].path, '/project/src/b.js');
  assert.equal(refs[1].line, 10);

  const stats = db.stats();
  assert.equal(stats.references, 2);
  db.close();
});

test('replaceRefsForNode replaces existing references', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'bar', kind: 'function', isExport: true, line: 1 }],
  });

  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/a.js' }],
    symbols: [],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');
  const barSym = db.getSymbolsByNode(nodeA.id)[0];

  db.replaceRefsForNode(nodeB.id, [
    { symbolId: barSym.id, line: 3, col: 0, kind: 'usage' },
  ]);
  assert.equal(db.getRefsBySymbol(barSym.id).length, 1);

  // Replace with new set
  db.replaceRefsForNode(nodeB.id, [
    { symbolId: barSym.id, line: 7, col: 4, kind: 'type-reference' },
    { symbolId: barSym.id, line: 12, col: 0, kind: 'usage' },
  ]);

  const refs = db.getRefsBySymbol(barSym.id);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].line, 7);
  assert.equal(refs[0].kind, 'type-reference');
  db.close();
});

test('getRefsByNode returns all references within a file', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [
      { name: 'alpha', kind: 'function', isExport: true, line: 1 },
      { name: 'beta', kind: 'function', isExport: true, line: 10 },
    ],
  });

  db.indexFile({
    filePath: '/project/src/c.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/a.js' }],
    symbols: [],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeC = db.getNode('/project/src/c.js');
  const syms = db.getSymbolsByNode(nodeA.id);

  db.replaceRefsForNode(nodeC.id, [
    { symbolId: syms[0].id, line: 3, col: 0, kind: 'usage' },
    { symbolId: syms[1].id, line: 5, col: 2, kind: 'usage' },
  ]);

  const refs = db.getRefsByNode(nodeC.id);
  assert.equal(refs.length, 2);
  db.close();
});

test('deleteNode cascades to symbol_references', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'target', kind: 'function', isExport: true, line: 1 }],
  });

  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/a.js' }],
    symbols: [],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');
  const sym = db.getSymbolsByNode(nodeA.id)[0];

  db.replaceRefsForNode(nodeB.id, [
    { symbolId: sym.id, line: 5, col: 0, kind: 'usage' },
  ]);
  assert.equal(db.stats().references, 1);

  // Delete the source file — should cascade and remove references
  db.deleteNode('/project/src/a.js');
  assert.equal(db.stats().references, 0);
  db.close();
});

// ---------------------------------------------------------------------------
// Phase 3: call_graph table tests
// ---------------------------------------------------------------------------

test('replaceCallsForNode stores and retrieves call graph entries', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/b.js' }],
    symbols: [
      { name: 'main', kind: 'function', isExport: true, line: 3 },
    ],
  });

  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [],
    symbols: [
      { name: 'helper', kind: 'function', isExport: true, line: 1 },
    ],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');
  const mainSym = db.getSymbolsByNode(nodeA.id)[0];

  db.replaceCallsForNode(nodeA.id, [
    { callerSymbolId: mainSym.id, calleeName: 'helper', calleeNodeId: nodeB.id, line: 5 },
    { callerSymbolId: mainSym.id, calleeName: 'console.log', calleeNodeId: null, line: 6 },
  ]);

  const outgoing = db.getCallsFrom(mainSym.id);
  assert.equal(outgoing.length, 2);
  assert.equal(outgoing[0].callee_name, 'helper');
  assert.equal(outgoing[0].callee_path, '/project/src/b.js');
  assert.equal(outgoing[1].callee_name, 'console.log');
  assert.equal(outgoing[1].callee_path, null);

  const stats = db.stats();
  assert.equal(stats.calls, 2);
  db.close();
});

test('getCallsTo returns incoming call hierarchy', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'caller1', kind: 'function', isExport: true, line: 1 }],
  });

  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'caller2', kind: 'function', isExport: true, line: 1 }],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');
  const sym1 = db.getSymbolsByNode(nodeA.id)[0];
  const sym2 = db.getSymbolsByNode(nodeB.id)[0];

  db.replaceCallsForNode(nodeA.id, [
    { callerSymbolId: sym1.id, calleeName: 'target', calleeNodeId: null, line: 3 },
  ]);
  db.replaceCallsForNode(nodeB.id, [
    { callerSymbolId: sym2.id, calleeName: 'target', calleeNodeId: null, line: 5 },
  ]);

  const incoming = db.getCallsTo('target');
  assert.equal(incoming.length, 2);
  const callers = incoming.map((c) => c.caller_name).sort();
  assert.deepEqual(callers, ['caller1', 'caller2']);
  db.close();
});

test('replaceCallsForNode replaces existing calls', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'fn', kind: 'function', isExport: true, line: 1 }],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const fnSym = db.getSymbolsByNode(nodeA.id)[0];

  db.replaceCallsForNode(nodeA.id, [
    { callerSymbolId: fnSym.id, calleeName: 'old', calleeNodeId: null, line: 3 },
  ]);
  assert.equal(db.stats().calls, 1);

  db.replaceCallsForNode(nodeA.id, [
    { callerSymbolId: fnSym.id, calleeName: 'new1', calleeNodeId: null, line: 4 },
    { callerSymbolId: fnSym.id, calleeName: 'new2', calleeNodeId: null, line: 5 },
  ]);
  assert.equal(db.stats().calls, 2);

  const calls = db.getCallsFrom(fnSym.id);
  assert.equal(calls[0].callee_name, 'new1');
  assert.equal(calls[1].callee_name, 'new2');
  db.close();
});

test('deleteNode cascades to call_graph', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'fn', kind: 'function', isExport: true, line: 1 }],
  });

  const nodeA = db.getNode('/project/src/a.js');
  const fnSym = db.getSymbolsByNode(nodeA.id)[0];

  db.replaceCallsForNode(nodeA.id, [
    { callerSymbolId: fnSym.id, calleeName: 'target', calleeNodeId: null, line: 3 },
  ]);
  assert.equal(db.stats().calls, 1);

  db.deleteNode('/project/src/a.js');
  assert.equal(db.stats().calls, 0);
  db.close();
});

// ---------------------------------------------------------------------------
// Phase 3: stats includes new counts
// ---------------------------------------------------------------------------

test('stats returns references and calls counts', () => {
  const db = new ProjectGraphDb(':memory:');
  const stats = db.stats();
  assert.equal(stats.references, 0);
  assert.equal(stats.calls, 0);
  db.close();
});
