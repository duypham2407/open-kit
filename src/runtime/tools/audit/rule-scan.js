import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getToolingEnv, isSemgrepAvailable } from '../../../global/tooling.js';
import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';
import {
  createInvalidPathResult,
  createHighVolumeScanFailureResult,
  createNotConfiguredResult,
  createScanResult,
  createSemgrepUnavailableResult,
  normalizeSemgrepFindings,
  resolveRuleConfigSource,
} from './scan-evidence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.resolve(__dirname, '../../../../assets/semgrep/packs');
const DEFAULT_SEMGREP_MAX_BUFFER = 64 * 1024 * 1024;

const BUNDLED_PACK_ALIASES = {
  auto: path.join(PACKS_DIR, 'quality-default.yml'),
  'p/security-audit': path.join(PACKS_DIR, 'security-audit.yml'),
};

export function resolveSemgrepConfig(config) {
  return BUNDLED_PACK_ALIASES[config] ?? config;
}

export function createRuleScanTool({ projectRoot, toolId = 'tool.rule-scan', scanKind = 'rule', defaultConfig = 'auto' }) {
  return {
    id: toolId,
    name: 'Rule Scan Tool',
    description: 'Runs Semgrep rule scans against the current project or a target path.',
    family: 'audit',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const toolingEnv = getToolingEnv(process.env);
      const requestedPath = typeof input === 'string' ? input : input.path ?? projectRoot;
      const targetPath = requestedPath === projectRoot ? projectRoot : resolveProjectPath(projectRoot, requestedPath);
      const rawConfig = typeof input === 'object' && input !== null ? input.config ?? defaultConfig : defaultConfig;
      const config = resolveSemgrepConfig(rawConfig);
      const ruleConfigSource = resolveRuleConfigSource(rawConfig, config, BUNDLED_PACK_ALIASES);
      const maxBuffer = resolveMaxBuffer(process.env.OPENKIT_SEMGREP_MAX_BUFFER, DEFAULT_SEMGREP_MAX_BUFFER);

      if (!rawConfig) {
        return createNotConfiguredResult({
          toolId,
          scanKind,
          projectRoot,
          requestedPath,
          targetPath,
          rawConfig,
          resolvedConfig: config,
          ruleConfigSource,
        });
      }

      if (!targetPath || !isInsideProjectRoot(projectRoot, targetPath)) {
        return createInvalidPathResult({
          toolId,
          scanKind,
          projectRoot,
          requestedPath,
          rawConfig,
          resolvedConfig: config,
          ruleConfigSource,
        });
      }

      if (!isSemgrepAvailable({ env: toolingEnv })) {
        return createSemgrepUnavailableResult({
          toolId,
          scanKind,
          projectRoot,
          requestedPath,
          targetPath,
          rawConfig,
          resolvedConfig: config,
          ruleConfigSource,
        });
      }

      const result = spawnSync('semgrep', ['scan', '--json', '--config', config, targetPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: toolingEnv,
        maxBuffer,
      });

      if (result.error) {
        if (isHighVolumeOutputError(result.error)) {
          const artifact = writeHighVolumeScanArtifact({
            projectRoot,
            toolId,
            stdout: result.stdout ?? '',
            stderr: result.stderr ?? '',
            exitCode: result.status ?? null,
            reason: result.error.message ?? 'output buffer overflow',
          });
          return createHighVolumeScanFailureResult({
            toolId,
            scanKind,
            projectRoot,
            requestedPath,
            targetPath,
            rawConfig,
            resolvedConfig: config,
            ruleConfigSource,
            reason: `Semgrep output exceeded OpenKit's ${maxBuffer} byte inline buffer: ${result.error.message ?? 'output buffer overflow'}`,
            stdout: result.stdout ?? '',
            stderr: result.stderr ?? '',
            exitCode: result.status ?? null,
            artifactRefs: artifact.relativePath ? [artifact.relativePath] : [],
          });
        }

        return createSemgrepUnavailableResult({
          toolId,
          scanKind,
          projectRoot,
          requestedPath,
          targetPath,
          rawConfig,
          resolvedConfig: config,
          ruleConfigSource,
          reason: `Semgrep was detected but could not execute: ${result.error.message ?? 'unknown execution error'}`,
        });
      }

      let parsed = { results: [] };
      try {
        parsed = result.stdout ? JSON.parse(result.stdout) : { results: [] };
      } catch (error) {
        return createScanResult({
          toolId,
          scanKind,
          projectRoot,
          requestedPath,
          targetPath,
          rawConfig,
          resolvedConfig: config,
          ruleConfigSource,
          status: 'scan_failed',
          capabilityState: 'available',
          resultState: 'failed',
          availability: {
            state: 'available',
            reason: 'Semgrep returned output that could not be parsed as JSON.',
            fallback: 'Inspect raw stderr/stdout, then retry the direct scan or record substitute/manual evidence with limitations.',
          },
          exitCode: result.status ?? 1,
          stderr: result.stderr ?? '',
          message: `Failed to parse semgrep output: ${error.message}`,
        });
      }

      const status = result.status === 0 || result.status === 1 ? 'ok' : 'scan_failed';
      return createScanResult({
        toolId,
        scanKind,
        projectRoot,
        requestedPath,
        targetPath,
        rawConfig,
        resolvedConfig: config,
        ruleConfigSource,
        status,
        capabilityState: 'available',
        resultState: status === 'ok' ? 'succeeded' : 'failed',
        availability: {
          state: 'available',
          reason: status === 'ok' ? null : 'Semgrep returned a non-success exit code without usable success semantics.',
          fallback: status === 'ok' ? null : 'Inspect stderr and rerun or record substitute/manual evidence with limitations.',
        },
        findings: normalizeSemgrepFindings(parsed.results ?? []),
        exitCode: result.status ?? 1,
        stderr: result.stderr ?? '',
      });
    },
  };
}

function isHighVolumeOutputError(error) {
  const code = error?.code;
  const message = String(error?.message ?? '');
  return code === 'ENOBUFS' || /maxBuffer|buffer/i.test(message);
}

function resolveMaxBuffer(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function writeHighVolumeScanArtifact({ projectRoot, toolId, stdout, stderr, exitCode, reason }) {
  const safeToolId = String(toolId ?? 'rule-scan').replace(/[^a-z0-9_.-]+/gi, '-');
  const artifactDir = path.join(projectRoot, '.openkit', 'artifacts', 'scan-output');
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeToolId}-high-volume.json`;
  const artifactPath = path.join(artifactDir, filename);
  const relativePath = path.relative(projectRoot, artifactPath).split(path.sep).join('/');

  try {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify({
      toolId,
      reason,
      exitCode,
      stdout,
      stderr,
      outputSummary: {
        stdoutBytes: Buffer.byteLength(String(stdout ?? ''), 'utf8'),
        stderrBytes: Buffer.byteLength(String(stderr ?? ''), 'utf8'),
        highVolume: true,
      },
    }, null, 2)}\n`, 'utf8');
    return { relativePath };
  } catch {
    return { relativePath: null };
  }
}
