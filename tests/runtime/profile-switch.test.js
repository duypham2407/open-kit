import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { setAgentModel } from '../../src/global/agent-models.js';
import {
  createAgentModelProfile,
  readAgentModelProfiles,
  setDefaultAgentModelProfile,
} from '../../src/global/agent-model-profiles.js';
import { getWorkspacePaths } from '../../src/global/paths.js';
import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { SessionProfileManager } from '../../src/runtime/managers/session-profile-manager.js';
import { createSessionProfileSwitchTool } from '../../src/runtime/tools/models/session-profile-switch.js';

function makeTempDir(prefix = 'openkit-profile-switch-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sessionProfileStatePath(workspaceRoot, sessionId) {
  return path.join(
    workspaceRoot,
    '.opencode',
    'runtime-sessions',
    encodeURIComponent(sessionId),
    'active-agent-model-profile.json'
  );
}

function sharedProfileStatePath(workspaceRoot) {
  return path.join(workspaceRoot, '.opencode', 'active-agent-model-profile.json');
}

test('session profile manager applies a named global profile only to the current workspace state', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-project-');
  const otherProjectRoot = makeTempDir('openkit-profile-switch-other-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-home-');
  const env = { OPENCODE_HOME: opencodeHome, OPENKIT_RUNTIME_SESSION_ID: 'workspace-session' };
  const paths = getWorkspacePaths({ projectRoot, env });
  const otherPaths = getWorkspacePaths({ projectRoot: otherProjectRoot, env });

  setAgentModel(paths.agentModelSettingsPath, 'qa-agent', 'openai/gpt-5-mini');
  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'reasoning-heavy',
    agentModels: {
      'fullstack-agent': { model: 'openai/gpt-5', variant: 'high' },
    },
  });
  setDefaultAgentModelProfile(paths.agentModelProfilesPath, 'daily');

  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });

  const result = manager.applyProfile('reasoning-heavy');

  assert.equal(result.status, 'ok');
  assert.equal(result.activeProfile.name, 'reasoning-heavy');
  assert.deepEqual(result.effectiveOverrides.agent['fullstack-agent'], {
    model: 'openai/gpt-5',
    variant: 'high',
  });

  const persisted = readJson(sessionProfileStatePath(paths.workspaceRoot, 'workspace-session'));
  assert.equal(persisted.profileName, 'reasoning-heavy');
  assert.equal(persisted.source, 'switch_profiles');
  assert.equal(persisted.workspaceId, paths.workspaceId);
  assert.equal(persisted.sessionId, 'workspace-session');
  assert.equal(fs.existsSync(sharedProfileStatePath(paths.workspaceRoot)), false);

  const globalStore = readAgentModelProfiles(paths.agentModelProfilesPath);
  assert.equal(globalStore.defaultProfile, 'daily');
  assert.deepEqual(Object.keys(globalStore.profiles).sort(), ['daily', 'reasoning-heavy']);

  const otherManager = new SessionProfileManager({
    projectRoot: otherPaths.projectRoot,
    runtimeRoot: otherPaths.workspaceRoot,
    env,
  });
  assert.equal(otherManager.getActiveProfileState().profileName, null);
});

test('session profile manager isolates selections by runtime session id in one workspace', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-session-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-session-home-');
  const env = { OPENCODE_HOME: opencodeHome };
  const paths = getWorkspacePaths({ projectRoot, env });

  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'heavy',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5' },
    },
  });

  const sessionA = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env: { ...env, OPENKIT_RUNTIME_SESSION_ID: 'session-a' },
  });
  const sessionB = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env: { ...env, OPENKIT_RUNTIME_SESSION_ID: 'session-b' },
  });

  sessionA.applyProfile('heavy');

  assert.equal(sessionA.getActiveProfileState().profileName, 'heavy');
  assert.equal(sessionB.getActiveProfileState().profileName, null);

  sessionB.applyProfile('daily');

  assert.equal(sessionA.getActiveProfileState().profileName, 'heavy');
  assert.equal(sessionB.getActiveProfileState().profileName, 'daily');

  const persistedA = readJson(sessionProfileStatePath(paths.workspaceRoot, 'session-a'));
  const persistedB = readJson(sessionProfileStatePath(paths.workspaceRoot, 'session-b'));
  assert.equal(persistedA.profileName, 'heavy');
  assert.equal(persistedA.sessionId, 'session-a');
  assert.equal(persistedB.profileName, 'daily');
  assert.equal(persistedB.sessionId, 'session-b');
  assert.equal(fs.existsSync(sharedProfileStatePath(paths.workspaceRoot)), false);
});

test('session profile manager refuses to write shared workspace state without runtime session id', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-no-session-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-no-session-home-');
  const env = { OPENCODE_HOME: opencodeHome };
  const paths = getWorkspacePaths({ projectRoot, env });

  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });

  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });

  const result = manager.applyProfile('daily');

  assert.equal(result.status, 'session-id-required');
  assert.match(result.message, /OPENKIT_RUNTIME_SESSION_ID/);
  assert.equal(fs.existsSync(sharedProfileStatePath(paths.workspaceRoot)), false);
  assert.equal(fs.existsSync(path.join(paths.workspaceRoot, '.opencode', 'runtime-sessions')), false);
});

test('session profile manager rejects unsafe path-segment runtime session ids fail-closed', () => {
  for (const unsafeSessionId of ['..', '.']) {
    const projectRoot = makeTempDir('openkit-profile-switch-unsafe-session-project-');
    const opencodeHome = makeTempDir('openkit-profile-switch-unsafe-session-home-');
    const env = { OPENCODE_HOME: opencodeHome, OPENKIT_RUNTIME_SESSION_ID: unsafeSessionId };
    const paths = getWorkspacePaths({ projectRoot, env });

    createAgentModelProfile(paths.agentModelProfilesPath, {
      name: 'daily',
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
    });

    fs.mkdirSync(path.dirname(sharedProfileStatePath(paths.workspaceRoot)), { recursive: true });
    fs.writeFileSync(
      sharedProfileStatePath(paths.workspaceRoot),
      `${JSON.stringify({
        schema: 'openkit/active-agent-model-profile@1',
        stateVersion: 1,
        profileName: 'stale-shared-profile',
        selectedAt: '2026-04-29T00:00:00.000Z',
        source: 'switch_profiles',
        workspaceId: paths.workspaceId,
        sessionId: null,
      }, null, 2)}\n`,
      'utf8'
    );

    const manager = new SessionProfileManager({
      projectRoot: paths.projectRoot,
      runtimeRoot: paths.workspaceRoot,
      env,
    });

    const result = manager.applyProfile('daily');
    const activeState = manager.getActiveProfileState();
    const runtimeSessionsPath = path.join(paths.workspaceRoot, '.opencode', 'runtime-sessions');

    assert.equal(result.status, 'session-id-required');
    assert.equal(fs.existsSync(runtimeSessionsPath), false);
    assert.equal(
      fs.existsSync(path.join(runtimeSessionsPath, 'active-agent-model-profile.json')),
      false
    );
    assert.equal(activeState.profileName, null);
    assert.equal(activeState.sessionId, null);
    assert.equal(activeState.workspaceId, paths.workspaceId);
  }
});

test('session profile manager ignores shared workspace profile state without runtime session id', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-stale-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-stale-home-');
  const env = { OPENCODE_HOME: opencodeHome };
  const paths = getWorkspacePaths({ projectRoot, env });
  const activeProfilePath = path.join(paths.workspaceRoot, '.opencode', 'active-agent-model-profile.json');

  fs.mkdirSync(path.dirname(activeProfilePath), { recursive: true });
  fs.writeFileSync(
    activeProfilePath,
    `${JSON.stringify({
      schema: 'openkit/active-agent-model-profile@1',
      stateVersion: 1,
      profileName: 'stale-shared-profile',
      selectedAt: '2026-04-29T00:00:00.000Z',
      source: 'switch_profiles',
      workspaceId: paths.workspaceId,
      sessionId: null,
      sessionSelections: {
        'session-a': {
          profileName: 'daily',
          selectedAt: '2026-04-29T00:00:00.000Z',
          source: 'switch_profiles',
          workspaceId: paths.workspaceId,
          sessionId: 'session-a',
        },
      },
    }, null, 2)}\n`,
    'utf8'
  );

  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });

  const activeState = manager.getActiveProfileState();

  assert.equal(activeState.profileName, null);
  assert.equal(activeState.sessionId, null);
  assert.equal(activeState.workspaceId, paths.workspaceId);
});

test('runtime tool lists global profiles and applies a selected profile to live model resolution', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-runtime-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-runtime-home-');
  const env = { OPENCODE_HOME: opencodeHome, OPENKIT_RUNTIME_SESSION_ID: 'runtime-tool-session' };
  const paths = getWorkspacePaths({ projectRoot, env });

  setAgentModel(paths.agentModelSettingsPath, 'fullstack-agent', 'openai/gpt-5-mini');
  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'reasoning-heavy',
    agentModels: {
      'fullstack-agent': { model: 'openai/gpt-5', variant: 'high' },
    },
  });

  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });
  const tool = runtime.tools.tools['tool.session-profile-switch'];

  const listing = tool.execute({ action: 'list' });
  assert.equal(listing.status, 'ok');
  assert.deepEqual(listing.profiles.map((profile) => profile.name), ['reasoning-heavy']);

  const applied = tool.execute({ action: 'apply', profileName: 'reasoning-heavy' });
  assert.equal(applied.status, 'ok');
  assert.equal(applied.activeProfile.name, 'reasoning-heavy');
  assert.equal(applied.modelResolution.resolutions.find((entry) => entry.trace.subjectId === 'fullstack-agent').model, 'openai/gpt-5');
  assert.equal(runtime.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'fullstack-agent').model, 'openai/gpt-5');
  assert.equal(readAgentModelProfiles(paths.agentModelProfilesPath).defaultProfile, null);
});

test('runtime bootstrap applies persisted session active profile state before model resolution', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-bootstrap-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-bootstrap-home-');
  const baseEnv = { OPENCODE_HOME: opencodeHome };
  const paths = getWorkspacePaths({ projectRoot, env: baseEnv });
  const env = {
    ...baseEnv,
    OPENKIT_WORKFLOW_STATE: paths.workflowStatePath,
    OPENKIT_RUNTIME_SESSION_ID: 'bootstrap-session',
  };

  setAgentModel(paths.agentModelSettingsPath, 'fullstack-agent', 'openai/gpt-5-mini');
  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'qa-heavy',
    agentModels: {
      'fullstack-agent': { model: 'openai/gpt-5', variant: 'high' },
    },
  });
  new SessionProfileManager({ projectRoot, runtimeRoot: paths.workspaceRoot, env }).applyProfile('qa-heavy');

  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });
  const qaResolution = runtime.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'fullstack-agent');

  assert.equal(qaResolution.model, 'openai/gpt-5');
  assert.equal(qaResolution.variant, 'high');
});

test('session profile switch tool handles no profiles, cancellation, missing selections, and apply failures without mutation', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-safety-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-safety-home-');
  const env = { OPENCODE_HOME: opencodeHome, OPENKIT_RUNTIME_SESSION_ID: 'safety-session' };
  const paths = getWorkspacePaths({ projectRoot, env });
  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });
  const tool = createSessionProfileSwitchTool({ sessionProfileManager: manager });

  assert.equal(tool.execute({ action: 'list' }).status, 'empty');
  assert.equal(tool.execute({ action: 'cancel' }).status, 'cancelled');

  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });

  const missing = tool.execute({ action: 'apply', profileName: 'deleted-after-list' });
  assert.equal(missing.status, 'not-found');
  assert.equal(manager.getActiveProfileState().profileName, null);

  const unsafeTool = createSessionProfileSwitchTool({
    sessionProfileManager: {
      listProfiles: () => [{ name: 'daily', agentCount: 1, isDefault: false }],
      applyProfile: () => ({ status: 'apply-failed', message: 'unsafe apply failure' }),
      getActiveProfileState: () => manager.getActiveProfileState(),
    },
  });
  assert.equal(unsafeTool.execute({ action: 'apply', profileName: 'daily' }).status, 'apply-failed');
  assert.equal(manager.getActiveProfileState().profileName, null);
});

test('session profile manager rejects invalid selected profile entries without changing previous state', () => {
  const projectRoot = makeTempDir('openkit-profile-switch-invalid-project-');
  const opencodeHome = makeTempDir('openkit-profile-switch-invalid-home-');
  const env = { OPENCODE_HOME: opencodeHome, OPENKIT_RUNTIME_SESSION_ID: 'invalid-profile-session' };
  const paths = getWorkspacePaths({ projectRoot, env });

  createAgentModelProfile(paths.agentModelProfilesPath, {
    name: 'safe',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  fs.writeFileSync(
    paths.agentModelProfilesPath,
    `${JSON.stringify({
      schema: 'openkit/agent-model-profiles@1',
      stateVersion: 1,
      updatedAt: '2026-04-29T00:00:00.000Z',
      defaultProfile: null,
      profiles: {
        safe: {
          name: 'safe',
          agentModels: {
            'qa-agent': { model: 'openai/gpt-5-mini' },
          },
          createdAt: '2026-04-29T00:00:00.000Z',
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
        broken: {
          name: 'broken',
          agentModels: {
            'qa-agent': { model: 'openai/gpt-5', variant: 42 },
          },
          createdAt: '2026-04-29T00:00:00.000Z',
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
      },
    }, null, 2)}\n`,
    'utf8'
  );

  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });

  assert.equal(manager.applyProfile('safe').status, 'ok');
  const failed = manager.applyProfile('broken');

  assert.equal(failed.status, 'apply-failed');
  assert.match(failed.message, /could not be applied safely/);
  assert.match(failed.warnings.join('\n'), /variant must be a string/);
  assert.equal(manager.getActiveProfileState().profileName, 'safe');
});
