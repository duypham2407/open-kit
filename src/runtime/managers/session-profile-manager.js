import fs from 'node:fs';
import path from 'node:path';

import {
  readAgentModelProfiles,
  resolveAgentModelProfileConfig,
} from '../../global/agent-model-profiles.js';
import { readAgentModelSettings } from '../../global/agent-models.js';
import { getGlobalPaths, getWorkspacePaths } from '../../global/paths.js';
import { normalizeRuntimeSessionId } from '../runtime-session-id.js';

const ACTIVE_PROFILE_SCHEMA = 'openkit/active-agent-model-profile@1';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createEmptyActiveProfileState({ workspaceId = null } = {}) {
  return {
    schema: ACTIVE_PROFILE_SCHEMA,
    stateVersion: 1,
    profileName: null,
    selectedAt: null,
    source: null,
    workspaceId,
    sessionId: null,
  };
}

function createSessionProfileStatePath(runtimeRoot, sessionId) {
  return path.join(runtimeRoot, '.opencode', 'runtime-sessions', encodeURIComponent(sessionId), 'active-agent-model-profile.json');
}

function normalizeProfileName(profileName) {
  return typeof profileName === 'string' ? profileName.trim() : '';
}

function activeProfileWarnings(warnings, profileName) {
  if (!Array.isArray(warnings) || !profileName) {
    return [];
  }

  return warnings.filter((warning) => typeof warning === 'string' && warning.startsWith(`profiles.${profileName}.`));
}

export class SessionProfileManager {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write', env = process.env } = {}) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.env = env;
    this.sessionId = normalizeRuntimeSessionId(env.OPENKIT_RUNTIME_SESSION_ID);
    this.globalPaths = getGlobalPaths({ env });
    this.workspacePaths = getWorkspacePaths({ projectRoot, env });
    this.filePath = this.sessionId ? createSessionProfileStatePath(runtimeRoot, this.sessionId) : null;
  }

  getActiveProfileState() {
    if (!this.sessionId) {
      return createEmptyActiveProfileState({ workspaceId: this.workspacePaths.workspaceId });
    }

    const state = readJsonIfExists(this.filePath);
    if (!isPlainObject(state)) {
      return {
        ...createEmptyActiveProfileState({ workspaceId: this.workspacePaths.workspaceId }),
        sessionId: this.sessionId,
      };
    }

    return {
      schema: ACTIVE_PROFILE_SCHEMA,
      stateVersion: 1,
      profileName: typeof state.profileName === 'string' ? state.profileName : null,
      selectedAt: typeof state.selectedAt === 'string' ? state.selectedAt : null,
      source: typeof state.source === 'string' ? state.source : null,
      workspaceId: typeof state.workspaceId === 'string' ? state.workspaceId : this.workspacePaths.workspaceId,
      sessionId: this.sessionId,
    };
  }

  listProfiles() {
    const store = readAgentModelProfiles(this.globalPaths.agentModelProfilesPath);
    return Object.values(store.profiles)
      .map((profile) => ({
        name: profile.name,
        description: typeof profile.description === 'string' ? profile.description : null,
        agentCount: isPlainObject(profile.agentModels) ? Object.keys(profile.agentModels).length : 0,
        isDefault: profile.name === store.defaultProfile,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  applyProfile(profileName, { source = 'switch_profiles' } = {}) {
    if (!this.sessionId) {
      return {
        status: 'session-id-required',
        message: 'Profile switching requires OPENKIT_RUNTIME_SESSION_ID for current-session scoping.',
        activeProfileState: this.getActiveProfileState(),
      };
    }

    const normalizedName = normalizeProfileName(profileName);
    const profileStore = readAgentModelProfiles(this.globalPaths.agentModelProfilesPath);
    const profile = profileStore.profiles[normalizedName] ?? null;

    if (!profile) {
      return {
        status: 'not-found',
        message: normalizedName
          ? `Profile ${normalizedName} does not exist.`
          : 'Profile name is required.',
      };
    }

    const scopedWarnings = activeProfileWarnings(profileStore.warnings, normalizedName);
    if (scopedWarnings.length > 0) {
      return {
        status: 'apply-failed',
        message: `Profile ${normalizedName} could not be applied safely.`,
        warnings: scopedWarnings,
      };
    }

    const baseSettings = readAgentModelSettings(this.globalPaths.agentModelSettingsPath);
    const resolved = resolveAgentModelProfileConfig({
      baseSettings,
      profileStore,
      activeProfileName: normalizedName,
    });

    if (resolved.activeProfileName !== normalizedName) {
      return {
        status: 'apply-failed',
        message: `Profile ${normalizedName} could not be applied safely.`,
        warnings: resolved.warnings,
      };
    }

    const state = {
      schema: ACTIVE_PROFILE_SCHEMA,
      stateVersion: 1,
      profileName: normalizedName,
      selectedAt: new Date().toISOString(),
      source,
      workspaceId: this.workspacePaths.workspaceId,
      sessionId: this.sessionId,
    };

    if (this.mode !== 'read-only') {
      writeJson(this.filePath, state);
    }

    return {
      status: 'ok',
      activeProfile: {
        name: normalizedName,
        source,
        storePath: this.globalPaths.agentModelProfilesPath,
        appliedAgentIds: Object.keys(profile.agentModels ?? {}).sort(),
      },
      state,
      effectiveOverrides: resolved.overrides,
      warnings: resolved.warnings,
    };
  }
}
