// Audit fix [4-H-1] / [4-H-2] / [4-H-3]: shared validator for spawn-able
// commands loaded from configuration files (.opencode/openkit.json,
// .mcp.json, env vars). Mirrors the rules already enforced by
// src/global/mcp/custom-mcp-validation.js so all spawn paths apply the
// same shell-injection / launcher-abuse boundary.

import path from 'node:path';

const SHELL_OPERATORS = ['&&', '||', ';', '|', '>', '<', '`', '$(', '\n', '\r'];
const SHELL_LAUNCHERS = new Set(['sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh']);
const SHELL_EXEC_FLAGS = new Set(['-c', '/c', '-command', '-encodedcommand']);

function executableName(command) {
  return path.basename(String(command ?? '')).toLowerCase().replace(/\.(exe|cmd|bat|com)$/u, '');
}

function hasShellOperator(value) {
  return SHELL_OPERATORS.some((operator) => String(value ?? '').includes(operator));
}

/**
 * Validate a (command, args) pair before spawning. Returns
 *   { ok: true } on success
 *   { ok: false, reason: string } on rejection
 *
 * Rules:
 * 1. command must be a non-empty string.
 * 2. command must not contain shell operators or command-substitution tokens.
 * 3. args (if provided) must each be strings without shell operators.
 * 4. If command resolves to a known shell launcher (sh/bash/zsh/cmd/...) AND
 *    the args contain a shell-exec flag (-c, /c, -command, ...), reject —
 *    that combination defeats argv-form spawn safety by handing a single
 *    string to the shell.
 *
 * @param {string} command
 * @param {string[]} [args]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateCommandSafety(command, args = []) {
  if (typeof command !== 'string' || command.length === 0) {
    return { ok: false, reason: 'command must be a non-empty string' };
  }

  if (hasShellOperator(command)) {
    return { ok: false, reason: 'command contains shell operators or command-substitution tokens; argv form is required' };
  }

  if (!Array.isArray(args)) {
    return { ok: false, reason: 'args must be an array' };
  }

  for (const part of args) {
    if (typeof part !== 'string') {
      return { ok: false, reason: 'every args element must be a string' };
    }
    if (hasShellOperator(part)) {
      return { ok: false, reason: 'args contain shell operators or command-substitution tokens; argv form is required' };
    }
  }

  const launcher = executableName(command);
  if (SHELL_LAUNCHERS.has(launcher) && args.some((part) => SHELL_EXEC_FLAGS.has(part.toLowerCase()))) {
    return { ok: false, reason: 'shell launcher with -c / /c flag is not allowed; use argv form instead' };
  }

  return { ok: true };
}

/**
 * Validate that an absolute path candidate (e.g. OPENKIT_SECURITY_CLI) is
 * an absolute filesystem path under one of the allowed prefixes. Used to
 * reject env-injected substitutions like /tmp/evil-binary.
 *
 * @param {string} candidate
 * @param {string[]} allowedPrefixes - e.g. ['/usr/']
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateAbsolutePathPrefix(candidate, allowedPrefixes) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return { ok: false, reason: 'value must be a non-empty string' };
  }
  if (!path.isAbsolute(candidate)) {
    return { ok: false, reason: 'value must be an absolute path' };
  }
  if (hasShellOperator(candidate)) {
    return { ok: false, reason: 'value contains shell operators or command-substitution tokens' };
  }
  const matched = allowedPrefixes.some((prefix) => candidate.startsWith(prefix));
  if (!matched) {
    return {
      ok: false,
      reason: `value must start with one of: ${allowedPrefixes.join(', ')}`,
    };
  }
  return { ok: true };
}
