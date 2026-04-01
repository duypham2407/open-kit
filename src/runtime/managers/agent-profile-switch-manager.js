import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function createEmptyState() {
  return {
    schema: 'openkit/agent-profile-switch-state@1',
    stateVersion: 1,
    updatedAt: new Date().toISOString(),
    manualSelections: {},
  };
}

export class AgentProfileSwitchManager {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.filePath = path.join(runtimeRoot, '.opencode', 'agent-profile-switches.json');
  }

  readState() {
    const state = readJsonIfExists(this.filePath);
    return isPlainObject(state) && isPlainObject(state.manualSelections)
      ? {
          schema: 'openkit/agent-profile-switch-state@1',
          stateVersion: 1,
          updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null,
          manualSelections: state.manualSelections,
        }
      : createEmptyState();
  }

  writeState(state) {
    if (this.mode === 'read-only') {
      return state;
    }

    writeJson(this.filePath, {
      schema: 'openkit/agent-profile-switch-state@1',
      stateVersion: 1,
      updatedAt: new Date().toISOString(),
      manualSelections: state.manualSelections,
    });
    return state;
  }

  get(agentId) {
    return this.readState().manualSelections[agentId] ?? null;
  }

  list() {
    return this.readState().manualSelections;
  }

  validateProfileIndex(profileIndex, maxProfiles = 2) {
    if (!Number.isInteger(profileIndex) || profileIndex < 0 || profileIndex >= maxProfiles) {
      throw new Error(`profile-switch received an invalid profileIndex. Expected 0-${Math.max(0, maxProfiles - 1)}.`);
    }
  }

  set(agentId, profileIndex, maxProfiles = 2) {
    this.validateProfileIndex(profileIndex, maxProfiles);
    const state = this.readState();
    state.manualSelections[agentId] = {
      agentId,
      profileIndex,
      updatedAt: new Date().toISOString(),
    };
    this.writeState(state);
    return state.manualSelections[agentId];
  }

  clear(agentId) {
    const state = this.readState();
    delete state.manualSelections[agentId];
    this.writeState(state);
    return null;
  }

  toggle(agentId, maxProfiles = 2) {
    const current = this.get(agentId);
    const nextIndex = current?.profileIndex === 1 ? 0 : Math.min(1, Math.max(0, maxProfiles - 1));
    return this.set(agentId, nextIndex, maxProfiles);
  }
}
