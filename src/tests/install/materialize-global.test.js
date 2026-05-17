import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { materializeGlobalInstall } from '../../global/materialize.js';

function setupEnv() {
  const openCodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-e2e-'));
  return {
    env: { OPENCODE_HOME: openCodeHome },
    cleanup: () => fs.rmSync(openCodeHome, { recursive: true, force: true }),
  };
}

describe('materializeGlobalInstall — Layer A discovery', () => {
  test('creates <kitRoot>/commands with curated commands', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      for (const cmd of ['delivery', 'quick-task', 'migrate', 'finish', 'write-solution', 'execute-solution', 'switch-profiles', 'configure-agent-models']) {
        assert.ok(
          fs.existsSync(path.join(result.kitRoot, 'commands', `${cmd}.md`)),
          `<kitRoot>/commands/${cmd}.md should exist`
        );
      }
    } finally {
      cleanup();
    }
  });

  test('creates <kitRoot>/agents with PascalCase files', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      for (const agent of ['MasterOrchestrator', 'QuickAgent']) {
        assert.ok(
          fs.existsSync(path.join(result.kitRoot, 'agents', `${agent}.md`)),
          `<kitRoot>/agents/${agent}.md should exist`
        );
      }
    } finally {
      cleanup();
    }
  });

  test('creates <kitRoot>/skills with SKILL.md entries', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      const skillsDir = path.join(result.kitRoot, 'skills');
      assert.ok(fs.existsSync(skillsDir));
      const skills = fs.readdirSync(skillsDir).filter((n) => !n.startsWith('.'));
      assert.ok(skills.length >= 1);
    } finally {
      cleanup();
    }
  });

  test('keeps Layer B at <kitRoot>/src/openkit-runtime/workflow-state.js', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      assert.ok(fs.existsSync(path.join(result.kitRoot, 'src', 'openkit-runtime', 'workflow-state.js')));
    } finally {
      cleanup();
    }
  });
});
