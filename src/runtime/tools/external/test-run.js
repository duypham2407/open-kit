// ---------------------------------------------------------------------------
// tool.test-run — Run project tests and return structured pass/fail results
//
// Gated: active only when a test framework is detected in the project root.
// Supports: vitest, jest, node:test, pytest, go test.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

// -- Framework detection -----------------------------------------------------

const FRAMEWORK_CONFIGS = [
  // vitest
  { framework: 'vitest', files: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'vitest.config.mjs'] },
  // jest
  { framework: 'jest', files: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'] },
  // go
  { framework: 'go', files: ['go.mod'] },
  // pytest
  { framework: 'pytest', files: ['pytest.ini', 'pyproject.toml', 'setup.cfg', 'conftest.py'] },
];

/**
 * Detect which test framework is configured in the project root.
 * Returns { framework: string | null, configPath: string | null }.
 */
export function detectTestFramework(projectRoot) {
  // Check for explicit config files first
  for (const { framework, files } of FRAMEWORK_CONFIGS) {
    for (const name of files) {
      const full = path.join(projectRoot, name);
      if (fs.existsSync(full)) {
        // For pyproject.toml, also check [tool.pytest] section
        if (name === 'pyproject.toml') {
          try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('[tool.pytest') || content.includes('[tool.pytest.ini_options]')) {
              return { framework, configPath: full };
            }
          } catch { /* ignore */ }
          continue;
        }
        // For setup.cfg, check for [tool:pytest]
        if (name === 'setup.cfg') {
          try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('[tool:pytest]')) {
              return { framework, configPath: full };
            }
          } catch { /* ignore */ }
          continue;
        }
        return { framework, configPath: full };
      }
    }
  }

  // Check package.json for jest config or vitest dependency
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.jest) return { framework: 'jest', configPath: pkgPath };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.vitest) return { framework: 'vitest', configPath: pkgPath };
      if (allDeps.jest) return { framework: 'jest', configPath: pkgPath };
    } catch { /* ignore parse errors */ }
  }

  // Check for node:test pattern — if package.json has a test script using node --test
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts?.test && pkg.scripts.test.includes('node --test')) {
        return { framework: 'node-test', configPath: pkgPath };
      }
    } catch { /* ignore */ }
  }

  return { framework: null, configPath: null };
}

// -- Test output parsing -----------------------------------------------------

/**
 * Parse vitest/jest JSON output into structured results.
 * Both use a similar structure with testResults array.
 */
export function parseJestOutput(raw) {
  try {
    const data = JSON.parse(raw);
    const suites = data.testResults ?? data.suites ?? [];
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const suite of suites) {
      const tests = suite.testResults ?? suite.assertionResults ?? [];
      for (const t of tests) {
        const status = t.status ?? (t.passed ? 'passed' : 'failed');
        if (status === 'passed') {
          passed++;
        } else if (status === 'failed') {
          failed++;
          failures.push({
            name: t.fullName ?? t.title ?? t.name ?? 'unknown',
            file: suite.name ?? suite.filePath ?? null,
            message: (t.failureMessages ?? []).join('\n').slice(0, 1000),
          });
        }
      }
    }

    return { passed, failed, skipped: data.numPendingTests ?? 0, failures };
  } catch {
    return null;
  }
}

/**
 * Parse node:test TAP-like output into structured results.
 * node --test outputs a simple TAP or human-readable format.
 */
export function parseNodeTestOutput(raw) {
  const lines = raw.split('\n');
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match TAP format: "# pass N"
    const tapPassMatch = trimmed.match(/^#\s+pass\s+(\d+)/);
    if (tapPassMatch) { passed = parseInt(tapPassMatch[1], 10); continue; }

    const tapFailMatch = trimmed.match(/^#\s+fail\s+(\d+)/);
    if (tapFailMatch) { failed = parseInt(tapFailMatch[1], 10); continue; }

    // Match info-line format (node >= 20): "ℹ pass N" or "ℹ fail N"
    // The ℹ character is U+2139 but node outputs various formats
    const infoPassMatch = trimmed.match(/^(?:ℹ|ℹ️|info)\s+pass\s+(\d+)/);
    if (infoPassMatch) { passed = parseInt(infoPassMatch[1], 10); continue; }

    const infoFailMatch = trimmed.match(/^(?:ℹ|ℹ️|info)\s+fail\s+(\d+)/);
    if (infoFailMatch) { failed = parseInt(infoFailMatch[1], 10); continue; }

    // Match TAP "not ok" lines for failure details
    const notOk = trimmed.match(/^not ok\s+\d+\s*[-–—]?\s*(.+)/);
    if (notOk) {
      failures.push({
        name: notOk[1].trim(),
        file: null,
        message: '',
      });
    }

    // Match node test runner "✖" failure lines
    const crossFail = trimmed.match(/^✖\s+(.+?)(?:\s+\([\d.]+(?:ms|s)\))?$/);
    if (crossFail) {
      failures.push({
        name: crossFail[1].trim(),
        file: null,
        message: '',
      });
    }
  }

  return { passed, failed, skipped: 0, failures };
}

/**
 * Parse pytest output into structured results.
 */
export function parsePytestOutput(raw) {
  const lines = raw.split('\n');
  let passed = 0;
  let failed = 0;
  const failures = [];

  // Look for the summary line: "X passed, Y failed"
  for (const line of lines) {
    const summaryMatch = line.match(/(\d+)\s+passed/);
    if (summaryMatch) passed = parseInt(summaryMatch[1], 10);
    const failedMatch = line.match(/(\d+)\s+failed/);
    if (failedMatch) failed = parseInt(failedMatch[1], 10);
  }

  // Collect FAILED lines
  for (const line of lines) {
    const failLine = line.match(/^FAILED\s+(.+?)(?:\s+-\s+(.+))?$/);
    if (failLine) {
      failures.push({
        name: failLine[1].trim(),
        file: null,
        message: failLine[2]?.trim() ?? '',
      });
    }
  }

  return { passed, failed, skipped: 0, failures };
}

/**
 * Parse go test output into structured results.
 */
export function parseGoTestOutput(raw) {
  const lines = raw.split('\n');
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--- PASS:')) passed++;
    if (trimmed.startsWith('--- FAIL:')) {
      failed++;
      const nameMatch = trimmed.match(/--- FAIL:\s+(\S+)/);
      failures.push({
        name: nameMatch?.[1] ?? 'unknown',
        file: null,
        message: '',
      });
    }
  }

  return { passed, failed, skipped: 0, failures };
}

// -- Binary detection --------------------------------------------------------

function detectTestBinary(projectRoot, framework) {
  if (framework === 'vitest') {
    const localBin = path.join(projectRoot, 'node_modules', '.bin', 'vitest');
    if (fs.existsSync(localBin)) return { command: localBin, args: [] };
    return { command: 'npx', args: ['vitest'] };
  }

  if (framework === 'jest') {
    const localBin = path.join(projectRoot, 'node_modules', '.bin', 'jest');
    if (fs.existsSync(localBin)) return { command: localBin, args: [] };
    return { command: 'npx', args: ['jest'] };
  }

  if (framework === 'node-test') {
    return { command: process.execPath, args: ['--test'] };
  }

  if (framework === 'pytest') {
    return { command: 'pytest', args: [] };
  }

  if (framework === 'go') {
    return { command: 'go', args: ['test'] };
  }

  return null;
}

// -- Tool factory ------------------------------------------------------------

/**
 * Create the tool.test-run tool definition.
 *
 * @param {object} options
 * @param {string} options.projectRoot  Absolute path to the project root.
 * @param {object} options.toolRunner   An external tool runner instance.
 * @returns {object} Tool definition compatible with the tool registry.
 */
export function createTestRunTool({ projectRoot, toolRunner }) {
  const { framework, configPath } = detectTestFramework(projectRoot);
  const isActive = framework !== null;

  return {
    id: 'tool.test-run',
    name: 'Test Runner Tool',
    description:
      'Run project tests and return structured pass/fail results. ' +
      'Auto-detects the test framework (vitest, jest, node:test, pytest, go test). ' +
      'Supports running a single test file or the full suite.',
    family: 'external',
    stage: 'foundation',
    status: isActive ? 'active' : 'unavailable',
    validationSurface: 'target_project_app',
    detectedFramework: framework,
    async execute({ testFile, testName, timeout = 120_000 } = {}) {
      if (!isActive) {
        return {
          status: 'unavailable',
          reason: 'No test framework detected in project root.',
        };
      }

      if (!toolRunner) {
        return {
          status: 'unavailable',
          reason: 'External tool runner is not configured.',
        };
      }

      const binary = detectTestBinary(projectRoot, framework);
      if (!binary) {
        return {
          status: 'unavailable',
          reason: `Cannot detect binary for framework: ${framework}`,
        };
      }

      const cmdArgs = [...binary.args];

      // Framework-specific argument building
      if (framework === 'vitest') {
        cmdArgs.push('run'); // non-watch mode
        if (testFile) cmdArgs.push(testFile);
        if (testName) cmdArgs.push('--reporter', 'json', '-t', testName);
        else cmdArgs.push('--reporter', 'json');
      } else if (framework === 'jest') {
        if (testFile) cmdArgs.push(testFile);
        if (testName) cmdArgs.push('-t', testName);
        cmdArgs.push('--json', '--forceExit');
      } else if (framework === 'node-test') {
        if (testFile) cmdArgs.push(testFile);
        else cmdArgs.push('tests/');
      } else if (framework === 'pytest') {
        if (testFile) cmdArgs.push(testFile);
        if (testName) cmdArgs.push('-k', testName);
        cmdArgs.push('-v');
      } else if (framework === 'go') {
        if (testFile) cmdArgs.push(testFile);
        else cmdArgs.push('./...');
        if (testName) cmdArgs.push('-run', testName);
        cmdArgs.push('-v');
      }

      const result = await toolRunner.run(binary.command, cmdArgs, { timeout });

      if (result.timedOut) {
        return {
          status: 'timeout',
          reason: `${framework} timed out after ${timeout}ms.`,
          stdout: result.stdout.slice(0, 2000),
          stderr: result.stderr.slice(0, 2000),
        };
      }

      const rawOutput = result.stdout || result.stderr;
      let parsed;

      if (framework === 'vitest' || framework === 'jest') {
        parsed = parseJestOutput(rawOutput);
      } else if (framework === 'node-test') {
        parsed = parseNodeTestOutput(rawOutput);
      } else if (framework === 'pytest') {
        parsed = parsePytestOutput(rawOutput);
      } else if (framework === 'go') {
        parsed = parseGoTestOutput(rawOutput);
      }

      // If parsing failed, return raw output
      if (!parsed) {
        return {
          status: result.exitCode === 0 ? 'ok' : 'errors',
          framework,
          exitCode: result.exitCode,
          passed: null,
          failed: null,
          parseError: true,
          stdout: result.stdout.slice(0, 4000),
          stderr: result.stderr.slice(0, 4000),
        };
      }

      return {
        status: parsed.failed > 0 ? 'failures' : 'ok',
        framework,
        configPath,
        exitCode: result.exitCode,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
        failures: parsed.failures,
        testFile: testFile ?? null,
        testName: testName ?? null,
      };
    },
  };
}
