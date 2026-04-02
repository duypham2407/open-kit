import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectGraphDb, isBetterSqliteAvailable } from '../../src/runtime/analysis/project-graph-db.js';

test('isBetterSqliteAvailable returns true when better-sqlite3 is installed', () => {
  assert.equal(isBetterSqliteAvailable(), true);
});

test('ProjectGraphDb creates in-memory DB and applies schema', () => {
  const db = new ProjectGraphDb(':memory:');
  const stats = db.stats();
  assert.equal(stats.nodes, 0);
  assert.equal(stats.edges, 0);
  assert.equal(stats.symbols, 0);
  db.close();
});

test('upsertNode inserts and retrieves a node', () => {
  const db = new ProjectGraphDb(':memory:');
  const node = db.upsertNode({ filePath: '/project/src/index.js', kind: 'module', mtime: 1000 });
  assert.ok(node);
  assert.equal(node.path, '/project/src/index.js');
  assert.equal(node.kind, 'module');
  assert.equal(node.mtime, 1000);
  db.close();
});

test('upsertNode updates mtime on conflict', () => {
  const db = new ProjectGraphDb(':memory:');
  db.upsertNode({ filePath: '/project/src/index.js', kind: 'module', mtime: 1000 });
  const updated = db.upsertNode({ filePath: '/project/src/index.js', kind: 'module', mtime: 2000 });
  assert.equal(updated.mtime, 2000);
  assert.equal(db.stats().nodes, 1);
  db.close();
});

test('getNode returns null for unknown path', () => {
  const db = new ProjectGraphDb(':memory:');
  assert.equal(db.getNode('/does/not/exist.js'), null);
  db.close();
});

test('indexFile stores node, edges, and symbols atomically', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1000,
    edges: [
      { toPath: '/project/src/b.js', edgeType: 'import', line: 1 },
    ],
    symbols: [
      { name: 'doSomething', kind: 'function', isExport: true, line: 3 },
    ],
  });

  assert.equal(db.stats().nodes, 2); // a.js + b.js (stub)
  assert.equal(db.stats().edges, 1);
  assert.equal(db.stats().symbols, 1);

  const nodeA = db.getNode('/project/src/a.js');
  assert.ok(nodeA);

  const deps = db.getDependencies(nodeA.id);
  assert.equal(deps.length, 1);
  assert.equal(deps[0].path, '/project/src/b.js');
  assert.equal(deps[0].edge_type, 'import');

  const syms = db.getSymbolsByNode(nodeA.id);
  assert.equal(syms.length, 1);
  assert.equal(syms[0].name, 'doSomething');
  assert.equal(syms[0].kind, 'function');
  assert.equal(syms[0].is_export, 1);

  db.close();
});

test('getDependents returns reverse edges', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1000,
    edges: [{ toPath: '/project/src/b.js', edgeType: 'import', line: 1 }],
    symbols: [],
  });

  const nodeB = db.getNode('/project/src/b.js');
  assert.ok(nodeB);

  const dependents = db.getDependents(nodeB.id);
  assert.equal(dependents.length, 1);
  assert.equal(dependents[0].path, '/project/src/a.js');
  db.close();
});

test('replaceEdgesFrom replaces all outgoing edges for a node', () => {
  const db = new ProjectGraphDb(':memory:');

  const nodeA = db.upsertNode({ filePath: '/project/src/a.js', kind: 'module', mtime: 1 });
  const nodeB = db.upsertNode({ filePath: '/project/src/b.js', kind: 'module', mtime: 1 });
  const nodeC = db.upsertNode({ filePath: '/project/src/c.js', kind: 'module', mtime: 1 });

  db.replaceEdgesFrom(nodeA.id, [
    { toNodeId: nodeB.id, edgeType: 'import', line: 1 },
  ]);
  assert.equal(db.getDependencies(nodeA.id).length, 1);

  db.replaceEdgesFrom(nodeA.id, [
    { toNodeId: nodeC.id, edgeType: 'import', line: 2 },
  ]);
  const deps = db.getDependencies(nodeA.id);
  assert.equal(deps.length, 1);
  assert.equal(deps[0].path, '/project/src/c.js');
  db.close();
});

test('findSymbolByName returns all files containing the symbol', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'MyClass', kind: 'class', isExport: true, line: 5 }],
  });
  db.indexFile({
    filePath: '/project/src/b.js',
    mtime: 1,
    edges: [],
    symbols: [{ name: 'MyClass', kind: 'class', isExport: false, line: 10 }],
  });

  const rows = db.findSymbolByName('MyClass');
  assert.equal(rows.length, 2);
  const paths = rows.map((r) => r.path).sort();
  assert.deepEqual(paths, ['/project/src/a.js', '/project/src/b.js']);
  db.close();
});

test('deleteNode removes node and cascades to edges and symbols', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [{ toPath: '/project/src/b.js', edgeType: 'import', line: 1 }],
    symbols: [{ name: 'foo', kind: 'function', isExport: true, line: 2 }],
  });

  const nodeA = db.getNode('/project/src/a.js');
  assert.ok(nodeA);
  db.deleteNode('/project/src/a.js');
  assert.equal(db.getNode('/project/src/a.js'), null);
  assert.equal(db.getDependencies(nodeA.id).length, 0);
  assert.equal(db.getSymbolsByNode(nodeA.id).length, 0);
  db.close();
});

test('stats returns correct counts after operations', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [
      { toPath: '/project/src/b.js', edgeType: 'import', line: 1 },
      { toPath: '/project/src/c.js', edgeType: 'import', line: 2 },
    ],
    symbols: [
      { name: 'foo', kind: 'function', isExport: true, line: 3 },
      { name: 'bar', kind: 'variable', isExport: false, line: 4 },
    ],
  });

  const stats = db.stats();
  assert.equal(stats.nodes, 3); // a.js + b.js (stub) + c.js (stub)
  assert.equal(stats.edges, 2);
  assert.equal(stats.symbols, 2);
  db.close();
});
