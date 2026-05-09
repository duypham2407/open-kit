import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createAstGrepSearchTool } from '../../src/runtime/tools/ast/ast-grep-search.js';
import { isAstGrepAvailable } from '../../src/global/tooling.js';

const astGrepInstalled = isAstGrepAvailable({ env: process.env });

test('ast-grep-search does not execute shell metacharacters embedded in pattern', { skip: !astGrepInstalled }, () => {
  // Set up a temp project to scan, and a sentinel file the injection would create.
  const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-grep-injection-'));
  const sentinel = path.join(tempProject, 'INJECTED');

  try {
    fs.writeFileSync(path.join(tempProject, 'sample.js'), 'console.log("hello");\n');

    // A pattern that, if passed through a shell, would create the sentinel.
    // With argv-form spawn, the shell never sees this string; ast-grep treats
    // the whole thing as a (likely-invalid) pattern and returns no matches.
    const tool = createAstGrepSearchTool({ projectRoot: tempProject });
    const result = tool.execute({
      pattern: `"console.log($A)" --output /dev/null; touch ${sentinel}`,
      lang: 'javascript',
    });

    assert.ok(
      typeof result === 'object' && result !== null,
      'tool should return an object (not throw)',
    );
    assert.ok(
      !fs.existsSync(sentinel),
      'sentinel file MUST NOT exist — its presence proves shell metacharacters executed',
    );
  } finally {
    fs.rmSync(tempProject, { recursive: true, force: true });
  }
});

test('ast-grep-search rejects non-string pattern (input validation unchanged)', () => {
  const tool = createAstGrepSearchTool({ projectRoot: process.cwd() });
  const result = tool.execute({ pattern: 123, lang: 'javascript' });
  assert.equal(result.status, 'invalid-input');
});
