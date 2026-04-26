import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getGlobalPaths } from '../paths.js';
import { redactedKeyState } from './redaction.js';

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function validateEnvVarName(envVar) {
  if (!ENV_NAME_PATTERN.test(envVar)) {
    throw new Error(`Invalid secret env var '${envVar}'.`);
  }
  return envVar;
}

function ensureSecureParent(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
    const mode = fs.statSync(directory).mode & 0o777;
    if (mode !== 0o700) {
      throw new Error(`Secret directory permissions are unsafe: expected 0700, got ${mode.toString(8)}.`);
    }
  }
}

function ensureSecureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o600);
    const mode = fs.statSync(filePath).mode & 0o777;
    if (mode !== 0o600) {
      throw new Error(`Secret file permissions are unsafe: expected 0600, got ${mode.toString(8)}.`);
    }
  }
}

function parseSecretContent(content) {
  const entries = [];
  const values = {};
  const duplicates = new Set();
  const seen = new Set();
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];

  for (const line of lines) {
    if (line === '') {
      entries.push({ type: 'blank', raw: line });
      continue;
    }
    if (line.trimStart().startsWith('#')) {
      entries.push({ type: 'comment', raw: line });
      continue;
    }

    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) {
      throw new Error('Secret file is malformed; refusing to rewrite secrets.env.');
    }

    const [, key, value] = match;
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
    values[key] = value;
    entries.push({ type: 'var', key, value });
  }

  return { entries, values, duplicates: [...duplicates] };
}

function readParsedSecretFile(secretPath) {
  if (!fs.existsSync(secretPath)) {
    return { entries: [], values: {}, duplicates: [] };
  }
  return parseSecretContent(fs.readFileSync(secretPath, 'utf8'));
}

function serializeEntries(entries) {
  const lines = entries.map((entry) => {
    if (entry.type === 'var') {
      return `${entry.key}=${entry.value}`;
    }
    return entry.raw;
  });
  return `${lines.join('\n').replace(/\n+$/u, '')}${lines.length > 0 ? '\n' : ''}`;
}

function atomicWriteSecretFile(secretPath, content) {
  const tempPath = path.join(path.dirname(secretPath), `.secrets.env.${process.pid}.${Date.now()}.tmp`);
  const handle = fs.openSync(tempPath, 'w', 0o600);
  try {
    fs.writeFileSync(handle, content, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(tempPath, 0o600);
  }
  fs.renameSync(tempPath, secretPath);
  ensureSecureFile(secretPath);
}

function mutateSecretFile(envVar, mutator, options = {}) {
  validateEnvVarName(envVar);
  const paths = getGlobalPaths(options);
  ensureSecureParent(paths.settingsRoot);
  ensureSecureFile(paths.secretsEnvPath);
  const parsed = readParsedSecretFile(paths.secretsEnvPath);
  const nextEntries = mutator(parsed);
  atomicWriteSecretFile(paths.secretsEnvPath, serializeEntries(nextEntries));
  return { paths, parsed };
}

export function setSecretValue(envVar, value, options = {}) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Secret value for '${envVar}' must be a non-empty string.`);
  }

  const { paths } = mutateSecretFile(envVar, (parsed) => {
    const nextEntries = [];
    let written = false;
    for (const entry of parsed.entries) {
      if (entry.type === 'var' && entry.key === envVar) {
        if (!written) {
          nextEntries.push({ type: 'var', key: envVar, value });
          written = true;
        }
        continue;
      }
      nextEntries.push(entry);
    }
    if (!written) {
      nextEntries.push({ type: 'var', key: envVar, value });
    }
    return nextEntries;
  }, options);

  return {
    status: 'stored',
    envVar,
    keyState: 'present_redacted',
    secretPath: paths.secretsEnvPath,
  };
}

export function unsetSecretValue(envVar, options = {}) {
  let removed = false;
  const { paths } = mutateSecretFile(envVar, (parsed) => {
    return parsed.entries.filter((entry) => {
      if (entry.type === 'var' && entry.key === envVar) {
        removed = true;
        return false;
      }
      return true;
    });
  }, options);

  return {
    status: removed ? 'removed' : 'already_missing',
    envVar,
    keyState: 'missing',
    secretPath: paths.secretsEnvPath,
  };
}

export function loadSecretsEnv(options = {}) {
  const paths = getGlobalPaths(options);
  if (!fs.existsSync(paths.secretsEnvPath)) {
    return { status: 'missing', values: {}, redacted: {}, secretPath: paths.secretsEnvPath };
  }
  ensureSecureParent(paths.settingsRoot);
  ensureSecureFile(paths.secretsEnvPath);
  const parsed = readParsedSecretFile(paths.secretsEnvPath);
  return {
    status: 'loaded',
    values: parsed.values,
    redacted: Object.fromEntries(Object.keys(parsed.values).map((key) => [key, redactedKeyState(true)])),
    duplicates: parsed.duplicates,
    secretPath: paths.secretsEnvPath,
  };
}

export function inspectSecretFile(options = {}) {
  const paths = getGlobalPaths(options);
  if (!fs.existsSync(paths.secretsEnvPath)) {
    return {
      status: 'missing',
      secretPath: paths.secretsEnvPath,
      platform: os.platform(),
      guidance: 'Run openkit configure mcp set-key <mcp-id> --stdin to create secrets.env.',
    };
  }

  try {
    ensureSecureParent(paths.settingsRoot);
    ensureSecureFile(paths.secretsEnvPath);
    const parsed = readParsedSecretFile(paths.secretsEnvPath);
    return {
      status: 'ok',
      secretPath: paths.secretsEnvPath,
      platform: os.platform(),
      envVars: Object.fromEntries(Object.keys(parsed.values).map((key) => [key, 'present_redacted'])),
      duplicateEnvVars: parsed.duplicates,
    };
  } catch (error) {
    return {
      status: 'unsafe',
      secretPath: paths.secretsEnvPath,
      platform: os.platform(),
      issue: error.message,
      guidance: 'Repair secrets.env permissions or malformed content before storing keys.',
    };
  }
}
