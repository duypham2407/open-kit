import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateMaterializedKitLayout, MaterializationError } from '../../global/materialize.js';

function makeTempKitRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-validate-'));
}

function writeFakeFile(filePath, content = 'fake') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function makeValidKitRoot() {
  const kitRoot = makeTempKitRoot();
  // Layer A
  writeFakeFile(path.join(kitRoot, 'opencode.json'), '{}');
  for (const cmd of ['delivery', 'quick-task', 'migrate', 'finish', 'write-solution', 'execute-solution', 'switch-profiles', 'configure-agent-models']) {
    writeFakeFile(path.join(kitRoot, 'commands', `${cmd}.md`));
  }
  for (const agent of ['MasterOrchestrator', 'ProductLead', 'SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent', 'QuickAgent']) {
    writeFakeFile(path.join(kitRoot, 'agents', `${agent}.md`));
  }
  writeFakeFile(path.join(kitRoot, 'skills', 'codebase-exploration', 'SKILL.md'));
  // Layer B
  writeFakeFile(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'));
  writeFakeFile(path.join(kitRoot, 'src', 'hooks', 'session-start.js'));
  return kitRoot;
}

describe('validateMaterializedKitLayout', () => {
  test('returns ok summary when Layer A and Layer B both present', () => {
    const kitRoot = makeValidKitRoot();
    try {
      const result = validateMaterializedKitLayout(kitRoot);
      assert.equal(result.ok, true);
      assert.ok(result.commandCount >= 8);
      assert.ok(result.agentCount >= 7);
      assert.ok(result.skillCount >= 1);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when <kitRoot>/commands missing', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'commands'), { recursive: true });
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /commands/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when <kitRoot>/agents is empty', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'agents'), { recursive: true });
      fs.mkdirSync(path.join(kitRoot, 'agents'));
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /agents/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when Layer B workflow-state.js missing', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'));
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /workflow-state\.js/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('error includes remediation hint', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'commands'), { recursive: true });
      try {
        validateMaterializedKitLayout(kitRoot);
        assert.fail('should have thrown');
      } catch (err) {
        assert.ok(err instanceof MaterializationError);
        assert.match(err.message, /sync:install-bundle|stageOpenCodeDiscoveryLayer/);
      }
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });
});
