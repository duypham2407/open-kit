// ---------------------------------------------------------------------------
// src/runtime/runtime-bootstrap.js
//
// Session lifecycle wiring for the runtime root (the long-lived process that
// hosts the OpenKit runtime in a launched session). Starts the heartbeat
// ticker and registers signal handlers that mark the sessions/index entry as
// `closed` on shutdown. Best-effort: shutdown handlers swallow errors because
// they may run during hard process termination.
//
// Wired in by the spawned process entry points (e.g. mcp-server) after
// bootstrapRuntimeFoundation returns, when OPENKIT_SESSION_ID is in env.
// ---------------------------------------------------------------------------

import { startHeartbeat } from './sessions/heartbeat.js';
import { updateSessionEntry } from './sessions/sessions-index.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'];

function noopHandle() {
  return {
    started: false,
    stop() {},
    async shutdown() {},
  };
}

/**
 * Start the per-session lifecycle: heartbeat ticker + shutdown handlers.
 *
 * @param {object} opts
 * @param {string} opts.baseDir         e.g. <projectRoot>/.opencode
 * @param {string|null|undefined} opts.sessionId  must equal env.OPENKIT_SESSION_ID
 * @param {number} [opts.pid]           defaults to processRef.pid
 * @param {number} [opts.intervalMs]    heartbeat interval (test override)
 * @param {boolean} [opts.registerSignals=true] register exit/SIGINT/SIGTERM
 * @param {object} [opts.processRef]    test seam (defaults to global process)
 * @returns {{started:boolean, stop:Function, shutdown:Function}}
 */
export function startSessionLifecycle({
  baseDir,
  sessionId,
  pid,
  intervalMs,
  registerSignals = true,
  processRef = process,
} = {}) {
  if (!sessionId) return noopHandle();
  if (!baseDir) return noopHandle();

  const effectivePid = pid ?? processRef.pid;
  const stopHeartbeat = startHeartbeat({
    baseDir,
    sessionId,
    pid: effectivePid,
    ...(intervalMs ? { intervalMs } : {}),
  });

  let stopped = false;
  let shutdownRan = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { stopHeartbeat(); } catch { /* swallow */ }
  };

  const shutdown = async () => {
    if (shutdownRan) return;
    shutdownRan = true;
    stop();
    // Best-effort: the sessions/index update may race with hard shutdown,
    // a corrupt index, or a missing entry. Never let the handler throw.
    try {
      await updateSessionEntry(baseDir, sessionId, (entry) => ({
        ...entry,
        status: 'closed',
        last_seen_at: new Date().toISOString(),
      }));
    } catch { /* swallow */ }
  };

  if (registerSignals && processRef) {
    // 'exit' is synchronous-only — async work won't finish. Stop the ticker
    // and fire shutdown without awaiting; the SIGINT/SIGTERM paths handle the
    // index update before exit propagates.
    processRef.on('exit', () => {
      stop();
      // Kick off best-effort close. Result discarded.
      shutdown().catch(() => {});
    });
    for (const sig of SHUTDOWN_SIGNALS) {
      processRef.on(sig, () => {
        // Return the shutdown promise so the host (or tests) can await it.
        // We don't propagate-exit ourselves: the host process owns exit codes.
        // Errors are already swallowed by shutdown().
        return shutdown();
      });
    }
  }

  return {
    started: true,
    stop,
    shutdown,
  };
}
