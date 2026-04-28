import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildOpenCodePermissionConfig,
  createCommandPermissionPolicyMetadata,
  inspectCommandPermissionPolicy,
  loadDefaultCommandPermissionPolicy,
  validateCommandPermissionPolicy,
} from '../../src/permissions/command-permission-policy.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-command-permission-policy-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('default command permission policy is schema-identifiable and valid', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const validation = validateCommandPermissionPolicy(policy);

  assert.equal(policy.schema, 'openkit/command-permission-policy@1');
  assert.equal(policy.version, 1);
  assert.equal(policy.intent, 'default-allow-with-confirm-required-exceptions');
  assert.equal(policy.defaults.desiredAction, 'allow');
  assert.deepEqual(validation.errors, []);
  assert.ok(validation.warnings.length >= 1, 'unsupported/defaultAction caveats should stay visible');
});

test('policy includes required dangerous command categories as ask or explicit unsupported granularity', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const projection = buildOpenCodePermissionConfig(policy);

  for (const permissionKey of [
    'rm',
    'rmdir',
    'unlink',
    'git reset --hard',
    'git clean',
    'git restore',
    'git checkout',
    'git push --force',
    'git push --force-with-lease',
    'npm publish',
    'npm unpublish',
    'openkit release publish',
    'dropdb',
    'sudo',
    'chmod',
    'chown',
  ]) {
    assert.equal(projection.permission[permissionKey], 'ask', `${permissionKey} should be confirmation-required`);
  }

  const unsupportedCategories = new Set(projection.unsupportedGranularity.map((entry) => entry.category));
  assert.ok(unsupportedCategories.has('shell-wrapped-delete'), 'shell-wrapped delete limitations must be explicit');
  assert.ok(unsupportedCategories.has('argument-sensitive-git-discard'), 'argument-sensitive git limitations must be explicit');
  assert.ok(unsupportedCategories.has('database-destructive-scripts'), 'database script limitations must be explicit');
});

test('projection keeps default-allow intent visible without writing unverified OpenCode defaultAction', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const projection = buildOpenCodePermissionConfig(policy);

  assert.equal(projection.support, 'degraded');
  assert.equal(projection.desiredDefaultAction, 'allow');
  assert.equal(projection.effectiveProjection, 'explicit-permission-map-with-visible-degraded-status');
  assert.equal(Object.hasOwn(projection.permission, 'defaultAction'), false);
  assert.equal(projection.permission.read, 'allow');
  assert.equal(projection.permission.write, 'allow');
  assert.equal(projection.permission.bash, 'allow');
  assert.equal(projection.permission['git status'], 'allow');
  assert.equal(projection.permission['git log'], 'allow');
  assert.equal(projection.permission['git diff'], 'allow');
  assert.ok(projection.caveats.some((entry) => /defaultAction/i.test(entry)));
});

test('inspectCommandPermissionPolicy reports aligned config as degraded when upstream defaultAction support is unverified', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const projection = buildOpenCodePermissionConfig(policy);
  const result = inspectCommandPermissionPolicy({
    policy,
    config: {
      permission: projection.permission,
      commandPermissionPolicy: createCommandPermissionPolicyMetadata(policy, projection),
    },
    configPath: '/tmp/opencode.json',
    scope: 'test-profile',
  });

  assert.equal(result.status, 'degraded');
  assert.equal(result.support, 'degraded');
  assert.equal(result.configPath, '/tmp/opencode.json');
  assert.deepEqual(result.missingConfirmRequired, []);
  assert.deepEqual(result.mismatchedConfirmRequired, []);
  assert.deepEqual(result.missingRoutineAllows, []);
  assert.ok(result.caveats.some((entry) => /defaultAction/i.test(entry)));
});

test('inspectCommandPermissionPolicy reports drift for missing dangerous entries', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const projection = buildOpenCodePermissionConfig(policy);
  const permission = { ...projection.permission };
  delete permission.rm;
  permission['git reset --hard'] = 'allow';

  const result = inspectCommandPermissionPolicy({
    policy,
    config: { permission },
    configPath: '/tmp/opencode.json',
    scope: 'test-profile',
  });

  assert.equal(result.status, 'drifted');
  assert.deepEqual(result.missingConfirmRequired, ['rm']);
  assert.deepEqual(result.mismatchedConfirmRequired, [
    { permissionKey: 'git reset --hard', expected: 'ask', actual: 'allow' },
  ]);
  assert.ok(result.issues.some((entry) => /missing confirm-required/i.test(entry)));
  assert.ok(result.nextActions.some((entry) => /openkit upgrade/i.test(entry)));
});

test('schema-malformed list fields return structured errors without throwing', () => {
  const policy = {
    ...loadDefaultCommandPermissionPolicy(),
    routineAllowExamples: {},
    confirmRequired: {},
    unsupportedGranularity: {},
  };

  const validation = validateCommandPermissionPolicy(policy);
  const projection = buildOpenCodePermissionConfig(policy);
  const inspection = inspectCommandPermissionPolicy({
    policy,
    config: { permission: {} },
    configPath: '/tmp/opencode.json',
    scope: 'schema-malformed-test',
  });

  assert.equal(validation.status, 'malformed');
  assert.ok(validation.errors.includes('routineAllowExamples must be a non-empty array'));
  assert.ok(validation.errors.includes('confirmRequired must be a non-empty array'));
  assert.ok(validation.errors.includes('unsupportedGranularity must be an array'));
  assert.equal(projection.support, 'unsupported');
  assert.deepEqual(projection.unsupportedGranularity, []);
  assert.equal(inspection.status, 'malformed');
  assert.equal(inspection.support, 'unsupported');
  assert.ok(inspection.issues.some((entry) => /routineAllowExamples must be a non-empty array/.test(entry)));
});

test('loadDefaultCommandPermissionPolicy can load a packaged policy path and reports malformed JSON', () => {
  const tempRoot = makeTempDir();
  const policyPath = path.join(tempRoot, 'assets', 'default-command-permission-policy.json');
  const policy = loadDefaultCommandPermissionPolicy();
  writeJson(policyPath, policy);

  const packagedPolicy = loadDefaultCommandPermissionPolicy({ packageRoot: tempRoot });
  assert.equal(packagedPolicy.schema, 'openkit/command-permission-policy@1');

  fs.writeFileSync(policyPath, '{"schema": ', 'utf8');
  assert.throws(
    () => loadDefaultCommandPermissionPolicy({ packageRoot: tempRoot }),
    /Failed to parse default command permission policy/,
  );
});

test('repo-local compatibility configs mirror the policy projection', () => {
  const policy = loadDefaultCommandPermissionPolicy();
  const projection = buildOpenCodePermissionConfig(policy);
  const metadata = createCommandPermissionPolicyMetadata(policy, projection);
  const template = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets', 'opencode.json.template'), 'utf8'));
  const repoLocal = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.opencode', 'opencode.json'), 'utf8'));

  assert.deepEqual(template.permission, projection.permission);
  assert.deepEqual(template.commandPermissionPolicy, metadata);
  assert.deepEqual(repoLocal.permission, projection.permission);
  assert.deepEqual(repoLocal.commandPermissionPolicy, metadata);
});
