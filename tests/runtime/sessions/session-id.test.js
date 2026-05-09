import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionId, isValidSessionId, isSyntheticOrphanId } from '../../../src/runtime/sessions/session-id.js';

describe('session-id', () => {
  it('generates s_ prefix + 6 hex chars', () => {
    const id = generateSessionId();
    assert.match(id, /^s_[0-9a-f]{6}$/);
  });

  it('two consecutive ids differ', () => {
    assert.notEqual(generateSessionId(), generateSessionId());
  });

  it('isValidSessionId accepts both runtime and synthetic forms', () => {
    assert.equal(isValidSessionId('s_abcdef'), true);
    assert.equal(isValidSessionId('s_orphan_12345678'), true);
    assert.equal(isValidSessionId('s_'), false);
    assert.equal(isValidSessionId('abc'), false);
    assert.equal(isValidSessionId('s_ABCDEF'), false);
    assert.equal(isValidSessionId(null), false);
  });

  it('isSyntheticOrphanId distinguishes synthetic ids', () => {
    assert.equal(isSyntheticOrphanId('s_orphan_12345678'), true);
    assert.equal(isSyntheticOrphanId('s_abcdef'), false);
    assert.equal(isSyntheticOrphanId(null), false);
    assert.equal(isSyntheticOrphanId('s_orphan_1234567'), false);
  });
});
