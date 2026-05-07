import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORBIDDEN_PACKAGE_PATH_PATTERNS,
  PACKAGE_READINESS_COMMAND,
  REQUIRED_PACKAGE_FILES,
  REQUIRED_PACKAGE_PREFIXES,
  scanPackageTextForSecrets,
  validatePackageFileList,
} from '../../scripts/verify-mcp-secret-package-readiness.mjs';

test('MCP secret package readiness contract uses npm pack dry-run and names release-critical files', () => {
  assert.equal(PACKAGE_READINESS_COMMAND, 'npm pack --dry-run --json');

  for (const requiredPath of [
    'bin/openkit.js',
    'bin/openkit-mcp.js',
    'src/global/mcp/secret-manager.js',
    'src/global/mcp/secret-stores/keychain-adapter.js',
    'src/global/mcp/redaction.js',
    'src/global/mcp/mcp-config-service.js',
    'src/global/launcher.js',
    'src/cli/commands/configure.js',
    'src/runtime/managers/mcp-health-manager.js',
    'docs/operator/mcp-configuration.md',
    'docs/operator/supported-surfaces.md',
    'docs/operations/runbooks/mcp-secret-package-readiness.md',
    'assets/install-bundle/opencode/README.md',
    'registry.json',
    'scripts/verify-mcp-secret-package-readiness.mjs',
    '.opencode/install-manifest.json',
    '.opencode/opencode.json',
    '.opencode/workflow-state.js',
  ]) {
    assert.ok(REQUIRED_PACKAGE_FILES.includes(requiredPath), `${requiredPath} should be required package evidence`);
  }

  assert.ok(REQUIRED_PACKAGE_PREFIXES.includes('assets/install-bundle/opencode/commands/'));
  assert.ok(REQUIRED_PACKAGE_PREFIXES.includes('assets/install-bundle/opencode/agents/'));
  assert.ok(FORBIDDEN_PACKAGE_PATH_PATTERNS.some((pattern) => pattern.id === 'active-workflow-state'));
});

test('MCP secret package readiness validation rejects missing files and runtime/secret artifacts', () => {
  const packageFiles = REQUIRED_PACKAGE_FILES
    .filter((filePath) => filePath !== 'src/global/mcp/secret-stores/keychain-adapter.js')
    .concat([
      'assets/install-bundle/opencode/commands/task.md',
      'assets/install-bundle/opencode/agents/FullstackAgent.md',
      '.opencode/workflow-state.json',
      'tmp/openkit/secrets.env',
      'duypham93-openkit-0.3.29.tgz',
    ]);

  const result = validatePackageFileList(packageFiles);

  assert.deepEqual(result.missingRequiredFiles, ['src/global/mcp/secret-stores/keychain-adapter.js']);
  assert.deepEqual(result.missingRequiredPrefixes, []);
  assert.deepEqual(
    result.forbiddenFiles.map((finding) => finding.ruleId),
    ['active-workflow-state', 'generated-package-archive', 'secret-env-file'],
  );
  assert.equal(result.status, 'fail');
});

test('MCP secret package readiness secret scan reports redacted path/rule findings only', () => {
  const rawSecret = 'sk-live-openkit-package-readiness-sentinel';
  const findings = scanPackageTextForSecrets({
    filePath: 'docs/operator/example.md',
    contents: `CONTEXT7_API_KEY=<CONTEXT7_API_KEY_VALUE>\nOPENKIT_TOKEN=${rawSecret}\nAuthorization=Bearer ${rawSecret}\n`,
    sentinelValues: [rawSecret],
  });

  assert.deepEqual(
    findings.map((finding) => ({ path: finding.path, ruleId: finding.ruleId })),
    [
      { path: 'docs/operator/example.md', ruleId: 'synthetic-sentinel' },
      { path: 'docs/operator/example.md', ruleId: 'raw-sk-token' },
      { path: 'docs/operator/example.md', ruleId: 'raw-env-assignment' },
      { path: 'docs/operator/example.md', ruleId: 'raw-authorization-header' },
    ],
  );
  assert.equal(JSON.stringify(findings).includes(rawSecret), false);
});
