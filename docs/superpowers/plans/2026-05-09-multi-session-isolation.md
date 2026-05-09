# Multi-Session Workflow Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global `active_work_item_id` model with per-session isolation so multiple tabs can develop multiple work items concurrently on one repo without state collisions.

**Architecture:** Introduce a `sessions/` registry keyed by `OPENKIT_SESSION_ID` that pins each tab to one work item and (for full/migration) one git worktree. A read-only resolver maps `(env) → (workItemId, baseDir)` so the existing `WorkflowStateManager` is built per-session. Atomic file writes with advisory locks coordinate cross-session updates. One-shot v2→v3 index migration on first runtime startup.

**Tech Stack:** Node.js ESM (≥18), `proper-lockfile` (new dep), `node:test`, `node:fs`, `node:child_process`, existing `git` CLI, existing `WorkflowStateManager` and `worktree-manager`.

**Spec:** `docs/superpowers/specs/2026-05-09-multi-session-isolation-design.md`

---

## File Structure

### New files (foundation)

```
src/runtime/sessions/
├── session-id.js                  generate session_id, validate format
├── session-paths.js               compute on-disk paths from sessionId/baseDir
├── atomic-json.js                 atomic write (tmp+rename) with proper-lockfile
├── sessions-index.js              read/write sessions/index.json + sweep
├── session-meta.js                read/write sessions/<id>/meta.json (write-once)
├── heartbeat.js                   start/stop heartbeat writer + reader
├── orphan-scanner.js              detect stale active entries
├── session-resolver.js            (env) → (workItemId, baseDir, mirrorPath)
├── work-items-index.js            read/write/migrate work-items/index.json v3
├── legacy-mirror-rotator.js       rotate top-level workflow-state.json
├── synthetic-orphan.js            build s_orphan_<hash> ids during migration
├── finish.js                      shared finish flow (slash + CLI)
├── abandon.js                     abandon command core
├── kill.js                        kill command core
├── resume.js                      resume command core
├── errors.js                      SessionRequiredError, SessionStateMismatchError, etc.
└── constants.js                   timeouts, thresholds, schema names
```

### New files (CLI/tools)

```
src/cli/commands/sessions/
├── list.js
├── show.js
├── resume.js
├── abandon.js
├── kill.js
├── downgrade-index.js
└── index.js                       dispatch table

src/cli/commands/dashboard.js
src/cli/commands/finish.js

src/runtime/tools/sessions/
└── session-bind.js                MCP tool: bind work item to current session
```

### New files (hooks/UX)

```
hooks/session-banner.js            print banner when OPENKIT_SESSION_ID set
assets/statusline-session.js       statusline plugin for session tag
commands/finish.md                 slash command definition
```

### Modified files

```
src/global/launcher.js             generate OPENKIT_SESSION_ID, write meta + index entries
src/runtime/runtime-config-loader.js  surface OPENKIT_SESSION_ID via env
src/runtime/doctor/...             add 5 checks
src/runtime/create-tools.js        line 87 active_work_item_id read → resolver
src/global/workspace-state.js      lines 144, 173, 193 → v3 schema
.opencode/lib/work-item-store.js   add v3 schema fns + migration helpers
.opencode/lib/workflow-state-controller.js  swap active_work_item_id reads → session resolver (many sites)
.opencode/workflow-state.js        CLI tool prints v3 listing
hooks/session-start*               read OPENKIT_SESSION_ID and call session-banner.js
package.json                       add proper-lockfile dep, add npm scripts
```

### New tests

```
tests/runtime/sessions/
├── session-id.test.js
├── atomic-json.test.js
├── sessions-index.test.js
├── session-meta.test.js
├── heartbeat.test.js
├── orphan-scanner.test.js
├── session-resolver.test.js
├── work-items-index.test.js
├── legacy-mirror-rotator.test.js
├── finish.test.js
├── abandon.test.js
├── kill.test.js
├── resume.test.js
└── synthetic-orphan.test.js

tests/runtime/state/index-migration-v2-v3.test.js
tests/runtime/doctor/sessions-checks.test.js

tests/integration/
├── sessions-multi-tab.test.js
├── orphan-recovery.test.js
├── finish-flow.test.js
└── sessions-index-lock.test.js

tests/regression/
├── migration-v2-to-v3-fixtures.test.js
└── auto-reconcile-worktree.test.js

tests/fixtures/migration/
├── pre-v3-typical/
├── pre-v3-multiple-workitems/
├── pre-v3-with-worktree/
├── pre-v3-already-v3/
└── pre-v3-corrupted/
```

---

## Phases

- **Phase 1 — Foundation primitives** (Tasks 1–7): pure, no I/O hooks. Builds `session-id`, `atomic-json`, `session-meta`, `sessions-index`, `work-items-index`, `legacy-mirror-rotator`, `errors`/`constants`.
- **Phase 2 — Lifecycle plumbing** (Tasks 8–11): `heartbeat`, `orphan-scanner`, `session-resolver`, `synthetic-orphan`.
- **Phase 3 — Migration & launcher** (Tasks 12–15): one-shot v2→v3 migration runner, launcher integration, bootstrap into runtime startup.
- **Phase 4 — Session commands** (Tasks 16–20): `resume`, `abandon`, `kill`, `finish`, `downgrade-index`.
- **Phase 5 — CLI & UX surface** (Tasks 21–25): `openkit sessions ...`, `openkit dashboard`, `openkit finish`, banner, statusline.
- **Phase 6 — Compatibility refactor** (Tasks 26–28): swap `active_work_item_id` reads to resolver across `workflow-state-controller.js`, `workspace-state.js`, `create-tools.js`.
- **Phase 7 — Doctor & integration tests** (Tasks 29–32): doctor checks, multi-tab integration, lock-contention, manual QA doc.

Each phase ends with a verification command and a commit. Tasks within a phase are TDD: failing test → minimal implementation → green → commit.

---

## Pre-flight: dependency add

### Task 0: Add proper-lockfile dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the dependency**

```bash
npm install --save proper-lockfile@4.1.2
```

Expected: `package.json` `dependencies` gains `"proper-lockfile": "4.1.2"`. `package-lock.json` updated.

- [ ] **Step 2: Verify import works**

```bash
node -e "import('proper-lockfile').then(m => console.log(typeof m.lock))"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add proper-lockfile for sessions index advisory locking"
```

---

## Phase 1 — Foundation primitives

### Task 1: Constants and errors

**Files:**
- Create: `src/runtime/sessions/constants.js`
- Create: `src/runtime/sessions/errors.js`
- Test: `tests/runtime/sessions/errors.test.js`

- [ ] **Step 1: Write failing test for error classes**

```javascript
// tests/runtime/sessions/errors.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/runtime/sessions/errors.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants**

```javascript
// src/runtime/sessions/constants.js
export const SESSIONS_INDEX_SCHEMA = 'openkit/sessions-index@1';
export const SESSION_META_SCHEMA = 'openkit/session-meta@1';
export const WORK_ITEMS_INDEX_SCHEMA_V3 = 'openkit/work-items-index@3';
export const LEGACY_STUB_SCHEMA = 'openkit/legacy-stub@1';

export const HEARTBEAT_INTERVAL_MS = 60_000;
export const ORPHAN_THRESHOLD_MS = 10 * 60_000;
export const CLOSED_RETENTION_MS = 7 * 24 * 60 * 60_000;

export const LEGACY_MIRROR_ROTATE_KEEP = 10;

export const INDEX_LOCK_RETRIES = 20;
export const INDEX_LOCK_RETRY_INTERVAL_MS = 100;
export const INDEX_LOCK_TIMEOUT_MS = 2_000;

export const SIGTERM_TO_SIGKILL_GRACE_MS = 3_000;
export const SIGKILL_CONFIRM_TIMEOUT_MS = 5_000;

export const SESSION_ID_PREFIX = 's_';
export const SESSION_ID_HEX_LEN = 6;
export const SYNTHETIC_ORPHAN_PREFIX = 's_orphan_';
export const SYNTHETIC_ORPHAN_HEX_LEN = 8;
```

- [ ] **Step 4: Implement errors**

```javascript
// src/runtime/sessions/errors.js
class OpenKitSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class SessionRequiredError extends OpenKitSessionError {
  constructor() {
    super(
      'OPENKIT_SESSION_ID is not set. Run `openkit run` to start a session, or `openkit sessions resume <id>` to attach to an existing one.',
      'OK_SESSION_REQUIRED',
    );
  }
}

export class SessionNotFoundError extends OpenKitSessionError {
  constructor(sessionId) {
    super(`Session '${sessionId}' was not found in sessions/index.json or its meta.json is missing.`, 'OK_SESSION_NOT_FOUND');
    this.sessionId = sessionId;
  }
}

export class SessionStateMismatchError extends OpenKitSessionError {
  constructor(envSessionId, workItemId, indexSessionId) {
    super(
      `Env OPENKIT_SESSION_ID=${envSessionId} but work item '${workItemId}' is bound to session '${indexSessionId ?? 'none'}' in work-items/index.json.`,
      'OK_SESSION_STATE_MISMATCH',
    );
    this.envSessionId = envSessionId;
    this.workItemId = workItemId;
    this.indexSessionId = indexSessionId;
  }
}

export class SessionAlreadyBoundError extends OpenKitSessionError {
  constructor(workItemId, lane) {
    super(
      `Session is bound to work item ${workItemId} (lane=${lane}). Open a new tab for a different work item.`,
      'OK_SESSION_ALREADY_BOUND',
    );
    this.workItemId = workItemId;
    this.lane = lane;
  }
}

export class WorktreeMissingError extends OpenKitSessionError {
  constructor(worktreePath) {
    super(`Worktree at '${worktreePath}' is missing on disk. Recommend abandoning the session.`, 'OK_WORKTREE_MISSING');
    this.worktreePath = worktreePath;
  }
}

export class IndexLockTimeoutError extends OpenKitSessionError {
  constructor(filePath, timeoutMs) {
    super(`Could not acquire advisory lock on '${filePath}' within ${timeoutMs}ms.`, 'OK_INDEX_LOCK_TIMEOUT');
    this.filePath = filePath;
    this.timeoutMs = timeoutMs;
  }
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
node --test tests/runtime/sessions/errors.test.js
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/sessions/constants.js src/runtime/sessions/errors.js tests/runtime/sessions/errors.test.js
git commit -m "feat(sessions): add constants and error classes"
```

---

### Task 2: Session ID generator

**Files:**
- Create: `src/runtime/sessions/session-id.js`
- Test: `tests/runtime/sessions/session-id.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/runtime/sessions/session-id.test.js
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
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
node --test tests/runtime/sessions/session-id.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/session-id.js
import { randomBytes } from 'node:crypto';
import {
  SESSION_ID_PREFIX,
  SESSION_ID_HEX_LEN,
  SYNTHETIC_ORPHAN_PREFIX,
  SYNTHETIC_ORPHAN_HEX_LEN,
} from './constants.js';

const RUNTIME_RE = new RegExp(`^${SESSION_ID_PREFIX}[0-9a-f]{${SESSION_ID_HEX_LEN}}$`);
const ORPHAN_RE = new RegExp(`^${SYNTHETIC_ORPHAN_PREFIX}[0-9a-f]{${SYNTHETIC_ORPHAN_HEX_LEN}}$`);

export function generateSessionId() {
  const bytes = randomBytes(Math.ceil(SESSION_ID_HEX_LEN / 2));
  return SESSION_ID_PREFIX + bytes.toString('hex').slice(0, SESSION_ID_HEX_LEN);
}

export function isValidSessionId(value) {
  if (typeof value !== 'string') return false;
  return RUNTIME_RE.test(value) || ORPHAN_RE.test(value);
}

export function isSyntheticOrphanId(value) {
  return typeof value === 'string' && ORPHAN_RE.test(value);
}
```

- [ ] **Step 4: Verify pass**

```bash
node --test tests/runtime/sessions/session-id.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/sessions/session-id.js tests/runtime/sessions/session-id.test.js
git commit -m "feat(sessions): session id generator and validators"
```

---

### Task 3: Atomic JSON write helper

**Files:**
- Create: `src/runtime/sessions/atomic-json.js`
- Test: `tests/runtime/sessions/atomic-json.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/runtime/sessions/atomic-json.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicReadModifyWrite, atomicReadJson } from '../../../src/runtime/sessions/atomic-json.js';
import { IndexLockTimeoutError } from '../../../src/runtime/sessions/errors.js';

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
```

- [ ] **Step 2: Run test to fail**

```bash
node --test tests/runtime/sessions/atomic-json.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/atomic-json.js
import fs from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { IndexLockTimeoutError } from './errors.js';
import {
  INDEX_LOCK_RETRIES,
  INDEX_LOCK_RETRY_INTERVAL_MS,
  INDEX_LOCK_TIMEOUT_MS,
} from './constants.js';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function atomicReadJson(filePath, defaultValue) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT' && defaultValue !== undefined) return defaultValue;
    throw err;
  }
}

export async function atomicReadModifyWrite(filePath, mutator, opts = {}) {
  const { defaultValue } = opts;
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    if (defaultValue === undefined) {
      throw new Error(`File missing and no defaultValue provided: ${filePath}`);
    }
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
  let release;
  try {
    release = await lockfile.lock(filePath, {
      retries: { retries: INDEX_LOCK_RETRIES, minTimeout: INDEX_LOCK_RETRY_INTERVAL_MS, maxTimeout: INDEX_LOCK_RETRY_INTERVAL_MS },
      stale: INDEX_LOCK_TIMEOUT_MS * 5,
    });
  } catch (err) {
    throw new IndexLockTimeoutError(filePath, INDEX_LOCK_TIMEOUT_MS);
  }
  try {
    const current = atomicReadJson(filePath, defaultValue);
    const next = mutator(current);
    const tmp = `${filePath}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(tmp, filePath);
    return next;
  } finally {
    await release();
  }
}
```

- [ ] **Step 4: Verify pass**

```bash
node --test tests/runtime/sessions/atomic-json.test.js
```
Expected: PASS (4/4).

- [ ] **Step 5: Add concurrency test for lock ordering**

```javascript
// append to tests/runtime/sessions/atomic-json.test.js
import { setTimeout as delay } from 'node:timers/promises';
describe('atomic-json concurrency', () => {
  it('serializes two concurrent increments', async () => {
    const file = path.join(tmp, 'race.json');
    fs.writeFileSync(file, JSON.stringify({ n: 0 }));
    await Promise.all([
      atomicReadModifyWrite(file, async (cur) => { await delay(20); return { n: cur.n + 1 }; }),
      atomicReadModifyWrite(file, async (cur) => { await delay(20); return { n: cur.n + 1 }; }),
    ]);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { n: 2 });
  });
});
```

Then update `atomicReadModifyWrite` to support async mutator: change `const next = mutator(current);` to `const next = await mutator(current);`.

- [ ] **Step 6: Verify pass**

```bash
node --test tests/runtime/sessions/atomic-json.test.js
```
Expected: PASS (5/5).

- [ ] **Step 7: Commit**

```bash
git add src/runtime/sessions/atomic-json.js tests/runtime/sessions/atomic-json.test.js
git commit -m "feat(sessions): atomic JSON read-modify-write with proper-lockfile"
```

---

### Task 4: Session paths helper

**Files:**
- Create: `src/runtime/sessions/session-paths.js`
- Test: `tests/runtime/sessions/session-paths.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/runtime/sessions/session-paths.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  sessionsDir, sessionsIndexPath, sessionDir,
  sessionMetaPath, heartbeatPath, sessionMirrorPath,
  workItemsIndexPath, legacyMirrorPath, legacyMirrorPattern,
} from '../../../src/runtime/sessions/session-paths.js';

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
    assert.match(legacyMirrorPattern(base), /workflow-state\\\.json\\\.legacy\\\./);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/session-paths.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/session-paths.js
import path from 'node:path';

export const sessionsDir = (baseDir) => path.join(baseDir, 'sessions');
export const sessionsIndexPath = (baseDir) => path.join(sessionsDir(baseDir), 'index.json');
export const sessionDir = (baseDir, id) => path.join(sessionsDir(baseDir), id);
export const sessionMetaPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'meta.json');
export const heartbeatPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'heartbeat.json');
export const sessionMirrorPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'workflow-state.json');
export const workItemsIndexPath = (baseDir) => path.join(baseDir, 'work-items', 'index.json');
export const legacyMirrorPath = (baseDir) => path.join(baseDir, 'workflow-state.json');
export const legacyMirrorPattern = (baseDir) =>
  new RegExp(path.join(baseDir, 'workflow-state.json.legacy.').replace(/[.\\/]/g, '\\$&'));
```

- [ ] **Step 4: Verify pass + commit**

```bash
node --test tests/runtime/sessions/session-paths.test.js
git add src/runtime/sessions/session-paths.js tests/runtime/sessions/session-paths.test.js
git commit -m "feat(sessions): on-disk path helpers"
```

---

The plan continues. I'll write the rest in chunks. Tasks 5-7 finish Phase 1.

---

### Task 5: Session meta (write-once)

**Files:**
- Create: `src/runtime/sessions/session-meta.js`
- Test: `tests/runtime/sessions/session-meta.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/session-meta.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSessionMeta, readSessionMeta } from '../../../src/runtime/sessions/session-meta.js';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-meta-')); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('session-meta', () => {
  const sample = {
    sessionId: 's_abcdef', workItemId: 'full-x', lane: 'full',
    repoRoot: '/r', worktreePath: '/r/.claude/worktrees/full-x',
    targetBranch: 'main', featureBranch: 'openkit/full-x',
    startedAt: '2026-05-09T10:00:00Z',
  };

  it('writes meta with schema and reads it back', () => {
    writeSessionMeta(tmp, sample);
    const got = readSessionMeta(tmp, 's_abcdef');
    assert.equal(got.schema, 'openkit/session-meta@1');
    assert.equal(got.session_id, 's_abcdef');
    assert.equal(got.work_item_id, 'full-x');
    assert.equal(got.feature_branch, 'openkit/full-x');
  });

  it('refuses to overwrite an existing meta', () => {
    writeSessionMeta(tmp, sample);
    assert.throws(() => writeSessionMeta(tmp, sample), /write-once/);
  });

  it('readSessionMeta throws SessionNotFoundError when missing', () => {
    assert.throws(() => readSessionMeta(tmp, 's_missing'), /SessionNotFoundError|not found/i);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/session-meta.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/session-meta.js
import fs from 'node:fs';
import path from 'node:path';
import { sessionMetaPath, sessionDir } from './session-paths.js';
import { SESSION_META_SCHEMA } from './constants.js';
import { SessionNotFoundError } from './errors.js';

export function writeSessionMeta(baseDir, meta) {
  const file = sessionMetaPath(baseDir, meta.sessionId);
  if (fs.existsSync(file)) {
    throw new Error(`session meta is write-once and already exists at ${file}`);
  }
  fs.mkdirSync(sessionDir(baseDir, meta.sessionId), { recursive: true });
  const payload = {
    schema: SESSION_META_SCHEMA,
    session_id: meta.sessionId,
    work_item_id: meta.workItemId,
    lane: meta.lane,
    repo_root: meta.repoRoot,
    worktree_path: meta.worktreePath ?? null,
    target_branch: meta.targetBranch ?? null,
    feature_branch: meta.featureBranch ?? null,
    started_at: meta.startedAt,
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readSessionMeta(baseDir, sessionId) {
  const file = sessionMetaPath(baseDir, sessionId);
  if (!fs.existsSync(file)) {
    throw new SessionNotFoundError(sessionId);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/session-meta.test.js
git add src/runtime/sessions/session-meta.js tests/runtime/sessions/session-meta.test.js
git commit -m "feat(sessions): write-once session meta"
```

---

### Task 6: sessions/index.json reader/writer

**Files:**
- Create: `src/runtime/sessions/sessions-index.js`
- Test: `tests/runtime/sessions/sessions-index.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/sessions-index.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readSessionsIndex, addSessionEntry, updateSessionEntry,
  removeSessionEntry, listSessions,
} from '../../../src/runtime/sessions/sessions-index.js';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-sidx-')); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const entry = (overrides = {}) => ({
  session_id: 's_abcdef', work_item_id: 'full-x', lane: 'full',
  worktree_path: '/r/.claude/worktrees/full-x', repo_root: '/r',
  pid: 1234, status: 'active', started_at: '2026-05-09T10:00:00Z',
  last_seen_at: '2026-05-09T10:00:00Z', ...overrides,
});

describe('sessions-index', () => {
  it('readSessionsIndex returns empty schema when file missing', () => {
    const idx = readSessionsIndex(base);
    assert.equal(idx.schema, 'openkit/sessions-index@1');
    assert.deepEqual(idx.sessions, []);
  });

  it('addSessionEntry appends', async () => {
    await addSessionEntry(base, entry());
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, 1);
    assert.equal(idx.sessions[0].session_id, 's_abcdef');
  });

  it('addSessionEntry refuses duplicate session_id', async () => {
    await addSessionEntry(base, entry());
    await assert.rejects(() => addSessionEntry(base, entry()), /duplicate/i);
  });

  it('updateSessionEntry mutates one entry', async () => {
    await addSessionEntry(base, entry());
    await updateSessionEntry(base, 's_abcdef', (cur) => ({ ...cur, status: 'orphan' }));
    assert.equal(readSessionsIndex(base).sessions[0].status, 'orphan');
  });

  it('removeSessionEntry drops one entry', async () => {
    await addSessionEntry(base, entry());
    await removeSessionEntry(base, 's_abcdef');
    assert.deepEqual(readSessionsIndex(base).sessions, []);
  });

  it('listSessions filters by status', async () => {
    await addSessionEntry(base, entry({ session_id: 's_111111' }));
    await addSessionEntry(base, entry({ session_id: 's_222222', status: 'orphan' }));
    const orphans = listSessions(base, { status: 'orphan' });
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].session_id, 's_222222');
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/sessions-index.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/sessions-index.js
import { atomicReadModifyWrite, atomicReadJson } from './atomic-json.js';
import { sessionsIndexPath } from './session-paths.js';
import { SESSIONS_INDEX_SCHEMA } from './constants.js';

const empty = () => ({ schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date().toISOString() });

export function readSessionsIndex(baseDir) {
  return atomicReadJson(sessionsIndexPath(baseDir), empty());
}

export async function addSessionEntry(baseDir, entry) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    if (idx.sessions.some((s) => s.session_id === entry.session_id)) {
      throw new Error(`duplicate session_id: ${entry.session_id}`);
    }
    return { ...idx, sessions: [...idx.sessions, entry], updated_at: new Date().toISOString() };
  }, { defaultValue: empty() });
}

export async function updateSessionEntry(baseDir, sessionId, mutator) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    const sessions = idx.sessions.map((s) => (s.session_id === sessionId ? mutator(s) : s));
    return { ...idx, sessions, updated_at: new Date().toISOString() };
  }, { defaultValue: empty() });
}

export async function removeSessionEntry(baseDir, sessionId) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      sessions: idx.sessions.filter((s) => s.session_id !== sessionId),
      updated_at: new Date().toISOString(),
    };
  }, { defaultValue: empty() });
}

export function listSessions(baseDir, { status } = {}) {
  const idx = readSessionsIndex(baseDir);
  if (!status || status === 'all') return idx.sessions;
  return idx.sessions.filter((s) => s.status === status);
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/sessions-index.test.js
git add src/runtime/sessions/sessions-index.js tests/runtime/sessions/sessions-index.test.js
git commit -m "feat(sessions): sessions/index.json reader/writer"
```

---

### Task 7: work-items/index.json v3 reader/writer + migrator

**Files:**
- Create: `src/runtime/sessions/work-items-index.js`
- Test: `tests/runtime/sessions/work-items-index.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/work-items-index.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readWorkItemsIndex, migrateWorkItemsIndex,
  addWorkItem, setCurrentSessionId, setWorkItemStatus,
} from '../../../src/runtime/sessions/work-items-index.js';
import { workItemsIndexPath } from '../../../src/runtime/sessions/session-paths.js';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-widx-')); fs.mkdirSync(path.join(base, 'work-items'), { recursive: true }); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('work-items-index v3', () => {
  it('migrates v2 → v3 idempotently, drops active_work_item_id', () => {
    const v2 = {
      active_work_item_id: 'feature-001',
      work_items: [
        { work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: '.opencode/work-items/feature-001/state.json' },
        { work_item_id: 'feature-002', mode: 'quick', status: 'done', state_path: '.opencode/work-items/feature-002/state.json' },
      ],
    };
    fs.writeFileSync(workItemsIndexPath(base), JSON.stringify(v2));
    migrateWorkItemsIndex(base);
    const v3 = readWorkItemsIndex(base);
    assert.equal(v3.schema, 'openkit/work-items-index@3');
    assert.equal(v3.active_work_item_id, undefined);
    const f1 = v3.work_items.find((w) => w.work_item_id === 'feature-001');
    assert.equal(f1.lane, 'full');
    assert.equal(f1.status, 'orphan');
    assert.equal(f1.current_session_id, null);
    const f2 = v3.work_items.find((w) => w.work_item_id === 'feature-002');
    assert.equal(f2.status, 'done');
    migrateWorkItemsIndex(base);
    assert.equal(readWorkItemsIndex(base).schema, 'openkit/work-items-index@3');
  });

  it('addWorkItem appends with current_session_id', async () => {
    await addWorkItem(base, {
      workItemId: 'full-x', featureSlug: 'x', lane: 'full',
      currentSessionId: 's_abcdef', statePath: '.opencode/work-items/full-x/state.json',
    });
    const idx = readWorkItemsIndex(base);
    assert.equal(idx.work_items[0].current_session_id, 's_abcdef');
    assert.equal(idx.work_items[0].status, 'in_progress');
  });

  it('setCurrentSessionId clears bind', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_abcdef', statePath: 'p' });
    await setCurrentSessionId(base, 'full-x', null);
    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.current_session_id, null);
  });

  it('setWorkItemStatus updates status', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_abcdef', statePath: 'p' });
    await setWorkItemStatus(base, 'full-x', 'done');
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'done');
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/work-items-index.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/work-items-index.js
import fs from 'node:fs';
import { atomicReadJson, atomicReadModifyWrite } from './atomic-json.js';
import { workItemsIndexPath } from './session-paths.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from './constants.js';

const empty = () => ({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] });

export function readWorkItemsIndex(baseDir) {
  return atomicReadJson(workItemsIndexPath(baseDir), empty());
}

export function migrateWorkItemsIndex(baseDir) {
  const file = workItemsIndexPath(baseDir);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(empty(), null, 2)}\n`);
    return;
  }
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cur.schema === WORK_ITEMS_INDEX_SCHEMA_V3) return;
  const items = (cur.work_items ?? []).map((wi) => {
    const lane = wi.lane ?? wi.mode ?? 'full';
    let status = wi.status;
    if (status !== 'done' && status !== 'abandoned') status = 'orphan';
    return {
      work_item_id: wi.work_item_id,
      feature_id: wi.feature_id ?? null,
      feature_slug: wi.feature_slug ?? null,
      lane,
      status,
      current_session_id: null,
      state_path: wi.state_path,
      created_at: wi.created_at ?? new Date().toISOString(),
    };
  });
  fs.writeFileSync(file, `${JSON.stringify({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: items }, null, 2)}\n`);
}

export async function addWorkItem(baseDir, { workItemId, featureId = null, featureSlug, lane, currentSessionId, statePath }) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    if (idx.work_items.some((wi) => wi.work_item_id === workItemId)) {
      throw new Error(`duplicate work_item_id: ${workItemId}`);
    }
    return {
      ...idx,
      work_items: [
        ...idx.work_items,
        {
          work_item_id: workItemId,
          feature_id: featureId,
          feature_slug: featureSlug,
          lane,
          status: 'in_progress',
          current_session_id: currentSessionId,
          state_path: statePath,
          created_at: new Date().toISOString(),
        },
      ],
    };
  }, { defaultValue: empty() });
}

export async function setCurrentSessionId(baseDir, workItemId, sessionId) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      work_items: idx.work_items.map((wi) =>
        wi.work_item_id === workItemId ? { ...wi, current_session_id: sessionId } : wi,
      ),
    };
  }, { defaultValue: empty() });
}

export async function setWorkItemStatus(baseDir, workItemId, status) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      work_items: idx.work_items.map((wi) =>
        wi.work_item_id === workItemId ? { ...wi, status } : wi,
      ),
    };
  }, { defaultValue: empty() });
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/work-items-index.test.js
git add src/runtime/sessions/work-items-index.js tests/runtime/sessions/work-items-index.test.js
git commit -m "feat(sessions): work-items/index.json v3 reader and v2→v3 migrator"
```

---

### Phase 1 verification

- [ ] Run all Phase 1 tests:

```bash
node --test tests/runtime/sessions/errors.test.js tests/runtime/sessions/session-id.test.js tests/runtime/sessions/atomic-json.test.js tests/runtime/sessions/session-paths.test.js tests/runtime/sessions/session-meta.test.js tests/runtime/sessions/sessions-index.test.js tests/runtime/sessions/work-items-index.test.js
```

Expected: all pass.

---

## Phase 2 — Lifecycle plumbing

### Task 8: Heartbeat writer/reader

**Files:**
- Create: `src/runtime/sessions/heartbeat.js`
- Test: `tests/runtime/sessions/heartbeat.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/heartbeat.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeHeartbeat, readHeartbeat, startHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';
import { setTimeout as delay } from 'node:timers/promises';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-hb-')); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('heartbeat', () => {
  it('writes and reads heartbeat', () => {
    writeHeartbeat(base, 's_abcdef', 1234);
    const hb = readHeartbeat(base, 's_abcdef');
    assert.equal(hb.pid, 1234);
    assert.match(hb.last_beat_at, /T/);
  });

  it('returns null when missing', () => {
    assert.equal(readHeartbeat(base, 's_missing'), null);
  });

  it('startHeartbeat fires immediately and stops cleanly', async () => {
    const stop = startHeartbeat({ baseDir: base, sessionId: 's_abcdef', pid: 1234, intervalMs: 50 });
    await delay(20);
    assert.ok(readHeartbeat(base, 's_abcdef'));
    stop();
    const beat1 = readHeartbeat(base, 's_abcdef').last_beat_at;
    await delay(120);
    const beat2 = readHeartbeat(base, 's_abcdef').last_beat_at;
    assert.equal(beat1, beat2);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/heartbeat.test.js
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/heartbeat.js
import fs from 'node:fs';
import { heartbeatPath, sessionDir } from './session-paths.js';
import { HEARTBEAT_INTERVAL_MS } from './constants.js';

export function writeHeartbeat(baseDir, sessionId, pid) {
  fs.mkdirSync(sessionDir(baseDir, sessionId), { recursive: true });
  fs.writeFileSync(
    heartbeatPath(baseDir, sessionId),
    `${JSON.stringify({ pid, last_beat_at: new Date().toISOString() })}\n`,
  );
}

export function readHeartbeat(baseDir, sessionId) {
  const file = heartbeatPath(baseDir, sessionId);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function startHeartbeat({ baseDir, sessionId, pid, intervalMs = HEARTBEAT_INTERVAL_MS }) {
  writeHeartbeat(baseDir, sessionId, pid);
  const handle = setInterval(() => {
    try { writeHeartbeat(baseDir, sessionId, pid); } catch { /* swallow during shutdown */ }
  }, intervalMs);
  handle.unref?.();
  return () => clearInterval(handle);
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/heartbeat.test.js
git add src/runtime/sessions/heartbeat.js tests/runtime/sessions/heartbeat.test.js
git commit -m "feat(sessions): heartbeat writer with startHeartbeat ticker"
```

---

### Task 9: Orphan scanner

**Files:**
- Create: `src/runtime/sessions/orphan-scanner.js`
- Test: `tests/runtime/sessions/orphan-scanner.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/orphan-scanner.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanOrphans } from '../../../src/runtime/sessions/orphan-scanner.js';
import { addSessionEntry, readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';
import { addWorkItem, readWorkItemsIndex } from '../../../src/runtime/sessions/work-items-index.js';
import { writeHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-orphan-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const ts = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

describe('orphan-scanner', () => {
  it('marks active entry orphan when last_seen_at is older than threshold', async () => {
    await addSessionEntry(base, {
      session_id: 's_111111', work_item_id: 'full-x', lane: 'full',
      worktree_path: '/r/.claude/worktrees/full-x', repo_root: '/r',
      pid: 99, status: 'active',
      started_at: ts(-30 * 60_000), last_seen_at: ts(-15 * 60_000),
    });
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_111111', statePath: 'p' });
    writeHeartbeat(base, 's_111111', 99);
    fs.utimesSync(path.join(base, 'sessions', 's_111111', 'heartbeat.json'), Date.now() / 1000 - 900, Date.now() / 1000 - 900);

    await scanOrphans(base, { now: () => Date.now() });
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions[0].status, 'orphan');
    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.current_session_id, null);
    assert.equal(wi.status, 'orphan');
  });

  it('keeps active when heartbeat is fresh and PID alive', async () => {
    await addSessionEntry(base, {
      session_id: 's_222222', work_item_id: 'q-y', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: process.pid, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    writeHeartbeat(base, 's_222222', process.pid);
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
  });

  it('removes closed entries older than 7 days', async () => {
    await addSessionEntry(base, {
      session_id: 's_333333', work_item_id: 'old', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: 77, status: 'closed',
      started_at: ts(-30 * 24 * 3600 * 1000), last_seen_at: ts(-10 * 24 * 3600 * 1000),
    });
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/orphan-scanner.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/orphan-scanner.js
import { atomicReadModifyWrite } from './atomic-json.js';
import { sessionsIndexPath, workItemsIndexPath } from './session-paths.js';
import { readHeartbeat } from './heartbeat.js';
import { ORPHAN_THRESHOLD_MS, CLOSED_RETENTION_MS, SESSIONS_INDEX_SCHEMA, WORK_ITEMS_INDEX_SCHEMA_V3 } from './constants.js';

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function shouldMarkOrphan(entry, baseDir, now) {
  const last = Date.parse(entry.last_seen_at);
  if (Number.isFinite(last) && now - last > ORPHAN_THRESHOLD_MS) return true;
  const hb = readHeartbeat(baseDir, entry.session_id);
  if (hb) {
    const beat = Date.parse(hb.last_beat_at);
    if (Number.isFinite(beat) && now - beat > ORPHAN_THRESHOLD_MS) return true;
  }
  if (!isPidAlive(entry.pid)) return true;
  return false;
}

export async function scanOrphans(baseDir, opts = {}) {
  const now = (opts.now ?? Date.now)();
  const transitionedToOrphan = [];

  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? { schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date(now).toISOString() };
    const sessions = idx.sessions
      .filter((s) => {
        if (s.status === 'closed') {
          const lastSeen = Date.parse(s.last_seen_at);
          if (Number.isFinite(lastSeen) && now - lastSeen > CLOSED_RETENTION_MS) return false;
        }
        return true;
      })
      .map((s) => {
        if (s.status !== 'active') return s;
        if (shouldMarkOrphan(s, baseDir, now)) {
          transitionedToOrphan.push(s);
          return { ...s, status: 'orphan' };
        }
        return s;
      });
    return { ...idx, sessions, updated_at: new Date(now).toISOString() };
  }, { defaultValue: { schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date(now).toISOString() } });

  for (const entry of transitionedToOrphan) {
    await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
      const idx = cur ?? { schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] };
      return {
        ...idx,
        work_items: idx.work_items.map((wi) =>
          wi.work_item_id === entry.work_item_id
            ? { ...wi, current_session_id: null, status: wi.status === 'done' ? wi.status : 'orphan' }
            : wi,
        ),
      };
    }, { defaultValue: { schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] } });
  }
  return { transitionedToOrphan: transitionedToOrphan.length };
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/orphan-scanner.test.js
git add src/runtime/sessions/orphan-scanner.js tests/runtime/sessions/orphan-scanner.test.js
git commit -m "feat(sessions): orphan scanner with closed-entry sweep"
```

---

### Task 10: Session resolver

**Files:**
- Create: `src/runtime/sessions/session-resolver.js`
- Test: `tests/runtime/sessions/session-resolver.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/session-resolver.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSession } from '../../../src/runtime/sessions/session-resolver.js';
import { writeSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import { addWorkItem } from '../../../src/runtime/sessions/work-items-index.js';
import { SessionRequiredError, SessionStateMismatchError, SessionNotFoundError } from '../../../src/runtime/sessions/errors.js';

let repo;
const baseFor = (root) => path.join(root, '.opencode');
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-resolve-'));
  fs.mkdirSync(path.join(baseFor(repo), 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('session-resolver', () => {
  it('throws SessionRequiredError when env missing', () => {
    assert.throws(() => resolveSession({ env: {}, repoRoot: repo }), (e) => e instanceof SessionRequiredError);
  });

  it('resolves quick session pointing at repo root .opencode', async () => {
    writeSessionMeta(baseFor(repo), {
      sessionId: 's_abcdef', workItemId: 'q-x', lane: 'quick',
      repoRoot: repo, worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt: '2026-05-09T10:00:00Z',
    });
    await addWorkItem(baseFor(repo), { workItemId: 'q-x', featureSlug: 'x', lane: 'quick', currentSessionId: 's_abcdef', statePath: 'p' });
    const r = resolveSession({ env: { OPENKIT_SESSION_ID: 's_abcdef' }, repoRoot: repo });
    assert.equal(r.sessionId, 's_abcdef');
    assert.equal(r.workItemId, 'q-x');
    assert.equal(r.lane, 'quick');
    assert.equal(r.baseDir, baseFor(repo));
    assert.equal(r.worktreePath, null);
    assert.match(r.mirrorPath, /sessions\/s_abcdef\/workflow-state\.json$/);
  });

  it('resolves full session pointing at worktree .opencode', async () => {
    const wt = path.join(repo, '.claude/worktrees/full-x');
    fs.mkdirSync(path.join(wt, '.opencode/work-items'), { recursive: true });
    writeSessionMeta(path.join(wt, '.opencode'), {
      sessionId: 's_aaaaaa', workItemId: 'full-x', lane: 'full',
      repoRoot: repo, worktreePath: wt,
      targetBranch: 'main', featureBranch: 'openkit/full-x', startedAt: '2026-05-09T10:00:00Z',
    });
    await addWorkItem(path.join(wt, '.opencode'), { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_aaaaaa', statePath: 'p' });
    const r = resolveSession({ env: { OPENKIT_SESSION_ID: 's_aaaaaa', OPENKIT_PROJECT_ROOT: wt }, repoRoot: repo });
    assert.equal(r.baseDir, path.join(wt, '.opencode'));
    assert.equal(r.worktreePath, wt);
  });

  it('throws mismatch when index points at another session', async () => {
    writeSessionMeta(baseFor(repo), {
      sessionId: 's_abcdef', workItemId: 'q-x', lane: 'quick',
      repoRoot: repo, worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt: '2026-05-09T10:00:00Z',
    });
    await addWorkItem(baseFor(repo), { workItemId: 'q-x', featureSlug: 'x', lane: 'quick', currentSessionId: 's_other11', statePath: 'p' });
    assert.throws(
      () => resolveSession({ env: { OPENKIT_SESSION_ID: 's_abcdef' }, repoRoot: repo }),
      (e) => e instanceof SessionStateMismatchError,
    );
  });

  it('throws SessionNotFoundError when meta missing', () => {
    assert.throws(
      () => resolveSession({ env: { OPENKIT_SESSION_ID: 's_missing' }, repoRoot: repo }),
      (e) => e instanceof SessionNotFoundError,
    );
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/session-resolver.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/session-resolver.js
import path from 'node:path';
import { readSessionMeta } from './session-meta.js';
import { readWorkItemsIndex } from './work-items-index.js';
import { sessionMirrorPath } from './session-paths.js';
import { SessionRequiredError, SessionStateMismatchError } from './errors.js';

export function resolveSession({ env, repoRoot }) {
  const sessionId = env?.OPENKIT_SESSION_ID;
  if (!sessionId) throw new SessionRequiredError();
  const projectRoot = env?.OPENKIT_PROJECT_ROOT ?? repoRoot;
  const baseDir = path.join(projectRoot, '.opencode');
  const meta = readSessionMeta(baseDir, sessionId);
  const idx = readWorkItemsIndex(baseDir);
  const wi = idx.work_items.find((w) => w.work_item_id === meta.work_item_id);
  if (!wi || wi.current_session_id !== sessionId) {
    throw new SessionStateMismatchError(sessionId, meta.work_item_id, wi?.current_session_id ?? null);
  }
  return {
    sessionId,
    workItemId: meta.work_item_id,
    lane: meta.lane,
    baseDir,
    mirrorPath: sessionMirrorPath(baseDir, sessionId),
    worktreePath: meta.worktree_path,
    repoRoot,
    targetBranch: meta.target_branch,
    featureBranch: meta.feature_branch,
  };
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/session-resolver.test.js
git add src/runtime/sessions/session-resolver.js tests/runtime/sessions/session-resolver.test.js
git commit -m "feat(sessions): read-only resolver from env to (workItemId, baseDir, mirror)"
```

---

### Task 11: Synthetic orphan id generator

**Files:**
- Create: `src/runtime/sessions/synthetic-orphan.js`
- Test: `tests/runtime/sessions/synthetic-orphan.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/synthetic-orphan.test.js
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
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/synthetic-orphan.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/synthetic-orphan.js
import { createHash } from 'node:crypto';
import { SYNTHETIC_ORPHAN_PREFIX, SYNTHETIC_ORPHAN_HEX_LEN } from './constants.js';

export function syntheticOrphanIdFor(workItemId) {
  const hash = createHash('sha1').update(workItemId).digest('hex').slice(0, SYNTHETIC_ORPHAN_HEX_LEN);
  return `${SYNTHETIC_ORPHAN_PREFIX}${hash}`;
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/synthetic-orphan.test.js
git add src/runtime/sessions/synthetic-orphan.js tests/runtime/sessions/synthetic-orphan.test.js
git commit -m "feat(sessions): stable synthetic orphan id generator"
```

---

### Task 12: Legacy mirror rotator

**Files:**
- Create: `src/runtime/sessions/legacy-mirror-rotator.js`
- Test: `tests/runtime/sessions/legacy-mirror-rotator.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/legacy-mirror-rotator.test.js
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

  it('caps rotated files at 10 oldest-first', () => {
    const file = path.join(base, 'workflow-state.json');
    for (let i = 0; i < 12; i++) {
      fs.writeFileSync(file, JSON.stringify({ tick: i }));
      rotateLegacyMirror(base);
      const ts = Date.now() + i;
      const oldest = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.')).sort()[0];
      if (oldest) fs.utimesSync(path.join(base, oldest), ts / 1000, ts / 1000);
    }
    const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
    assert.ok(legacies.length <= 10, `expected ≤ 10, got ${legacies.length}`);
  });

  it('handles missing source file as no-op', () => {
    const r = rotateLegacyMirror(base);
    assert.equal(r.rotated, false);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/legacy-mirror-rotator.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/legacy-mirror-rotator.js
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_MIRROR_ROTATE_KEEP, LEGACY_STUB_SCHEMA } from './constants.js';
import { legacyMirrorPath } from './session-paths.js';

const STUB = { schema: LEGACY_STUB_SCHEMA, note: 'session state moved to .opencode/sessions/<id>/workflow-state.json' };

export function rotateLegacyMirror(baseDir) {
  const file = legacyMirrorPath(baseDir);
  if (!fs.existsSync(file)) return { rotated: false };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { parsed = {}; }
  if (parsed?.schema === LEGACY_STUB_SCHEMA) return { rotated: false };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(baseDir, `workflow-state.json.legacy.${stamp}`);
  fs.renameSync(file, target);
  fs.writeFileSync(file, `${JSON.stringify(STUB, null, 2)}\n`);
  capRotatedFiles(baseDir);
  return { rotated: true, target };
}

function capRotatedFiles(baseDir) {
  const legacies = fs
    .readdirSync(baseDir)
    .filter((n) => n.startsWith('workflow-state.json.legacy.'))
    .map((n) => ({ name: n, full: path.join(baseDir, n), mtime: fs.statSync(path.join(baseDir, n)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
  while (legacies.length > LEGACY_MIRROR_ROTATE_KEEP) {
    const drop = legacies.shift();
    fs.unlinkSync(drop.full);
  }
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/legacy-mirror-rotator.test.js
git add src/runtime/sessions/legacy-mirror-rotator.js tests/runtime/sessions/legacy-mirror-rotator.test.js
git commit -m "feat(sessions): legacy mirror rotation capped at 10 files"
```

---

### Phase 2 verification

- [ ] Run all Phase 2 tests:

```bash
node --test tests/runtime/sessions/heartbeat.test.js tests/runtime/sessions/orphan-scanner.test.js tests/runtime/sessions/session-resolver.test.js tests/runtime/sessions/synthetic-orphan.test.js tests/runtime/sessions/legacy-mirror-rotator.test.js
```
Expected: all pass.

---

## Phase 3 — Migration runner & launcher integration

### Task 13: Worktree auto-reconciliation builder

**Files:**
- Create: `src/runtime/sessions/worktree-reconciler.js`
- Test: `tests/runtime/sessions/worktree-reconciler.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/worktree-reconciler.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reconcileExistingWorktrees } from '../../../src/runtime/sessions/worktree-reconciler.js';
import { addWorkItem, readWorkItemsIndex } from '../../../src/runtime/sessions/work-items-index.js';
import { readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-rec-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('worktree-reconciler', () => {
  it('creates synthetic orphan for matching not-done work item', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    const sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions.length, 1);
    assert.match(sessions[0].session_id, /^s_orphan_/);
    assert.equal(sessions[0].status, 'orphan');
    assert.equal(sessions[0].work_item_id, 'full-x');
  });

  it('skips done work items', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const idx = readWorkItemsIndex(base);
    idx.work_items[0].status = 'done';
    fs.writeFileSync(path.join(base, 'work-items', 'index.json'), JSON.stringify(idx, null, 2));
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });

  it('logs warning when no work item matches but does not delete worktree', async () => {
    const warnings = [];
    const fakeListWorktrees = () => [{ workItemId: 'unknown-x', worktreePath: '/r/.claude/worktrees/unknown-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees, warn: (m) => warnings.push(m) });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /unknown-x/);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/worktree-reconciler.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/worktree-reconciler.js
import { readWorkItemsIndex } from './work-items-index.js';
import { addSessionEntry, readSessionsIndex } from './sessions-index.js';
import { syntheticOrphanIdFor } from './synthetic-orphan.js';

export async function reconcileExistingWorktrees({ baseDir, listWorktrees, warn = (m) => console.warn(m) }) {
  const wis = readWorkItemsIndex(baseDir).work_items;
  const existing = new Set(readSessionsIndex(baseDir).sessions.map((s) => s.session_id));
  for (const wt of listWorktrees()) {
    const wi = wis.find((w) => w.work_item_id === wt.workItemId);
    if (!wi) {
      warn(`OK1235 worktree at ${wt.worktreePath} (work item ${wt.workItemId}) has no matching index entry; skipping`);
      continue;
    }
    if (wi.status === 'done' || wi.status === 'abandoned') continue;
    const id = syntheticOrphanIdFor(wt.workItemId);
    if (existing.has(id)) continue;
    await addSessionEntry(baseDir, {
      session_id: id, work_item_id: wi.work_item_id, lane: wi.lane,
      worktree_path: wt.worktreePath, repo_root: wt.repoRoot,
      pid: null, status: 'orphan',
      started_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/worktree-reconciler.test.js
git add src/runtime/sessions/worktree-reconciler.js tests/runtime/sessions/worktree-reconciler.test.js
git commit -m "feat(sessions): worktree auto-reconciler synthesizes orphans"
```

---

### Task 14: One-shot migration runner

**Files:**
- Create: `src/runtime/sessions/migrate-on-start.js`
- Test: `tests/runtime/sessions/migrate-on-start.test.js`

- [ ] **Step 1: Failing tests**

```javascript
// tests/runtime/sessions/migrate-on-start.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateOnStart } from '../../../src/runtime/sessions/migrate-on-start.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-mig-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('migrate-on-start', () => {
  it('creates sessions/ dir, migrates v2 index, rotates legacy mirror', async () => {
    fs.writeFileSync(path.join(base, 'work-items/index.json'), JSON.stringify({
      active_work_item_id: 'feature-001',
      work_items: [{ work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: 'p' }],
    }));
    fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'full_implementation' }));
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    assert.ok(fs.existsSync(path.join(base, 'sessions')));
    const idx = JSON.parse(fs.readFileSync(path.join(base, 'work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
    assert.equal(idx.active_work_item_id, undefined);
    const stub = JSON.parse(fs.readFileSync(path.join(base, 'workflow-state.json'), 'utf8'));
    assert.equal(stub.schema, 'openkit/legacy-stub@1');
  });

  it('is idempotent on already-v3 layout', async () => {
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    const idx = JSON.parse(fs.readFileSync(path.join(base, 'work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
  });

  it('emits warning once per process', async () => {
    fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'x' }));
    const logs = [];
    await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
    assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
node --test tests/runtime/sessions/migrate-on-start.test.js
```

- [ ] **Step 3: Implement**

```javascript
// src/runtime/sessions/migrate-on-start.js
import fs from 'node:fs';
import { migrateWorkItemsIndex } from './work-items-index.js';
import { rotateLegacyMirror } from './legacy-mirror-rotator.js';
import { reconcileExistingWorktrees } from './worktree-reconciler.js';
import { sessionsDir, sessionsIndexPath } from './session-paths.js';
import { SESSIONS_INDEX_SCHEMA } from './constants.js';

let warnedThisProcess = false;

export async function migrateOnStart({ baseDir, listWorktrees, warn = (m) => console.warn(m) }) {
  fs.mkdirSync(sessionsDir(baseDir), { recursive: true });
  if (!fs.existsSync(sessionsIndexPath(baseDir))) {
    fs.writeFileSync(
      sessionsIndexPath(baseDir),
      `${JSON.stringify({ schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date().toISOString() }, null, 2)}\n`,
    );
  }
  migrateWorkItemsIndex(baseDir);
  const r = rotateLegacyMirror(baseDir);
  if (r.rotated && !warnedThisProcess) {
    warn(`OK1234 Legacy mirror rotated to ${r.target}. New runtime uses sessions/<id>/workflow-state.json.`);
    warnedThisProcess = true;
  }
  await reconcileExistingWorktrees({ baseDir, listWorktrees, warn });
}
```

- [ ] **Step 4: Verify + commit**

```bash
node --test tests/runtime/sessions/migrate-on-start.test.js
git add src/runtime/sessions/migrate-on-start.js tests/runtime/sessions/migrate-on-start.test.js
git commit -m "feat(sessions): one-shot migration runner for v2→v3 cutover"
```

---

### Task 15: Wire migration into runtime startup

**Files:**
- Modify: `src/runtime/runtime-config-loader.js` or equivalent runtime bootstrap entry — find via grep
- Test: `tests/runtime/sessions/runtime-bootstrap-migration.test.js`

- [ ] **Step 1: Locate the bootstrap entry**

```bash
grep -n "ensureWorkspaceBootstrap\|bootstrapRuntimeFoundation" /Users/duypham/Code/open-kit/src/runtime/*.js /Users/duypham/Code/open-kit/src/global/*.js | head -20
```

The migration runner must be invoked exactly once per process, before any code reads `work-items/index.json`. The top of `bootstrapRuntimeFoundation()` (in `src/runtime/runtime-bootstrap.js` or `src/runtime/runtime-config-loader.js`) is the right place. Read the file's surrounding code, then in step 3 import `migrateOnStart` and call it after the existing `ensureWorkspaceBootstrap` (or its analogue) succeeds.

- [ ] **Step 2: Write test**

```javascript
// tests/runtime/sessions/runtime-bootstrap-migration.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootstrapRuntimeFoundation } from '../../../src/runtime/runtime-bootstrap.js';

let repo;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-bs-'));
  fs.mkdirSync(path.join(repo, '.opencode/work-items'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.opencode/work-items/index.json'), JSON.stringify({
    active_work_item_id: 'feature-001',
    work_items: [{ work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: 'p' }],
  }));
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('runtime bootstrap migration', () => {
  it('runs migrateOnStart before returning', async () => {
    await bootstrapRuntimeFoundation({ projectRoot: repo, env: { OPENKIT_PROJECT_ROOT: repo } });
    const idx = JSON.parse(fs.readFileSync(path.join(repo, '.opencode/work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
    assert.ok(fs.existsSync(path.join(repo, '.opencode/sessions')));
  });
});
```

- [ ] **Step 3: Verify fail**

```bash
node --test tests/runtime/sessions/runtime-bootstrap-migration.test.js
```

- [ ] **Step 4: Wire migration into the bootstrap entry**

Locate the function. Add at the top of its body after directory bootstrap:

```javascript
import { migrateOnStart } from './sessions/migrate-on-start.js';
import { listOpenKitWorktrees } from '../global/worktree-manager.js';

// inside bootstrapRuntimeFoundation, after ensureWorkspaceBootstrap:
await migrateOnStart({
  baseDir: path.join(projectRoot, '.opencode'),
  listWorktrees: () => listOpenKitWorktrees(projectRoot),
});
```

If `listOpenKitWorktrees` does not exist yet, add it as a thin wrapper around `git worktree list --porcelain` filtering paths under `.claude/worktrees/`. The wrapper signature is `(repoRoot) => Array<{workItemId, worktreePath, repoRoot}>`.

- [ ] **Step 5: Verify pass**

```bash
node --test tests/runtime/sessions/runtime-bootstrap-migration.test.js
```

- [ ] **Step 6: Run full Phase 1+2+3 suite**

```bash
node --test tests/runtime/sessions/
```

- [ ] **Step 7: Commit**

```bash
git add src/runtime/runtime-bootstrap.js src/global/worktree-manager.js tests/runtime/sessions/runtime-bootstrap-migration.test.js
git commit -m "feat(sessions): run v2→v3 migration on runtime bootstrap"
```

---

### Task 16: Launcher generates session and writes meta + index entries

**Files:**
- Modify: `src/global/launcher.js` (around lines 600-660)
- Test: `tests/global/launcher-sessions.test.js`

- [ ] **Step 1: Read current launcher block**

```bash
sed -n '590,665p' /Users/duypham/Code/open-kit/src/global/launcher.js
```

(Use Read tool, not sed, in actual execution. Reproduce the surrounding 70 lines.)

- [ ] **Step 2: Write test**

```javascript
// tests/global/launcher-sessions.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runOpenKit } from '../../src/global/launcher.js';
import { readSessionsIndex } from '../../src/runtime/sessions/sessions-index.js';

let repo;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-launch-'));
  fs.mkdirSync(path.join(repo, '.opencode/work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('launcher generates session entry', () => {
  it('writes meta and sessions/index.json entry, sets OPENKIT_SESSION_ID', async () => {
    let capturedEnv;
    const fakeSpawn = (cmd, args, opts) => { capturedEnv = opts.env; return { status: 0, stdout: '', stderr: '' }; };
    await runOpenKit({
      argv: ['run'],
      env: { OPENKIT_HOME: path.join(repo, '.kit'), HOME: repo },
      cwd: repo,
      spawn: fakeSpawn,
    });
    assert.match(capturedEnv.OPENKIT_SESSION_ID, /^s_[0-9a-f]{6}$/);
    const sessions = readSessionsIndex(path.join(repo, '.opencode')).sessions;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].session_id, capturedEnv.OPENKIT_SESSION_ID);
    assert.equal(sessions[0].status, 'active');
  });
});
```

- [ ] **Step 3: Verify fail**

```bash
node --test tests/global/launcher-sessions.test.js
```

- [ ] **Step 4: Edit launcher**

In `src/global/launcher.js`, after `const runtimeSessionId = ...` (line ~605) and before constructing `runtimeBootstrapEnv` (line ~621), insert:

```javascript
import { generateSessionId } from '../runtime/sessions/session-id.js';
import { writeSessionMeta } from '../runtime/sessions/session-meta.js';
import { addSessionEntry } from '../runtime/sessions/sessions-index.js';
import { sessionMirrorPath } from '../runtime/sessions/session-paths.js';

// inside runOpenKit, after runtimeSessionId computed:
const openKitSessionId = generateSessionId();
const sessionMeta = {
  sessionId: openKitSessionId,
  workItemId: null,
  lane: null,
  repoRoot: paths.projectRoot,
  worktreePath: null,
  targetBranch: null,
  featureBranch: null,
  startedAt: new Date().toISOString(),
};
writeSessionMeta(path.join(paths.projectRoot, '.opencode'), sessionMeta);
await addSessionEntry(path.join(paths.projectRoot, '.opencode'), {
  session_id: openKitSessionId, work_item_id: null, lane: null,
  worktree_path: null, repo_root: paths.projectRoot,
  pid: process.pid, status: 'active',
  started_at: sessionMeta.startedAt, last_seen_at: sessionMeta.startedAt,
});
```

Then inject into `runtimeBootstrapEnv`:

```javascript
OPENKIT_SESSION_ID: openKitSessionId,
OPENKIT_WORKFLOW_STATE: sessionMirrorPath(path.join(paths.projectRoot, '.opencode'), openKitSessionId),
```

(Replace the existing `OPENKIT_WORKFLOW_STATE: paths.workflowStatePath` assignment.)

- [ ] **Step 5: Verify pass**

```bash
node --test tests/global/launcher-sessions.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/global/launcher.js tests/global/launcher-sessions.test.js
git commit -m "feat(launcher): generate OPENKIT_SESSION_ID and register session"
```

> **Note** — Lane selection (`/quick-task | /migrate | /delivery`) and work-item-binding for the freshly created session happen via slash commands inside the running tab (Tasks 22-24). The launcher creates the session in an "unbound" state with `work_item_id = null`. Slash commands fill it in.

---

### Phase 3 verification

- [ ] Full sessions test suite:

```bash
node --test tests/runtime/sessions/ tests/global/launcher-sessions.test.js
```

- [ ] **Smoke test:** create a fresh repo, run `openkit run`, confirm `.opencode/sessions/<id>/meta.json` and `sessions/index.json` exist.

---

## Phase 4 — Session lifecycle commands

The remaining phases are summarized below. Each command follows the same TDD pattern: failing test → implement → verify → commit.

### Task 17: Heartbeat startup hook in runtime root

**Files:**
- Modify: `src/runtime/runtime-bootstrap.js` (or wherever `bootstrapRuntimeFoundation` finishes)
- Test: `tests/runtime/sessions/heartbeat-bootstrap.test.js`

Steps:
- Add `startHeartbeat({ baseDir, sessionId, pid: process.pid })` after migration runs and `OPENKIT_SESSION_ID` is in env.
- Register `process.on('exit')`, `process.on('SIGINT')`, `process.on('SIGTERM')` handlers that update sessions/index entry to `status='closed'` (best effort) and call the heartbeat stop fn.
- Test: launch fake bootstrap, advance fake interval, assert heartbeat file timestamp moves; send SIGINT, assert index entry is `closed`.

Commit: `feat(sessions): start heartbeat ticker and signal handlers in runtime root`

### Task 18: Resume command

**Files:**
- Create: `src/runtime/sessions/resume.js`
- Test: `tests/runtime/sessions/resume.test.js`

Cover the 6 steps in spec §6.5. Inject `spawn` for testability. Validate worktree path, branch match, atomic-write index updates, then invoke `spawn` to attach.

Commit: `feat(sessions): resume command core`

### Task 19: Abandon command

**Files:**
- Create: `src/runtime/sessions/abandon.js`
- Test: `tests/runtime/sessions/abandon.test.js`

Cover spec §6.6. Inject `worktreeRemover` and `prompt` for testability. Test happy path, dirty-worktree refusal, `--force-remove-dirty` override, missing worktree.

Commit: `feat(sessions): abandon command core`

### Task 20: Kill command

**Files:**
- Create: `src/runtime/sessions/kill.js`
- Test: `tests/runtime/sessions/kill.test.js`

Cover spec §6.7. Inject `processKill` (so the test can simulate alive→dead transitions) and `now`. Test SIGTERM-only happy path, SIGTERM→SIGKILL escalation, dead-PID refusal, `--abandon` combo.

Commit: `feat(sessions): kill command core with SIGTERM→SIGKILL escalation`

### Task 21: Finish command

**Files:**
- Create: `src/runtime/sessions/finish.js`
- Test: `tests/runtime/sessions/finish.test.js`

Cover spec §6.8 — both quick lane (no git op) and full/migration (squash merge → remove worktree → close). Inject `git` and `worktreeRemover`. Test:
- Quick happy path
- Full happy path (mock git accepts merge)
- Refuse on QA gate not met
- Refuse on missing worktree, branch mismatch, dirty worktree, repo on wrong branch
- Refuse on merge conflict (no cleanup)

Commit: `feat(sessions): finish command — squash merge and worktree removal`

### Task 22: Downgrade-index rollback

**Files:**
- Create: `src/runtime/sessions/downgrade-index.js`
- Test: `tests/runtime/sessions/downgrade-index.test.js`

Cover spec §8.4. Test: v3 with one in_progress → v2 with `active_work_item_id` set; v3 with all done → v2 without that field; restore latest `.legacy.<ts>` if present.

Commit: `feat(sessions): downgrade-index rollback script (maintainer-only)`

### Phase 4 verification

```bash
node --test tests/runtime/sessions/
```

---

## Phase 5 — CLI surface and UX

### Task 23: `openkit sessions` CLI dispatcher

**Files:**
- Create: `src/cli/commands/sessions/index.js`, `list.js`, `show.js`, `resume.js`, `abandon.js`, `kill.js`, `downgrade-index.js`
- Modify: `src/cli/...` main dispatch (`bin/openkit.js`)
- Test: `tests/cli/sessions-cli.test.js`

Each CLI subcommand thinly wraps the core function. Entry table:

```javascript
// src/cli/commands/sessions/index.js
import { listCmd } from './list.js';
import { showCmd } from './show.js';
import { resumeCmd } from './resume.js';
import { abandonCmd } from './abandon.js';
import { killCmd } from './kill.js';
import { downgradeIndexCmd } from './downgrade-index.js';

export const sessionsSubcommands = {
  list: listCmd,
  show: showCmd,
  resume: resumeCmd,
  abandon: abandonCmd,
  kill: killCmd,
  'downgrade-index': downgradeIndexCmd,
};

export async function sessionsDispatch(argv, ctx) {
  const [name, ...rest] = argv;
  const fn = sessionsSubcommands[name];
  if (!fn) throw new Error(`unknown subcommand: openkit sessions ${name}`);
  return fn(rest, ctx);
}
```

Tests cover argv parsing, exit codes, output format. Commit: `feat(cli): openkit sessions list/show/resume/abandon/kill/downgrade-index`

### Task 24: `openkit dashboard`

**Files:**
- Create: `src/cli/commands/dashboard.js`
- Test: `tests/cli/dashboard.test.js`

Render the box layout from spec §4.1 of brainstorming. Read sessions/index.json + each session's meta + read state.json's current stage. Test: 1 active + 1 orphan + 1 closed → output contains all three sections with correct headers.

Commit: `feat(cli): openkit dashboard cross-session view`

### Task 25: `openkit finish` and `/finish` slash

**Files:**
- Create: `src/cli/commands/finish.js`, `commands/finish.md`
- Test: `tests/cli/finish.test.js`

CLI thinly wraps `finish.js` from Task 21, resolving session via `resolveSession({ env: process.env, repoRoot })`.

Slash command file at `commands/finish.md` (follow existing slash command format under `commands/`).

Commit: `feat(cli): openkit finish + /finish slash command`

### Task 26: Session-start banner

**Files:**
- Create: `hooks/session-banner.js`
- Modify: existing `hooks/session-start*` to invoke the banner when `OPENKIT_SESSION_ID` is present
- Test: `tests/hooks/session-banner.test.js`

Banner reads `meta.json` + per-item state.json's stage. Render the box from spec §7.3. Test stdout match.

Commit: `feat(hooks): session-start banner for OpenKit session context`

### Task 27: Statusline session tag

**Files:**
- Create: `assets/statusline-session.js` (or modify existing statusline asset if present)
- Test: `tests/assets/statusline-session.test.js`

Append `[s_8f3a2c · full · full_implementation]` when `OPENKIT_SESSION_ID` is set. Test the formatting helper as a pure function.

Commit: `feat(statusline): session tag in statusline output`

### Phase 5 verification

```bash
node --test tests/cli/ tests/hooks/ tests/assets/
```

---

## Phase 6 — Compatibility refactor

### Task 28: Refactor reads of `active_work_item_id` in `src/`

**Files:**
- Modify: `src/runtime/create-tools.js:87`
- Modify: `src/global/workspace-state.js:144`, `:173`, `:193`

For each call site, the existing read of `index.active_work_item_id` is replaced by a call to `resolveSession({ env, repoRoot }).workItemId`, falling back to a clear error if env is missing (the call site should already have `env` and `repoRoot`).

Bootstrap path (`workspace-state.js:173`/`:193`) initializes the v3 schema directly, never writes `active_work_item_id`. Test: `tests/global/workspace-state-v3-bootstrap.test.js`.

Commit: `refactor(active-work-item-id): use session resolver in src/`

### Task 29: Refactor reads of `active_work_item_id` in `.opencode/lib/workflow-state-controller.js`

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js` lines 557, 612, 685, 2129, 2139, 2151, 2164, 3764
- Modify: `.opencode/lib/work-item-store.js` (drop legacy v2 writers)
- Modify: `.opencode/workflow-state.js:488`, `:736`, `:738`

Each call site falls into one of:
- Write of `active_work_item_id` → drop entirely; nothing writes the field anymore.
- Read of `active_work_item_id` → replace with `resolveSession(...).workItemId` if env available; otherwise read `current_session_id` from work-items index (find the entry with matching session) — but only as a transitional fallback for code paths that are not session-bound. Document each replacement in a code comment.

Update the `.opencode/tests/work-item-store.test.js` and `.opencode/tests/workflow-state-controller.test.js` fixtures to use v3 schema. **Each test fixture rewrite is its own commit** — keeps diff reviewable.

Commit (split as needed):
- `refactor(workflow-state-controller): swap active_work_item_id reads to resolver`
- `refactor(workflow-state-controller): drop active_work_item_id writes`
- `test(workflow-state-controller): migrate fixtures to v3 schema`
- `refactor(workflow-state.js): print v3 listing without active_work_item_id`

### Task 30: Slash command lane binding

**Files:**
- Modify: `commands/quick-task.md`, `commands/migrate.md`, `commands/delivery.md` (slash command implementations / instructions)
- Modify: corresponding agent prompts that invoke them

Slash command flow updated to:
1. Resolve current session via `resolveSession`.
2. If `meta.work_item_id` is already set → throw `SessionAlreadyBoundError` with the message from spec §7.2.
3. Otherwise, create the work item, update meta (one-time write of work_item_id, lane, worktree_path, branches), call `setCurrentSessionId`, and (for full/migration) trigger `worktree-manager` to create the worktree and re-spawn agents inside it.

Test: `tests/commands/lane-binding.test.js` covers each slash, the rejection path, and the worktree-creation path. Commit: `feat(commands): slash commands bind work item to current session`

---

## Phase 7 — Integration tests, doctor, manual QA

### Task 31: Doctor checks

**Files:**
- Modify: `src/runtime/doctor/...` to add the 5 checks from spec §7.5
- Test: `tests/runtime/doctor/sessions-checks.test.js`

For each check: one passing fixture, one failing fixture, assert classification (pass/warn/fail) and remediation message.

Commit: `feat(doctor): add sessions/orphan/legacy-mirror checks`

### Task 32: Multi-tab integration test

**Files:**
- Test: `tests/integration/sessions-multi-tab.test.js`

Use `child_process.fork` with two child scripts that each call the launcher's session-creation path. Assert:
- Two distinct session ids
- Two distinct entries in sessions/index.json
- No cross-overwrites of mirror files

Commit: `test(integration): multi-tab session isolation`

### Task 33: Orphan recovery integration

**Files:**
- Test: `tests/integration/orphan-recovery.test.js`

Spawn a subprocess that registers a session and exits via `process.exit(137)` (simulates kill -9). Run scanner with mock clock advanced 11 minutes. Assert orphan, run resume, assert active.

Commit: `test(integration): orphan recovery via resume`

### Task 34: Lock contention integration

**Files:**
- Test: `tests/integration/sessions-index-lock.test.js`

Fork 5 readers and 2 writers. Assert no JSON corruption, all complete under 10 seconds.

Commit: `test(integration): sessions/index.json lock contention`

### Task 35: Finish-flow integration

**Files:**
- Test: `tests/integration/finish-flow.test.js`

Real `git` calls on a temp repo: init, create worktree manually, simulate the session metadata, call finish. Assert squash-merge commit on target branch, worktree removed, feature branch deleted, work item done. Variants: dirty refusal, conflict refusal.

Commit: `test(integration): /finish squash-merge happy path and refusals`

### Task 36: Migration regression suite

**Files:**
- Create: `tests/fixtures/migration/pre-v3-typical/`, `pre-v3-multiple-workitems/`, `pre-v3-with-worktree/`, `pre-v3-already-v3/`, `pre-v3-corrupted/`
- Test: `tests/regression/migration-v2-to-v3-fixtures.test.js`, `tests/regression/auto-reconcile-worktree.test.js`

Each fixture is a directory tree copied to a tmpdir at test start. Run `migrateOnStart` against it, assert post-state.

Commit: `test(regression): v2→v3 migration fixtures and auto-reconcile`

### Task 37: Manual QA artifact

**Files:**
- Create: `docs/qa/2026-05-09-multi-session-isolation.md`

Document the manual checks in spec §10.5. Each check has a pass/fail box and an evidence column.

Commit: `docs(qa): manual QA checklist for multi-session isolation`

### Task 38: Update verify scripts

**Files:**
- Modify: `package.json` `scripts.verify:all`

Add `node --test tests/runtime/sessions/`, `node --test tests/integration/`, `node --test tests/regression/`. Confirm `npm run verify:all` passes.

Commit: `chore: include sessions and integration tests in verify:all`

### Task 39: Release notes and AGENTS.md update

**Files:**
- Modify: `RELEASES.md`, `CHANGELOG.md`, `AGENTS.md` (workflow artifacts section), `docs/maintainer/2026-03-26-ai-surface-map.md`

Document v0.7.0 cutover: per-session isolation, schema v3, legacy mirror deprecation, new `openkit sessions ...` and `openkit dashboard` commands, /finish flow.

Commit: `docs(release): v0.7.0 multi-session isolation cutover notes`

### Phase 7 verification

```bash
npm run verify:all
```

Expected: all tests pass.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §4.1 concepts (session/work-item/worktree) | Tasks 2, 5 (ids and meta) |
| §4.2 invariants 1-6 | Tasks 5 (write-once meta), 7 (no active_work_item_id), 10 (resolver), 30 (slash binding) |
| §5.1 sessions/index.json | Tasks 1, 6 |
| §5.2 meta.json | Task 5 |
| §5.3 heartbeat.json | Tasks 8, 17 |
| §5.4 work-items/index.json v3 | Task 7 |
| §5.5 legacy stub + rotation cap 10 | Task 12 |
| §5.6 atomic write protocol | Task 3 |
| §6 lifecycle (active→orphan→closed) | Tasks 8, 9, 17 |
| §6.1 resolver | Task 10 |
| §6.2 launcher | Task 16 |
| §6.3 heartbeat | Tasks 8, 17 |
| §6.4 orphan scanner | Task 9 |
| §6.5 resume | Task 18 |
| §6.6 abandon | Task 19 |
| §6.7 kill | Task 20 |
| §6.8 finish | Tasks 21, 25, 35 |
| §7.1 sessions CLI | Task 23 |
| §7.2 slash commands | Tasks 25, 30 |
| §7.3 banner | Task 26 |
| §7.4 statusline | Task 27 |
| §7.5 doctor 5 checks | Task 31 |
| §8.1 migration trigger | Tasks 14, 15 |
| §8.2 v2→v3 index | Task 7 |
| §8.3 worktree auto-reconcile | Tasks 13, 14 |
| §8.4 rollback | Task 22 |
| §9.1 active_work_item_id refactor | Tasks 28, 29 |
| §9.2 stub mirror | Tasks 12, 14 |
| §9.3 worktree manager wraps | Tasks 16, 21 |
| §9.4 WorkflowStateManager unchanged | Verified by Task 10 (resolver returns args) |
| §10 testing strategy | Tasks 32-37 |

All spec sections have an implementing task.

**Placeholder scan:** searched for "TBD", "TODO", "implement later", "fill in details" — none in the implementation steps. Task 39 references release notes content that the implementer must compose; that's an action, not a placeholder.

**Type consistency:**
- `sessionId` (camelCase) is the in-code field; `session_id` (snake) is the on-disk field. Used consistently.
- `workItemId` / `work_item_id` same convention.
- `addSessionEntry`, `updateSessionEntry`, `removeSessionEntry`, `listSessions` — verified consistent across Tasks 6, 9, 13, 23.
- `migrateWorkItemsIndex` (Task 7), `migrateOnStart` (Task 14), `reconcileExistingWorktrees` (Task 13) — distinct names, distinct responsibilities.
- `addWorkItem` / `setCurrentSessionId` / `setWorkItemStatus` (Task 7) — used in Tasks 16, 18, 19, 20, 21.

No naming drift detected.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-multi-session-isolation.md`.
