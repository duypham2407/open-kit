import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';
import { isAstGrepAvailable } from '../../../global/tooling.js';

/**
 * tool.ast-grep-search
 *
 * Structural code search using the ast-grep CLI.
 * Runs `ast-grep run --pattern <pattern> --lang <lang> --json <path>`.
 *
 * This tool actually invokes the ast-grep binary (unlike ast-search which
 * previously only checked ast-grep availability for metadata).
 */
export function createAstGrepSearchTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.ast-grep-search',
    name: 'AST-Grep Structural Search',
    description:
      'Structural code search using ast-grep patterns. Finds code matching an AST pattern across the project or a specific file.',
    family: 'ast',
    stage: 'active',
    status: isAstGrepAvailable({ env: process.env }) ? 'active' : 'degraded',
    execute(input = {}) {
      if (!isAstGrepAvailable({ env: process.env })) {
        return {
          status: 'dependency-missing',
          reason: 'ast-grep CLI is not available on PATH. Install with: npm install -g @ast-grep/cli',
          matches: [],
          matchCount: 0,
        };
      }

      const pattern = input.pattern;
      if (!pattern || typeof pattern !== 'string') {
        return {
          status: 'invalid-input',
          reason: 'A pattern string is required. Example: "console.log($A)"',
          matches: [],
          matchCount: 0,
        };
      }

      const lang = input.lang ?? input.language ?? 'typescript';
      const targetPath = input.path
        ? resolveProjectPath(projectRoot, input.path)
        : projectRoot;

      if (targetPath && !isInsideProjectRoot(projectRoot, targetPath)) {
        return { status: 'invalid-path', matches: [], matchCount: 0 };
      }

      try {
        const spawnArgs = [
          'run',
          '--pattern', pattern,
          '--lang', lang,
          '--json',
          targetPath || projectRoot,
        ];

        const spawnResult = spawnSync('ast-grep', spawnArgs, {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 30000,
          maxBuffer: 5 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });

        if (spawnResult.error) {
          throw spawnResult.error;
        }

        const stdoutOutput = spawnResult.stdout ?? '';
        const stderrOutput = spawnResult.stderr ?? '';
        const exitStatus = spawnResult.status;

        let parsed;
        try {
          parsed = JSON.parse(stdoutOutput);
        } catch {
          return {
            status: 'ok',
            pattern,
            lang,
            targetPath: targetPath ? path.relative(projectRoot, targetPath) : '.',
            matches: [],
            matchCount: 0,
            rawOutput: stdoutOutput.slice(0, 500),
            stderrOutput: stderrOutput.slice(0, 500),
            exitStatus,
          };
        }

        const matches = (Array.isArray(parsed) ? parsed : []).map((entry) => ({
          file: entry.file ? path.relative(projectRoot, entry.file) : null,
          rule: entry.ruleId ?? null,
          text: entry.text ?? entry.matchedText ?? null,
          range: entry.range ?? null,
          lines: entry.lines ?? null,
        }));

        return {
          status: 'ok',
          pattern,
          lang,
          targetPath: targetPath ? path.relative(projectRoot, targetPath) : '.',
          matches,
          matchCount: matches.length,
        };
      } catch (error) {
        // With spawnSync, only spawn-level failures (ENOENT, ETIMEDOUT, etc.)
        // throw via spawnResult.error rethrow above. Non-zero ast-grep exits
        // are handled inside the JSON.parse fallback, not here.
        return {
          status: 'error',
          reason: error?.message ?? String(error),
          pattern,
          lang,
          matches: [],
          matchCount: 0,
        };
      }
    },
  };
}
