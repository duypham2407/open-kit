import { readAgentCatalog } from '../../global/agent-models.js';
import {
  createAgentModelProfile,
  deleteAgentModelProfile,
  detectStaleAgentModelProfileReferences,
  findRunningAgentModelProfileSessions,
  listAgentModelProfiles,
  readAgentModelProfiles,
  setDefaultAgentModelProfile,
  updateAgentModelProfile,
} from '../../global/agent-model-profiles.js';
import { ensureGlobalInstall } from '../../global/ensure-install.js';
import { getGlobalPaths } from '../../global/paths.js';
import {
  chooseModelInteractively,
  chooseVariantInteractively,
  createPromptAdapter,
  parseModelIdsFromOutput,
  parseVerboseModelCatalog,
  promptLine,
  runOpenCodeModels,
  toPlainModelEntries,
} from './agent-model-selection.js';

const ACTION_FLAGS = new Set(['--create', '--edit', '--list', '--delete', '--set-default']);

function profilesHelp() {
  return [
    'Usage: openkit profiles [--create|--edit|--list|--delete|--set-default]',
    '',
    'Manage global OpenKit agent model profiles stored under OPENCODE_HOME/openkit.',
    '',
    'Options:',
    '  --create       Create a new global profile interactively',
    '  --edit         Edit an existing global profile interactively',
    '  --list         List global profiles and mark the default profile',
    '  --delete       Delete a global profile after confirmation',
    '  --set-default  Set an existing global profile as the launch default',
    '  --help, -h     Show this help',
    '',
    'Notes:',
    '  Profiles are global to this OpenKit installation.',
    '  /switch-profiles and openkit switch-profiles are session-only and do not change the global default.',
  ].join('\n');
}

function parseArgs(args = []) {
  const parsed = { action: args.length === 0 ? 'list' : null };
  let actionCount = 0;

  for (const value of args) {
    if (value === '--help' || value === '-h') {
      parsed.help = true;
      continue;
    }

    if (!ACTION_FLAGS.has(value)) {
      throw new Error(`Unknown argument: ${value}`);
    }

    actionCount += 1;
    if (actionCount > 1) {
      throw new Error('Use exactly one profiles action flag at a time.');
    }

    parsed.action = value.slice(2);
  }

  return parsed;
}

function pluralizeRole(count) {
  return count === 1 ? 'role' : 'roles';
}

function formatProfiles(profiles) {
  if (profiles.length === 0) {
    return 'No global agent model profiles have been created yet. Run `openkit profiles --create` to add one.';
  }

  const lines = ['Global agent model profiles:'];
  for (const [index, profile] of profiles.entries()) {
    const defaultMarker = profile.isDefault ? ' [default]' : '';
    const description = profile.description ? ` — ${profile.description}` : '';
    lines.push(
      `${index + 1}. ${profile.name}${defaultMarker} (${profile.agentCount} ${pluralizeRole(profile.agentCount)})${description}`
    );
  }
  return lines.join('\n');
}

function formatAgents(agents, agentModels = {}) {
  const lines = ['Available OpenKit agents:'];
  for (const [index, agent] of agents.entries()) {
    const current = agentModels[agent.id]?.model ? ` -> ${agentModels[agent.id].model}` : '';
    lines.push(`${index + 1}. ${agent.id} (${agent.name})${current}`);
  }
  return lines.join('\n');
}

function isYes(value) {
  return ['y', 'yes'].includes(value.toLowerCase());
}

function cloneAgentModels(agentModels = {}) {
  return JSON.parse(JSON.stringify(agentModels ?? {}));
}

function knownAgentIdsFromCatalog(agents) {
  return agents.map((agent) => agent.id);
}

function getProfileByName(profilesPath, profileName, options = {}) {
  const store = readAgentModelProfiles(profilesPath, options);
  return store.profiles[profileName] ?? null;
}

async function chooseProfileInteractively(rl, profiles, io, promptLabel) {
  if (profiles.length === 0) {
    return null;
  }

  io.stdout.write(`${formatProfiles(profiles)}\n`);

  while (true) {
    const response = await promptLine(rl, promptLabel);
    if (!response || response.toLowerCase() === 'q' || response.toLowerCase() === 'quit') {
      return null;
    }

    const asNumber = Number.parseInt(response, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= profiles.length) {
      return profiles[asNumber - 1];
    }

    const direct = profiles.find((profile) => profile.name === response);
    if (direct) {
      return direct;
    }

    io.stderr.write('Unknown profile selection. Try again.\n');
  }
}

async function chooseAgentInteractively(rl, agents, agentModels, io) {
  io.stdout.write(`${formatAgents(agents, agentModels)}\n`);

  while (true) {
    const response = await promptLine(rl, 'Select agent by number or id, press Enter when done, or q to cancel: ');
    if (!response) {
      return null;
    }
    if (response.toLowerCase() === 'q' || response.toLowerCase() === 'quit') {
      return 'cancel';
    }

    const asNumber = Number.parseInt(response, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= agents.length) {
      return agents[asNumber - 1];
    }

    const direct = agents.find((agent) => agent.id === response);
    if (direct) {
      return direct;
    }

    io.stderr.write('Unknown agent selection. Try again.\n');
  }
}

function normalizeProfileNameInput(input, existingName = null) {
  const source = input || existingName;
  const normalized = typeof source === 'string' ? source.trim() : '';
  if (!normalized) {
    return null;
  }
  return normalized;
}

function ensureUniqueProfileName(store, profileName, existingName = null) {
  if (profileName !== existingName && Object.hasOwn(store.profiles, profileName)) {
    throw new Error(`Profile ${profileName} already exists.`);
  }
}

function discoverAvailableModels({ env, refresh, io }) {
  const verboseResult = runOpenCodeModels('', { env, refresh, verbose: true });

  if (verboseResult.error?.code === 'ENOENT') {
    throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
  }

  if ((verboseResult.status ?? 1) === 0) {
    if (verboseResult.stderr) {
      io.stderr.write(verboseResult.stderr);
    }

    const entries = parseVerboseModelCatalog(verboseResult.stdout ?? '');
    if (entries.length > 0) {
      return entries;
    }
  } else if (verboseResult.stderr) {
    io.stderr.write(verboseResult.stderr);
  }

  const plainResult = runOpenCodeModels('', { env, refresh, verbose: false });

  if (plainResult.error?.code === 'ENOENT') {
    throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
  }

  if ((plainResult.status ?? 1) !== 0) {
    throw new Error('`opencode models` failed, so profile model validation could not continue.');
  }

  if (plainResult.stderr) {
    io.stderr.write(plainResult.stderr);
  }

  return toPlainModelEntries(parseModelIdsFromOutput(plainResult.stdout ?? ''));
}

function assertProfileModelsAreAvailable(profileInput, { env, refresh, io }) {
  const availableModels = discoverAvailableModels({ env, refresh, io });
  const stale = detectStaleAgentModelProfileReferences(
    {
      profiles: {
        [profileInput.name]: {
          name: profileInput.name,
          agentModels: profileInput.agentModels,
        },
      },
    },
    availableModels
  );

  if (stale.length > 0) {
    const first = stale[0];
    throw new Error(
      `Profile ${first.profileName} references ${first.model} for ${first.agentId}, but OpenCode did not return that model.`
    );
  }
}

async function collectProfileInput({ mode, existingProfile = null, store, agents, env, io }) {
  const rl = createPromptAdapter(io);
  const existingName = existingProfile?.name ?? null;

  try {
    const nameResponse = await promptLine(
      rl,
      existingName ? `Profile name [${existingName}]: ` : 'Profile name (q to cancel): '
    );
    if (!existingName && (!nameResponse || nameResponse.toLowerCase() === 'q')) {
      return { status: 'cancelled', message: 'Profile creation cancelled.' };
    }

    const profileName = normalizeProfileNameInput(nameResponse, existingName);
    if (!profileName) {
      return { status: 'cancelled', message: `${mode === 'edit' ? 'Profile edit' : 'Profile creation'} cancelled.` };
    }
    ensureUniqueProfileName(store, profileName, existingName);

    const descriptionResponse = await promptLine(rl, 'Description (optional): ');
    const description = descriptionResponse.trim().length > 0 ? descriptionResponse.trim() : existingProfile?.description ?? null;
    const agentModels = cloneAgentModels(existingProfile?.agentModels ?? {});

    while (true) {
      const agent = await chooseAgentInteractively(rl, agents, agentModels, io);
      if (agent === 'cancel') {
        return { status: 'cancelled', message: `${mode === 'edit' ? 'Profile edit' : 'Profile creation'} cancelled.` };
      }
      if (!agent) {
        break;
      }

      if (mode === 'edit' && Object.hasOwn(agentModels, agent.id)) {
        const removeExisting = await promptLine(
          rl,
          `Remove ${agent.id} from this profile so it falls back to current/default settings? [y/N]: `
        );
        if (isYes(removeExisting)) {
          delete agentModels[agent.id];

          const again = await promptLine(rl, 'Add, update, or remove another agent? [y/N]: ');
          if (!isYes(again)) {
            break;
          }
          continue;
        }
      }

      const modelEntry = await chooseModelInteractively(rl, io, {
        env,
        refresh: false,
        verbose: true,
        strict: true,
      });
      if (!modelEntry) {
        return { status: 'cancelled', message: `${mode === 'edit' ? 'Profile edit' : 'Profile creation'} cancelled.` };
      }

      const variant = await chooseVariantInteractively(rl, io, modelEntry);
      agentModels[agent.id] = {
        model: modelEntry.modelId,
        ...(variant ? { variant } : {}),
      };

      const again = await promptLine(
        rl,
        mode === 'edit' ? 'Add, update, or remove another agent? [y/N]: ' : 'Add or update another agent? [y/N]: '
      );
      if (!isYes(again)) {
        break;
      }
    }

    if (mode === 'create' && Object.keys(agentModels).length === 0) {
      return { status: 'cancelled', message: 'Profile creation cancelled; no agent model selections were saved.' };
    }

    const profileInput = {
      name: profileName,
      description,
      agentModels,
    };

    assertProfileModelsAreAvailable(profileInput, { env, refresh: false, io });

    const confirmed = await promptLine(rl, `Save profile ${profileName}? [y/N]: `);
    if (!isYes(confirmed)) {
      return { status: 'cancelled', message: `${mode === 'edit' ? 'Profile edit' : 'Profile creation'} cancelled.` };
    }

    return { status: 'ready', profileInput };
  } finally {
    rl.close();
  }
}

function printStoreWarnings(store, io) {
  for (const warning of store.warnings ?? []) {
    io.stderr.write(`Warning: ${warning}\n`);
  }
}

async function handleCreate({ profilesPath, store, agents, env, io }) {
  const collected = await collectProfileInput({ mode: 'create', store, agents, env, io });
  if (collected.status === 'cancelled') {
    io.stdout.write(`${collected.message}\n`);
    return 0;
  }

  createAgentModelProfile(profilesPath, collected.profileInput, {
    knownAgentIds: knownAgentIdsFromCatalog(agents),
  });
  io.stdout.write(`Saved profile ${collected.profileInput.name}.\n`);
  io.stdout.write(`Profiles file: ${profilesPath}\n`);
  return 0;
}

async function handleEdit({ profilesPath, store, profiles, agents, env, io }) {
  if (profiles.length === 0) {
    io.stdout.write('No global agent model profiles are available to edit. Run `openkit profiles --create` first.\n');
    return 0;
  }

  const rl = createPromptAdapter(io);
  let selected;
  try {
    selected = await chooseProfileInteractively(rl, profiles, io, 'Select profile to edit by number/name (q to cancel): ');
  } finally {
    rl.close();
  }

  if (!selected) {
    io.stdout.write('Profile edit cancelled.\n');
    return 0;
  }

  const existingProfile = getProfileByName(profilesPath, selected.name, { knownAgentIds: knownAgentIdsFromCatalog(agents) });
  const collected = await collectProfileInput({ mode: 'edit', existingProfile, store, agents, env, io });
  if (collected.status === 'cancelled') {
    io.stdout.write(`${collected.message}\n`);
    return 0;
  }

  updateAgentModelProfile(profilesPath, selected.name, collected.profileInput, {
    knownAgentIds: knownAgentIdsFromCatalog(agents),
  });
  io.stdout.write(`Updated profile ${collected.profileInput.name}.\n`);
  return 0;
}

async function handleSetDefault({ profilesPath, profiles, io }) {
  if (profiles.length === 0) {
    io.stdout.write('No global agent model profiles are available to set as default. Run `openkit profiles --create` first.\n');
    return 0;
  }

  const rl = createPromptAdapter(io);
  let selected;
  try {
    selected = await chooseProfileInteractively(rl, profiles, io, 'Select default profile by number/name (q to cancel): ');
  } finally {
    rl.close();
  }

  if (!selected) {
    io.stdout.write('Default profile selection cancelled.\n');
    return 0;
  }

  setDefaultAgentModelProfile(profilesPath, selected.name);
  io.stdout.write(`Default profile set to ${selected.name}.\n`);
  return 0;
}

async function handleDelete({ profilesPath, store, profiles, workspacesRoot, io }) {
  if (profiles.length === 0) {
    io.stdout.write('No global agent model profiles are available to delete.\n');
    return 0;
  }

  const rl = createPromptAdapter(io);
  let selected;
  try {
    selected = await chooseProfileInteractively(rl, profiles, io, 'Select profile to delete by number/name (q to cancel): ');
    if (!selected) {
      io.stdout.write('Profile deletion cancelled.\n');
      return 0;
    }

    if (store.defaultProfile === selected.name) {
      io.stderr.write(`Cannot delete default profile ${selected.name}. Set another default first.\n`);
      return 1;
    }

    const activeSessions = findRunningAgentModelProfileSessions({
      profileName: selected.name,
      workspacesRoot,
    });
    if (activeSessions.length > 0) {
      const sessionList = activeSessions
        .map((session) => session.sessionId ?? 'unknown-session')
        .join(', ');
      io.stderr.write(
        `Cannot delete profile ${selected.name} because it is active in running OpenKit sessions: ${sessionList}. ` +
        'Exit affected sessions first, then retry deletion.\n'
      );
      return 1;
    }

    const confirmed = await promptLine(rl, `Delete profile ${selected.name}? [y/N]: `);
    if (!isYes(confirmed)) {
      io.stdout.write('Profile deletion cancelled.\n');
      return 0;
    }
  } finally {
    rl.close();
  }

  deleteAgentModelProfile(profilesPath, selected.name, { workspacesRoot });
  io.stdout.write(`Deleted profile ${selected.name}.\n`);
  return 0;
}

export const profilesCommand = {
  name: 'profiles',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${profilesHelp()}\n`);
      return 0;
    }

    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      io.stderr.write('Run `openkit profiles --help` for usage.\n');
      return 1;
    }

    const ensured = ensureGlobalInstall({
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (ensured.action === 'blocked') {
      for (const issue of ensured.doctor.issues ?? []) {
        io.stderr.write(`${issue}\n`);
      }
      if (ensured.doctor.nextStep) {
        io.stderr.write(`Next: ${ensured.doctor.nextStep}\n`);
      }
      return 1;
    }

    const globalPaths = getGlobalPaths({ env: process.env });
    const profilesPath = globalPaths.agentModelProfilesPath;
    const registryPath = `${globalPaths.kitRoot}/registry.json`;
    const agents = readAgentCatalog(registryPath);
    const knownAgentIds = knownAgentIdsFromCatalog(agents);
    const store = readAgentModelProfiles(profilesPath, { knownAgentIds });
    const profiles = listAgentModelProfiles(profilesPath);
    printStoreWarnings(store, io);

    try {
      if (parsed.action === 'create') {
        return await handleCreate({ profilesPath, store, agents, env: process.env, io });
      }

      if (parsed.action === 'edit') {
        return await handleEdit({ profilesPath, store, profiles, agents, env: process.env, io });
      }

      if (parsed.action === 'set-default') {
        return await handleSetDefault({ profilesPath, profiles, io });
      }

      if (parsed.action === 'delete') {
        return await handleDelete({ profilesPath, store, profiles, workspacesRoot: globalPaths.workspacesRoot, io });
      }

      io.stdout.write(`${formatProfiles(profiles)}\n`);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
