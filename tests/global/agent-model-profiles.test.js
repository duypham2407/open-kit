import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { setAgentModel } from '../../src/global/agent-models.js';
import {
  buildAgentModelProfileConfigOverrides,
  createAgentModelProfile,
  deleteAgentModelProfile,
  detectStaleAgentModelProfileReferences,
  findRunningAgentModelProfileSessions,
  getDefaultAgentModelProfile,
  listAgentModelProfiles,
  readAgentModelProfiles,
  resolveAgentModelProfileConfig,
  setDefaultAgentModelProfile,
  updateAgentModelProfile,
} from '../../src/global/agent-model-profiles.js';
import { getGlobalPaths } from '../../src/global/paths.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-agent-model-profiles-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('global paths include the agent model profile store under OpenCode home', () => {
  const tempDir = makeTempDir();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempDir } });

  assert.equal(paths.agentModelProfilesPath, path.join(tempDir, 'openkit', 'agent-model-profiles.json'));
});

test('profile store creates and lists sparse global profiles', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  const store = createAgentModelProfile(
    profilesPath,
    {
      name: ' reasoning-heavy ',
      description: 'Use the strongest model for planning roles.',
      agentModels: {
        'product-lead-agent': { model: 'openai/gpt-5', variant: 'high' },
      },
    },
    { knownAgentIds: ['product-lead-agent', 'qa-agent'], now: () => '2026-04-29T00:00:00.000Z' }
  );

  assert.equal(store.profiles['reasoning-heavy'].name, 'reasoning-heavy');
  assert.equal(store.profiles['reasoning-heavy'].description, 'Use the strongest model for planning roles.');
  assert.deepEqual(store.profiles['reasoning-heavy'].agentModels, {
    'product-lead-agent': { model: 'openai/gpt-5', variant: 'high' },
  });

  assert.deepEqual(listAgentModelProfiles(profilesPath), [
    {
      name: 'reasoning-heavy',
      description: 'Use the strongest model for planning roles.',
      agentCount: 1,
      isDefault: false,
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  ]);
});

test('profile creation validates duplicate names, known agent ids, and model entry shape without mutation', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  createAgentModelProfile(
    profilesPath,
    {
      name: 'fast-review',
      agentModels: {
        'qa-agent': { model: 'anthropic/claude-sonnet-4-5' },
      },
    },
    { knownAgentIds: ['qa-agent'], now: () => '2026-04-29T00:00:00.000Z' }
  );

  assert.throws(
    () =>
      createAgentModelProfile(
        profilesPath,
        {
          name: 'fast-review',
          agentModels: {
            'qa-agent': { model: 'openai/gpt-5-mini' },
          },
        },
        { knownAgentIds: ['qa-agent'] }
      ),
    /already exists/
  );

  assert.throws(
    () =>
      createAgentModelProfile(
        profilesPath,
        {
          name: 'unknown-agent',
          agentModels: {
            'made-up-agent': { model: 'openai/gpt-5' },
          },
        },
        { knownAgentIds: ['qa-agent'] }
      ),
    /Unknown agent id/
  );

  assert.throws(
    () =>
      createAgentModelProfile(
        profilesPath,
        {
          name: 'bad-model',
          agentModels: {
            'qa-agent': { model: 'gpt-5' },
          },
        },
        { knownAgentIds: ['qa-agent'] }
      ),
    /provider-qualified/
  );

  assert.deepEqual(Object.keys(readAgentModelProfiles(profilesPath).profiles), ['fast-review']);
});

test('default profile helpers only point at existing profiles', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });

  setDefaultAgentModelProfile(profilesPath, 'daily');
  assert.equal(getDefaultAgentModelProfile(profilesPath), 'daily');

  assert.throws(() => setDefaultAgentModelProfile(profilesPath, 'missing'), /does not exist/);
  assert.equal(getDefaultAgentModelProfile(profilesPath), 'daily');
});

test('profile resolver layers sparse active profile entries over base agent model settings', () => {
  const tempDir = makeTempDir();
  const baseSettingsPath = path.join(tempDir, 'agent-models.json');
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  setAgentModel(baseSettingsPath, 'product-lead-agent', 'openai/gpt-5-mini');
  setAgentModel(baseSettingsPath, 'qa-agent', 'anthropic/claude-sonnet-4-5', 'balanced');
  createAgentModelProfile(profilesPath, {
    name: 'reasoning-heavy',
    agentModels: {
      'product-lead-agent': { model: 'openai/gpt-5', variant: 'high' },
    },
  });
  setDefaultAgentModelProfile(profilesPath, 'reasoning-heavy');

  assert.deepEqual(buildAgentModelProfileConfigOverrides({ baseSettingsPath, profilesPath }), {
    agent: {
      'product-lead-agent': { model: 'openai/gpt-5', variant: 'high' },
      'qa-agent': { model: 'anthropic/claude-sonnet-4-5', variant: 'balanced' },
    },
  });
});

test('profile resolver falls back to base settings when the requested or default profile is missing', () => {
  const profileStore = {
    defaultProfile: 'missing-default',
    profiles: {},
  };
  const baseSettings = {
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  };

  const resolved = resolveAgentModelProfileConfig({ baseSettings, profileStore });

  assert.equal(resolved.activeProfileName, null);
  assert.match(resolved.warnings.join('\n'), /missing-default/);
  assert.deepEqual(resolved.overrides, {
    agent: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
});

test('stale model reference detection compares profile models with discovered model entries', () => {
  const store = {
    profiles: {
      daily: {
        name: 'daily',
        agentModels: {
          'qa-agent': {
            model: 'openai/gpt-5-mini',
            fallback_models: ['openai/gpt-5', { model: 'anthropic/claude-sonnet-4-5' }],
          },
          'code-reviewer': { model: 'missing/provider-model' },
        },
      },
    },
  };

  assert.deepEqual(
    detectStaleAgentModelProfileReferences(store, [
      { modelId: 'openai/gpt-5-mini' },
      'openai/gpt-5',
    ]),
    [
      {
        profileName: 'daily',
        agentId: 'qa-agent',
        field: 'fallback_models[1]',
        model: 'anthropic/claude-sonnet-4-5',
      },
      {
        profileName: 'daily',
        agentId: 'code-reviewer',
        field: 'model',
        model: 'missing/provider-model',
      },
    ]
  );
});

test('profile update and delete helpers keep default profile consistency', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  createAgentModelProfile(profilesPath, {
    name: 'heavy',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5' },
    },
  });
  setDefaultAgentModelProfile(profilesPath, 'heavy');

  updateAgentModelProfile(profilesPath, 'daily', {
    description: 'Daily profile',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini', variant: 'low' },
    },
  });
  deleteAgentModelProfile(profilesPath, 'daily');

  const store = readAgentModelProfiles(profilesPath);
  assert.equal(store.profiles.daily, undefined);
  assert.equal(store.defaultProfile, 'heavy');

  assert.throws(() => deleteAgentModelProfile(profilesPath, 'heavy'), /default profile/);
});

test('profile deletion blocks launch metadata references in running sessions', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const sessionIndexPath = path.join(
    workspacesRoot,
    'workspace-a',
    'openkit',
    '.opencode',
    'runtime-sessions',
    'index.json'
  );

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'running-launch',
        status: 'running',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  assert.throws(
    () => deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot }),
    /active in running OpenKit sessions: running-launch/
  );
  assert.ok(readAgentModelProfiles(profilesPath).profiles.daily);
});

test('profile deletion blocks session-specific active profile references in running sessions', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const runtimeRoot = path.join(workspacesRoot, 'workspace-a', 'openkit');
  const sessionIndexPath = path.join(runtimeRoot, '.opencode', 'runtime-sessions', 'index.json');
  const sessionProfileStatePath = path.join(
    runtimeRoot,
    '.opencode',
    'runtime-sessions',
    'running-switch',
    'active-agent-model-profile.json'
  );

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'running-switch',
        status: 'running',
      },
    ],
  });
  writeJson(sessionProfileStatePath, {
    profileName: 'daily',
    source: 'switch_profiles',
  });

  assert.throws(
    () => deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot }),
    /active in running OpenKit sessions: running-switch/
  );
  assert.ok(readAgentModelProfiles(profilesPath).profiles.daily);
});

test('profile deletion keeps default profile guard when session safety is enabled', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  setDefaultAgentModelProfile(profilesPath, 'daily');

  assert.throws(
    () => deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot }),
    /default profile/
  );
  assert.ok(readAgentModelProfiles(profilesPath).profiles.daily);
});

test('profile deletion ignores completed, failed, and stopped sessions', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const sessionIndexPath = path.join(
    workspacesRoot,
    'workspace-a',
    'openkit',
    '.opencode',
    'runtime-sessions',
    'index.json'
  );

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'finished_without_exit_code',
        status: 'completed',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
      {
        session_id: 'failed_without_exit_code',
        status: 'failed',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
      {
        session_id: 'stopped_without_exit_code',
        running: false,
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot });

  assert.equal(readAgentModelProfiles(profilesPath).profiles.daily, undefined);
});

test('profile deletion blocks ambiguous non-terminal session records', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const sessionIndexPath = path.join(
    workspacesRoot,
    'workspace-a',
    'openkit',
    '.opencode',
    'runtime-sessions',
    'index.json'
  );

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'starting-session',
        status: 'starting',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  assert.throws(
    () => deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot }),
    /active in running OpenKit sessions: starting-session/
  );
  assert.ok(readAgentModelProfiles(profilesPath).profiles.daily);
});

test('profile deletion succeeds when no running session references profile', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const sessionIndexPath = path.join(
    workspacesRoot,
    'workspace-a',
    'openkit',
    '.opencode',
    'runtime-sessions',
    'index.json'
  );

  createAgentModelProfile(profilesPath, {
    name: 'daily',
    agentModels: {
      'qa-agent': { model: 'openai/gpt-5-mini' },
    },
  });
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'running-other-profile',
        status: 'running',
        activeAgentModelProfile: {
          name: 'heavy',
          source: 'global_default',
        },
      },
    ],
  });

  deleteAgentModelProfile(profilesPath, 'daily', { workspacesRoot });

  assert.equal(readAgentModelProfiles(profilesPath).profiles.daily, undefined);
});

test('running profile session lookup ignores explicit non-running session states', () => {
  const tempDir = makeTempDir();
  const workspacesRoot = path.join(tempDir, 'workspaces');
  const sessionIndexPath = path.join(
    workspacesRoot,
    'workspace-a',
    'openkit',
    '.opencode',
    'runtime-sessions',
    'index.json'
  );

  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: 'finished_without_exit_code',
        status: 'completed',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
      {
        session_id: 'failed_without_exit_code',
        status: 'failed',
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
      {
        session_id: 'stopped_without_exit_code',
        running: false,
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  assert.deepEqual(
    findRunningAgentModelProfileSessions({ profileName: 'daily', workspacesRoot }),
    []
  );
});

test('reading malformed profile stores surfaces validation warnings while preserving safe defaults', () => {
  const tempDir = makeTempDir();
  const profilesPath = path.join(tempDir, 'agent-model-profiles.json');

  writeJson(profilesPath, {
    schema: 'wrong/schema',
    stateVersion: 2,
    defaultProfile: 'missing',
    profiles: {
      malformed: {
        name: 'different-name',
        agentModels: {
          'qa-agent': { model: '' },
        },
      },
    },
  });

  const store = readAgentModelProfiles(profilesPath, { knownAgentIds: ['qa-agent'] });
  assert.deepEqual(Object.keys(store.profiles), ['malformed']);
  assert.match(store.warnings.join('\n'), /schema/);
  assert.match(store.warnings.join('\n'), /defaultProfile/);
  assert.match(store.warnings.join('\n'), /must match its key/);
  assert.match(store.warnings.join('\n'), /profiles\.malformed\.agentModels\.qa-agent\.model must be a non-empty string/);
});
