import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getToolingEnv } from '../../src/global/tooling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

const noVarRuleId = 'openkit.quality.no-var-declaration';
const qualityConfig = path.join(projectRoot, 'assets/semgrep/packs/quality-default.yml');
const securityConfig = path.join(projectRoot, 'assets/semgrep/packs/security-audit.yml');

const fixtures = {
  positive: 'tests/fixtures/semgrep/quality/no-var-positive.js',
  negativeModern: 'tests/fixtures/semgrep/quality/no-var-negative-modern.js',
  negativeTextMetadata: 'tests/fixtures/semgrep/quality/no-var-negative-text-metadata.js',
  mixed: 'tests/fixtures/semgrep/quality/no-var-mixed.js',
  securitySanity: 'tests/fixtures/semgrep/security/security-sanity.js',
};

function matchesRuleId(checkId, ruleId) {
  return checkId === ruleId || checkId.endsWith(`.${ruleId}`);
}

function summarizeFindings(findings) {
  return findings
    .map((finding) => `${finding.check_id} at ${finding.path}:${finding.start?.line ?? '?'}`)
    .join('; ');
}

function commandLabel(candidate) {
  return [candidate.command, ...candidate.prefixArgs].join(' ');
}

function resolveCommandPath(command, env) {
  const pathValue = env.PATH ?? '';
  for (const segment of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(segment, command);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isSelfRecursiveSemgrepShim(commandPath) {
  try {
    const contents = fs.readFileSync(commandPath, 'utf8');
    return contents.includes(`exec ${JSON.stringify(commandPath)} "$@"`);
  } catch {
    return false;
  }
}

function resolveSemgrepRunner() {
  const attempts = [];
  const candidates = [
    {
      command: 'semgrep',
      prefixArgs: [],
      env: getToolingEnv(process.env),
      source: 'OpenKit tooling PATH',
    },
    {
      command: 'npx',
      prefixArgs: ['--no-install', 'semgrep'],
      env: process.env,
      source: 'local or globally available npx package',
    },
    {
      command: 'python3',
      prefixArgs: ['-m', 'semgrep'],
      env: process.env,
      source: 'Python module fallback',
    },
  ];

  for (const candidate of candidates) {
    if (candidate.command === 'semgrep') {
      const commandPath = resolveCommandPath('semgrep', candidate.env);
      if (commandPath && isSelfRecursiveSemgrepShim(commandPath)) {
        attempts.push({
          label: commandLabel(candidate),
          source: candidate.source,
          status: 'skipped',
          error: `self-recursive shim at ${commandPath}`,
        });
        continue;
      }
    }

    const result = spawnSync(candidate.command, [...candidate.prefixArgs, '--version'], {
      cwd: projectRoot,
      env: candidate.env,
      encoding: 'utf8',
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });

    attempts.push({
      label: commandLabel(candidate),
      source: candidate.source,
      status: result.status,
      signal: result.signal,
      error: result.error?.message,
      stderr: result.stderr?.trim(),
    });

    if (result.status === 0) {
      return { ...candidate, attempts };
    }
  }

  return { unavailable: true, attempts };
}

const semgrepRunner = resolveSemgrepRunner();
const semgrepUnavailableReason = semgrepRunner.unavailable
  ? `Semgrep executable unavailable. Attempts: ${JSON.stringify(semgrepRunner.attempts)}`
  : null;
const isCiEnvironment = (Boolean(process.env.CI) && process.env.CI !== 'false' && process.env.CI !== '0')
  || (Boolean(process.env.GITHUB_ACTIONS) && process.env.GITHUB_ACTIONS !== 'false' && process.env.GITHUB_ACTIONS !== '0');
const allowLocalSemgrepSkip = process.env.OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP === '1'
  && !isCiEnvironment;

function requireSemgrepOrSkip(t) {
  if (!semgrepUnavailableReason) {
    return true;
  }

  if (allowLocalSemgrepSkip) {
    t.skip(`${semgrepUnavailableReason}. OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP=1 was set outside CI; this skipped run is local convenience only and is not valid gate evidence.`);
    return false;
  }

  assert.fail(`${semgrepUnavailableReason}. Semgrep is required for verify:semgrep-quality gate evidence. Install/provision Semgrep instead of relying on skipped tests; OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP=1 is accepted only outside CI for local convenience runs and is not valid gate evidence.`);
}

function runSemgrep(configPath, targetPath) {
  assert.equal(semgrepRunner.unavailable, undefined, semgrepUnavailableReason);

  const result = spawnSync(
    semgrepRunner.command,
    [
      ...semgrepRunner.prefixArgs,
      'scan',
      '--json',
      '--metrics=off',
      '--config',
      configPath,
      targetPath,
    ],
    {
      cwd: projectRoot,
      env: semgrepRunner.env,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  assert.ok(
    result.status === 0 || result.status === 1,
    `${commandLabel(semgrepRunner)} scan failed for ${targetPath} with status ${result.status}, signal ${result.signal}, stderr: ${result.stderr}`,
  );

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`Failed to parse Semgrep JSON for ${targetPath}: ${error.message}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
}

function noVarFindingsFor(fixturePath) {
  const output = runSemgrep(qualityConfig, fixturePath);
  return output.results.filter((finding) => matchesRuleId(finding.check_id, noVarRuleId));
}

function fixtureLine(relativePath, needle) {
  const contents = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  const index = contents.split('\n').findIndex((line) => line.includes(needle));
  assert.notEqual(index, -1, `${needle} not found in ${relativePath}`);
  return index + 1;
}

test('quality pack reports actual var declarations', (t) => {
  if (!requireSemgrepOrSkip(t)) {
    return;
  }

  const findings = noVarFindingsFor(fixtures.positive);

  assert.equal(findings.length, 1, `Expected one no-var finding; got ${summarizeFindings(findings)}`);
  assert.equal(findings[0].start.line, fixtureLine(fixtures.positive, 'var legacyValue = 1;'));
});

test('quality pack does not treat const, let, import, or test syntax as var declarations', (t) => {
  if (!requireSemgrepOrSkip(t)) {
    return;
  }

  const findings = noVarFindingsFor(fixtures.negativeModern);

  assert.equal(findings.length, 0, `Expected zero no-var findings; got ${summarizeFindings(findings)}`);
});

test('quality pack ignores object keys, env-var text, comments, strings, docs, and metadata', (t) => {
  if (!requireSemgrepOrSkip(t)) {
    return;
  }

  const findings = noVarFindingsFor(fixtures.negativeTextMetadata);

  assert.equal(findings.length, 0, `Expected zero no-var findings; got ${summarizeFindings(findings)}`);
});

test('quality pack reports only the real declaration in mixed fixtures', (t) => {
  if (!requireSemgrepOrSkip(t)) {
    return;
  }

  const findings = noVarFindingsFor(fixtures.mixed);

  assert.equal(findings.length, 1, `Expected one no-var finding; got ${summarizeFindings(findings)}`);
  assert.equal(findings[0].start.line, fixtureLine(fixtures.mixed, 'var legacyValue = 1;'));
});

test('security pack sanity still reports an OpenKit security finding', (t) => {
  if (!requireSemgrepOrSkip(t)) {
    return;
  }

  const output = runSemgrep(securityConfig, fixtures.securitySanity);
  const securityFindings = output.results.filter((finding) => finding.check_id.includes('openkit.security.'));

  assert.ok(securityFindings.length > 0, 'Expected at least one openkit.security.* finding.');
  assert.ok(
    securityFindings.some((finding) => matchesRuleId(finding.check_id, 'openkit.security.no-new-function')),
    `Expected openkit.security.no-new-function; got ${summarizeFindings(securityFindings)}`,
  );
});
