import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ProjectGraphDb } from '../../src/runtime/analysis/project-graph-db.js';
import { extractCodeChunks, cosineSimilarity } from '../../src/runtime/analysis/code-chunk-extractor.js';
import { MockEmbeddingProvider } from '../../src/runtime/analysis/embedding-provider.js';
import { EmbeddingIndexer } from '../../src/runtime/analysis/embedding-indexer.js';
import { SessionMemoryManager } from '../../src/runtime/managers/session-memory-manager.js';
import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { ProjectGraphManager } from '../../src/runtime/managers/project-graph-manager.js';
import { createSemanticSearchTool } from '../../src/runtime/tools/graph/semantic-search.js';
import { createEmbeddingIndexTool } from '../../src/runtime/tools/analysis/embedding-index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-semantic-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

// ---------------------------------------------------------------------------
// Code Chunk Extractor Tests
// ---------------------------------------------------------------------------

test('extractCodeChunks produces chunks for functions with line ranges', () => {
  const source =
    'import { foo } from \'./foo.js\';\n' +
    '\n' +
    'export function doWork(x) {\n' +
    '  return foo(x) + 1;\n' +
    '}\n' +
    '\n' +
    'export function helper() {\n' +
    '  return 42;\n' +
    '}\n';

  const chunks = extractCodeChunks({
    source,
    filePath: '/project/src/main.js',
    symbols: [
      { name: 'doWork', kind: 'function', startLine: 3, endLine: 5 },
      { name: 'helper', kind: 'function', startLine: 7, endLine: 9 },
    ],
    imports: [{ specifier: './foo.js', importedNames: ['foo'] }],
    projectRoot: '/project',
  });

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].chunkId, 'src/main.js:doWork:3');
  assert.ok(chunks[0].content.includes('doWork'));
  assert.equal(chunks[0].metadata.symbolName, 'doWork');
  assert.equal(chunks[0].metadata.kind, 'function');
  assert.ok(chunks[0].metadata.imports.includes('foo'));
  assert.equal(chunks[1].chunkId, 'src/main.js:helper:7');
});

test('extractCodeChunks skips class members (included in class chunk)', () => {
  const source =
    'export class MyClass {\n' +
    '  myMethod() {\n' +
    '    return 1;\n' +
    '  }\n' +
    '}\n';

  const chunks = extractCodeChunks({
    source,
    filePath: '/project/src/cls.js',
    symbols: [
      { name: 'MyClass', kind: 'class', startLine: 1, endLine: 5 },
      { name: 'myMethod', kind: 'method', startLine: 2, endLine: 4, scope: 'MyClass' },
    ],
    imports: [],
    projectRoot: '/project',
  });

  // Only the class chunk, not the method (scope !== null is skipped)
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].metadata.symbolName, 'MyClass');
  assert.ok(chunks[0].content.includes('myMethod'));
});

test('extractCodeChunks splits oversized symbols into deterministic subchunks', () => {
  const repeatedBody = Array.from({ length: 220 }, (_, index) => `  const value${index} = ${index};`).join('\n');
  const source = [
    'export function giantHandler() {',
    repeatedBody,
    '  return value0;',
    '}',
  ].join('\n');

  const chunks = extractCodeChunks({
    source,
    filePath: '/project/src/giant.js',
    symbols: [
      { name: 'giantHandler', kind: 'function', startLine: 1, endLine: 223, isExport: true },
    ],
    imports: [],
    projectRoot: '/project',
  });

  assert.ok(chunks.length > 1, `Expected oversized symbol to split, got ${chunks.length} chunk(s)`);
  assert.equal(chunks[0].chunkId, 'src/giant.js:giantHandler:1:part-1');
  assert.equal(chunks[0].metadata.totalSplits, chunks.length);
  assert.equal(chunks[0].metadata.isExport, true);
  assert.ok(chunks[0].metadata.estimatedTokens > 0);
});

test('extractCodeChunks falls back to module chunk when no symbols have ranges', () => {
  const source = 'console.log("hello");\n';

  const chunks = extractCodeChunks({
    source,
    filePath: '/project/src/simple.js',
    symbols: [],
    imports: [],
    projectRoot: '/project',
  });

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].metadata.kind, 'module');
});

// ---------------------------------------------------------------------------
// Cosine Similarity Tests
// ---------------------------------------------------------------------------

test('cosineSimilarity returns 1.0 for identical vectors', () => {
  const v = [1, 2, 3, 4];
  const score = cosineSimilarity(v, v);
  assert.ok(Math.abs(score - 1.0) < 0.001);
});

test('cosineSimilarity returns 0 for orthogonal vectors', () => {
  const a = [1, 0];
  const b = [0, 1];
  const score = cosineSimilarity(a, b);
  assert.ok(Math.abs(score) < 0.001);
});

test('cosineSimilarity handles zero-length edge case', () => {
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
});

// ---------------------------------------------------------------------------
// Embedding Storage Tests (DB layer)
// ---------------------------------------------------------------------------

test('replaceEmbeddingsForNode stores and retrieves embeddings', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({
    filePath: '/project/src/a.js',
    mtime: 1,
    edges: [],
    symbols: [],
  });

  const node = db.getNode('/project/src/a.js');
  const vec = new Float32Array([0.1, 0.2, 0.3, 0.4]);
  const embedding = Buffer.from(vec.buffer);

  db.replaceEmbeddingsForNode(node.id, [
    { chunkId: 'src/a.js:foo:1', embedding, model: 'test-model' },
  ]);

  const rows = db.getEmbeddingsByNode(node.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].chunk_id, 'src/a.js:foo:1');
  assert.equal(rows[0].model, 'test-model');

  const stored = new Float32Array(rows[0].embedding.buffer, rows[0].embedding.byteOffset, rows[0].embedding.byteLength / 4);
  assert.ok(Math.abs(stored[0] - 0.1) < 0.001);

  assert.equal(db.stats().embeddings, 1);
  db.close();
});

test('getEmbeddingByChunk retrieves by chunk ID', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({ filePath: '/project/src/a.js', mtime: 1, edges: [], symbols: [] });
  const node = db.getNode('/project/src/a.js');
  const vec = new Float32Array([1, 2, 3]);

  db.replaceEmbeddingsForNode(node.id, [
    { chunkId: 'chunk-abc', chunkHash: 'hash-abc', metadataJson: '{"kind":"function"}', embedding: Buffer.from(vec.buffer), model: 'm1' },
  ]);

  const row = db.getEmbeddingByChunk('chunk-abc');
  assert.ok(row);
  assert.equal(row.chunk_id, 'chunk-abc');
  assert.equal(row.chunk_hash, 'hash-abc');
  assert.equal(row.metadata_json, '{"kind":"function"}');

  const missing = db.getEmbeddingByChunk('nonexistent');
  assert.equal(missing, null);

  db.close();
});

// ---------------------------------------------------------------------------
// Session Touch Tests (DB layer)
// ---------------------------------------------------------------------------

test('recordSessionTouch and getSessionTouches work correctly', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({ filePath: '/project/src/a.js', mtime: 1, edges: [], symbols: [] });
  db.indexFile({ filePath: '/project/src/b.js', mtime: 1, edges: [], symbols: [] });

  const nodeA = db.getNode('/project/src/a.js');
  const nodeB = db.getNode('/project/src/b.js');

  db.recordSessionTouch({ sessionId: 'sess-1', nodeId: nodeA.id, action: 'read' });
  db.recordSessionTouch({ sessionId: 'sess-1', nodeId: nodeB.id, action: 'write' });
  db.recordSessionTouch({ sessionId: 'sess-2', nodeId: nodeA.id, action: 'edit' });

  const sess1 = db.getSessionTouches('sess-1');
  assert.equal(sess1.length, 2);

  const sess2 = db.getSessionTouches('sess-2');
  assert.equal(sess2.length, 1);
  assert.equal(sess2[0].action, 'edit');

  assert.equal(db.stats().sessionTouches, 3);
  db.close();
});

test('getNodeTouchHistory returns cross-session history', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({ filePath: '/project/src/a.js', mtime: 1, edges: [], symbols: [] });
  const nodeA = db.getNode('/project/src/a.js');

  db.recordSessionTouch({ sessionId: 'sess-1', nodeId: nodeA.id, action: 'read' });
  db.recordSessionTouch({ sessionId: 'sess-2', nodeId: nodeA.id, action: 'write' });

  const history = db.getNodeTouchHistory(nodeA.id);
  assert.equal(history.length, 2);
  db.close();
});

test('getRecentTouches respects limit', () => {
  const db = new ProjectGraphDb(':memory:');

  db.indexFile({ filePath: '/project/src/a.js', mtime: 1, edges: [], symbols: [] });
  const nodeA = db.getNode('/project/src/a.js');

  for (let i = 0; i < 10; i++) {
    db.recordSessionTouch({ sessionId: `sess-${i}`, nodeId: nodeA.id, action: 'read' });
  }

  const recent = db.getRecentTouches(3);
  assert.equal(recent.length, 3);
  db.close();
});

// ---------------------------------------------------------------------------
// Session Memory Manager Tests
// ---------------------------------------------------------------------------

test('SessionMemoryManager records and retrieves session touches', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const mem = new SessionMemoryManager({
    projectGraphManager: manager,
    sessionId: 'test-session',
  });

  assert.equal(mem.available, true);
  assert.equal(mem.sessionId, 'test-session');

  const filePath = path.join(dir, 'src/a.js');
  mem.recordTouch(filePath, 'read');
  mem.recordTouch(filePath, 'write');

  const touches = mem.getSessionTouches();
  assert.equal(touches.length, 2);
  // Both actions recorded (order depends on timestamp precision)
  const actions = touches.map((t) => t.action).sort();
  assert.deepEqual(actions, ['read', 'write']);

  const history = mem.getFileHistory(filePath);
  assert.equal(history.length, 2);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('SessionMemoryManager.buildContext returns combined data', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function helper() { return 1; }\n');
  writeFile(dir, 'src/main.js', 'import { helper } from \'./utils.js\';\nhelper();\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const mem = new SessionMemoryManager({ projectGraphManager: manager });
  mem.recordTouch(path.join(dir, 'src/main.js'), 'read');

  const ctx = mem.buildContext({
    filePath: path.join(dir, 'src/main.js'),
    symbolName: 'helper',
  });

  assert.ok(ctx.sessionTouches.length >= 1);
  assert.ok(ctx.dependencies.length >= 0);
  assert.ok(ctx.symbols.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Semantic Search Tool Tests
// ---------------------------------------------------------------------------

test('semantic-search tool has correct metadata', () => {
  const tool = createSemanticSearchTool({ projectGraphManager: null, sessionMemoryManager: null });
  assert.equal(tool.id, 'tool.semantic-search');
  assert.equal(tool.family, 'graph');
  assert.equal(tool.status, 'degraded');
});

test('semantic-search tool returns unavailable without graph', async () => {
  const tool = createSemanticSearchTool({ projectGraphManager: null, sessionMemoryManager: null });
  const result = await tool.execute({ query: 'test' });
  assert.equal(result.status, 'unavailable');
});

test('semantic-search tool performs keyword search', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function formatDate() { return "2026-01-01"; }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const tool = createSemanticSearchTool({ projectGraphManager: manager });
  const result = await tool.execute({ action: 'search', query: 'formatDate' });

  assert.equal(result.status, 'ok');
  assert.ok(result.results.length >= 1);
  assert.ok(result.results[0].path.includes('utils.js'));
  assert.equal(result.searchMode, 'keyword');
  assert.ok(result.results[0].scoreBreakdown);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('semantic-search tool accepts string input', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export function myFunc() {}\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const tool = createSemanticSearchTool({ projectGraphManager: manager });
  const result = await tool.execute('myFunc');

  assert.equal(result.status, 'ok');
  assert.ok(result.results.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('semantic-search tool returns session touches', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const mem = new SessionMemoryManager({ projectGraphManager: manager, sessionId: 'test' });
  mem.recordTouch(path.join(dir, 'src/a.js'), 'read');

  const tool = createSemanticSearchTool({ projectGraphManager: manager, sessionMemoryManager: mem });
  const result = await tool.execute({ action: 'session' });

  assert.equal(result.status, 'ok');
  assert.equal(result.sessionId, 'test');
  assert.ok(result.touches.length >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('semantic-search tool rejects unknown action', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({
    projectRoot: dir,
    syntaxIndexManager: sim,
    dbPath: ':memory:',
  });
  await manager.indexProject({ maxFiles: 100 });

  const tool = createSemanticSearchTool({ projectGraphManager: manager });
  const result = await tool.execute({ action: 'unknown' });
  assert.equal(result.status, 'error');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Embedding-based semantic search integration
// ---------------------------------------------------------------------------

test('semantic-search tool uses embedding search when provider is available', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/auth.js', [
    'export function authenticateUser(email, password) {',
    '  return { token: "abc123", user: email };',
    '}',
  ].join('\n'));
  writeFile(dir, 'src/math.js', [
    'export function calculateTotal(items) {',
    '  return items.reduce((sum, item) => sum + item.price, 0);',
    '}',
  ].join('\n'));

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 64 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });
  await indexer.indexProject();

  const mem = new SessionMemoryManager({ projectGraphManager: manager, embeddingProvider: provider });
  assert.equal(mem.hasEmbeddingProvider, true);

  const tool = createSemanticSearchTool({ projectGraphManager: manager, sessionMemoryManager: mem });
  const result = await tool.execute({ action: 'search', query: 'authenticate user login' });

  assert.equal(result.status, 'ok');
  assert.ok(['embedding', 'hybrid'].includes(result.searchMode));
  assert.ok(Array.isArray(result.results));
  assert.ok(result.results.length >= 1);
  // Each result should have the expected shape
  for (const r of result.results) {
    assert.ok(typeof r.chunkId === 'string');
    assert.ok(typeof r.path === 'string');
    assert.ok(typeof r.score === 'number');
    assert.ok(r.scoreBreakdown);
  }

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('semantic-search tool falls back to keyword when no embeddings exist', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function formatDate(d) { return d.toISOString(); }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  // Provider is configured but no embeddings indexed yet
  const provider = new MockEmbeddingProvider({ dimensions: 32 });
  const mem = new SessionMemoryManager({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createSemanticSearchTool({ projectGraphManager: manager, sessionMemoryManager: mem });
  const result = await tool.execute({ action: 'search', query: 'formatDate' });

  assert.equal(result.status, 'ok');
  // minScore fallback triggered because no DB embeddings; keyword search runs
  assert.ok(['keyword', 'embedding'].includes(result.searchMode));

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('semantic-search tool merges vector and keyword results into hybrid mode', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/auth.js', [
    'export function authenticateUser(email, password) {',
    '  return { token: "abc123", user: email };',
    '}',
  ].join('\n'));
  writeFile(dir, 'src/session.js', [
    'export function createSession(user) {',
    '  return { id: user.id };',
    '}',
  ].join('\n'));

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 64 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });
  await indexer.indexProject();

  const mem = new SessionMemoryManager({ projectGraphManager: manager, embeddingProvider: provider });
  const tool = createSemanticSearchTool({ projectGraphManager: manager, sessionMemoryManager: mem });
  const result = await tool.execute({ action: 'search', query: 'authenticateUser login token', topK: 10, minScore: 0.0 });

  assert.equal(result.status, 'ok');
  assert.equal(result.searchMode, 'hybrid');
  assert.ok(result.results.length >= 1);
  assert.ok(result.results[0].scoreBreakdown);
  assert.ok(typeof result.results[0].scoreBreakdown.vector === 'number');
  assert.ok(typeof result.results[0].scoreBreakdown.keyword === 'number');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('SessionMemoryManager.buildResultContext expands graph relationships', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/helper.js', 'export function helper() { return 1; }\n');
  writeFile(dir, 'src/main.js', 'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const mem = new SessionMemoryManager({ projectGraphManager: manager });
  const context = mem.buildResultContext({
    path: path.join(dir, 'src/main.js'),
    absolutePath: path.join(dir, 'src/main.js'),
    symbolName: 'run',
  });

  assert.ok(Array.isArray(context.dependencies));
  assert.ok(Array.isArray(context.dependents));
  assert.ok(Array.isArray(context.sameFileSymbols));
  assert.ok(context.callHierarchy);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('SessionMemoryManager.semanticSearchQuery returns results via provider', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/auth.js', 'export function login(user, pass) { return true; }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 64 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });
  await indexer.indexProject();

  const mem = new SessionMemoryManager({ projectGraphManager: manager, embeddingProvider: provider });
  const results = await mem.semanticSearchQuery('login authentication', { topK: 5, minScore: 0.0 });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 1);
  assert.ok(typeof results[0].score === 'number');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('SessionMemoryManager.semanticSearchQuery returns empty when no provider', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  // No embeddingProvider
  const mem = new SessionMemoryManager({ projectGraphManager: manager });
  assert.equal(mem.hasEmbeddingProvider, false);

  const results = await mem.semanticSearchQuery('anything');
  assert.deepEqual(results, []);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// ProjectGraphManager auto-embedding callback
// ---------------------------------------------------------------------------

test('ProjectGraphManager.onFileIndexed callback fires after indexFile', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/widget.js', 'export function render() { return "<div/>"; }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });

  const firedPaths = [];
  manager.onFileIndexed((fp) => {
    firedPaths.push(fp);
  });

  const filePath = path.join(dir, 'src/widget.js');
  const result = await manager.indexFile(filePath);
  assert.equal(result.status, 'indexed');
  assert.ok(firedPaths.includes(filePath));

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('ProjectGraphManager.onFileIndexed callback is not fired for unchanged files', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/stable.js', 'export const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });

  const filePath = path.join(dir, 'src/stable.js');
  // First index (indexed)
  await manager.indexFile(filePath);

  const firedPaths = [];
  manager.onFileIndexed((fp) => firedPaths.push(fp));

  // Second index — mtime unchanged, should be skipped
  const result = await manager.indexFile(filePath);
  assert.equal(result.status, 'unchanged');
  assert.equal(firedPaths.length, 0);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('ProjectGraphManager callback wires embeddings automatically', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/service.js', 'export class UserService { getUser(id) { return { id }; } }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });

  const provider = new MockEmbeddingProvider({ dimensions: 32 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  // Wire callback (same as create-managers does)
  manager.onFileIndexed((fp) => indexer.indexFileEmbeddings(fp));

  const filePath = path.join(dir, 'src/service.js');
  await manager.indexFile(filePath);

  // Give the async callback a tick to complete
  await new Promise((resolve) => setImmediate(resolve));

  const node = manager._db.getNode(filePath);
  const embeddings = manager._db.getEmbeddingsByNode(node.id);
  assert.ok(embeddings.length >= 1, `Expected embeddings after auto-index callback, got ${embeddings.length}`);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Embedding Index Tool Tests
// ---------------------------------------------------------------------------

test('embedding-index tool has correct metadata', () => {
  const tool = createEmbeddingIndexTool({ embeddingIndexer: null });
  assert.equal(tool.id, 'tool.embedding-index');
  assert.equal(tool.family, 'analysis');
  assert.equal(tool.status, 'degraded');
});

test('embedding-index tool status action reports unavailable when no indexer', async () => {
  const tool = createEmbeddingIndexTool({ embeddingIndexer: null });
  const result = await tool.execute({ action: 'status' });
  assert.equal(result.status, 'unavailable');
});

test('embedding-index tool status action returns indexer describe', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const x = 1;\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 16 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createEmbeddingIndexTool({ embeddingIndexer: indexer });
  assert.equal(tool.status, 'active');

  const result = await tool.execute({ action: 'status' });
  assert.equal(result.status, 'ok');
  assert.equal(result.available, true);
  assert.ok(result.provider);
  assert.ok(result.stats);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('embedding-index tool index-file action embeds a file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/target.js', 'export function doThing() { return 42; }\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 16 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createEmbeddingIndexTool({ embeddingIndexer: indexer });
  const filePath = path.join(dir, 'src/target.js');
  const result = await tool.execute({ action: 'index-file', filePath });

  assert.equal(result.status, 'ok');
  assert.ok(result.chunks >= 1);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('embedding-index tool index-project action indexes all files', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export function alpha() {}\n');
  writeFile(dir, 'src/b.js', 'export function beta() {}\n');

  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 16 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createEmbeddingIndexTool({ embeddingIndexer: indexer });
  const result = await tool.execute({ action: 'index-project' });

  assert.equal(result.status, 'complete');
  assert.ok(result.filesProcessed >= 2);
  assert.ok(result.chunksEmbedded >= 2);

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('embedding-index tool rejects unknown action', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');
  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 16 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createEmbeddingIndexTool({ embeddingIndexer: indexer });
  const result = await tool.execute({ action: 'badaction' });
  assert.equal(result.status, 'error');

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});

test('embedding-index tool index-file requires filePath', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'const x = 1;\n');
  const sim = new SyntaxIndexManager({ projectRoot: dir });
  const manager = new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: sim, dbPath: ':memory:' });
  await manager.indexProject({ maxFiles: 100 });

  const provider = new MockEmbeddingProvider({ dimensions: 16 });
  const indexer = new EmbeddingIndexer({ projectGraphManager: manager, embeddingProvider: provider });

  const tool = createEmbeddingIndexTool({ embeddingIndexer: indexer });
  const result = await tool.execute({ action: 'index-file' });
  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('filePath'));

  manager.dispose();
  fs.rmSync(dir, { recursive: true });
});
