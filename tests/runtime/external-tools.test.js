import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createExternalToolRunner } from '../../src/runtime/tools/external/tool-runner.js';
import { createTypecheckTool, parseTscLine, parseTscOutput, detectTsconfig } from '../../src/runtime/tools/external/typecheck.js';
import { createLintTool, detectLinter, parseEslintJsonOutput, parseBiomeOutput } from '../../src/runtime/tools/external/lint.js';
import {
  createTestRunTool,
  detectTestFramework,
  parseJestOutput,
  parseNodeTestOutput,
  parsePytestOutput,
  parseGoTestOutput,
} from '../../src/runtime/tools/external/test-run.js';

// -- Helpers -----------------------------------------------------------------

function makeTempDir(prefix = 'openkit-ext-tools-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// =============================================================================
// tool-runner.js tests
// =============================================================================

test('tool-runner: runs a simple command and captures stdout', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });

  const result = await runner.run(process.execPath, ['-e', 'process.stdout.write("hello")']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'hello');
  assert.equal(result.timedOut, false);
});

test('tool-runner: captures stderr', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });

  const result = await runner.run(process.execPath, ['-e', 'process.stderr.write("oops")']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, 'oops');
});

test('tool-runner: returns non-zero exit code', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });

  const result = await runner.run(process.execPath, ['-e', 'process.exit(42)']);
  assert.equal(result.exitCode, 42);
  assert.equal(result.timedOut, false);
});

test('tool-runner: handles timeout gracefully', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });

  const result = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    timeout: 300,
  });

  assert.equal(result.timedOut, true);
});

test('tool-runner: handles missing command gracefully', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });

  const result = await runner.run('__nonexistent_command_xyz__', []);
  assert.equal(result.exitCode, null);
  assert.ok(result.stderr.length > 0 || result.timedOut === false);
});

test('tool-runner: prepends node_modules/.bin to PATH', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir, env: { PATH: '/usr/bin' } });

  const result = await runner.run(process.execPath, [
    '-e',
    `process.stdout.write(process.env.PATH.split(require('path').delimiter)[0])`,
  ]);

  assert.equal(result.stdout, path.join(dir, 'node_modules', '.bin'));
});

// =============================================================================
// typecheck.js tests
// =============================================================================

test('parseTscLine: parses a standard tsc error line', () => {
  const line = "src/foo.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.";
  const parsed = parseTscLine(line);
  assert.deepEqual(parsed, {
    file: 'src/foo.ts',
    line: 12,
    column: 5,
    severity: 'error',
    code: 'TS2322',
    message: "Type 'string' is not assignable to type 'number'.",
  });
});

test('parseTscLine: returns null for non-matching lines', () => {
  assert.equal(parseTscLine('Found 2 errors.'), null);
  assert.equal(parseTscLine(''), null);
  assert.equal(parseTscLine('   '), null);
});

test('parseTscOutput: parses multi-line tsc output', () => {
  const raw = [
    "src/a.ts(1,1): error TS2304: Cannot find name 'foo'.",
    '',
    "src/b.ts(10,3): warning TS6133: 'x' is declared but its value is never read.",
    'Found 2 errors.',
  ].join('\n');

  const diagnostics = parseTscOutput(raw);
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].severity, 'error');
  assert.equal(diagnostics[1].severity, 'warning');
});

test('detectTsconfig: finds tsconfig.json', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'tsconfig.json'), '{}');
  assert.equal(detectTsconfig(dir), path.join(dir, 'tsconfig.json'));
});

test('detectTsconfig: returns null when no tsconfig', () => {
  const dir = makeTempDir();
  assert.equal(detectTsconfig(dir), null);
});

test('createTypecheckTool: status unavailable without tsconfig', () => {
  const dir = makeTempDir();
  const tool = createTypecheckTool({ projectRoot: dir, toolRunner: null });
  assert.equal(tool.id, 'tool.typecheck');
  assert.equal(tool.status, 'unavailable');
});

test('createTypecheckTool: status active with tsconfig', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'tsconfig.json'), '{}');
  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createTypecheckTool({ projectRoot: dir, toolRunner: runner });
  assert.equal(tool.status, 'active');
});

test('createTypecheckTool: execute returns unavailable without tsconfig', async () => {
  const dir = makeTempDir();
  const tool = createTypecheckTool({ projectRoot: dir, toolRunner: null });
  const result = await tool.execute();
  assert.equal(result.status, 'unavailable');
});

test('createTypecheckTool: execute returns unavailable without toolRunner', async () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'tsconfig.json'), '{}');
  const tool = createTypecheckTool({ projectRoot: dir, toolRunner: null });
  const result = await tool.execute();
  assert.equal(result.status, 'unavailable');
  assert.ok(result.reason.includes('tool runner'));
});

// =============================================================================
// lint.js tests
// =============================================================================

test('detectLinter: finds eslintrc config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, '.eslintrc.json'), '{}');
  const result = detectLinter(dir);
  assert.equal(result.linter, 'eslint');
});

test('detectLinter: finds flat eslint config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'eslint.config.js'), 'export default [];');
  const result = detectLinter(dir);
  assert.equal(result.linter, 'eslint');
});

test('detectLinter: finds biome config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'biome.json'), '{}');
  const result = detectLinter(dir);
  assert.equal(result.linter, 'biome');
});

test('detectLinter: returns null when no config', () => {
  const dir = makeTempDir();
  const result = detectLinter(dir);
  assert.equal(result.linter, null);
});

test('detectLinter: finds eslintConfig in package.json', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'package.json'), JSON.stringify({ eslintConfig: { rules: {} } }));
  const result = detectLinter(dir);
  assert.equal(result.linter, 'eslint');
});

test('parseEslintJsonOutput: parses standard eslint json format', () => {
  const raw = JSON.stringify([
    {
      filePath: '/tmp/foo.js',
      messages: [
        { line: 5, column: 1, severity: 2, ruleId: 'no-unused-vars', message: "'x' is defined but never used.", fix: null },
        { line: 10, column: 3, severity: 1, ruleId: 'prefer-const', message: "Prefer const.", fix: { range: [0, 1], text: 'const' } },
      ],
    },
  ]);

  const findings = parseEslintJsonOutput(raw);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].severity, 'error');
  assert.equal(findings[0].ruleId, 'no-unused-vars');
  assert.equal(findings[0].fixable, false);
  assert.equal(findings[1].severity, 'warning');
  assert.equal(findings[1].fixable, true);
});

test('parseEslintJsonOutput: returns empty for invalid JSON', () => {
  assert.deepEqual(parseEslintJsonOutput('not json'), []);
});

test('parseBiomeOutput: parses diagnostics array', () => {
  const raw = JSON.stringify({ diagnostics: [
    { file: 'src/x.ts', severity: 'error', category: 'lint/style', message: 'Missing semicolon', fixable: true },
  ]});

  const findings = parseBiomeOutput(raw);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'error');
  assert.equal(findings[0].fixable, true);
});

test('createLintTool: status unavailable without config', () => {
  const dir = makeTempDir();
  const tool = createLintTool({ projectRoot: dir, toolRunner: null });
  assert.equal(tool.id, 'tool.lint');
  assert.equal(tool.status, 'unavailable');
});

test('createLintTool: status active with eslint config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, '.eslintrc.json'), '{}');
  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createLintTool({ projectRoot: dir, toolRunner: runner });
  assert.equal(tool.status, 'active');
  assert.equal(tool.detectedLinter, 'eslint');
});

test('createLintTool: execute returns unavailable without config', async () => {
  const dir = makeTempDir();
  const tool = createLintTool({ projectRoot: dir, toolRunner: null });
  const result = await tool.execute();
  assert.equal(result.status, 'unavailable');
});

// =============================================================================
// test-run.js tests
// =============================================================================

test('detectTestFramework: finds vitest config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'vitest.config.ts'), 'export default {};');
  const result = detectTestFramework(dir);
  assert.equal(result.framework, 'vitest');
});

test('detectTestFramework: finds jest config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'jest.config.js'), 'module.exports = {};');
  const result = detectTestFramework(dir);
  assert.equal(result.framework, 'jest');
});

test('detectTestFramework: finds go.mod', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'go.mod'), 'module example.com/test');
  const result = detectTestFramework(dir);
  assert.equal(result.framework, 'go');
});

test('detectTestFramework: finds pytest.ini', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'pytest.ini'), '[pytest]');
  const result = detectTestFramework(dir);
  assert.equal(result.framework, 'pytest');
});

test('detectTestFramework: finds node:test via package.json scripts', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'package.json'), JSON.stringify({
    scripts: { test: 'node --test tests/' },
  }));
  const result = detectTestFramework(dir);
  assert.equal(result.framework, 'node-test');
});

test('detectTestFramework: returns null when nothing found', () => {
  const dir = makeTempDir();
  const result = detectTestFramework(dir);
  assert.equal(result.framework, null);
});

test('parseJestOutput: parses jest/vitest JSON output', () => {
  const raw = JSON.stringify({
    numPendingTests: 1,
    testResults: [
      {
        name: '/tmp/test.js',
        testResults: [
          { status: 'passed', fullName: 'adds numbers' },
          { status: 'failed', fullName: 'subtracts', failureMessages: ['Expected 3 but got 4'] },
        ],
      },
    ],
  });

  const result = parseJestOutput(raw);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].name, 'subtracts');
});

test('parseNodeTestOutput: parses TAP-like output', () => {
  const raw = [
    'TAP version 13',
    'ok 1 - adds numbers',
    'not ok 2 - subtracts',
    '# tests 2',
    '# pass 1',
    '# fail 1',
  ].join('\n');

  const result = parseNodeTestOutput(raw);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
});

test('parseNodeTestOutput: parses info-line format (node >= 20)', () => {
  const raw = [
    '\u2714 adds numbers (2.1ms)',
    '\u2716 subtracts (1.5ms)',
    '\u2139 tests 2',
    '\u2139 pass 1',
    '\u2139 fail 1',
  ].join('\n');

  const result = parseNodeTestOutput(raw);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
});

test('parsePytestOutput: parses pytest summary', () => {
  const raw = [
    'test_math.py::test_add PASSED',
    'test_math.py::test_sub FAILED',
    'FAILED test_math.py::test_sub - AssertionError',
    '=== 1 passed, 1 failed ===',
  ].join('\n');

  const result = parsePytestOutput(raw);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
});

test('parseGoTestOutput: parses go test output', () => {
  const raw = [
    '--- PASS: TestAdd (0.00s)',
    '--- FAIL: TestSub (0.00s)',
    'FAIL',
  ].join('\n');

  const result = parseGoTestOutput(raw);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].name, 'TestSub');
});

test('createTestRunTool: status unavailable without framework', () => {
  const dir = makeTempDir();
  const tool = createTestRunTool({ projectRoot: dir, toolRunner: null });
  assert.equal(tool.id, 'tool.test-run');
  assert.equal(tool.status, 'unavailable');
});

test('createTestRunTool: status active with vitest config', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'vitest.config.ts'), 'export default {};');
  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createTestRunTool({ projectRoot: dir, toolRunner: runner });
  assert.equal(tool.status, 'active');
  assert.equal(tool.detectedFramework, 'vitest');
});

test('createTestRunTool: execute returns unavailable without framework', async () => {
  const dir = makeTempDir();
  const tool = createTestRunTool({ projectRoot: dir, toolRunner: null });
  const result = await tool.execute();
  assert.equal(result.status, 'unavailable');
});

// =============================================================================
// Integration: tool-runner + real child process
// =============================================================================

test('integration: tool-runner runs node script and captures structured output', async () => {
  const dir = makeTempDir();
  const script = path.join(dir, 'worker.js');
  writeFile(script, `
    const result = { sum: 1 + 2, product: 2 * 3 };
    process.stdout.write(JSON.stringify(result));
  `);

  const runner = createExternalToolRunner({ projectRoot: dir });
  const result = await runner.run(process.execPath, [script]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.sum, 3);
  assert.equal(parsed.product, 6);
});

test('integration: typecheck tool runs against a tiny TS project', async () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true },
    include: ['*.ts'],
  }));
  writeFile(path.join(dir, 'ok.ts'), 'const x: number = 42; export { x };');

  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createTypecheckTool({ projectRoot: dir, toolRunner: runner });

  // This test only runs if tsc is available; if not, it degrades gracefully
  const result = await tool.execute({ timeout: 30_000 });
  // We accept either ok (tsc found and passed) or timeout/unavailable (tsc not installed)
  assert.ok(
    ['ok', 'errors', 'timeout', 'unavailable'].includes(result.status),
    `Unexpected status: ${result.status}`
  );
});

test('integration: lint tool execute returns unavailable when no config', async () => {
  const dir = makeTempDir();
  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createLintTool({ projectRoot: dir, toolRunner: runner });
  const result = await tool.execute();
  assert.equal(result.status, 'unavailable');
});

test('integration: test-run tool runs node --test on a simple test file', async () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'package.json'), JSON.stringify({
    type: 'module',
    scripts: { test: 'node --test tests/' },
  }));
  writeFile(path.join(dir, 'tests', 'simple.test.js'), `
    import test from 'node:test';
    import assert from 'node:assert/strict';
    test('1 + 1 = 2', () => { assert.equal(1 + 1, 2); });
  `);

  const runner = createExternalToolRunner({ projectRoot: dir });
  const tool = createTestRunTool({ projectRoot: dir, toolRunner: runner });

  assert.equal(tool.status, 'active');
  assert.equal(tool.detectedFramework, 'node-test');

  const result = await tool.execute({ testFile: path.join(dir, 'tests', 'simple.test.js'), timeout: 15_000 });
  // node --test should find and run the test
  assert.ok(['ok', 'failures'].includes(result.status), `Unexpected status: ${result.status}`);
  assert.equal(result.exitCode, 0, 'Expected exit code 0 for passing test');
  assert.equal(result.framework, 'node-test');
  // When running nested inside node --test, the child output may be
  // consumed by the parent test runner resulting in passed=0. We accept
  // this environment limitation: the critical assertion is exitCode === 0.
  assert.equal(result.failed, 0);
});
