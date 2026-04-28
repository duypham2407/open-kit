// ---------------------------------------------------------------------------
// tool.typecheck — Run TypeScript type checker and return structured diagnostics
//
// Gated: active only when a tsconfig.json is found in the project root.
// Uses the project-local tsc when available, falls back to npx tsc.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse a single line of tsc --noEmit output into a diagnostic object.
 *
 * Expected format:
 *   src/foo.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.
 *
 * Returns null if the line does not match.
 */
export function parseTscLine(line) {
  // Match: file(line,col): severity TScode: message
  const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.+)$/);
  if (!match) return null;

  return {
    file: match[1],
    line: parseInt(match[2], 10),
    column: parseInt(match[3], 10),
    severity: match[4],
    code: match[5],
    message: match[6],
  };
}

/**
 * Parse full tsc output into structured diagnostics.
 */
export function parseTscOutput(raw) {
  const lines = raw.split('\n');
  const diagnostics = [];
  for (const line of lines) {
    const parsed = parseTscLine(line.trim());
    if (parsed) diagnostics.push(parsed);
  }
  return diagnostics;
}

/**
 * Detect the tsconfig path to use.
 * Returns the absolute path if found, null otherwise.
 */
export function detectTsconfig(projectRoot) {
  const candidates = ['tsconfig.json', 'tsconfig.build.json'];
  for (const name of candidates) {
    const full = path.join(projectRoot, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/**
 * Detect the tsc binary to use.
 * Prefers project-local node_modules/.bin/tsc, falls back to npx tsc.
 */
export function detectTscBinary(projectRoot) {
  const localTsc = path.join(projectRoot, 'node_modules', '.bin', 'tsc');
  if (fs.existsSync(localTsc)) {
    return { command: localTsc, args: [] };
  }
  return { command: 'npx', args: ['tsc'] };
}

/**
 * Create the tool.typecheck tool definition.
 *
 * @param {object} options
 * @param {string}          options.projectRoot   Absolute path to the project root.
 * @param {object}          options.toolRunner    An external tool runner instance.
 * @returns {object}        Tool definition compatible with the tool registry.
 */
export function createTypecheckTool({ projectRoot, toolRunner }) {
  const tsconfigPath = detectTsconfig(projectRoot);
  const isActive = tsconfigPath !== null;

  return {
    id: 'tool.typecheck',
    name: 'TypeScript Type Checker',
    description:
      'Run the TypeScript compiler in --noEmit mode to surface type errors. ' +
      'Returns structured diagnostics with file, line, column, severity, and message.',
    family: 'external',
    stage: 'foundation',
    status: isActive ? 'active' : 'unavailable',
    validationSurface: 'target_project_app',
    async execute({ filePath, project, timeout = 60_000 } = {}) {
      if (!isActive) {
        return {
          status: 'unavailable',
          validationSurface: 'target_project_app',
          capabilityState: 'unavailable',
          unavailableValidationPath: 'target_project_app',
          reason: 'No tsconfig.json found in project root.',
          caveats: ['Target-project app typecheck validation is unavailable until the project declares tsconfig.json.'],
        };
      }

      if (!toolRunner) {
        return {
          status: 'unavailable',
          validationSurface: 'target_project_app',
          capabilityState: 'unavailable',
          unavailableValidationPath: 'target_project_app',
          reason: 'External tool runner is not configured.',
          caveats: ['Target-project app typecheck validation is unavailable because no tool runner is configured.'],
        };
      }

      const { command, args: baseArgs } = detectTscBinary(projectRoot);
      const tscArgs = [...baseArgs, '--noEmit'];

      const effectiveProject = project ?? tsconfigPath;
      tscArgs.push('--project', effectiveProject);

      if (filePath) {
        // tsc --noEmit --project does not accept file arguments — but we
        // include the file path for filtering output later.
      }

      const result = await toolRunner.run(command, tscArgs, { timeout });

      if (result.timedOut) {
        return {
          status: 'timeout',
          validationSurface: 'target_project_app',
          capabilityState: 'degraded',
          reason: `tsc timed out after ${timeout}ms.`,
          stdout: result.stdout.slice(0, 2000),
          stderr: result.stderr.slice(0, 2000),
        };
      }

      // tsc returns 0 for no errors, non-zero when there are errors.
      const rawOutput = result.stdout || result.stderr;
      const diagnostics = parseTscOutput(rawOutput);

      // If a specific filePath was requested, filter diagnostics to that file
      const filtered = filePath
        ? diagnostics.filter((d) => {
            const normalized = d.file.replace(/\\/g, '/');
            const target = filePath.replace(/\\/g, '/');
            return normalized === target || normalized.endsWith('/' + target) || target.endsWith('/' + normalized);
          })
        : diagnostics;

      return {
        status: filtered.length === 0 ? 'ok' : 'errors',
        validationSurface: 'target_project_app',
        capabilityState: 'available',
        exitCode: result.exitCode,
        diagnostics: filtered,
        totalErrors: diagnostics.filter((d) => d.severity === 'error').length,
        totalWarnings: diagnostics.filter((d) => d.severity === 'warning').length,
        filtered: filePath ? true : false,
      };
    },
  };
}
