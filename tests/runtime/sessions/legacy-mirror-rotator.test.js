import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rotateLegacyMirror } from '../../../src/runtime/sessions/legacy-mirror-rotator.js';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-rot-')); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('legacy-mirror-rotator', () => {
  it('rotates non-stub mirror and writes stub', () => {
    const file = path.join(base, 'workflow-state.json');
    fs.writeFileSync(file, JSON.stringify({ stage: 'quick_intake' }));
    const r = rotateLegacyMirror(base);
    assert.equal(r.rotated, true);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(after.schema, 'openkit/legacy-stub@1');
    const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
    assert.equal(legacies.length, 1);
  });

  it('does not rotate stub', () => {
    const file = path.join(base, 'workflow-state.json');
    fs.writeFileSync(file, JSON.stringify({ schema: 'openkit/legacy-stub@1' }));
    const r = rotateLegacyMirror(base);
    assert.equal(r.rotated, false);
  });

  it('caps rotated files at 10 oldest-first', async () => {
    const file = path.join(base, 'workflow-state.json');
    for (let i = 0; i < 12; i++) {
      fs.writeFileSync(file, JSON.stringify({ tick: i }));
      rotateLegacyMirror(base);
      // pause to ensure unique timestamps and mtime spread
      await new Promise((r) => setTimeout(r, 10));
    }
    const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
    assert.ok(legacies.length <= 10, `expected ≤ 10, got ${legacies.length}`);
  });

  it('handles missing source file as no-op', () => {
    const r = rotateLegacyMirror(base);
    assert.equal(r.rotated, false);
  });
});
