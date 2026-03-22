import fs from 'node:fs';
import path from 'node:path';

import { validateInstallState } from '../install/install-state.js';
import { discoverProjectShape } from '../install/discovery.js';

const EXPECTED_MANAGED_ASSETS = {
  'runtime.opencode-manifest': {
    path: 'opencode.json',
    validate(contents) {
      return (
        contents?.installState?.path === '.openkit/openkit-install.json' &&
        contents?.installState?.schema === 'openkit/install-state@1' &&
        contents?.productSurface?.current === 'managed-opencode-wrapper' &&
        contents?.productSurface?.wrapperReadiness === 'managed' &&
        contents?.productSurface?.installationMode === 'openkit-managed'
      );
    },
  },
  'runtime.install-state': {
    path: '.openkit/openkit-install.json',
    validate(contents) {
      return contents?.installation?.profile === 'openkit-core';
    },
  },
};

const ROOT_WRAPPER_ASSET_ID = 'runtime.opencode-manifest';

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      malformed: false,
      value: null,
    };
  }

  try {
    return {
      exists: true,
      malformed: false,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
    };
  } catch {
    return {
      exists: true,
      malformed: true,
      value: null,
    };
  }
}

function defaultIsOpenCodeAvailable() {
  const pathValue = process.env.PATH ?? '';
  return pathValue.split(path.delimiter).some((segment) => {
    if (!segment) {
      return false;
    }

    const candidate = path.join(segment, 'opencode');
    return fs.existsSync(candidate);
  });
}

export function inspectManagedDoctor({
  projectRoot,
  env = process.env,
  isOpenCodeAvailable = defaultIsOpenCodeAvailable,
} = {}) {
  const resolvedProjectRoot = projectRoot ?? process.cwd();
  const wrapperManifestPath = path.join(resolvedProjectRoot, 'opencode.json');
  const runtimeManifestPath = path.join(resolvedProjectRoot, '.opencode', 'opencode.json');
  const installStatePath = path.join(resolvedProjectRoot, '.openkit', 'openkit-install.json');
  const wrapperManifestResult = readJsonIfPresent(wrapperManifestPath);
  const installStateResult = readJsonIfPresent(installStatePath);
  const wrapperManifest = wrapperManifestResult.value;
  const installState = installStateResult.value;
  const issues = [];
  const driftedAssets = [];
  const ownedAssets = {
    managed: [],
    adopted: [],
  };
  const classification = discoverProjectShape(resolvedProjectRoot).classification;

  if (!wrapperManifestResult.exists && !installStateResult.exists) {
    return {
      status: 'install-missing',
      canRunCleanly: false,
      summary: 'Managed install was not found; openkit run cannot proceed cleanly.',
      issues: ['Managed wrapper entrypoint was not found at opencode.json.'],
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  if (!wrapperManifestResult.exists || !installStateResult.exists) {
    if (installState) {
      const installStateErrors = validateInstallState(installState);
      if (installStateErrors.length === 0) {
        ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
        ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);
      }
    }

    const missingAssets = [];
    if (!wrapperManifestResult.exists) {
      missingAssets.push('Missing required managed asset: opencode.json');
    }
    if (!installStateResult.exists) {
      missingAssets.push('Missing required managed asset: .openkit/openkit-install.json');
    }

    return {
      status: 'install-incomplete',
      canRunCleanly: false,
      summary: 'Managed install is incomplete; openkit run cannot proceed cleanly.',
      issues: missingAssets,
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  if (wrapperManifestResult.malformed || installStateResult.malformed) {
    if (installState && !installStateResult.malformed) {
      const installStateErrors = validateInstallState(installState);
      if (installStateErrors.length === 0) {
        ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
        ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);
      }
    }

    if (wrapperManifestResult.malformed) {
      driftedAssets.push('opencode.json');
      issues.push('Managed asset JSON is malformed: opencode.json');
    }

    if (installStateResult.malformed) {
      driftedAssets.push('.openkit/openkit-install.json');
      issues.push('Managed asset JSON is malformed: .openkit/openkit-install.json');
    }

    return {
      status: 'drift-detected',
      canRunCleanly: false,
      summary: 'Managed asset drift was detected; review wrapper-owned files before running OpenKit.',
      issues,
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  const installStateErrors = validateInstallState(installState);
  if (installStateErrors.length > 0) {
    return {
      status: 'install-incomplete',
      canRunCleanly: false,
      summary: 'Managed install is incomplete; install state is invalid.',
      issues: installStateErrors,
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
  ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);

  const adoptedRootManifest = (installState.assets?.adopted ?? []).some(
    (asset) => asset?.assetId === ROOT_WRAPPER_ASSET_ID && asset?.path === 'opencode.json'
  );

  if (adoptedRootManifest && !EXPECTED_MANAGED_ASSETS[ROOT_WRAPPER_ASSET_ID].validate(wrapperManifest)) {
    return {
      status: 'install-incomplete',
      canRunCleanly: false,
      summary: 'Managed wrapper contract is incomplete; adopted root manifest is not compatible enough to run cleanly.',
      issues: ['Adopted root manifest is incompatible with the managed wrapper contract.'],
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  for (const asset of installState.assets?.managed ?? []) {
    const expectedAsset = EXPECTED_MANAGED_ASSETS[asset.assetId];

    if (!expectedAsset) {
      continue;
    }

    const assetPath = path.join(resolvedProjectRoot, asset.path);
    const contentsResult = readJsonIfPresent(assetPath);
    const contents = contentsResult.value;

    if (contentsResult.malformed) {
      if (!driftedAssets.includes(asset.path)) {
        driftedAssets.push(asset.path);
      }
      issues.push(`Managed asset JSON is malformed: ${asset.path}`);
      continue;
    }

    if (!contentsResult.exists || !expectedAsset.validate(contents)) {
      if (!driftedAssets.includes(asset.path)) {
        driftedAssets.push(asset.path);
      }
      issues.push(`Drift detected for managed asset: ${asset.path}`);
    }
  }

  if (driftedAssets.length > 0) {
    return {
      status: 'drift-detected',
      canRunCleanly: false,
      summary: 'Managed asset drift was detected; review wrapper-owned files before running OpenKit.',
      issues,
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  if (!fs.existsSync(runtimeManifestPath)) {
    issues.push('Missing runtime manifest: .opencode/opencode.json');
  }

  if (!isOpenCodeAvailable(env)) {
    issues.push('OpenCode executable is not available on PATH');
  }

  if (issues.length > 0) {
    return {
      status: 'runtime-prerequisites-missing',
      canRunCleanly: false,
      summary: 'Runtime launch prerequisites are missing; openkit run cannot proceed cleanly.',
      issues,
      driftedAssets,
      ownedAssets,
      classification,
      wrapperManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  return {
    status: 'healthy',
    canRunCleanly: true,
    summary: 'Managed wrapper is healthy; openkit run can proceed cleanly.',
    issues: [],
    driftedAssets,
    ownedAssets,
    classification,
    wrapperManifestPath,
    runtimeManifestPath,
    installStatePath,
  };
}
