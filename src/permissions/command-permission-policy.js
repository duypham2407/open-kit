import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getOpenKitOnlyOpenCodeConfigKeys } from '../opencode/config-schema.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');

export const COMMAND_PERMISSION_POLICY_SCHEMA = 'openkit/command-permission-policy@1';
export const DEFAULT_POLICY_RELATIVE_PATH = 'assets/default-command-permission-policy.json';
const VALID_ACTIONS = new Set(['allow', 'ask']);
const VALID_DEFAULT_SUPPORT = new Set(['supported', 'unverified', 'unsupported', 'verify-at-runtime']);
const REQUIRED_MINIMUM_KEYS = [
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
  'truncate',
  'db reset',
  'db wipe',
  'sudo',
  'chmod',
  'chown',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  return structuredClone(value);
}

function getPolicyList(policy, fieldName) {
  const value = policy?.[fieldName];
  return Array.isArray(value) ? value : [];
}

function getDefaultPolicyPath(packageRoot = PACKAGE_ROOT) {
  return path.join(packageRoot, DEFAULT_POLICY_RELATIVE_PATH);
}

function addEntryToPermission(permission, entry, collectionName, errors) {
  if (!isPlainObject(entry)) {
    errors.push(`${collectionName} entries must be objects`);
    return;
  }

  if (!entry.id || typeof entry.id !== 'string') {
    errors.push(`${collectionName} entry is missing id`);
  }

  if (!entry.permissionKey || typeof entry.permissionKey !== 'string') {
    errors.push(`${collectionName} entry '${entry.id ?? '<unknown>'}' is missing permissionKey`);
  }

  if (!VALID_ACTIONS.has(entry.action)) {
    errors.push(`${collectionName} entry '${entry.id ?? '<unknown>'}' action must be allow or ask`);
  }

  if (entry.permissionKey && VALID_ACTIONS.has(entry.action)) {
    permission[entry.permissionKey] = entry.action;
  }
}

function expectedPermissionFromPolicy(policy, errors = []) {
  const permission = {};

  for (const entry of getPolicyList(policy, 'routineAllowExamples')) {
    addEntryToPermission(permission, entry, 'routineAllowExamples', errors);
  }

  for (const entry of getPolicyList(policy, 'confirmRequired')) {
    addEntryToPermission(permission, entry, 'confirmRequired', errors);
    if (entry?.action && entry.action !== 'ask') {
      errors.push(`confirmRequired entry '${entry.id ?? '<unknown>'}' must use action ask`);
    }
  }

  return permission;
}

function collectSupportCaveats(policy) {
  const caveats = [];
  const defaultActionSupport = policy?.opencodeProjection?.defaultActionSupport;
  const routineAllowExamples = getPolicyList(policy, 'routineAllowExamples');
  const unsupportedGranularity = getPolicyList(policy, 'unsupportedGranularity');

  if (defaultActionSupport !== 'supported') {
    caveats.push(
      'OpenCode defaultAction allow plus confirm-required exception semantics are not verified; OpenKit projects an explicit permission map and reports degraded support.',
    );
  }

  if (routineAllowExamples.some((entry) => entry.permissionKey === 'bash')) {
    caveats.push(
      'Broad bash allow depends on OpenCode exception matching for dangerous subcommands; shell-wrapped destructive forms remain a visible limitation.',
    );
  }

  for (const entry of unsupportedGranularity) {
    if (entry?.summary) {
      caveats.push(entry.summary);
    }
  }

  return [...new Set(caveats)];
}

function determineProjectionSupport(policy, validation) {
  if (validation.errors.length > 0) {
    return 'unsupported';
  }

  if (policy?.opencodeProjection?.defaultActionSupport === 'supported' && getPolicyList(policy, 'unsupportedGranularity').length === 0) {
    return 'supported';
  }

  return 'degraded';
}

function comparePermissionEntries({ configPermission = {}, expectedEntries = [], expectedAction }) {
  const missing = [];
  const mismatched = [];

  for (const entry of expectedEntries) {
    if (!entry?.permissionKey || entry.action !== expectedAction) {
      continue;
    }

    if (!Object.hasOwn(configPermission, entry.permissionKey)) {
      missing.push(entry.permissionKey);
      continue;
    }

    if (configPermission[entry.permissionKey] !== expectedAction) {
      mismatched.push({
        permissionKey: entry.permissionKey,
        expected: expectedAction,
        actual: configPermission[entry.permissionKey],
      });
    }
  }

  return { missing, mismatched };
}

export function loadDefaultCommandPermissionPolicy({ packageRoot = PACKAGE_ROOT, policyPath } = {}) {
  const resolvedPolicyPath = policyPath ?? getDefaultPolicyPath(packageRoot);

  try {
    return JSON.parse(fs.readFileSync(resolvedPolicyPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Default command permission policy is missing: ${resolvedPolicyPath}`);
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse default command permission policy at ${resolvedPolicyPath}: ${error.message}`);
    }

    throw error;
  }
}

export function tryLoadDefaultCommandPermissionPolicy(options = {}) {
  try {
    return {
      status: 'loaded',
      policy: loadDefaultCommandPermissionPolicy(options),
      error: null,
      policyPath: options.policyPath ?? getDefaultPolicyPath(options.packageRoot ?? PACKAGE_ROOT),
    };
  } catch (error) {
    return {
      status: error.message?.includes('missing') ? 'missing' : 'malformed',
      policy: null,
      error: error.message,
      policyPath: options.policyPath ?? getDefaultPolicyPath(options.packageRoot ?? PACKAGE_ROOT),
    };
  }
}

export function validateCommandPermissionPolicy(policy) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(policy)) {
    return {
      status: 'malformed',
      errors: ['policy must be an object'],
      warnings,
    };
  }

  const routineAllowExamples = getPolicyList(policy, 'routineAllowExamples');
  const confirmRequired = getPolicyList(policy, 'confirmRequired');
  const unsupportedGranularity = getPolicyList(policy, 'unsupportedGranularity');

  if (policy.schema !== COMMAND_PERMISSION_POLICY_SCHEMA) {
    errors.push(`schema must be '${COMMAND_PERMISSION_POLICY_SCHEMA}'`);
  }

  if (policy.version !== 1) {
    errors.push('version must be 1');
  }

  if (policy.intent !== 'default-allow-with-confirm-required-exceptions') {
    errors.push("intent must be 'default-allow-with-confirm-required-exceptions'");
  }

  if (policy.defaults?.desiredAction !== 'allow') {
    errors.push("defaults.desiredAction must be 'allow'");
  }

  if (policy.opencodeProjection?.targetKey !== 'permission') {
    errors.push("opencodeProjection.targetKey must be 'permission'");
  }

  if (!VALID_DEFAULT_SUPPORT.has(policy.opencodeProjection?.defaultActionSupport)) {
    errors.push('opencodeProjection.defaultActionSupport must be supported, unverified, unsupported, or verify-at-runtime');
  }

  if (!Array.isArray(policy.routineAllowExamples) || routineAllowExamples.length === 0) {
    errors.push('routineAllowExamples must be a non-empty array');
  }

  if (!Array.isArray(policy.confirmRequired) || confirmRequired.length === 0) {
    errors.push('confirmRequired must be a non-empty array');
  }

  if (!Array.isArray(policy.unsupportedGranularity)) {
    errors.push('unsupportedGranularity must be an array');
  }

  const permission = expectedPermissionFromPolicy(policy, errors);
  const missingRequiredKeys = REQUIRED_MINIMUM_KEYS.filter((key) => permission[key] !== 'ask');
  if (missingRequiredKeys.length > 0) {
    errors.push(`confirmRequired is missing minimum dangerous permission keys: ${missingRequiredKeys.join(', ')}`);
  }

  const unsupportedCategories = new Set(unsupportedGranularity.map((entry) => entry?.category).filter(Boolean));
  for (const requiredCategory of ['shell-wrapped-delete', 'argument-sensitive-git-discard', 'database-destructive-scripts']) {
    if (!unsupportedCategories.has(requiredCategory)) {
      warnings.push(`unsupported granularity category is not listed: ${requiredCategory}`);
    }
  }

  if (policy.opencodeProjection?.defaultActionSupport !== 'supported') {
    warnings.push('OpenCode defaultAction support is unverified; effective default-allow behavior must be reported as degraded.');
  }

  return {
    status: errors.length === 0 ? 'valid' : 'malformed',
    errors,
    warnings,
  };
}

export function buildOpenCodePermissionConfig(policy, { opencodeCapabilities = {} } = {}) {
  const validation = validateCommandPermissionPolicy(policy);
  const errors = [...validation.errors];
  const permission = expectedPermissionFromPolicy(policy, errors);
  const support = determineProjectionSupport(policy, { ...validation, errors });
  const defaultActionSupported = opencodeCapabilities.defaultAction === true || policy?.opencodeProjection?.defaultActionSupport === 'supported';
  const caveats = collectSupportCaveats(policy);
  const unsupportedGranularity = getPolicyList(policy, 'unsupportedGranularity');

  return {
    permission,
    support: defaultActionSupported && unsupportedGranularity.length === 0 && errors.length === 0 ? 'supported' : support,
    desiredDefaultAction: policy?.defaults?.desiredAction ?? null,
    effectiveProjection: defaultActionSupported
      ? 'opencode-default-action-with-exceptions'
      : (policy?.opencodeProjection?.fallbackWhenUnsupported ?? 'explicit-permission-map-with-visible-degraded-status'),
    unsupportedGranularity: cloneValue(unsupportedGranularity),
    caveats,
    validation,
  };
}

export function createCommandPermissionPolicyMetadata(policy, projection = buildOpenCodePermissionConfig(policy)) {
  return {
    schema: COMMAND_PERMISSION_POLICY_SCHEMA,
    version: policy.version,
    intent: policy.intent,
    desiredDefaultAction: policy.defaults?.desiredAction ?? null,
    projectionSupport: projection.support,
    effectiveProjection: projection.effectiveProjection,
    defaultActionSupport: policy.opencodeProjection?.defaultActionSupport ?? 'unverified',
    unsupportedGranularityCount: projection.unsupportedGranularity.length,
  };
}

export function buildOpenCodeCommandPermissionSection(policy = loadDefaultCommandPermissionPolicy(), options = {}) {
  return buildOpenCodePermissionConfig(policy, options).permission;
}

export function inspectCommandPermissionPolicy({
  policy,
  config,
  configPath = null,
  scope = 'unknown',
  surface = 'global_cli',
} = {}) {
  if (!policy) {
    return {
      status: 'missing',
      support: 'unsupported',
      surface,
      scope,
      configPath,
      desiredDefaultAction: null,
      effectiveProjection: null,
      missingConfirmRequired: [],
      mismatchedConfirmRequired: [],
      missingRoutineAllows: [],
      mismatchedRoutineAllows: [],
      unsupportedGranularity: [],
      issues: ['Command permission policy source is missing.'],
      caveats: [],
      nextActions: ['Refresh the package or run openkit upgrade to restore the policy source.'],
    };
  }

  const validation = validateCommandPermissionPolicy(policy);
  if (validation.errors.length > 0) {
    return {
      status: 'malformed',
      support: 'unsupported',
      surface,
      scope,
      configPath,
      desiredDefaultAction: policy?.defaults?.desiredAction ?? null,
      effectiveProjection: null,
      missingConfirmRequired: [],
      mismatchedConfirmRequired: [],
      missingRoutineAllows: [],
      mismatchedRoutineAllows: [],
      unsupportedGranularity: cloneValue(getPolicyList(policy, 'unsupportedGranularity')),
      issues: validation.errors.map((error) => `Command permission policy schema error: ${error}`),
      caveats: validation.warnings,
      nextActions: ['Refresh the package or run openkit upgrade after fixing the policy source.'],
    };
  }

  if (!isPlainObject(config)) {
    return {
      status: 'missing',
      support: 'unsupported',
      surface,
      scope,
      configPath,
      desiredDefaultAction: policy.defaults.desiredAction,
      effectiveProjection: null,
      missingConfirmRequired: [],
      mismatchedConfirmRequired: [],
      missingRoutineAllows: [],
      mismatchedRoutineAllows: [],
      unsupportedGranularity: cloneValue(getPolicyList(policy, 'unsupportedGranularity')),
      issues: ['Materialized OpenCode config is missing or unreadable.'],
      caveats: validation.warnings,
      nextActions: ['Run openkit upgrade to rematerialize the managed OpenKit profile/config.'],
    };
  }

  const projection = buildOpenCodePermissionConfig(policy);
  const configPermission = isPlainObject(config.permission) ? config.permission : {};
  const confirm = comparePermissionEntries({
    configPermission,
    expectedEntries: getPolicyList(policy, 'confirmRequired'),
    expectedAction: 'ask',
  });
  const routine = comparePermissionEntries({
    configPermission,
    expectedEntries: getPolicyList(policy, 'routineAllowExamples'),
    expectedAction: 'allow',
  });
  const issues = [];
  const nextActions = [];
  const legacyOpenKitMetadataKeys = getOpenKitOnlyOpenCodeConfigKeys(config);

  if (!isPlainObject(config.permission)) {
    issues.push('Materialized OpenCode config is missing the permission map.');
  }

  if (legacyOpenKitMetadataKeys.length > 0) {
    issues.push(
      `Materialized OpenCode config contains OpenKit-only metadata keys that strict OpenCode rejects: ${legacyOpenKitMetadataKeys.join(', ')}.`,
    );
  }

  if (confirm.missing.length > 0) {
    issues.push(`Materialized config is missing confirm-required dangerous entries: ${confirm.missing.join(', ')}.`);
  }

  if (confirm.mismatched.length > 0) {
    issues.push(`Materialized config has dangerous entries that are not ask: ${confirm.mismatched.map((entry) => `${entry.permissionKey}=${entry.actual}`).join(', ')}.`);
  }

  if (routine.missing.length > 0) {
    issues.push(`Materialized config is missing routine allow entries: ${routine.missing.join(', ')}.`);
  }

  if (routine.mismatched.length > 0) {
    issues.push(`Materialized config has routine entries that are not allow: ${routine.mismatched.map((entry) => `${entry.permissionKey}=${entry.actual}`).join(', ')}.`);
  }

  if (issues.length > 0) {
    nextActions.push('Run openkit upgrade to rematerialize the managed OpenKit profile/config, then rerun openkit doctor.');
  }

  if (projection.support !== 'supported') {
    nextActions.push('Treat prompt-free routine command behavior as degraded until OpenCode defaultAction exception support is verified upstream.');
  }

  return {
    status: issues.length > 0 ? 'drifted' : projection.support === 'supported' ? 'healthy' : projection.support,
    support: projection.support,
    surface,
    scope,
    configPath,
    desiredDefaultAction: projection.desiredDefaultAction,
    effectiveProjection: projection.effectiveProjection,
    missingConfirmRequired: confirm.missing,
    mismatchedConfirmRequired: confirm.mismatched,
    missingRoutineAllows: routine.missing,
    mismatchedRoutineAllows: routine.mismatched,
    unsupportedGranularity: projection.unsupportedGranularity,
    legacyOpenKitMetadataKeys,
    metadataMatches: legacyOpenKitMetadataKeys.length === 0,
    issues,
    caveats: projection.caveats,
    nextActions,
  };
}

export function createPermissionedOpenCodeConfigMetadata(policy = loadDefaultCommandPermissionPolicy()) {
  return createPermissionedOpenCodeConfigProjection(policy);
}

export function createPermissionedOpenCodeConfigProjection(policy = loadDefaultCommandPermissionPolicy()) {
  const projection = buildOpenCodePermissionConfig(policy);
  return {
    permission: projection.permission,
  };
}
