#!/usr/bin/env node
/**
 * OpenKit statusline plugin — appends a per-tab session tag of the form
 *
 *   [s_8f3a2c · full · full_implementation]
 *
 * to whatever upstream statusline content is being rendered, whenever
 * `OPENKIT_SESSION_ID` is set in the environment.
 *
 * Spec §7.4 (docs/superpowers/specs/2026-05-09-multi-session-isolation-design.md):
 *   "The statusline plugin appends a tag of the form
 *    `[s_8f3a2c · full · full_implementation]` whenever `OPENKIT_SESSION_ID`
 *    is set."
 *
 * Contract (Claude Code statusline command):
 *   - Receives JSON on stdin (e.g. `{ "session_id": "...", "model": { ... } }`)
 *     plus the parent process env. Optional — falls back gracefully if stdin
 *     is empty.
 *   - Writes the final statusline string to stdout (no trailing newline
 *     required, but harmless).
 *   - Must never throw — a broken statusline must not block the user. We
 *     return the upstream input verbatim on any failure.
 *
 * The pure formatter `formatSessionTag` is exported for unit-testing without
 * touching the filesystem. The IO-bound `buildStatusLine` is also exported so
 * tests can drive it with a fixture base dir.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Pure helpers (testable in isolation; no FS, no env reads)
// ---------------------------------------------------------------------------

/**
 * Build the bracketed session tag.
 *
 * @param {{ sessionId?: string|null, lane?: string|null, stage?: string|null }} fields
 * @returns {string} `"[s_8f3a2c · full · full_implementation]"` when sessionId
 *   is present, otherwise `""`. Missing lane/stage render as `"-"` so the
 *   shape stays stable. The separator is the U+00B7 middle dot, surrounded
 *   by single spaces, matching spec §7.4 verbatim.
 */
export function formatSessionTag({ sessionId, lane, stage } = {}) {
  if (!sessionId || typeof sessionId !== 'string') return '';
  const safe = (v) => {
    if (v === undefined || v === null) return '-';
    const s = String(v).trim();
    return s.length === 0 ? '-' : s;
  };
  return `[${safe(sessionId)} · ${safe(lane)} · ${safe(stage)}]`;
}

/**
 * Append the session tag to an upstream statusline string. The tag is joined
 * with a single space when the upstream content is non-empty; when upstream
 * is empty we return just the tag. When `sessionId` is absent we return the
 * upstream content unchanged.
 *
 * @param {string} upstream
 * @param {{ sessionId?: string|null, lane?: string|null, stage?: string|null }} fields
 * @returns {string}
 */
export function appendSessionTag(upstream, fields) {
  const base = typeof upstream === 'string' ? upstream : '';
  const tag = formatSessionTag(fields);
  if (!tag) return base;
  return base.length === 0 ? tag : `${base} ${tag}`;
}

// ---------------------------------------------------------------------------
// IO-bound helpers (read session meta + per-session workflow-state mirror)
// ---------------------------------------------------------------------------

function safeReadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Look up `(lane, stage)` for a session by reading
 *   <baseDir>/sessions/<id>/meta.json          → lane
 *   <baseDir>/sessions/<id>/workflow-state.json → current_stage
 *   <baseDir>/work-items/<wi>/state.json        → current_stage (fallback)
 *
 * Each read is best-effort; missing/unparseable files yield `null` for the
 * corresponding field. This function never throws.
 *
 * @param {string} baseDir absolute path to `<project>/.opencode`
 * @param {string} sessionId
 * @returns {{ sessionId: string, lane: string|null, stage: string|null, workItemId: string|null }}
 */
export function readSessionContext(baseDir, sessionId) {
  if (!baseDir || !sessionId) {
    const normalizedId = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    return { sessionId: normalizedId, lane: null, stage: null, workItemId: null };
  }
  const sessionRoot = path.join(baseDir, 'sessions', sessionId);
  const meta = safeReadJson(path.join(sessionRoot, 'meta.json'));
  const lane = typeof meta?.lane === 'string' && meta.lane.length > 0 ? meta.lane : null;
  const workItemId = typeof meta?.work_item_id === 'string' && meta.work_item_id.length > 0
    ? meta.work_item_id
    : null;

  // Prefer the per-session mirror (matches `WorkflowStateManager`'s session
  // surface); fall back to the work-item state.json so the tag still resolves
  // a sensible stage on the very first paint, before the mirror is written.
  const candidates = [path.join(sessionRoot, 'workflow-state.json')];
  if (workItemId) {
    candidates.push(path.join(baseDir, 'work-items', workItemId, 'state.json'));
  }
  let stage = null;
  for (const candidate of candidates) {
    const data = safeReadJson(candidate);
    if (data && typeof data.current_stage === 'string' && data.current_stage.length > 0) {
      stage = data.current_stage;
      break;
    }
  }
  return { sessionId, lane, stage, workItemId };
}

/**
 * Resolve `<project>/.opencode` for the current invocation. Honours
 * `OPENKIT_PROJECT_ROOT` (set by `src/global/launcher.js`) before falling
 * back to the supplied `cwd`.
 *
 * @param {{ env: NodeJS.ProcessEnv, cwd: string }} ctx
 * @returns {string}
 */
export function resolveBaseDir({ env, cwd }) {
  if (env?.OPENKIT_SESSION_BASE_DIR && env.OPENKIT_SESSION_BASE_DIR.length > 0) {
    return path.resolve(env.OPENKIT_SESSION_BASE_DIR);
  }

  const root = env?.OPENKIT_REPOSITORY_ROOT && env.OPENKIT_REPOSITORY_ROOT.length > 0
    ? env.OPENKIT_REPOSITORY_ROOT
    : (env?.OPENKIT_PROJECT_ROOT && env.OPENKIT_PROJECT_ROOT.length > 0
      ? env.OPENKIT_PROJECT_ROOT
      : (cwd ?? process.cwd()));
  return path.join(root, '.opencode');
}

/**
 * End-to-end builder used by the CLI entrypoint and exercised by tests with
 * a fixture base dir. Never throws — returns the upstream input on any
 * unexpected failure.
 *
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string, input?: string, baseDir?: string }} opts
 * @returns {string}
 */
export function buildStatusLine({ env = {}, cwd = process.cwd(), input = '', baseDir } = {}) {
  try {
    const sessionId = env.OPENKIT_SESSION_ID;
    if (!sessionId) return input;
    const resolvedBase = baseDir ?? resolveBaseDir({ env, cwd });
    const ctx = readSessionContext(resolvedBase, sessionId);
    return appendSessionTag(input, ctx);
  } catch {
    return input;
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

/**
 * Extract the upstream statusline content from a Claude Code statusline JSON
 * payload. Recognised shapes:
 *
 *   { "statusline": "..." }    // already-rendered upstream
 *   { "input": "..." }         // alternative key used by some plugins
 *   "raw text"                 // plain string on stdin
 *
 * Anything else yields an empty string — we still emit the tag if the env is
 * set, so the user gets useful information.
 *
 * @param {string} stdinPayload
 * @returns {string}
 */
export function extractUpstreamInput(stdinPayload) {
  const raw = typeof stdinPayload === 'string' ? stdinPayload.trim() : '';
  if (raw.length === 0) return '';
  // Recognise JSON shapes by their leading char — object, array, or quoted
  // string. Anything else is treated as already-rendered upstream text.
  if (raw.startsWith('{') || raw.startsWith('[') || raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.statusline === 'string') return parsed.statusline;
        if (typeof parsed.input === 'string') return parsed.input;
      }
      return '';
    } catch {
      return raw;
    }
  }
  return raw;
}

async function main() {
  let payload = '';
  try {
    payload = await readStdin();
  } catch {
    payload = '';
  }
  const input = extractUpstreamInput(payload);
  const out = buildStatusLine({ env: process.env, cwd: process.cwd(), input });
  process.stdout.write(out);
}

// Run as CLI when invoked directly (not when imported from tests).
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`
  || (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])));
if (invokedDirectly) {
  main().catch(() => {
    // Statusline must never block the user.
    process.exit(0);
  });
}
