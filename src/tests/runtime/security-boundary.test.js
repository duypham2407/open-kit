// Regression tests for audit fixes [4-H-1] / [4-H-2] / [4-H-3] / [4-H-4]:
// config-loaded commands and file:// prompt references must be validated
// against shell-injection / launcher-abuse / project-root-traversal before
// being spawned or read.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { validateCommandSafety, validateAbsolutePathPrefix } from '../../global/mcp/command-safety.js';
import { materializePromptFileReferences } from '../../runtime/config/prompt-file-loader.js';

// ── command-safety: validateCommandSafety ─────────────────────────────────

test('validateCommandSafety accepts a plain absolute-path command + argv array', () => {
  const result = validateCommandSafety('/usr/bin/echo', ['hello']);
  assert.equal(result.ok, true);
});

test('validateCommandSafety rejects empty command', () => {
  const result = validateCommandSafety('', []);
  assert.equal(result.ok, false);
  assert.match(result.reason, /non-empty/);
});

test('validateCommandSafety rejects shell operators in the command itself', () => {
  const result = validateCommandSafety('/bin/sh; rm -rf /tmp', []);
  assert.equal(result.ok, false);
  assert.match(result.reason, /shell operators/);
});

test('validateCommandSafety rejects shell operators in args', () => {
  const result = validateCommandSafety('/usr/bin/echo', ['hello && rm -rf /tmp']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /shell operators/);
});

test('validateCommandSafety rejects shell launcher with -c flag (defeats argv safety)', () => {
  const result = validateCommandSafety('bash', ['-c', 'rm -rf /tmp']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /shell launcher/);
});

test('validateCommandSafety accepts node binary even though name overlaps with launcher list semantics', () => {
  const result = validateCommandSafety('/usr/local/bin/node', ['script.js']);
  assert.equal(result.ok, true);
});

// ── command-safety: validateAbsolutePathPrefix ────────────────────────────

test('validateAbsolutePathPrefix accepts /usr/bin/security', () => {
  const result = validateAbsolutePathPrefix('/usr/bin/security', ['/usr/']);
  assert.equal(result.ok, true);
});

test('validateAbsolutePathPrefix rejects /tmp/evil', () => {
  const result = validateAbsolutePathPrefix('/tmp/evil', ['/usr/']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /must start with/);
});

test('validateAbsolutePathPrefix rejects relative path', () => {
  const result = validateAbsolutePathPrefix('security', ['/usr/']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /absolute path/);
});

test('validateAbsolutePathPrefix rejects path with shell operators', () => {
  const result = validateAbsolutePathPrefix('/usr/bin/security; touch /tmp/sentinel', ['/usr/']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /shell operators/);
});

// ── prompt-file-loader: project-root boundary [4-H-4] ─────────────────────

test('materializePromptFileReferences rejects file:///etc/passwd-style absolute paths outside project root', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-prompt-'));

  // /etc/passwd typically exists; the loader should reject before reading.
  let threw = false;
  let warning = null;
  try {
    const result = materializePromptFileReferences(
      {
        agents: {
          test: { prompt: 'file:///etc/passwd' },
        },
      },
      { projectRoot },
    );
    // The loader catches errors and pushes to warnings; the prompt remains
    // the original URI string. Either path is acceptable as "rejected".
    if (result.warnings.some((w) => /outside the project root/.test(w))) {
      warning = result.warnings.find((w) => /outside the project root/.test(w));
    } else if (result.config.agents.test.prompt === 'file:///etc/passwd') {
      // Unchanged value also indicates the read was blocked.
      warning = 'rejected (prompt value unchanged from URI)';
    }
  } catch (err) {
    threw = err;
  }

  assert.ok(
    threw || warning,
    'file:// prompt outside project root must be rejected (either thrown or pushed to warnings)',
  );

  fs.rmSync(projectRoot, { recursive: true, force: true });
});

test('materializePromptFileReferences accepts file://./relative-paths inside project root', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-prompt-ok-'));
  fs.writeFileSync(path.join(projectRoot, 'prompt.md'), 'hello world');

  const result = materializePromptFileReferences(
    {
      agents: {
        test: { prompt: 'file://./prompt.md' },
      },
    },
    { projectRoot },
  );

  assert.equal(result.config.agents.test.prompt, 'hello world');
  assert.equal(result.warnings.length, 0);

  fs.rmSync(projectRoot, { recursive: true, force: true });
});
