import { readHeartbeat } from './heartbeat.js';
import { readSessionMeta } from './session-meta.js';
import { updateSessionEntry } from './sessions-index.js';
import { setCurrentSessionId } from './work-items-index.js';
import { abandonSession } from './abandon.js';
import {
  SIGTERM_TO_SIGKILL_GRACE_MS,
  SIGKILL_CONFIRM_TIMEOUT_MS,
} from './constants.js';

/**
 * Default `processKill(pid, signal)` — wraps `process.kill`. Throws an Error
 * with `code === 'ESRCH'` when the PID is dead.
 */
function defaultProcessKill(pid, signal) {
  return process.kill(pid, signal);
}

/**
 * Default sleep — uses setTimeout. Tests inject a deterministic stub.
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    const handle = setTimeout(resolve, ms);
    handle.unref?.();
  });
}

/**
 * `isAlive(pid)` via signal 0. Treats a missing PID as dead. Any thrown error
 * other than `EPERM` is treated as dead — `EPERM` means the PID exists but we
 * don't own it, so the process is alive from our point of view.
 */
function isAlive(processKill, pid) {
  if (!pid) return false;
  try {
    processKill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

/**
 * Kill a hung session per spec §6.7.
 *
 * Steps:
 *   1. Read PID from `sessions/<id>/heartbeat.json`. If the PID is already
 *      dead (or there is no heartbeat / no PID), refuse with a recommendation
 *      to run `abandon` instead — `kill` is for live, hung processes only.
 *   2. Send SIGTERM. Wait `SIGTERM_TO_SIGKILL_GRACE_MS` (3 s).
 *   3. If still alive, send SIGKILL and poll signal-0 every 100 ms for up to
 *      `SIGKILL_CONFIRM_TIMEOUT_MS` (5 s) waiting for `ESRCH`.
 *   4. Once the PID is confirmed dead, mark the sessions index entry
 *      `status = orphan` and clear `work_items[*].current_session_id`. The
 *      user can then `resume` or `abandon`.
 *   5. If `abandon` is true, run abandonSession after the kill completes —
 *      this combines kill + abandon in a single command.
 *
 * Injected dependencies (testability):
 *   - processKill(pid, signal) — defaults to `process.kill`. Must throw an
 *     Error with `code === 'ESRCH'` when the PID does not exist.
 *   - sleep(ms) — defaults to a real setTimeout-based sleep.
 *   - now() — defaults to Date.now.
 *   - For `--abandon`: forwards `abandon`-related opts to `abandonSession`.
 *
 * @param {object} opts
 * @param {string}  opts.baseDir
 * @param {string}  opts.sessionId
 * @param {boolean} [opts.abandon=false]            run abandonSession after kill
 * @param {boolean} [opts.forceRemoveDirty=false]   forwarded to abandonSession
 * @param {Function} [opts.worktreeRemover]         forwarded to abandonSession
 * @param {Function} [opts.prompt]                  forwarded to abandonSession
 * @param {(pid: number, signal: number|string) => any} [opts.processKill]
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {() => number} [opts.now]
 * @param {number} [opts.pollIntervalMs=100]
 * @returns {Promise<{
 *   sessionId: string,
 *   pid: number,
 *   escalated: boolean,
 *   killedAt: string,
 *   abandon?: object,
 * }>}
 */
export async function killSession({
  baseDir,
  sessionId,
  abandon = false,
  forceRemoveDirty = false,
  worktreeRemover,
  prompt,
  processKill = defaultProcessKill,
  sleep = defaultSleep,
  now = () => Date.now(),
  pollIntervalMs = 100,
}) {
  // Validate session exists before touching anything (throws SessionNotFoundError).
  const meta = readSessionMeta(baseDir, sessionId);

  // Step 1: read PID from heartbeat. PID dead → recommend abandon.
  const hb = readHeartbeat(baseDir, sessionId);
  if (!hb || !hb.pid) {
    const reason = hb ? 'has no PID' : 'is missing';
    const err = new Error(
      `Session '${sessionId}' heartbeat ${reason}. The process is not alive — run \`openkit sessions abandon ${sessionId}\` instead.`,
    );
    err.code = 'OK_KILL_PID_DEAD';
    err.sessionId = sessionId;
    throw err;
  }
  const pid = hb.pid;
  if (!isAlive(processKill, pid)) {
    const err = new Error(
      `Session '${sessionId}' PID ${pid} is already dead. Run \`openkit sessions abandon ${sessionId}\` instead.`,
    );
    err.code = 'OK_KILL_PID_DEAD';
    err.sessionId = sessionId;
    err.pid = pid;
    throw err;
  }

  // Step 2: SIGTERM, wait 3 s.
  try {
    processKill(pid, 'SIGTERM');
  } catch (err) {
    // ESRCH between the alive check and the SIGTERM send: process died on
    // its own. Treat as success — fall through to index updates.
    if (!err || err.code !== 'ESRCH') throw err;
  }
  await sleep(SIGTERM_TO_SIGKILL_GRACE_MS);

  // Step 3: if still alive, SIGKILL + poll up to 5 s for ESRCH.
  let escalated = false;
  if (isAlive(processKill, pid)) {
    escalated = true;
    try {
      processKill(pid, 'SIGKILL');
    } catch (err) {
      if (!err || err.code !== 'ESRCH') throw err;
    }
    const deadline = now() + SIGKILL_CONFIRM_TIMEOUT_MS;
    while (isAlive(processKill, pid)) {
      if (now() >= deadline) {
        const err = new Error(
          `Session '${sessionId}' PID ${pid} did not exit within ${SIGKILL_CONFIRM_TIMEOUT_MS}ms after SIGKILL.`,
        );
        err.code = 'OK_KILL_TIMEOUT';
        err.sessionId = sessionId;
        err.pid = pid;
        throw err;
      }
      await sleep(pollIntervalMs);
    }
  }

  // Step 4: PID confirmed dead — atomically mark orphan + clear pointer.
  const killedAt = new Date(now()).toISOString();
  await updateSessionEntry(baseDir, sessionId, (cur) => ({
    ...cur,
    status: 'orphan',
    pid: null,
    last_seen_at: killedAt,
  }));
  if (meta.work_item_id) {
    await setCurrentSessionId(baseDir, meta.work_item_id, null);
  }

  const result = { sessionId, pid, escalated, killedAt };

  // Step 5: --abandon combo. Run after the kill is fully committed so a
  // failure during abandon still leaves the session in a sane (orphan) state.
  if (abandon) {
    result.abandon = await abandonSession({
      baseDir,
      sessionId,
      forceRemoveDirty,
      worktreeRemover,
      prompt,
    });
  }

  return result;
}
