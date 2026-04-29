import fs from 'node:fs';
import path from 'node:path';

import { buildAgentModelConfigOverrides, isValidModelId, readAgentModelSettings } from './agent-models.js';

const AGENT_MODEL_PROFILES_SCHEMA = 'openkit/agent-model-profiles@1';
const TERMINAL_SESSION_STATUSES = new Set(['completed', 'failed', 'stopped']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultNow() {
  return new Date().toISOString();
}

function normalizeProfileName(name) {
  if (typeof name !== 'string') {
    throw new Error('Profile name must be a non-empty string.');
  }

  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new Error('Profile name must be a non-empty string.');
  }

  return normalized;
}

function normalizeOptionalDescription(description) {
  if (description === undefined || description === null) {
    return null;
  }

  if (typeof description !== 'string') {
    throw new Error('Profile description must be a string when provided.');
  }

  const normalized = description.trim();
  return normalized.length > 0 ? normalized : null;
}

function toKnownAgentSet(knownAgentIds) {
  if (!Array.isArray(knownAgentIds) || knownAgentIds.length === 0) {
    return null;
  }

  return new Set(knownAgentIds);
}

function validateKnownAgentId(agentId, knownAgents) {
  if (!knownAgents) {
    return;
  }

  if (!knownAgents.has(agentId)) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }
}

function normalizeFallbackModels(fallbackModels, label) {
  if (fallbackModels === undefined) {
    return undefined;
  }

  if (!Array.isArray(fallbackModels)) {
    throw new Error(`${label}.fallback_models must be an array when provided.`);
  }

  return fallbackModels.map((entry, index) => {
    if (typeof entry === 'string') {
      const model = entry.trim();
      if (!isValidModelId(model)) {
        throw new Error(`${label}.fallback_models[${index}] must be provider-qualified.`);
      }
      return model;
    }

    if (!isPlainObject(entry) || typeof entry.model !== 'string') {
      throw new Error(`${label}.fallback_models[${index}] must be a model string or object with a model field.`);
    }

    const model = entry.model.trim();
    if (!isValidModelId(model)) {
      throw new Error(`${label}.fallback_models[${index}].model must be provider-qualified.`);
    }

    return {
      model,
      ...(typeof entry.variant === 'string' && entry.variant.trim().length > 0 ? { variant: entry.variant.trim() } : {}),
    };
  });
}

function normalizeAutoFallback(autoFallback, label) {
  if (autoFallback === undefined) {
    return undefined;
  }

  if (!isPlainObject(autoFallback)) {
    throw new Error(`${label}.auto_fallback must be an object when provided.`);
  }

  return { ...autoFallback };
}

function normalizeModelEntry(entry, label) {
  if (!isPlainObject(entry)) {
    throw new Error(`${label} must be an object.`);
  }

  if (typeof entry.model !== 'string' || entry.model.trim().length === 0) {
    throw new Error(`${label}.model must be a non-empty string.`);
  }

  const model = entry.model.trim();
  if (!isValidModelId(model)) {
    throw new Error(`${label}.model must be provider-qualified.`);
  }

  if (Object.hasOwn(entry, 'variant') && typeof entry.variant !== 'string') {
    throw new Error(`${label}.variant must be a string when provided.`);
  }

  const fallbackModels = normalizeFallbackModels(entry.fallback_models, label);
  const autoFallback = normalizeAutoFallback(entry.auto_fallback, label);

  return {
    model,
    ...(typeof entry.variant === 'string' && entry.variant.trim().length > 0 ? { variant: entry.variant.trim() } : {}),
    ...(fallbackModels !== undefined && fallbackModels.length > 0 ? { fallback_models: fallbackModels } : {}),
    ...(autoFallback !== undefined ? { auto_fallback: autoFallback } : {}),
  };
}

function normalizeAgentModels(agentModels = {}, { knownAgentIds, pathPrefix = null } = {}) {
  const agentModelsPath = pathPrefix ? `${pathPrefix}.agentModels` : 'agentModels';
  const objectLabel = pathPrefix ? agentModelsPath : 'Profile agentModels';

  if (!isPlainObject(agentModels)) {
    throw new Error(`${objectLabel} must be an object.`);
  }

  const knownAgents = toKnownAgentSet(knownAgentIds);
  const normalizedEntries = Object.entries(agentModels).map(([agentId, entry]) => {
    validateKnownAgentId(agentId, knownAgents);
    return [agentId, normalizeModelEntry(entry, `${agentModelsPath}.${agentId}`)];
  });

  return Object.fromEntries(normalizedEntries);
}

function scopeProfileValidationWarning(profileName, message) {
  const normalizedMessage = typeof message === 'string' && message.length > 0 ? message : 'unknown validation error.';
  const profilePrefix = `profiles.${profileName}.`;

  if (normalizedMessage.startsWith(profilePrefix)) {
    return normalizedMessage;
  }

  return `${profilePrefix}${normalizedMessage}`;
}

function validateProfileStoreShape(store, { knownAgentIds } = {}) {
  const warnings = [];

  if (!isPlainObject(store)) {
    return ['Agent model profile store must be a JSON object.'];
  }

  if (store.schema !== undefined && store.schema !== AGENT_MODEL_PROFILES_SCHEMA) {
    warnings.push(`schema should be ${AGENT_MODEL_PROFILES_SCHEMA}.`);
  }

  if (store.stateVersion !== undefined && store.stateVersion !== 1) {
    warnings.push('stateVersion should be 1.');
  }

  if (!isPlainObject(store.profiles)) {
    warnings.push('profiles is missing or malformed; OpenKit will treat it as empty.');
    return warnings;
  }

  if (typeof store.defaultProfile === 'string' && !Object.hasOwn(store.profiles, store.defaultProfile)) {
    warnings.push(`defaultProfile ${store.defaultProfile} does not reference an existing profile.`);
  }

  for (const [profileName, profile] of Object.entries(store.profiles)) {
    if (!isPlainObject(profile)) {
      warnings.push(`profiles.${profileName}.profile must be an object.`);
      continue;
    }

    if (typeof profile.name !== 'string' || profile.name.trim().length === 0) {
      warnings.push(`profiles.${profileName}.name must be a non-empty string.`);
    } else if (profile.name !== profileName) {
      warnings.push(`profiles.${profileName}.name must match its key.`);
    }

    try {
      normalizeAgentModels(profile.agentModels, { knownAgentIds, pathPrefix: `profiles.${profileName}` });
    } catch (error) {
      warnings.push(scopeProfileValidationWarning(profileName, error instanceof Error ? error.message : String(error)));
    }
  }

  return warnings;
}

function profileFromInput(input, { existingProfile = null, knownAgentIds, now = defaultNow } = {}) {
  if (!isPlainObject(input)) {
    throw new Error('Profile must be an object.');
  }

  const timestamp = now();
  const name = normalizeProfileName(input.name ?? existingProfile?.name);
  const description = normalizeOptionalDescription(input.description ?? existingProfile?.description);
  const agentModels = normalizeAgentModels(input.agentModels ?? existingProfile?.agentModels ?? {}, { knownAgentIds });

  return {
    name,
    ...(description ? { description } : {}),
    agentModels,
    createdAt: typeof existingProfile?.createdAt === 'string' ? existingProfile.createdAt : timestamp,
    updatedAt: timestamp,
  };
}

function createEmptyAgentModelProfiles() {
  return {
    schema: AGENT_MODEL_PROFILES_SCHEMA,
    stateVersion: 1,
    updatedAt: defaultNow(),
    defaultProfile: null,
    profiles: {},
  };
}

function normalizeStoreForWrite(store, { now = defaultNow } = {}) {
  return {
    schema: AGENT_MODEL_PROFILES_SCHEMA,
    stateVersion: 1,
    updatedAt: now(),
    defaultProfile: typeof store.defaultProfile === 'string' ? store.defaultProfile : null,
    profiles: isPlainObject(store.profiles) ? store.profiles : {},
  };
}

function writeAgentModelProfiles(profilesPath, store, options = {}) {
  const normalized = normalizeStoreForWrite(store, options);
  writeJson(profilesPath, normalized);
  return normalized;
}

function assertProfileNotActiveInRunningSessions(profileName, workspacesRoot) {
  const activeSessions = findRunningAgentModelProfileSessions({ profileName, workspacesRoot });
  if (activeSessions.length === 0) {
    return;
  }

  const sessionList = activeSessions
    .map((session) => session.sessionId ?? 'unknown-session')
    .join(', ');
  throw new Error(
    `Cannot delete profile ${profileName} because it is active in running OpenKit sessions: ${sessionList}. ` +
    'Exit affected sessions first, then retry deletion.'
  );
}

function modelEntryFromSetting(value) {
  if (!isPlainObject(value) || typeof value.model !== 'string' || value.model.trim().length === 0) {
    return null;
  }

  return {
    model: value.model,
    ...(typeof value.variant === 'string' && value.variant.length > 0 ? { variant: value.variant } : {}),
    ...(Array.isArray(value.fallback_models) && value.fallback_models.length > 0
      ? { fallback_models: value.fallback_models }
      : {}),
    ...(isPlainObject(value.auto_fallback) ? { auto_fallback: value.auto_fallback } : {}),
    ...(Array.isArray(value.profiles) && value.profiles.length > 0 ? { profiles: value.profiles } : {}),
  };
}

function overridesFromAgentModels(agentModels) {
  const entries = Object.entries(agentModels ?? {})
    .map(([agentId, value]) => [agentId, modelEntryFromSetting(value)])
    .filter(([, value]) => value !== null);

  if (entries.length === 0) {
    return {};
  }

  return {
    agent: Object.fromEntries(entries),
  };
}

function getAvailableModelIds(availableModels) {
  if (!Array.isArray(availableModels)) {
    return null;
  }

  return new Set(
    availableModels
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (isPlainObject(entry) && typeof entry.modelId === 'string') {
          return entry.modelId;
        }
        if (isPlainObject(entry) && typeof entry.model === 'string') {
          return entry.model;
        }
        return null;
      })
      .filter(Boolean)
  );
}

function collectEntryModels(entry) {
  const refs = [];

  if (typeof entry.model === 'string') {
    refs.push({ field: 'model', model: entry.model });
  }

  if (Array.isArray(entry.fallback_models)) {
    for (const [index, fallbackEntry] of entry.fallback_models.entries()) {
      if (typeof fallbackEntry === 'string') {
        refs.push({ field: `fallback_models[${index}]`, model: fallbackEntry });
      } else if (isPlainObject(fallbackEntry) && typeof fallbackEntry.model === 'string') {
        refs.push({ field: `fallback_models[${index}]`, model: fallbackEntry.model });
      }
    }
  }

  return refs;
}

function readJsonQuietly(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function deriveRuntimeRootFromSessionIndex(sessionIndexPath) {
  return path.resolve(path.dirname(sessionIndexPath), '..', '..');
}

function getSessionProfileStatePath(runtimeRoot, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return null;
  }

  return path.join(
    runtimeRoot,
    '.opencode',
    'runtime-sessions',
    encodeURIComponent(sessionId),
    'active-agent-model-profile.json'
  );
}

function isRunningSessionRecord(session) {
  if (session?.status === 'running' || session?.running === true) {
    return true;
  }

  if (TERMINAL_SESSION_STATUSES.has(session?.status) || session?.running === false) {
    return false;
  }

  if (typeof session?.exitCode === 'number') {
    return false;
  }

  return true;
}

function activeProfileNameFromMetadata(metadata) {
  if (typeof metadata === 'string') {
    return metadata;
  }

  if (isPlainObject(metadata) && typeof metadata.name === 'string') {
    return metadata.name;
  }

  return null;
}

function collectRuntimeSessionIndexPaths(workspacesRoot) {
  if (typeof workspacesRoot !== 'string' || !fs.existsSync(workspacesRoot)) {
    return [];
  }

  return fs.readdirSync(workspacesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workspacesRoot, entry.name, 'openkit', '.opencode', 'runtime-sessions', 'index.json'))
    .filter((sessionIndexPath) => fs.existsSync(sessionIndexPath));
}

export function readAgentModelProfiles(profilesPath, options = {}) {
  const store = readJsonIfPresent(profilesPath);
  if (!store) {
    return createEmptyAgentModelProfiles();
  }

  const profiles = isPlainObject(store.profiles) ? store.profiles : {};
  const warnings = validateProfileStoreShape(store, options);

  return {
    schema: AGENT_MODEL_PROFILES_SCHEMA,
    stateVersion: 1,
    updatedAt: typeof store.updatedAt === 'string' ? store.updatedAt : null,
    defaultProfile: typeof store.defaultProfile === 'string' ? store.defaultProfile : null,
    profiles,
    warnings,
  };
}

export function listAgentModelProfiles(profilesPath) {
  const store = readAgentModelProfiles(profilesPath);

  return Object.values(store.profiles)
    .map((profile) => ({
      name: profile.name,
      description: typeof profile.description === 'string' ? profile.description : null,
      agentCount: isPlainObject(profile.agentModels) ? Object.keys(profile.agentModels).length : 0,
      isDefault: profile.name === store.defaultProfile,
      createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : null,
      updatedAt: typeof profile.updatedAt === 'string' ? profile.updatedAt : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createAgentModelProfile(profilesPath, profileInput, options = {}) {
  const store = readAgentModelProfiles(profilesPath, options);
  const profile = profileFromInput(profileInput, options);

  if (Object.hasOwn(store.profiles, profile.name)) {
    throw new Error(`Profile ${profile.name} already exists.`);
  }

  const nextStore = {
    ...store,
    profiles: {
      ...store.profiles,
      [profile.name]: profile,
    },
  };

  return writeAgentModelProfiles(profilesPath, nextStore, options);
}

export function updateAgentModelProfile(profilesPath, profileName, profileInput, options = {}) {
  const store = readAgentModelProfiles(profilesPath, options);
  const normalizedName = normalizeProfileName(profileName);
  const existingProfile = store.profiles[normalizedName];

  if (!existingProfile) {
    throw new Error(`Profile ${normalizedName} does not exist.`);
  }

  const profile = profileFromInput(
    {
      ...profileInput,
      name: profileInput?.name ?? normalizedName,
    },
    { ...options, existingProfile }
  );

  if (profile.name !== normalizedName && Object.hasOwn(store.profiles, profile.name)) {
    throw new Error(`Profile ${profile.name} already exists.`);
  }

  const nextProfiles = { ...store.profiles };
  delete nextProfiles[normalizedName];
  nextProfiles[profile.name] = profile;

  const nextStore = {
    ...store,
    defaultProfile: store.defaultProfile === normalizedName ? profile.name : store.defaultProfile,
    profiles: nextProfiles,
  };

  return writeAgentModelProfiles(profilesPath, nextStore, options);
}

export function deleteAgentModelProfile(profilesPath, profileName, options = {}) {
  const store = readAgentModelProfiles(profilesPath, options);
  const normalizedName = normalizeProfileName(profileName);

  if (!store.profiles[normalizedName]) {
    throw new Error(`Profile ${normalizedName} does not exist.`);
  }

  if (store.defaultProfile === normalizedName) {
    throw new Error(`Cannot delete default profile ${normalizedName}. Set another default first.`);
  }

  if (options.workspacesRoot !== undefined && options.workspacesRoot !== null) {
    assertProfileNotActiveInRunningSessions(normalizedName, options.workspacesRoot);
  }

  const nextProfiles = { ...store.profiles };
  delete nextProfiles[normalizedName];

  return writeAgentModelProfiles(
    profilesPath,
    {
      ...store,
      profiles: nextProfiles,
    },
    options
  );
}

export function getDefaultAgentModelProfile(profilesPath) {
  return readAgentModelProfiles(profilesPath).defaultProfile;
}

export function setDefaultAgentModelProfile(profilesPath, profileName, options = {}) {
  const store = readAgentModelProfiles(profilesPath, options);
  const normalizedName = normalizeProfileName(profileName);

  if (!store.profiles[normalizedName]) {
    throw new Error(`Profile ${normalizedName} does not exist.`);
  }

  return writeAgentModelProfiles(
    profilesPath,
    {
      ...store,
      defaultProfile: normalizedName,
    },
    options
  );
}

export function resolveAgentModelProfileConfig({
  baseSettings = null,
  profileStore = null,
  activeProfileName = null,
} = {}) {
  const baseAgentModels = isPlainObject(baseSettings?.agentModels) ? baseSettings.agentModels : {};
  const store = isPlainObject(profileStore) ? profileStore : { defaultProfile: null, profiles: {} };
  const profiles = isPlainObject(store.profiles) ? store.profiles : {};
  const requestedProfileName = activeProfileName ?? store.defaultProfile ?? null;
  const warnings = [];

  let activeProfile = null;
  if (requestedProfileName) {
    activeProfile = profiles[requestedProfileName] ?? null;
    if (!activeProfile) {
      warnings.push(`Profile ${requestedProfileName} does not exist; using base agent model settings.`);
    }
  }

  const resolvedAgentModels = {
    ...baseAgentModels,
    ...(isPlainObject(activeProfile?.agentModels) ? activeProfile.agentModels : {}),
  };

  return {
    activeProfileName: activeProfile?.name ?? null,
    agentModels: resolvedAgentModels,
    overrides: overridesFromAgentModels(resolvedAgentModels),
    warnings,
  };
}

export function buildAgentModelProfileConfigOverrides({ baseSettingsPath, profilesPath, activeProfileName = null } = {}) {
  const baseSettings = baseSettingsPath ? readAgentModelSettings(baseSettingsPath) : null;
  const profileStore = profilesPath ? readAgentModelProfiles(profilesPath) : null;

  if (!profilesPath) {
    return baseSettingsPath ? buildAgentModelConfigOverrides(baseSettingsPath) : {};
  }

  return resolveAgentModelProfileConfig({ baseSettings, profileStore, activeProfileName }).overrides;
}

export function detectStaleAgentModelProfileReferences(profileStore, availableModels) {
  const availableModelIds = getAvailableModelIds(availableModels);
  if (!availableModelIds) {
    return [];
  }

  const profiles = isPlainObject(profileStore?.profiles) ? profileStore.profiles : {};
  const stale = [];

  for (const [profileName, profile] of Object.entries(profiles)) {
    const agentModels = isPlainObject(profile.agentModels) ? profile.agentModels : {};
    for (const [agentId, entry] of Object.entries(agentModels)) {
      for (const reference of collectEntryModels(entry)) {
        if (!availableModelIds.has(reference.model)) {
          stale.push({
            profileName,
            agentId,
            field: reference.field,
            model: reference.model,
          });
        }
      }
    }
  }

  return stale;
}

export function findRunningAgentModelProfileSessions({ profileName, workspacesRoot } = {}) {
  const normalizedName = normalizeProfileName(profileName);
  const matches = [];

  for (const sessionIndexPath of collectRuntimeSessionIndexPaths(workspacesRoot)) {
    const sessionIndex = readJsonQuietly(sessionIndexPath);
    const sessions = Array.isArray(sessionIndex?.sessions) ? sessionIndex.sessions : [];

    for (const session of sessions) {
      if (!isRunningSessionRecord(session)) {
        continue;
      }

      const activeSources = [];
      if (activeProfileNameFromMetadata(session.activeAgentModelProfile) === normalizedName) {
        activeSources.push(session.activeAgentModelProfile?.source ?? 'launch_metadata');
      }

      const runtimeRoot = typeof session.runtimeRoot === 'string'
        ? session.runtimeRoot
        : deriveRuntimeRootFromSessionIndex(sessionIndexPath);
      const sessionProfileStatePath = getSessionProfileStatePath(runtimeRoot, session.session_id);
      const sessionProfileState = sessionProfileStatePath ? readJsonQuietly(sessionProfileStatePath) : null;
      if (sessionProfileState?.profileName === normalizedName) {
        activeSources.push(sessionProfileState.source ?? 'switch_profiles');
      }

      if (activeSources.length > 0) {
        matches.push({
          sessionId: session.session_id ?? null,
          recordedAt: session.recorded_at ?? null,
          workspaceId: path.basename(path.dirname(path.dirname(path.dirname(path.dirname(sessionIndexPath))))),
          runtimeRoot,
          sources: [...new Set(activeSources)],
        });
      }
    }
  }

  return matches;
}
