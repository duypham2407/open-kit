import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSemgrepAvailable } from '../../../global/tooling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.resolve(__dirname, '../../../../assets/semgrep/packs');

const BUNDLED_PACK_ALIASES = {
  auto: path.join(PACKS_DIR, 'quality-default.yml'),
  'p/security-audit': path.join(PACKS_DIR, 'security-audit.yml'),
};

export function resolveSemgrepConfig(config) {
  return BUNDLED_PACK_ALIASES[config] ?? config;
}

function normalizeFindings(results = []) {
  return results.map((entry) => ({
    checkId: entry.check_id,
    path: entry.path,
    start: entry.start,
    end: entry.end,
    severity: entry.extra?.severity ?? 'INFO',
    message: entry.extra?.message ?? '',
  }));
}

export function createRuleScanTool({ projectRoot }) {
  return {
    id: 'tool.rule-scan',
    name: 'Rule Scan Tool',
    description: 'Runs Semgrep rule scans against the current project or a target path.',
    family: 'audit',
    stage: 'foundation',
    status: 'active',
    execute(input = {}) {
      if (!isSemgrepAvailable({ env: process.env })) {
        return {
          status: 'dependency-missing',
          provider: 'semgrep',
          findings: [],
        };
      }

      const targetPath = typeof input === 'string' ? input : input.path ?? projectRoot;
      const rawConfig = typeof input === 'object' && input !== null ? input.config ?? 'auto' : 'auto';
      const config = resolveSemgrepConfig(rawConfig);
      const result = spawnSync('semgrep', ['scan', '--json', '--config', config, targetPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: process.env,
      });

      if (result.error) {
        throw result.error;
      }

      const parsed = result.stdout ? JSON.parse(result.stdout) : { results: [] };
      return {
        status: result.status === 0 || result.status === 1 ? 'ok' : 'scan-failed',
        provider: 'semgrep',
        targetPath,
        config,
        findings: normalizeFindings(parsed.results ?? []),
        findingCount: (parsed.results ?? []).length,
        exitCode: result.status ?? 1,
        stderr: result.stderr ?? '',
      };
    },
  };
}
