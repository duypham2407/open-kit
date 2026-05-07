import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_READINESS_COMMAND = 'npm pack --dry-run --json';

export const REQUIRED_PACKAGE_FILES = Object.freeze([
  'package.json',
  'bin/openkit.js',
  'bin/openkit-mcp.js',
  'src/global/mcp/secret-manager.js',
  'src/global/mcp/secret-stores/keychain-adapter.js',
  'src/global/mcp/redaction.js',
  'src/global/mcp/mcp-config-store.js',
  'src/global/mcp/mcp-config-service.js',
  'src/global/mcp/mcp-configurator.js',
  'src/global/mcp/interactive-wizard.js',
  'src/global/mcp/health-checks.js',
  'src/global/mcp/profile-materializer.js',
  'src/global/mcp/custom-mcp-store.js',
  'src/global/mcp/custom-mcp-validation.js',
  'src/global/launcher.js',
  'src/global/ensure-install.js',
  'src/global/materialize.js',
  'src/install/asset-manifest.js',
  'src/cli/commands/configure.js',
  'src/cli/commands/run.js',
  'src/cli/commands/doctor.js',
  'src/cli/commands/install.js',
  'src/cli/commands/install-global.js',
  'src/cli/commands/upgrade.js',
  'src/runtime/managers/mcp-health-manager.js',
  'src/runtime/tools/capability/mcp-doctor.js',
  'src/runtime/tools/capability/capability-inventory.js',
  'src/capabilities/mcp-catalog.js',
  'docs/operator/mcp-configuration.md',
  'docs/operator/supported-surfaces.md',
  'docs/operator/README.md',
  'docs/operations/runbooks/mcp-secret-package-readiness.md',
  'assets/install-bundle/opencode/README.md',
  'registry.json',
  'scripts/verify-mcp-secret-package-readiness.mjs',
  '.opencode/install-manifest.json',
  '.opencode/opencode.json',
  '.opencode/workflow-state.js',
]);

export const REQUIRED_PACKAGE_PREFIXES = Object.freeze([
  'assets/install-bundle/opencode/commands/',
  'assets/install-bundle/opencode/agents/',
]);

export const FORBIDDEN_PACKAGE_PATH_PATTERNS = Object.freeze([
  {
    id: 'active-workflow-state',
    description: 'active compatibility workflow-state mirror must not ship as package state',
    pattern: /^\.opencode\/workflow-state\.json$/u,
  },
  {
    id: 'managed-work-item-state',
    description: 'managed work-item runtime state must not ship',
    pattern: /^\.opencode\/work-items(?:\/|$)/u,
  },
  {
    id: 'secret-env-file',
    description: 'local MCP secret env files must not ship',
    pattern: /(^|\/)secrets\.env$/u,
  },
  {
    id: 'env-file',
    description: 'raw environment files must not ship',
    pattern: /(^|\/)(?:\.[^/]*|[^/]*)\.env$/u,
  },
  {
    id: 'generated-mcp-config',
    description: 'generated MCP config state must not ship',
    pattern: /(^|\/)(?:custom-mcp-config|mcp-config|mcp-profile-state)\.json$/u,
  },
  {
    id: 'runtime-project-graph-db',
    description: 'generated runtime graph databases must not ship',
    pattern: /(^|\/)project-graph\.db$/u,
  },
  {
    id: 'sqlite-runtime-db',
    description: 'generated SQLite runtime databases must not ship',
    pattern: /\.(?:sqlite|sqlite3)$/u,
  },
  {
    id: 'generated-package-archive',
    description: 'generated package tarballs must not ship',
    pattern: /(?:^|\/).*\.tgz$/u,
  },
  {
    id: 'extracted-package-directory',
    description: 'extracted npm package directories must not ship',
    pattern: /(?:^|\/)package\//u,
  },
  {
    id: 'temporary-opencode-home',
    description: 'temporary OpenCode homes must not ship',
    pattern: /(?:^|\/)(?:tmp|temp|\.tmp)\/(?:opencode|openkit)(?:\/|$)/u,
  },
]);

const SECRET_SCAN_RULES = Object.freeze([
  {
    id: 'raw-sk-token',
    pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/gu,
  },
  {
    id: 'raw-env-assignment',
    pattern: /\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*(?!['"]?(?:\$\{|<|\[REDACTED\]|redacted\b|missing\b|present\b|null\b|undefined\b|true\b|false\b|\*{3,}))[A-Za-z0-9_.:/+=@-]{12,}/giu,
  },
  {
    id: 'raw-authorization-header',
    pattern: /\bAuthorization\s*[:=]\s*(?!['"]?(?:\$\{|<|\[REDACTED\])|Bearer\s+(?:\$\{|<|\[REDACTED\]))(?:Bearer\s+)?[A-Za-z0-9._~+/=-]{12,}/giu,
  },
  {
    id: 'private-key-block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu,
  },
]);

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.md',
  '.mjs',
  '.sh',
  '.txt',
  '.yaml',
  '.yml',
]);

function normalizePackagePath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^package\//u, '').replace(/^\.\//u, '');
}

function uniqSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function validatePackageFileList(packageFiles, options = {}) {
  const requiredFiles = options.requiredFiles ?? REQUIRED_PACKAGE_FILES;
  const requiredPrefixes = options.requiredPrefixes ?? REQUIRED_PACKAGE_PREFIXES;
  const forbiddenPatterns = options.forbiddenPatterns ?? FORBIDDEN_PACKAGE_PATH_PATTERNS;
  const normalizedFiles = uniqSorted(packageFiles.map(normalizePackagePath));
  const packageFileSet = new Set(normalizedFiles);

  const missingRequiredFiles = requiredFiles.filter((filePath) => !packageFileSet.has(filePath));
  const missingRequiredPrefixes = requiredPrefixes.filter((prefix) => !normalizedFiles.some((filePath) => filePath.startsWith(prefix)));
  const forbiddenFiles = [];

  for (const filePath of normalizedFiles) {
    for (const forbiddenPattern of forbiddenPatterns) {
      if (forbiddenPattern.pattern.test(filePath)) {
        forbiddenFiles.push({
          path: filePath,
          ruleId: forbiddenPattern.id,
          description: forbiddenPattern.description,
        });
        break;
      }
    }
  }

  const failed = missingRequiredFiles.length > 0 || missingRequiredPrefixes.length > 0 || forbiddenFiles.length > 0;

  return {
    surface: 'package',
    status: failed ? 'fail' : 'pass',
    packageFiles: normalizedFiles,
    requiredFiles: { checked: requiredFiles.length, missing: missingRequiredFiles },
    requiredPrefixes: { checked: requiredPrefixes.length, missing: missingRequiredPrefixes },
    forbiddenFiles,
    missingRequiredFiles,
    missingRequiredPrefixes,
  };
}

function sentinelRules(sentinelValues = []) {
  return sentinelValues
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map((value) => ({ id: 'synthetic-sentinel', value }));
}

export function scanPackageTextForSecrets({ filePath, contents, sentinelValues = [] }) {
  const findings = [];

  for (const sentinelRule of sentinelRules(sentinelValues)) {
    if (contents.includes(sentinelRule.value)) {
      findings.push({ path: filePath, ruleId: sentinelRule.id });
    }
  }

  for (const rule of SECRET_SCAN_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(contents)) {
      findings.push({ path: filePath, ruleId: rule.id });
    }
  }

  return findings;
}

function parseNpmPackJson(stdout) {
  const parsed = JSON.parse(stdout);
  const packuments = Array.isArray(parsed) ? parsed : [parsed];
  const files = [];

  for (const packument of packuments) {
    if (!packument || !Array.isArray(packument.files)) {
      continue;
    }

    for (const fileEntry of packument.files) {
      if (fileEntry && typeof fileEntry.path === 'string') {
        files.push(fileEntry.path);
      }
    }
  }

  if (files.length === 0) {
    throw new Error('npm pack dry-run JSON did not include a file list');
  }

  return files;
}

function runNpmPackDryRun(projectRoot) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ? `\n${result.stderr.trim()}` : '';
    throw new Error(`npm pack dry-run failed with exit status ${result.status ?? 'unknown'}${stderr}`);
  }

  return parseNpmPackJson(result.stdout);
}

function isTextFile(filePath) {
  if (filePath === 'package.json' || filePath === 'README.md' || filePath === 'AGENTS.md' || filePath === 'registry.json') {
    return true;
  }

  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath));
}

function readTextFileIfSafe(projectRoot, packagePath) {
  if (!isTextFile(packagePath)) {
    return null;
  }

  const absolutePath = path.join(projectRoot, packagePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile() || stat.size > 1024 * 1024) {
    return null;
  }

  const buffer = fs.readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString('utf8');
}

function packageSentinelsFromEnvironment() {
  const rawValue = process.env.OPENKIT_PACKAGE_SECRET_SENTINELS ?? '';
  return rawValue.split(',').map((value) => value.trim()).filter(Boolean);
}

export function verifyPackageReadiness({ projectRoot = process.cwd(), sentinelValues = packageSentinelsFromEnvironment() } = {}) {
  const packageFiles = runNpmPackDryRun(projectRoot).map(normalizePackagePath);
  const fileListValidation = validatePackageFileList(packageFiles);
  const secretFindings = [];
  let checkedTextFiles = 0;

  for (const packagePath of fileListValidation.packageFiles) {
    const contents = readTextFileIfSafe(projectRoot, packagePath);
    if (contents === null) {
      continue;
    }

    checkedTextFiles += 1;
    secretFindings.push(...scanPackageTextForSecrets({ filePath: packagePath, contents, sentinelValues }));
  }

  const status = fileListValidation.status === 'pass' && secretFindings.length === 0 ? 'pass' : 'fail';

  return {
    surface: 'package',
    status,
    packageListCommand: PACKAGE_READINESS_COMMAND,
    requiredFiles: fileListValidation.requiredFiles,
    requiredPrefixes: fileListValidation.requiredPrefixes,
    forbiddenFiles: {
      checkedPatterns: FORBIDDEN_PACKAGE_PATH_PATTERNS.length,
      present: fileListValidation.forbiddenFiles.map(({ path: findingPath, ruleId }) => ({ path: findingPath, ruleId })),
    },
    secretScan: {
      checkedFiles: checkedTextFiles,
      findings: secretFindings,
    },
    packageFileCount: fileListValidation.packageFiles.length,
    temporaryArtifacts: 'none-persisted-dry-run-only',
    targetProjectAppValidation: 'unavailable',
  };
}

function formatResult(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = [
    `MCP secret package readiness: ${result.status}`,
    `surface: ${result.surface}`,
    `package-list command: ${result.packageListCommand}`,
    `package files checked: ${result.packageFileCount}`,
    `required files checked: ${result.requiredFiles.checked}; missing: ${result.requiredFiles.missing.length}`,
    `required prefixes checked: ${result.requiredPrefixes.checked}; missing: ${result.requiredPrefixes.missing.length}`,
    `forbidden patterns checked: ${result.forbiddenFiles.checkedPatterns}; present: ${result.forbiddenFiles.present.length}`,
    `secret text files checked: ${result.secretScan.checkedFiles}; findings: ${result.secretScan.findings.length}`,
    `temporary artifacts: ${result.temporaryArtifacts}`,
    `target_project_app validation: ${result.targetProjectAppValidation}`,
  ];

  if (result.requiredFiles.missing.length > 0) {
    lines.push(`missing required files: ${result.requiredFiles.missing.join(', ')}`);
  }

  if (result.requiredPrefixes.missing.length > 0) {
    lines.push(`missing required prefixes: ${result.requiredPrefixes.missing.join(', ')}`);
  }

  if (result.forbiddenFiles.present.length > 0) {
    lines.push(
      `forbidden files: ${result.forbiddenFiles.present.map((finding) => `${finding.path} (${finding.ruleId})`).join(', ')}`,
    );
  }

  if (result.secretScan.findings.length > 0) {
    lines.push(
      `secret findings: ${result.secretScan.findings.map((finding) => `${finding.path} (${finding.ruleId})`).join(', ')}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function parseCliArgs(argv) {
  return {
    json: argv.includes('--json'),
  };
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const result = verifyPackageReadiness();
  const output = formatResult(result, options);

  if (result.status === 'pass') {
    process.stdout.write(output);
    return;
  }

  process.stderr.write(output);
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main();
}
