import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isJsTsExtension,
  isLightweightExtension,
  extractLightweightGraph,
} from '../../src/runtime/analysis/language-support/index.js';

test('language-support recognizes JS/TS and lightweight extensions', () => {
  assert.equal(isJsTsExtension('/tmp/a.ts'), true);
  assert.equal(isJsTsExtension('/tmp/a.cts'), true);
  assert.equal(isJsTsExtension('/tmp/a.py'), false);

  assert.equal(isLightweightExtension('/tmp/a.py'), true);
  assert.equal(isLightweightExtension('/tmp/a.go'), true);
  assert.equal(isLightweightExtension('/tmp/a.md'), true);
  assert.equal(isLightweightExtension('/tmp/a.ts'), false);
});

test('extractLightweightGraph extracts basic python symbols/imports', () => {
  const source = [
    'from app.core import helper',
    'import os',
    '',
    'def run():',
    '  return helper()',
    '',
    'class Service:',
    '  pass',
  ].join('\n');

  const graph = extractLightweightGraph({ source, filePath: '/tmp/main.py' });
  assert.ok(graph.imports.length >= 2);
  assert.ok(graph.symbols.some((s) => s.name === 'run' && s.kind === 'function'));
  assert.ok(graph.symbols.some((s) => s.name === 'Service' && s.kind === 'class'));
});

test('extractLightweightGraph extracts markdown headings and links', () => {
  const source = '# Title\n\nRead [Guide](./guide.md).';
  const graph = extractLightweightGraph({ source, filePath: '/tmp/README.md' });
  assert.ok(graph.symbols.some((s) => s.kind === 'heading-h1'));
  assert.ok(graph.imports.some((i) => i.specifier === './guide.md'));
});
