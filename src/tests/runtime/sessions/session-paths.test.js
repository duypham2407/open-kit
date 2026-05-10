import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  sessionsDir, sessionsIndexPath, sessionDir,
  sessionMetaPath, heartbeatPath, sessionMirrorPath,
  workItemsIndexPath, legacyMirrorPath, legacyMirrorPattern,
} from '../../../runtime/sessions/session-paths.js';

const base = '/tmp/repo/.opencode';

describe('session-paths', () => {
  it('builds layout paths from baseDir', () => {
    assert.equal(sessionsDir(base), path.join(base, 'sessions'));
    assert.equal(sessionsIndexPath(base), path.join(base, 'sessions', 'index.json'));
    assert.equal(sessionDir(base, 's_abcdef'), path.join(base, 'sessions', 's_abcdef'));
    assert.equal(sessionMetaPath(base, 's_abcdef'), path.join(base, 'sessions', 's_abcdef', 'meta.json'));
    assert.equal(heartbeatPath(base, 's_abcdef'), path.join(base, 'sessions', 's_abcdef', 'heartbeat.json'));
    assert.equal(sessionMirrorPath(base, 's_abcdef'), path.join(base, 'sessions', 's_abcdef', 'workflow-state.json'));
    assert.equal(workItemsIndexPath(base), path.join(base, 'work-items', 'index.json'));
    assert.equal(legacyMirrorPath(base), path.join(base, 'workflow-state.json'));
    assert.ok(legacyMirrorPattern(base) instanceof RegExp);
    assert.ok(legacyMirrorPattern(base).test(path.join(base, 'workflow-state.json.legacy.2026-05-09T10-12-00-000Z')));
    assert.ok(!legacyMirrorPattern(base).test(path.join(base, 'workflow-state.json')));
  });
});
