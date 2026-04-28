// ---------------------------------------------------------------------------
// tool.lint — Run project linter and return structured findings
//
// Gated: active only when a linter config is detected in the project root.
// Supports ESLint and Biome detection; degrades gracefully when neither found.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

// -- Config detection --------------------------------------------------------

const ESLINT_CONFIGS = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
];

const BIOME_CONFIGS = ['biome.json', 'biome.jsonc'];

/**
 * Detect which linter is configured in the project root.
 * Returns { linter: 'eslint' | 'biome' | null, configPath: string | null }.
 */
export function detectLinter(projectRoot) {
  for (const name of ESLINT_CONFIGS) {
    const full = path.join(projectRoot, name);
    if (fs.existsSync(full)) return { linter: 'eslint', configPath: full };
  }

  // Also check package.json for eslintConfig key
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.eslintConfig) return { linter: 'eslint', configPath: pkgPath };
    } catch { /* ignore parse errors */ }
  }

  for (const name of BIOME_CONFIGS) {
    const full = path.join(projectRoot, name);
    if (fs.existsSync(full)) return { linter: 'biome', configPath: full };
  }

  return { linter: null, configPath: null };
}

// -- ESLint output parsing ---------------------------------------------------

/**
 * Parse ESLint JSON output (--format json) into structured findings.
 */
export function parseEslintJsonOutput(raw) {
  try {
    const files = JSON.parse(raw);
    if (!Array.isArray(files)) return [];

    const findings = [];
    for (const entry of files) {
      if (!entry.messages || !Array.isArray(entry.messages)) continue;
      for (const msg of entry.messages) {
        findings.push({
          file: entry.filePath ?? null,
          line: msg.line ?? null,
          column: msg.column ?? null,
          severity: msg.severity === 2 ? 'error' : 'warning',
          ruleId: msg.ruleId ?? null,
          message: msg.message ?? '',
          fixable: !!msg.fix,
        });
      }
    }
    return findings;
  } catch {
    return [];
  }
}

/**
 * Parse Biome JSON diagnostics output into structured findings.
 */
export function parseBiomeOutput(raw) {
  try {
    const parsed = JSON.parse(raw);
    const diagnostics = Array.isArray(parsed) ? parsed : parsed.diagnostics ?? [];

    return diagnostics.map((d) => ({
      file: d.file ?? d.path ?? null,
      line: d.span?.start?.line ?? d.location?.line ?? null,
      column: d.span?.start?.column ?? d.location?.column ?? null,
      severity: d.severity ?? 'error',
      ruleId: d.category ?? d.code ?? null,
      message: d.message ?? d.title ?? '',
      fixable: d.fixable ?? false,
    }));
  } catch {
    return [];
  }
}

// -- Lint binary detection ---------------------------------------------------

function detectLintBinary(projectRoot, linterName) {
  if (linterName === 'eslint') {
    const localBin = path.join(projectRoot, 'node_modules', '.bin', 'eslint');
    if (fs.existsSync(localBin)) return { command: localBin, args: [] };
    return { command: 'npx', args: ['eslint'] };
  }

  if (linterName === 'biome') {
    const localBin = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    if (fs.existsSync(localBin)) return { command: localBin, args: [] };
    return { command: 'npx', args: ['@biomejs/biome'] };
  }

  return null;
}

// -- Tool factory ------------------------------------------------------------

/**
 * Create the tool.lint tool definition.
 *
 * @param {object} options
 * @param {string} options.projectRoot  Absolute path to the project root.
 * @param {object} options.toolRunner   An external tool runner instance.
 * @returns {object} Tool definition compatible with the tool registry.
 */
export function createLintTool({ projectRoot, toolRunner }) {
  const { linter, configPath } = detectLinter(projectRoot);
  const isActive = linter !== null;

  return {
    id: 'tool.lint',
    name: 'Lint Tool',
    description:
      'Run the project linter (ESLint or Biome) and return structured findings. ' +
      'Supports file-scoped linting and reports fixable issues.',
    family: 'external',
    stage: 'foundation',
    status: isActive ? 'active' : 'unavailable',
    validationSurface: 'target_project_app',
    detectedLinter: linter,
    async execute({ filePath, fix = false, timeout = 60_000 } = {}) {
      if (!isActive) {
        return {
          status: 'unavailable',
          validationSurface: 'target_project_app',
          capabilityState: 'unavailable',
          unavailableValidationPath: 'target_project_app',
          reason: 'No linter configuration found in project root.',
          caveats: ['Target-project app lint validation is unavailable until the project declares a supported linter config.'],
        };
      }

      if (!toolRunner) {
        return {
          status: 'unavailable',
          validationSurface: 'target_project_app',
          capabilityState: 'unavailable',
          unavailableValidationPath: 'target_project_app',
          reason: 'External tool runner is not configured.',
        };
      }

      const binary = detectLintBinary(projectRoot, linter);
      if (!binary) {
        return {
          status: 'unavailable',
          validationSurface: 'target_project_app',
          capabilityState: 'unavailable',
          unavailableValidationPath: 'target_project_app',
          reason: `Cannot detect binary for linter: ${linter}`,
        };
      }

      let cmdArgs;

      if (linter === 'eslint') {
        cmdArgs = [...binary.args, '--format', 'json'];
        if (fix) cmdArgs.push('--fix');
        cmdArgs.push(filePath ?? '.');
      } else if (linter === 'biome') {
        cmdArgs = [...binary.args, 'lint'];
        if (fix) cmdArgs.push('--apply');
        cmdArgs.push('--reporter', 'json');
        cmdArgs.push(filePath ?? '.');
      } else {
        return { status: 'error', reason: `Unsupported linter: ${linter}` };
      }

      const result = await toolRunner.run(binary.command, cmdArgs, { timeout });

      if (result.timedOut) {
        return {
          status: 'timeout',
          validationSurface: 'target_project_app',
          capabilityState: 'degraded',
          reason: `${linter} timed out after ${timeout}ms.`,
          stdout: result.stdout.slice(0, 2000),
          stderr: result.stderr.slice(0, 2000),
        };
      }

      const rawOutput = result.stdout || result.stderr;
      const findings = linter === 'eslint'
        ? parseEslintJsonOutput(rawOutput)
        : parseBiomeOutput(rawOutput);

      return {
        status: findings.length === 0 ? 'ok' : 'findings',
        validationSurface: 'target_project_app',
        capabilityState: 'available',
        linter,
        configPath,
        exitCode: result.exitCode,
        findings,
        totalErrors: findings.filter((f) => f.severity === 'error').length,
        totalWarnings: findings.filter((f) => f.severity === 'warning').length,
        fixable: findings.filter((f) => f.fixable).length,
        fix,
      };
    },
  };
}
