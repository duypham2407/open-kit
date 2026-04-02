import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SyntaxIndexManager } from '../../src/runtime/managers/syntax-index-manager.js';
import { buildFileGraph } from '../../src/runtime/analysis/import-graph-builder.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-graph-builder-'));
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

test('buildFileGraph extracts static imports', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `
import { foo } from './utils.js';
import path from 'node:path';
import React from 'react';
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  assert.ok(result);
  assert.equal(result.filePath, filePath);

  const importSpecifiers = result.imports.map((i) => i.specifier);
  assert.ok(importSpecifiers.includes('./utils.js'));
  assert.ok(importSpecifiers.includes('node:path'));
  assert.ok(importSpecifiers.includes('react'));

  // Relative import resolves; bare specifiers do not
  const utilsImport = result.imports.find((i) => i.specifier === './utils.js');
  assert.ok(utilsImport.resolvedPath !== null);

  const pathImport = result.imports.find((i) => i.specifier === 'node:path');
  assert.equal(pathImport.resolvedPath, null); // bare specifier

  const reactImport = result.imports.find((i) => i.specifier === 'react');
  assert.equal(reactImport.resolvedPath, null); // bare specifier
});

test('buildFileGraph extracts named imports', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `
import { alpha, beta, gamma } from './helpers.js';
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  const helpersImport = result.imports.find((i) => i.specifier === './helpers.js');
  assert.ok(helpersImport);
  assert.ok(helpersImport.importedNames.includes('alpha'));
  assert.ok(helpersImport.importedNames.includes('beta'));
  assert.ok(helpersImport.importedNames.includes('gamma'));
});

test('buildFileGraph extracts exported functions and classes', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/utils.js', `
export function doWork() {}
export class WorkerClass {}
export const CONSTANT = 42;
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  const symbolNames = result.symbols.map((s) => s.name);
  assert.ok(symbolNames.includes('doWork'));
  assert.ok(symbolNames.includes('WorkerClass'));
  assert.ok(symbolNames.includes('CONSTANT'));

  const doWork = result.symbols.find((s) => s.name === 'doWork');
  assert.equal(doWork.kind, 'function');
  assert.equal(doWork.isExport, true);

  const WorkerClass = result.symbols.find((s) => s.name === 'WorkerClass');
  assert.equal(WorkerClass.kind, 'class');
  assert.equal(WorkerClass.isExport, true);
});

test('buildFileGraph extracts re-exports with source', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/index.js', `
export { foo, bar } from './foo.js';
export * from './other.js';
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  const fooReExport = result.imports.find((i) => i.specifier === './foo.js');
  assert.ok(fooReExport);
  assert.equal(fooReExport.kind, 're-export');

  const otherReExport = result.imports.find((i) => i.specifier === './other.js');
  assert.ok(otherReExport);
  assert.equal(otherReExport.kind, 're-export');
});

test('buildFileGraph resolves relative import to existing file', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/utils.js', 'export function x() {}');
  const filePath = writeFile(dir, 'src/index.js', `
import { x } from './utils.js';
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });

  const imp = result.imports.find((i) => i.specifier === './utils.js');
  assert.ok(imp);
  assert.equal(imp.resolvedPath, path.join(dir, 'src', 'utils.js'));
});

test('buildFileGraph returns null for unsupported file types', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'README.md', '# Hello');

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });
  assert.equal(result, null);
});

test('buildFileGraph handles TypeScript imports and exports', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'src/types.ts', `
import type { Config } from './config.js';
export interface MyInterface { name: string; }
export type MyType = string | number;
export enum Status { Active = 'active', Inactive = 'inactive' }
`);

  const mgr = new SyntaxIndexManager({ projectRoot: dir });
  const result = await buildFileGraph({ syntaxIndexManager: mgr, filePath, projectRoot: dir });
  assert.ok(result);

  const symbolNames = result.symbols.map((s) => s.name);
  assert.ok(symbolNames.includes('MyInterface'));
  assert.ok(symbolNames.includes('MyType'));
  assert.ok(symbolNames.includes('Status'));
});
