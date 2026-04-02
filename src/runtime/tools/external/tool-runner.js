// ---------------------------------------------------------------------------
// External tool runner — safe child-process execution with timeout, structured
// result, and environment isolation.
//
// Used by tool.typecheck, tool.lint, tool.test-run to invoke project-local
// toolchains without leaking runtime internals or blocking the event loop.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Create an external tool runner bound to a project root.
 *
 * @param {object} options
 * @param {string} options.projectRoot  Absolute path to the project root.
 * @param {object} [options.env]        Base environment (defaults to process.env).
 * @returns {{ run: Function }}
 */
export function createExternalToolRunner({ projectRoot, env = process.env }) {
  /**
   * Run an external command and capture structured output.
   *
   * @param {string}   command             Executable name or path.
   * @param {string[]} args                Command arguments.
   * @param {object}   [options]
   * @param {number}   [options.timeout]   Timeout in ms (default 30 000).
   * @param {string}   [options.cwd]       Working directory (default projectRoot).
   * @param {object}   [options.extraEnv]  Additional env vars merged on top.
   * @returns {Promise<{ exitCode: number|null, stdout: string, stderr: string, timedOut: boolean }>}
   */
  async function run(command, args = [], { timeout = 30_000, cwd, extraEnv } = {}) {
    const resolvedCwd = cwd ?? projectRoot;

    // Build a safe environment: inherit from base, add node_modules/.bin to
    // PATH so project-local binaries are found first, then merge extraEnv.
    const localBin = path.join(projectRoot, 'node_modules', '.bin');
    const basePath = env.PATH ?? '';
    const mergedEnv = {
      ...env,
      PATH: localBin + path.delimiter + basePath,
      ...extraEnv,
    };

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      function settle(exitCode) {
        if (settled) return;
        settled = true;
        resolve({ exitCode, stdout, stderr, timedOut });
      }

      let child;
      try {
        child = spawn(command, args, {
          cwd: resolvedCwd,
          env: mergedEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (spawnError) {
        // spawn itself can throw (e.g. ENOENT for missing command)
        settle(null);
        stderr = spawnError instanceof Error ? spawnError.message : String(spawnError);
        return;
      }

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
          // Give 2 s grace then SIGKILL
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch { /* best-effort */ }
          }, 2000);
        } catch { /* already exited */ }
      }, timeout);

      child.stdout.on('data', (chunk) => { stdout += String(chunk); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });

      child.on('error', (err) => {
        clearTimeout(timer);
        stderr += (stderr ? '\n' : '') + (err instanceof Error ? err.message : String(err));
        settle(null);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        settle(code);
      });
    });
  }

  return { run, projectRoot };
}
