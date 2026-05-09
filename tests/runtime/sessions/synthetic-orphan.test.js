import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticOrphanIdFor } from '../../../src/runtime/sessions/synthetic-orphan.js';

describe('synthetic-orphan', () => {
  it('produces stable id for same workItemId', () => {
    assert.equal(syntheticOrphanIdFor('full-x'), syntheticOrphanIdFor('full-x'));
  });
  it('produces s_orphan_<8hex>', () => {
    assert.match(syntheticOrphanIdFor('full-x'), /^s_orphan_[0-9a-f]{8}$/);
  });
  it('distinct ids for distinct work items', () => {
    assert.notEqual(syntheticOrphanIdFor('full-x'), syntheticOrphanIdFor('full-y'));
  });
});
