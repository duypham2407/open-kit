import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuleScanTool } from '../../src/runtime/tools/audit/rule-scan.js';
import { createSecurityScanTool } from '../../src/runtime/tools/audit/security-scan.js';
import { applyTriageClassifications } from '../../src/runtime/tools/audit/scan-evidence.js';
import { findUsableSemgrepCommand, isSemgrepAvailable, ensureSemgrepInstalled, getToolingEnv } from '../../src/global/tooling.js';

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

test('isSemgrepAvailable ignores a self-recursive managed semgrep shim and uses fallback', () => {
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  const fakeBin = makeTempDir();
  const semgrepPath = path.join(toolingBin, 'semgrep');

  writeExecutable(semgrepPath, `#!/bin/sh
exec ${JSON.stringify(semgrepPath)} "$@"
`);
  writeExecutable(path.join(fakeBin, 'npx'), '#!/bin/sh\nexit 0\n');

  const env = {
    OPENCODE_HOME: tempHome,
    PATH: fakeBin,
  };

  const command = findUsableSemgrepCommand({ env });

  assert.equal(isSemgrepAvailable({ env }), true);
  assert.equal(command.command, 'npx');
  assert.deepEqual(command.args, ['--no-install', 'semgrep']);
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

test('rule-scan tool returns structured unavailable when semgrep is not available', () => {
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
    assert.equal(tool.capabilityState, 'available');
    assert.equal(tool.validationSurface, 'runtime_tooling');

    const result = tool.execute({});
    assert.equal(result.status, 'unavailable');
    assert.equal(result.capabilityState, 'unavailable');
    assert.equal(result.validationSurface, 'runtime_tooling');
    assert.equal(result.toolId, 'tool.rule-scan');
    assert.equal(result.scanKind, 'rule');
    assert.equal(result.provider, 'semgrep');
    assert.equal(result.resultState, 'unavailable');
    assert.equal(result.availability.state, 'unavailable');
    assert.match(result.availability.reason, /semgrep/i);
    assert.match(result.availability.fallback, /substitute|manual/i);
    assert.deepEqual(result.findings, []);
    assert.equal(result.findingCount, 0);
    assert.equal(result.triageSummary.groupCount, 0);
    assert.equal(result.evidenceHint.evidenceType, 'direct_tool');
    assert.equal(result.evidenceHint.validationSurface, 'runtime_tooling');
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
    assert.equal(result.capabilityState, 'available');
    assert.equal(result.validationSurface, 'runtime_tooling');
    assert.equal(result.toolId, 'tool.rule-scan');
    assert.equal(result.scanKind, 'rule');
    assert.equal(result.availability.state, 'available');
    assert.equal(result.resultState, 'succeeded');
    assert.equal(result.provider, 'semgrep');
    // The auto config should be resolved to the bundled pack path
    assert.match(result.config, /quality-default\.yml$/);
    assert.equal(result.ruleConfig.requested, 'auto');
    assert.match(result.ruleConfig.resolved, /quality-default\.yml$/);
    assert.equal(result.ruleConfig.source, 'bundled');
    assert.equal(result.findingCount, 1);
    assert.equal(result.findings[0].checkId, 'openkit.quality.no-console-log');
    assert.equal(result.findings[0].severity, 'WARNING');
    assert.equal(result.severitySummary.WARNING, 1);
    assert.equal(result.triageSummary.groupCount, 1);
    assert.equal(result.triageSummary.unclassifiedCount, 1);
    assert.equal(result.triageSummary.groups[0].ruleId, 'openkit.quality.no-console-log');
    assert.equal(result.triageSummary.groups[0].severity, 'WARNING');
    assert.equal(result.triageSummary.groups[0].classification, 'unclassified');
    assert.equal(result.evidenceHint.source, 'tool.rule-scan');
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

test('rule-scan classifies high-volume semgrep output as scan_failed with artifact refs', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\nnode -e "process.stdout.write('x'.repeat(4096))"\n`
  );

  const originalEnv = process.env;
  process.env = {
    ...process.env,
    OPENCODE_HOME: tempHome,
    PATH: toolingBin,
    OPENKIT_SEMGREP_MAX_BUFFER: '128',
  };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'auto' });

    assert.equal(result.status, 'scan_failed');
    assert.equal(result.capabilityState, 'degraded');
    assert.equal(result.resultState, 'failed');
    assert.equal(result.availability.state, 'degraded');
    assert.match(result.availability.reason, /buffer|output exceeded/i);
    assert.notEqual(result.status, 'unavailable');
    assert.equal(result.outputSummary.highVolume, true);
    assert.equal(result.artifactRefs.length, 1);
    assert.equal(fs.existsSync(path.join(projectRoot, result.artifactRefs[0])), true);
    assert.match(result.limitations.join(' '), /inline capture buffer/i);
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
    assert.equal(result.severitySummary.ERROR, 1);
    assert.equal(result.severitySummary.INFO, 1);
    assert.equal(result.triageSummary.groupCount, 2);
    assert.equal(result.triageSummary.groups[0].count, 1);
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

    assert.equal(result.status, 'scan_failed');
    assert.equal(result.capabilityState, 'available');
    assert.equal(result.availability.state, 'available');
    assert.equal(result.resultState, 'failed');
    assert.equal(result.triageSummary.groupCount, 0);
    assert.equal(result.exitCode, 2);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan returns invalid-path for targets outside project root', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  writeExecutable(path.join(toolingBin, 'semgrep'), '#!/bin/sh\necho "{\"results\":[]}"\n');

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ path: '/tmp/outside-project.js' });
    assert.equal(result.status, 'invalid_path');
    assert.equal(result.capabilityState, 'available');
    assert.equal(result.resultState, 'failed');
    assert.match(result.availability.fallback, /valid project path/i);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan returns invalid-path before checking Semgrep availability', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: '' };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ path: '/tmp/outside-project.js' });

    assert.equal(result.status, 'invalid_path');
    assert.equal(result.capabilityState, 'available');
    assert.equal(result.resultState, 'failed');
    assert.match(result.availability.reason, /outside the project root|could not be resolved/i);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan returns unavailable when Semgrep exists but cannot execute', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  fs.mkdirSync(toolingBin, { recursive: true });
  fs.writeFileSync(path.join(toolingBin, 'semgrep'), '#!/bin/sh\necho broken\n', 'utf8');

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });

    assert.equal(result.status, 'unavailable');
    assert.equal(result.capabilityState, 'unavailable');
    assert.equal(result.resultState, 'unavailable');
    assert.equal(result.availability.state, 'unavailable');
    assert.match(result.availability.reason, /semgrep/i);
    assert.match(result.availability.fallback, /substitute|manual/i);
  } finally {
    process.env = originalEnv;
  }
});

test('rule-scan returns scan-failed when semgrep output is invalid json', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  writeExecutable(path.join(toolingBin, 'semgrep'), '#!/bin/sh\necho not-json\n');

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createRuleScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });
    assert.equal(result.status, 'scan_failed');
    assert.match(result.message, /parse semgrep output/i);
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

test('scan evidence helper applies non-blocking noise triage and keeps rationale traceable', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  const fakeOutput = JSON.stringify({
    results: [
      { check_id: 'openkit.quality.noisy-rule', path: 'src/a.js', start: { line: 1, col: 1 }, end: { line: 1, col: 5 }, extra: { severity: 'WARNING', message: 'noise' } },
      { check_id: 'openkit.quality.noisy-rule', path: 'src/b.js', start: { line: 2, col: 1 }, end: { line: 2, col: 5 }, extra: { severity: 'WARNING', message: 'noise' } },
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
    const classified = applyTriageClassifications(result, [
      {
        ruleId: 'openkit.quality.noisy-rule',
        severity: 'WARNING',
        classification: 'non_blocking_noise',
        rationale: 'Broad warning unrelated to the changed files; keep traceable for rule tuning.',
        trace_ref: 'artifacts/noisy-rule.json',
      },
    ]);

    assert.equal(classified.triageSummary.unclassifiedCount, 0);
    assert.equal(classified.triageSummary.nonBlockingNoiseCount, 1);
    assert.equal(classified.triageSummary.groups[0].classification, 'non_blocking_noise');
    assert.match(classified.triageSummary.groups[0].rationale, /rule tuning/);
    assert.equal(classified.triageSummary.groups[0].trace_ref, 'artifacts/noisy-rule.json');
  } finally {
    process.env = originalEnv;
  }
});

test('scan evidence helper records full false-positive fixture details', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');

  const fakeOutput = JSON.stringify({
    results: [
      { check_id: 'openkit.security.fixture-token', path: 'tests/fixtures/token.js', start: { line: 1, col: 1 }, end: { line: 1, col: 20 }, extra: { severity: 'WARNING', message: 'token-like fixture', metadata: { category: 'security' } } },
    ],
  });

  writeExecutable(
    path.join(toolingBin, 'semgrep'),
    `#!/bin/sh\necho '${fakeOutput}'\nexit 1\n`
  );

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    const result = tool.execute({ config: 'p/test' });
    const classified = applyTriageClassifications(result, [
      {
        ruleId: 'openkit.security.fixture-token',
        severity: 'WARNING',
        classification: 'false_positive',
        rationale: 'Synthetic placeholder used only by tests.',
        false_positive: {
          rule_id: 'openkit.security.fixture-token',
          file: 'tests/fixtures/token.js',
          context: 'test fixture placeholder, not production/runtime code',
          rationale: 'Synthetic token-looking value used only in tests; not a real secret.',
          impact: 'No production/runtime security impact and no exploitable credential.',
          follow_up: 'none',
        },
      },
    ]);

    assert.equal(classified.triageSummary.falsePositiveCount, 1);
    assert.equal(classified.falsePositiveSummary.count, 1);
    assert.equal(classified.falsePositiveSummary.items[0].rule_id, 'openkit.security.fixture-token');
    assert.match(classified.falsePositiveSummary.items[0].context, /test fixture/);
    assert.match(classified.falsePositiveSummary.items[0].impact, /No production\/runtime security impact/);
    assert.equal(classified.falsePositiveSummary.items[0].follow_up, 'none');
  } finally {
    process.env = originalEnv;
  }
});

// --- createSecurityScanTool tests ---

test('security-scan tool returns structured unavailable when semgrep is not available', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: '' };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    assert.equal(tool.id, 'tool.security-scan');
    assert.equal(tool.capabilityState, 'available');
    assert.equal(tool.validationSurface, 'runtime_tooling');

    const result = tool.execute({});
    assert.equal(result.status, 'unavailable');
    assert.equal(result.capabilityState, 'unavailable');
    assert.equal(result.validationSurface, 'runtime_tooling');
    assert.equal(result.toolId, 'tool.security-scan');
    assert.equal(result.scanKind, 'security');
    assert.equal(result.provider, 'semgrep');
    assert.equal(result.evidenceHint.source, 'tool.security-scan');
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
    assert.equal(result.toolId, 'tool.security-scan');
    assert.equal(result.scanKind, 'security');
    // Should resolve to bundled security-audit pack
    assert.match(result.config, /security-audit\.yml$/);
    assert.equal(result.ruleConfig.requested, 'p/security-audit');
    assert.equal(result.ruleConfig.source, 'bundled');
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

test('security-scan preserves string target input', () => {
  const projectRoot = makeTempDir();
  const tempHome = makeTempDir();
  const toolingBin = path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin');
  const targetPath = path.join(projectRoot, 'src', 'index.js');
  writeText(targetPath, 'console.log("hi");\n');
  writeText(path.join(projectRoot, 'src', 'dummy.js'), 'export const x = 1;\n');

  writeExecutable(path.join(toolingBin, 'semgrep'), "#!/bin/sh\nnode -e \"process.stdout.write(JSON.stringify({results:[]}))\"\n");

  const originalEnv = process.env;
  process.env = { ...process.env, OPENCODE_HOME: tempHome, PATH: toolingBin };

  try {
    const tool = createSecurityScanTool({ projectRoot });
    const result = tool.execute('src/index.js');
    assert.equal(result.targetPath, path.join(projectRoot, 'src', 'index.js'));
    assert.equal(['ok', 'scan_failed'].includes(result.status), true);
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
