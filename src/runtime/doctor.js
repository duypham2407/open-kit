import fs from 'node:fs';
import path from 'node:path';

import { validateInstallState } from '../install/install-state.js';
import { discoverProjectShape } from '../install/discovery.js';
import { isCommandAvailable } from '../command-detection.js';
import { isAstGrepAvailable, isCodemodAvailable, isSemgrepAvailable } from '../global/tooling.js';
import { bootstrapRuntimeFoundation } from './index.js';
import { inspectBackgroundDoctor } from './doctor/background-doctor.js';
import { inspectCapabilityDoctor } from './doctor/capability-doctor.js';
import { inspectInstallDoctor } from './doctor/install-doctor.js';
import { inspectMcpDoctor } from './doctor/mcp-doctor.js';
import { inspectModelDoctor } from './doctor/model-doctor.js';
import { inspectWorkflowDoctor } from './doctor/workflow-doctor.js';

const EXPECTED_MANAGED_ASSETS = {
  'runtime.opencode-manifest': {
    path: 'opencode.json',
    validate(contents) {
      return (
        contents?.installState?.path === '.openkit/openkit-install.json' &&
        contents?.installState?.schema === 'openkit/install-state@1' &&
        contents?.permission?.npm === 'allow' &&
        contents?.permission?.task === 'allow' &&
        contents?.permission?.bash === 'allow' &&
        contents?.permission?.edit === 'allow' &&
        contents?.permission?.read === 'allow' &&
        contents?.permission?.write === 'allow' &&
        contents?.permission?.glob === 'allow' &&
        contents?.permission?.grep === 'allow' &&
        contents?.permission?.list === 'allow' &&
        contents?.permission?.skill === 'allow' &&
        contents?.permission?.lsp === 'allow' &&
        contents?.permission?.todoread === 'allow' &&
        contents?.permission?.todowrite === 'allow' &&
        contents?.permission?.webfetch === 'allow' &&
        contents?.permission?.websearch === 'allow' &&
        contents?.permission?.codesearch === 'allow' &&
        contents?.permission?.external_directory === 'allow' &&
        contents?.permission?.doom_loop === 'allow' &&
        contents?.permission?.rm === 'ask' &&
        contents?.permission?.['git log'] === 'allow' &&
        contents?.permission?.['git diff'] === 'allow' &&
        contents?.productSurface?.current === 'global-openkit-install' &&
        contents?.productSurface?.installReadiness === 'managed' &&
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

const ROOT_MANIFEST_ASSET_ID = 'runtime.opencode-manifest';

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
  return isCommandAvailable('opencode');
}

export function inspectManagedDoctor({
  projectRoot,
  env = process.env,
  isOpenCodeAvailable = defaultIsOpenCodeAvailable,
} = {}) {
  const resolvedProjectRoot = projectRoot ?? process.cwd();
  const rootManifestPath = path.join(resolvedProjectRoot, 'opencode.json');
  const runtimeManifestPath = path.join(resolvedProjectRoot, '.opencode', 'opencode.json');
  const installStatePath = path.join(resolvedProjectRoot, '.openkit', 'openkit-install.json');
  const rootManifestResult = readJsonIfPresent(rootManifestPath);
  const installStateResult = readJsonIfPresent(installStatePath);
  const rootManifest = rootManifestResult.value;
  const installState = installStateResult.value;
  const issues = [];
  const driftedAssets = [];
  const ownedAssets = {
    managed: [],
    adopted: [],
  };
  const classification = discoverProjectShape(resolvedProjectRoot).classification;

  if (!rootManifestResult.exists && !installStateResult.exists) {
    return {
      status: 'install-missing',
      canRunCleanly: false,
      summary: 'Managed install was not found; openkit run cannot proceed cleanly.',
      issues: ['Managed install entrypoint was not found at opencode.json.'],
      driftedAssets,
      ownedAssets,
      classification,
      rootManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  if (!rootManifestResult.exists || !installStateResult.exists) {
    if (installState) {
      const installStateErrors = validateInstallState(installState);
      if (installStateErrors.length === 0) {
        ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
        ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);
      }
    }

    const missingAssets = [];
    if (!rootManifestResult.exists) {
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
      rootManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  if (rootManifestResult.malformed || installStateResult.malformed) {
    if (installState && !installStateResult.malformed) {
      const installStateErrors = validateInstallState(installState);
      if (installStateErrors.length === 0) {
        ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
        ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);
      }
    }

    if (rootManifestResult.malformed) {
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
      summary: 'Managed asset drift was detected; review managed install files before running OpenKit.',
      issues,
      driftedAssets,
      ownedAssets,
      classification,
      rootManifestPath,
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
      rootManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  ownedAssets.managed = (installState.assets?.managed ?? []).map((asset) => asset.path);
  ownedAssets.adopted = (installState.assets?.adopted ?? []).map((asset) => asset.path);

  const adoptedRootManifest = (installState.assets?.adopted ?? []).some(
    (asset) => asset?.assetId === ROOT_MANIFEST_ASSET_ID && asset?.path === 'opencode.json'
  );

  if (adoptedRootManifest && !EXPECTED_MANAGED_ASSETS[ROOT_MANIFEST_ASSET_ID].validate(rootManifest)) {
    return {
      status: 'install-incomplete',
      canRunCleanly: false,
      summary: 'Managed install contract is incomplete; adopted root manifest is not compatible enough to run cleanly.',
      issues: ['Adopted root manifest is incompatible with the managed install contract.'],
      driftedAssets,
      ownedAssets,
      classification,
      rootManifestPath,
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
      summary: 'Managed asset drift was detected; review managed install files before running OpenKit.',
      issues,
      driftedAssets,
      ownedAssets,
      classification,
      rootManifestPath,
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

  if (!isAstGrepAvailable({ env })) {
    issues.push('ast-grep executable is not available on PATH or the OpenKit tooling bin path');
  }

  if (!isSemgrepAvailable({ env })) {
    issues.push('semgrep executable is not available on PATH or the OpenKit tooling bin path');
  }

  if (!isCodemodAvailable()) {
    issues.push('jscodeshift package is not installed; codemod tools will report dependency-missing');
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
      rootManifestPath,
      runtimeManifestPath,
      installStatePath,
    };
  }

  let runtimeFoundation = null;
  let runtimeFoundationIssue = null;

  try {
    runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot: resolvedProjectRoot, env, mode: 'read-only' });
  } catch (error) {
    runtimeFoundationIssue = `Runtime foundation error: ${error.message}`;
  }

  if (runtimeFoundationIssue) {
    return {
      status: 'runtime-prerequisites-missing',
      canRunCleanly: false,
      summary: 'Runtime launch prerequisites are missing; openkit run cannot proceed cleanly.',
      issues: [runtimeFoundationIssue],
      driftedAssets,
      ownedAssets,
      classification,
      rootManifestPath,
      runtimeManifestPath,
      installStatePath,
      runtimeFoundation,
    };
  }

  return {
    status: 'healthy',
    canRunCleanly: true,
    summary: 'Managed install is healthy; openkit run can proceed cleanly.',
    issues: [],
    driftedAssets,
    ownedAssets,
    classification,
    rootManifestPath,
    runtimeManifestPath,
    installStatePath,
    runtimeFoundation,
    runtimeDoctor: {
      install: inspectInstallDoctor({
        classification,
        rootManifestPath,
        runtimeManifestPath,
      }),
      workflow: inspectWorkflowDoctor(runtimeFoundation?.managers?.workflowKernel),
      capabilities: inspectCapabilityDoctor(runtimeFoundation),
      background: inspectBackgroundDoctor(runtimeFoundation?.managers?.backgroundManager, runtimeFoundation?.managers?.workflowKernel),
      mcp: inspectMcpDoctor(runtimeFoundation?.mcpPlatform),
      models: inspectModelDoctor(runtimeFoundation?.modelRuntime),
      continuation: runtimeFoundation?.runtimeInterface?.runtimeState?.recovery ?? null,
      toolFamilies: runtimeFoundation?.tools?.toolFamilies ?? [],
      commands: runtimeFoundation?.commands ?? [],
      skills: runtimeFoundation?.skills?.skills ?? [],
    },
  };
}
