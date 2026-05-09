import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SessionRequiredError,
  SessionNotFoundError,
  SessionStateMismatchError,
  SessionAlreadyBoundError,
  WorktreeMissingError,
  IndexLockTimeoutError,
} from '../../../src/runtime/sessions/errors.js';

describe('sessions/errors', () => {
  it('SessionRequiredError carries remediation hint', () => {
    const err = new SessionRequiredError();
    assert.match(err.message, /openkit run/);
    assert.equal(err.code, 'OK_SESSION_REQUIRED');
  });

  it('SessionStateMismatchError exposes both ids', () => {
    const err = new SessionStateMismatchError('s_abc', 'wi-x', 's_def');
    assert.match(err.message, /s_abc/);
    assert.match(err.message, /s_def/);
    assert.equal(err.code, 'OK_SESSION_STATE_MISMATCH');
  });

  it('IndexLockTimeoutError records the path it tried to lock', () => {
    const err = new IndexLockTimeoutError('/tmp/foo.json', 2000);
    assert.match(err.message, /\/tmp\/foo\.json/);
    assert.match(err.message, /2000/);
    assert.equal(err.code, 'OK_INDEX_LOCK_TIMEOUT');
  });
});
