import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCodemodPreviewTool } from '../../src/runtime/tools/codemod/codemod-preview.js';
import { createCodemodApplyTool } from '../../src/runtime/tools/codemod/codemod-apply.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-codemod-'));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// --- codemod-preview tests ---

test('codemod-preview tool has correct metadata', () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodPreviewTool({ projectRoot });
  assert.equal(tool.id, 'tool.codemod-preview');
  assert.equal(tool.family, 'codemod');
  assert.equal(tool.stage, 'foundation');
  assert.equal(tool.status, 'active');
});

test('codemod-preview returns invalid-input when no transform or files provided', async () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodPreviewTool({ projectRoot });

  const result = await tool.execute({});
  assert.equal(result.status, 'invalid-input');
  assert.match(result.message, /transform/i);
});

test('codemod-preview returns invalid-input when no files provided', async () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodPreviewTool({ projectRoot });

  const result = await tool.execute({ inlineTransform: 'return fileInfo.source;' });
  assert.equal(result.status, 'invalid-input');
  assert.match(result.message, /file/i);
});

test('codemod-preview with inline transform shows no-change for identity transform', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'const x = 1;\n');

  const tool = createCodemodPreviewTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: 'return fileInfo.source;',
    files: [filePath],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.provider, 'jscodeshift');
  assert.equal(result.totalCount, 1);
  assert.equal(result.changedCount, 0);
  assert.equal(result.previews[0].status, 'no-change');
});

test('codemod-preview with inline transform detects changes', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'var x = 1;\nvar y = 2;\n');

  const tool = createCodemodPreviewTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: `
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      root.find(j.VariableDeclaration, { kind: 'var' }).forEach(p => { p.node.kind = 'const'; });
      return root.toSource();
    `,
    files: [filePath],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.changedCount, 1);
  assert.equal(result.previews[0].status, 'preview-ready');
  assert.equal(result.previews[0].diff.changed, true);

  // Verify original file was NOT modified (preview-only)
  const afterContent = fs.readFileSync(filePath, 'utf8');
  assert.equal(afterContent, 'var x = 1;\nvar y = 2;\n');
});

test('codemod-preview reports file-not-found for missing files', async () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodPreviewTool({ projectRoot });

  const result = await tool.execute({
    inlineTransform: 'return fileInfo.source;',
    files: [path.join(projectRoot, 'nonexistent.js')],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.previews[0].status, 'file-not-found');
});

test('codemod-preview reports transform-error for malformed inline transform', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'const x = 1;\n');

  const tool = createCodemodPreviewTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: 'this is not valid javascript {{{',
    files: [filePath],
  });

  assert.equal(result.status, 'transform-error');
  assert.match(result.message, /compile/i);
});

test('codemod-preview reports transform-not-found for missing transform file', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'const x = 1;\n');

  const tool = createCodemodPreviewTool({ projectRoot });
  const result = await tool.execute({
    transform: '/nonexistent/transform.js',
    files: [filePath],
  });

  assert.equal(result.status, 'transform-not-found');
});

test('codemod-preview handles multiple files', async () => {
  const projectRoot = makeTempDir();
  const file1 = path.join(projectRoot, 'a.js');
  const file2 = path.join(projectRoot, 'b.js');
  writeText(file1, 'var a = 1;\n');
  writeText(file2, 'const b = 2;\n');

  const tool = createCodemodPreviewTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: `
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      root.find(j.VariableDeclaration, { kind: 'var' }).forEach(p => { p.node.kind = 'let'; });
      return root.toSource();
    `,
    files: [file1, file2],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.totalCount, 2);
  assert.equal(result.changedCount, 1); // only a.js has var
  assert.equal(result.previews[0].status, 'preview-ready');
  assert.equal(result.previews[1].status, 'no-change');
});

// --- codemod-apply tests ---

test('codemod-apply tool has correct metadata', () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodApplyTool({ projectRoot });
  assert.equal(tool.id, 'tool.codemod-apply');
  assert.equal(tool.family, 'codemod');
  assert.equal(tool.stage, 'foundation');
  assert.equal(tool.status, 'active');
});

test('codemod-apply returns invalid-input when no transform provided', async () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodApplyTool({ projectRoot });

  const result = await tool.execute({});
  assert.equal(result.status, 'invalid-input');
});

test('codemod-apply writes transformed output to disk', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'var x = 1;\nvar y = 2;\n');

  const tool = createCodemodApplyTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: `
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      root.find(j.VariableDeclaration, { kind: 'var' }).forEach(p => { p.node.kind = 'const'; });
      return root.toSource();
    `,
    files: [filePath],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.appliedCount, 1);
  assert.equal(result.applied[0].status, 'applied');
  assert.equal(result.applied[0].written, true);

  // Verify file was actually modified
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('const x'));
  assert.ok(content.includes('const y'));
  assert.ok(!content.includes('var'));
});

test('codemod-apply with dryRun does not write to disk', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  const original = 'var x = 1;\n';
  writeText(filePath, original);

  const tool = createCodemodApplyTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: `
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      root.find(j.VariableDeclaration, { kind: 'var' }).forEach(p => { p.node.kind = 'const'; });
      return root.toSource();
    `,
    files: [filePath],
    dryRun: true,
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.dryRun, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.applied[0].status, 'applied');
  assert.equal(result.applied[0].written, false);

  // Verify file was NOT modified
  assert.equal(fs.readFileSync(filePath, 'utf8'), original);
});

test('codemod-apply reports no-change for identity transform', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'const x = 1;\n');

  const tool = createCodemodApplyTool({ projectRoot });
  const result = await tool.execute({
    inlineTransform: 'return fileInfo.source;',
    files: [filePath],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.appliedCount, 0);
  assert.equal(result.applied[0].status, 'no-change');
  assert.equal(result.applied[0].written, false);
});

test('codemod-apply reports file-not-found for missing files', async () => {
  const projectRoot = makeTempDir();
  const tool = createCodemodApplyTool({ projectRoot });

  const result = await tool.execute({
    inlineTransform: 'return fileInfo.source;',
    files: [path.join(projectRoot, 'missing.js')],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.applied[0].status, 'file-not-found');
  assert.equal(result.applied[0].written, false);
});

test('codemod-apply with transform file path that does not exist', async () => {
  const projectRoot = makeTempDir();
  const filePath = path.join(projectRoot, 'test.js');
  writeText(filePath, 'const x = 1;\n');

  const tool = createCodemodApplyTool({ projectRoot });
  const result = await tool.execute({
    transform: '/nonexistent/transform.js',
    files: [filePath],
  });

  assert.equal(result.status, 'transform-error');
});

// --- capability test ---

test('runtime bootstrap includes codemod capability and tools', async () => {
  // Dynamic import to avoid circular dependency issues
  const { bootstrapRuntimeFoundation } = await import('../../src/runtime/index.js');

  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });

  assert.ok(result.capabilities.some((entry) => entry.id === 'capability.codemod'));
  assert.ok(result.tools.toolList.some((entry) => entry.id === 'tool.codemod-preview'));
  assert.ok(result.tools.toolList.some((entry) => entry.id === 'tool.codemod-apply'));
  assert.ok(result.tools.toolFamilies.some((entry) => entry.family === 'codemod'));
});
