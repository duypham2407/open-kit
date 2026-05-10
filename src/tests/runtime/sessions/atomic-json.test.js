import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicReadModifyWrite, atomicReadJson } from '../../../runtime/sessions/atomic-json.js';
import { IndexLockTimeoutError } from '../../../runtime/sessions/errors.js';

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-atomic-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('atomic-json', () => {
  it('creates file on first write', async () => {
    const file = path.join(tmp, 'a.json');
    await atomicReadModifyWrite(file, () => ({ count: 1 }), { defaultValue: { count: 0 } });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { count: 1 });
  });

  it('mutates an existing file under lock', async () => {
    const file = path.join(tmp, 'b.json');
    fs.writeFileSync(file, JSON.stringify({ count: 1 }));
    await atomicReadModifyWrite(file, (current) => ({ count: current.count + 1 }));
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { count: 2 });
  });

  it('atomicReadJson returns default when file missing', () => {
    const file = path.join(tmp, 'missing.json');
    assert.deepEqual(atomicReadJson(file, { x: 1 }), { x: 1 });
  });

  it('does not leak tmp files on success', async () => {
    const file = path.join(tmp, 'c.json');
    await atomicReadModifyWrite(file, () => ({ k: 'v' }), { defaultValue: {} });
    const stray = fs.readdirSync(tmp).filter((n) => n.startsWith('c.json.tmp'));
    assert.deepEqual(stray, []);
  });
});

import { setTimeout as delay } from 'node:timers/promises';
describe('atomic-json concurrency', () => {
  it('serializes two concurrent increments', async () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-atomic2-'));
    const file = path.join(tmp2, 'race.json');
    fs.writeFileSync(file, JSON.stringify({ n: 0 }));
    await Promise.all([
      atomicReadModifyWrite(file, async (cur) => { await delay(20); return { n: cur.n + 1 }; }),
      atomicReadModifyWrite(file, async (cur) => { await delay(20); return { n: cur.n + 1 }; }),
    ]);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { n: 2 });
    fs.rmSync(tmp2, { recursive: true, force: true });
  });
});
