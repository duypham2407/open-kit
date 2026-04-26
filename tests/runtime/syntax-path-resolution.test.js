import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { wrapToolExecution } from '../../src/runtime/tools/wrap-tool-execution.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-syntax-paths-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function createFixtureProject() {
  const projectRoot = fs.realpathSync.native(makeTempDir());
  writeText(path.join(projectRoot, 'package.json'), '{"name":"syntax-path-fixture","type":"module"}\n');
  writeText(path.join(projectRoot, 'src', 'sample.js'), 'export function greet() {\n  return "hi";\n}\n');
  writeText(path.join(projectRoot, 'src', 'nested', 'consumer.js'), 'import { greet } from "../sample.js";\nexport const message = greet();\n');
  writeText(path.join(projectRoot, '.opencode', 'openkit', 'shim.js'), 'export const shim = true;\n');
  writeText(path.join(projectRoot, 'notes.txt'), 'plain text\n');
  return projectRoot;
}

function bootstrapSyntaxTools(projectRoot, env = {}) {
  const foundation = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      ...process.env,
      HOME: makeTempDir(),
      ...env,
    },
    mode: 'read-only',
  });

  return {
    foundation,
    outline: foundation.tools.tools['tool.syntax-outline'],
    context: foundation.tools.tools['tool.syntax-context'],
    locate: foundation.tools.tools['tool.syntax-locate'],
  };
}

test('syntax tools resolve project-relative, dot-normalized, absolute, and project-local compatibility paths', async () => {
  const projectRoot = createFixtureProject();
  const { outline } = bootstrapSyntaxTools(projectRoot);
  const absoluteSamplePath = path.join(projectRoot, 'src', 'sample.js');

  const relative = await outline.execute({ filePath: 'src/sample.js' });
  const dotRelative = await outline.execute({ filePath: './src/./sample.js   ' });
  const safeParentSegment = await outline.execute({ filePath: 'src/nested/../sample.js' });
  const absolute = await outline.execute({ filePath: absoluteSamplePath });
  const compatibilityShim = await outline.execute({ filePath: '.opencode/openkit/shim.js' });

  for (const result of [relative, dotRelative, safeParentSegment, absolute]) {
    assert.equal(result.status, 'ok');
    assert.equal(result.language, 'javascript');
    assert.equal(result.validationSurface, 'runtime_tooling');
    assert.equal(result.resolvedPath, absoluteSamplePath);
    assert.equal(result.relativePath, 'src/sample.js');
    assert.notEqual(result.status, 'invalid-path');
    assert.notEqual(result.status, 'missing-file');
  }

  assert.equal(relative.filePath, absolute.filePath);
  assert.equal(dotRelative.requestedPath, './src/./sample.js   ');
  assert.equal(dotRelative.pathResolution.normalizedInput, './src/./sample.js');
  assert.equal(compatibilityShim.status, 'ok');
  assert.equal(compatibilityShim.relativePath, '.opencode/openkit/shim.js');
});

test('syntax tools distinguish unsupported files, missing files, directories, and outside-root paths', async () => {
  const projectRoot = createFixtureProject();
  const outsideRoot = makeTempDir();
  const outsideFile = path.join(outsideRoot, 'outside.js');
  writeText(outsideFile, 'export const outside = true;\n');
  const { outline } = bootstrapSyntaxTools(projectRoot);

  const unsupported = await outline.execute({ filePath: 'notes.txt' });
  const missing = await outline.execute({ filePath: 'src/missing.js' });
  const directory = await outline.execute({ filePath: 'src' });
  const traversalEscape = await outline.execute({ filePath: '../outside.js' });
  const absoluteOutside = await outline.execute({ filePath: outsideFile });

  assert.equal(unsupported.status, 'unsupported-language');
  assert.equal(unsupported.reason, 'unsupported-language');
  assert.equal(unsupported.validationSurface, 'runtime_tooling');
  assert.equal(missing.status, 'missing-file');
  assert.equal(missing.reason, 'missing-file');
  assert.equal(directory.status, 'not-file');
  assert.equal(directory.reason, 'directory');
  assert.equal(directory.kind, 'directory');
  assert.equal(traversalEscape.status, 'invalid-path');
  assert.equal(traversalEscape.reason, 'outside-root');
  assert.equal(absoluteOutside.status, 'invalid-path');
  assert.equal(absoluteOutside.reason, 'outside-root');
});

test('syntax tools reject symlink escapes after canonical resolution', async (t) => {
  const projectRoot = createFixtureProject();
  const outsideRoot = makeTempDir();
  const outsideFile = path.join(outsideRoot, 'escape.js');
  const symlinkPath = path.join(projectRoot, 'src', 'escape.js');
  writeText(outsideFile, 'export const escaped = true;\n');

  try {
    fs.symlinkSync(outsideFile, symlinkPath);
  } catch {
    t.skip('filesystem does not allow symlink creation in this environment');
    return;
  }

  const { outline } = bootstrapSyntaxTools(projectRoot);
  const result = await outline.execute({ filePath: 'src/escape.js' });

  assert.equal(result.status, 'invalid-path');
  assert.equal(result.reason, 'symlink-outside-root');
  assert.equal(result.validationSurface, 'runtime_tooling');
});

test('syntax-context and syntax-locate inherit the shared resolver without changing node behavior', async () => {
  const projectRoot = createFixtureProject();
  const { context, locate } = bootstrapSyntaxTools(projectRoot);
  const absoluteSamplePath = fs.realpathSync.native(path.join(projectRoot, 'src', 'sample.js'));

  const contextResult = await context.execute({ filePath: absoluteSamplePath, line: 1, column: 0, depth: 1 });
  const locateResult = await locate.execute({ filePath: './src/./sample.js', nodeType: 'function_declaration' });

  assert.equal(contextResult.status, 'ok');
  assert.equal(contextResult.language, 'javascript');
  assert.equal(contextResult.resolvedPath, absoluteSamplePath);
  assert.ok(contextResult.node);
  assert.equal(locateResult.status, 'ok');
  assert.equal(locateResult.language, 'javascript');
  assert.equal(locateResult.resolvedPath, absoluteSamplePath);
  assert.equal(locateResult.matchCount, 1);
});

test('runtime bootstrap normalizes leaked cwd placeholders before syntax tools resolve files', async () => {
  const projectRoot = createFixtureProject();
  const placeholderRoot = path.join(path.dirname(projectRoot), '{cwd}');
  const { foundation, outline } = bootstrapSyntaxTools(placeholderRoot, {
    OPENKIT_PROJECT_ROOT: placeholderRoot,
    OPENKIT_REPOSITORY_ROOT: projectRoot,
  });

  assert.equal(foundation.projectRoot, projectRoot);
  assert.equal(foundation.runtimeInterface.projectRoot, projectRoot);

  const result = await outline.execute({ filePath: 'src/sample.js' });
  assert.equal(result.status, 'ok');
  assert.equal(result.resolvedPath, path.join(projectRoot, 'src', 'sample.js'));
});

test('wrapToolExecution records explicit not-file syntax outcomes as failures', () => {
  const calls = [];
  const wrapped = wrapToolExecution(
    {
      id: 'tool.syntax-outline',
      execute(input) {
        return input;
      },
    },
    {
      actionModelStateManager: {
        recordSuccess(payload) {
          calls.push({ type: 'success', payload });
        },
        recordFailure(payload) {
          calls.push({ type: 'failure', payload });
        },
      },
    }
  );

  wrapped.execute({ status: 'not-file' });
  wrapped.execute({ status: 'ok' });

  assert.equal(calls[0].type, 'failure');
  assert.equal(calls[0].payload.detail, 'not-file');
  assert.equal(calls[1].type, 'success');
});
