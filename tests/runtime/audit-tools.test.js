import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuleScanTool } from '../../src/runtime/tools/audit/rule-scan.js';
import { createSecurityScanTool } from '../../src/runtime/tools/audit/security-scan.js';
import { isSemgrepAvailable, ensureSemgrepInstalled, getToolingEnv } from '../../src/global/tooling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-audit-'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// --- isSemgrepAvailable tests ---

test('isSemgrepAvailable returns false when no semgrep executable exists', () => {
  const tempHome = makeTempDir();
  const result = isSemgrepAvailable({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });
  assert.equal(result, false);
});

test('isSemgrepAvailable returns true when semgrep shim exists in tooling bin', () => {
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  writeExecutable(path.join(toolingBin, 'semgrep'), '#!/bin/sh\nexit 0\n');

  const result = isSemgrepAvailable({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });
  assert.equal(result, true);
});

test('isSemgrepAvailable returns true when semgrep is on system PATH', () => {
  const tempHome = makeTempDir();
  const fakeBin = makeTempDir();
  writeExecutable(path.join(fakeBin, 'semgrep'), '#!/bin/sh\nexit 0\n');

  const result = isSemgrepAvailable({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: fakeBin,
    },
  });
  assert.equal(result, true);
});

// --- ensureSemgrepInstalled tests ---

test('ensureSemgrepInstalled links existing semgrep from PATH', () => {
  const tempHome = makeTempDir();
  const fakeBin = makeTempDir();
  writeExecutable(path.join(fakeBin, 'semgrep'), '#!/bin/sh\necho semgrep\n');

  const result = ensureSemgrepInstalled({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: fakeBin,
    },
    spawn: () => ({ status: 0, stdout: '', stderr: '', error: null }),
  });

  assert.equal(result.action, 'installed');
  assert.equal(result.installed, true);

  const shimPath = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep');
  assert.equal(fs.existsSync(shimPath), true);
});

test('ensureSemgrepInstalled falls back to pip when no semgrep on PATH', () => {
  const tempHome = makeTempDir();
  let spawnCalled = false;

  const result = ensureSemgrepInstalled({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
    spawn: (cmd, args) => {
      spawnCalled = true;
      assert.equal(cmd, 'python3');
      assert.ok(args.includes('semgrep'));
      return { status: 0, stdout: '', stderr: '', error: null };
    },
  });

  assert.equal(spawnCalled, true);
  assert.equal(result.action, 'installed');
  assert.equal(result.installed, true);

  const shimPath = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep');
  assert.equal(fs.existsSync(shimPath), true);
  const shimContent = fs.readFileSync(shimPath, 'utf8');
  assert.match(shimContent, /python3/);
});

test('ensureSemgrepInstalled returns failed when pip install fails', () => {
  const tempHome = makeTempDir();

  const result = ensureSemgrepInstalled({
    env: {
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
    spawn: () => ({ status: 1, stdout: '', stderr: 'pip error', error: null }),
  });

  assert.equal(result.action, 'failed');
  assert.equal(result.installed, false);
  assert.equal(result.exitCode, 1);
});

// --- createRuleScanTool tests ---

test('rule-scan tool returns dependency-missing when semgrep is not available', () => {
  const projectRoot = makeTempDir();

  // Ensure semgrep is not on PATH by clearing it
  const originalEnv = process.env;
  const tempHome = makeTempDir();
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: '' };

  try {
    const tool = createRuleScanTool({ projectRoot });
    assert.equal(tool.id, 'tool.rule-scan');
    assert.equal(tool.family, 'audit');
    assert.equal(tool.stage, 'foundation');
    assert.equal(tool.status, 'active');

    const result = tool.execute({});
    assert.equal(result.status, 'dependency-missing');
    assert.equal(result.provider, 'semgrep');
    assert.deepEqual(result.findings, []);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan tool resolves auto config to bundled quality-default pack', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  // Create a fake semgrep that outputs valid JSON
  const fakeOutput = JSON.stringify({
    results: [
      {
        check_id: 'openkit.quality.no-console-log',
        path: 'src/index.js',
        start: { line: 10, col: 1 },
        end: { line: 10, col: 30 },
        extra: { severity: 'WARNING', message: 'Avoid console.log' },
      },
    ],
  });

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '${fakeOutput}'\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'auto' });

    assert.equal(result.status, 'ok');
    assert.equal(result.provider, 'semgrep');
    // The auto config should be resolved to the bundled pack path
    assert.match(result.config, /quality-default\.yml$/);
    assert.equal(result.findingCount, 1);
    assert.equal(result.findings[0].checkId, 'openkit.quality.no-console-log');
    assert.equal(result.findings[0].severity, 'WARNING');
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan tool passes explicit config through without resolving', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '{"results":[]}'\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/javascript' });

    assert.equal(result.status, 'ok');
    assert.equal(result.config, 'p/javascript');
    assert.equal(result.findingCount, 0);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan tool normalizes findings correctly', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  const fakeOutput = JSON.stringify({
    results: [
      {
        check_id: 'rule-a',
        path: 'a.js',
        start: { line: 1, col: 1 },
        end: { line: 1, col: 10 },
        extra: { severity: 'ERROR', message: 'msg a' },
      },
      {
        check_id: 'rule-b',
        path: 'b.js',
        start: { line: 5, col: 3 },
        end: { line: 5, col: 20 },
        extra: {},
      },
    ],
  });

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '${fakeOutput}'\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });

    assert.equal(result.findingCount, 2);
    assert.equal(result.findings[0].checkId, 'rule-a');
    assert.equal(result.findings[0].severity, 'ERROR');
    assert.equal(result.findings[0].message, 'msg a');
    // Missing severity/message defaults
    assert.equal(result.findings[1].checkId, 'rule-b');
    assert.equal(result.findings[1].severity, 'INFO');
    assert.equal(result.findings[1].message, '');
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan tool returns scan-failed for non-zero/non-one exit codes', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '{"results":[]}'\nexit 2\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });

    assert.equal(result.status, 'scan-failed');
    assert.equal(result.exitCode, 2);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan tool treats exit code 1 (findings present) as ok', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  const fakeOutput = JSON.stringify({
    results: [
      { check_id: 'r1', path: 'f.js', start: { line: 1, col: 1 }, end: { line: 1, col: 5 }, extra: { severity: 'WARNING', message: 'w' } },
    ],
  });

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '${fakeOutput}'\nexit 1\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });

    assert.equal(result.status, 'ok');
    assert.equal(result.exitCode, 1);
    assert.equal(result.findingCount, 1);
  } finally {
    process.env = originalEnv;
  }
});

// --- createSecurityScanTool tests ---

test('security-scan tool returns dependency-missing when semgrep is not available', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: '' };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    assert.equal(tool.id, 'tool.security-scan');

    const result = tool.execute({});
    assert.equal(result.status, 'dependency-missing');
    assert.equal(result.provider, 'semgrep');
  } finally {
    process.env = originalEnv;
  }
});

test('security-scan tool defaults to bundled security-audit pack', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '{"results":[]}'\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    const result = tool.execute({});

    assert.equal(result.status, 'ok');
    // Should resolve to bundled security-audit pack
    assert.match(result.config, /security-audit\.yml$/);
  } finally {
    process.env = originalEnv;
  }
});

test('security-scan tool allows config override', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '{"results":[]}'\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    const result = tool.execute({ config: '/custom/rules.yml' });

    assert.equal(result.status, 'ok');
    assert.equal(result.config, '/custom/rules.yml');
  } finally {
    process.env = originalEnv;
  }
});

// --- Rule pack resolution tests ---

test('bundled quality-default.yml pack file exists and is valid YAML', () => {
  const packPath = path.resolve(__dirname, '../../assets/semgrep/packs/quality-default.yml');
  assert.equal(fs.existsSync(packPath), true);
  const content = fs.readFileSync(packPath, 'utf8');
  assert.match(content, /rules:/);
  assert.match(content, /openkit\.quality\./);
});

test('bundled security-audit.yml pack file exists and is valid YAML', () => {
  const packPath = path.resolve(__dirname, '../../assets/semgrep/packs/security-audit.yml');
  assert.equal(fs.existsSync(packPath), true);
  const content = fs.readFileSync(packPath, 'utf8');
  assert.match(content, /rules:/);
  assert.match(content, /openkit\.security\./);
});

// --- getToolingEnv test ---

test('getToolingEnv prepends tooling bin to PATH', () => {
  const tempHome = makeTempDir();
  const env = getToolingEnv({
    OPENCODE_HOME: tempHome,
    PATH: '/usr/bin',
  });

  const expectedBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  assert.ok(env.PATH.startsWith(expectedBin));
  assert.ok(env.PATH.includes('/usr/bin'));
});
