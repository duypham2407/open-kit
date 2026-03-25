import fs from 'node:fs';
import path from 'node:path';

const AGENT_MODEL_SETTINGS_SCHEMA = 'openkit/agent-model-settings@1';

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

function deriveAgentNameFromPath(agentPath) {
  return path.basename(agentPath, path.extname(agentPath));
}

export function isValidModelId(model) {
  if (typeof model !== 'string') {
    return false;
  }

  const trimmed = model.trim();
  if (!trimmed.includes('/')) {
    return false;
  }

  const [provider, modelId] = trimmed.split('/', 2);
  return provider.length > 0 && modelId.length > 0;
}

export function readAgentCatalog(registryPath) {
  const registry = readJsonIfPresent(registryPath);
  const agents = Array.isArray(registry?.components?.agents) ? registry.components.agents : [];

  return agents.map((agent) => ({
    id: deriveAgentNameFromPath(agent.path),
    name: agent.name,
    role: agent.role,
    path: agent.path,
    registryId: agent.id,
  }));
}

export function createEmptyAgentModelSettings() {
  return {
    schema: AGENT_MODEL_SETTINGS_SCHEMA,
    stateVersion: 1,
    updatedAt: new Date().toISOString(),
    agentModels: {},
  };
}

export function readAgentModelSettings(settingsPath) {
  const settings = readJsonIfPresent(settingsPath);
  if (!settings) {
    return createEmptyAgentModelSettings();
  }

  const agentModels = isPlainObject(settings.agentModels) ? settings.agentModels : {};
  return {
    schema: AGENT_MODEL_SETTINGS_SCHEMA,
    stateVersion: 1,
    updatedAt: typeof settings.updatedAt === 'string' ? settings.updatedAt : null,
    agentModels,
  };
}

export function writeAgentModelSettings(settingsPath, settings) {
  writeJson(settingsPath, {
    schema: AGENT_MODEL_SETTINGS_SCHEMA,
    stateVersion: 1,
    updatedAt: new Date().toISOString(),
    agentModels: settings.agentModels,
  });
}

export function setAgentModel(settingsPath, agentId, model) {
  const settings = readAgentModelSettings(settingsPath);
  settings.agentModels = {
    ...settings.agentModels,
    [agentId]: {
      model,
    },
  };
  writeAgentModelSettings(settingsPath, settings);
  return settings;
}

export function clearAgentModel(settingsPath, agentId) {
  const settings = readAgentModelSettings(settingsPath);
  const nextModels = { ...settings.agentModels };
  delete nextModels[agentId];
  settings.agentModels = nextModels;
  writeAgentModelSettings(settingsPath, settings);
  return settings;
}

export function buildAgentModelConfigOverrides(settingsPath) {
  const settings = readAgentModelSettings(settingsPath);
  const agentEntries = Object.entries(settings.agentModels)
    .filter(([, value]) => isPlainObject(value) && typeof value.model === 'string' && value.model.length > 0)
    .map(([agentId, value]) => [agentId, { model: value.model }]);

  if (agentEntries.length === 0) {
    return {};
  }

  return {
    agent: Object.fromEntries(agentEntries),
  };
}
