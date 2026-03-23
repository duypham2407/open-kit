import fs from 'node:fs';
import path from 'node:path';

const GLOBAL_INSTALL_SCHEMA = 'openkit/global-install-state@1';

export function createGlobalInstallState({ kitVersion = '0.1.0', installedAt = new Date().toISOString(), profile = 'openkit' } = {}) {
  return {
    schema: GLOBAL_INSTALL_SCHEMA,
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: kitVersion,
    },
    installation: {
      profile,
      status: 'installed',
      installedAt,
    },
  };
}

export function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function validateGlobalInstallState(state) {
  const errors = [];

  if (!state || typeof state !== 'object') {
    return ['global install state must be an object'];
  }

  if (state.schema !== GLOBAL_INSTALL_SCHEMA) {
    errors.push(`schema must be '${GLOBAL_INSTALL_SCHEMA}'`);
  }

  if (state.stateVersion !== 1) {
    errors.push('stateVersion must be 1');
  }

  if (!state.kit?.name || typeof state.kit.name !== 'string') {
    errors.push('kit.name must be a non-empty string');
  }

  if (!state.kit?.version || typeof state.kit.version !== 'string') {
    errors.push('kit.version must be a non-empty string');
  }

  if (!state.installation?.profile || typeof state.installation.profile !== 'string') {
    errors.push('installation.profile must be a non-empty string');
  }

  if (state.installation?.status !== 'installed') {
    errors.push("installation.status must be 'installed'");
  }

  if (!state.installation?.installedAt || typeof state.installation.installedAt !== 'string') {
    errors.push('installation.installedAt must be an ISO timestamp string');
  }

  return errors;
}

export { GLOBAL_INSTALL_SCHEMA };
