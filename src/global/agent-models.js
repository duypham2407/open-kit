import fs from 'node:fs';
import path from 'node:path';

import { validateAgentModelSettings } from '../runtime/config-validation.js';

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

function normalizeProfileEntry(entry) {
  if (!isPlainObject(entry) || typeof entry.model !== 'string' || entry.model.trim().length === 0) {
    return null;
  }

  return {
    model: entry.model,
    ...(typeof entry.variant === 'string' && entry.variant.length > 0 ? { variant: entry.variant } : {}),
    ...(Array.isArray(entry.fallback_models) && entry.fallback_models.length > 0 ? { fallback_models: entry.fallback_models } : {}),
    ...(isPlainObject(entry.auto_fallback) ? { auto_fallback: entry.auto_fallback } : {}),
  };
}

function normalizeProfiles(profiles = []) {
  return (Array.isArray(profiles) ? profiles : [profiles]).map(normalizeProfileEntry).filter(Boolean).slice(0, 2);
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

  return agents
    .filter((agent) => agent?.status !== 'compatibility-only' && agent?.audience !== 'compatibility')
    .map((agent) => ({
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

  const warnings = validateAgentModelSettings(settings);

  const agentModels = isPlainObject(settings.agentModels) ? settings.agentModels : {};
  return {
    schema: AGENT_MODEL_SETTINGS_SCHEMA,
    stateVersion: 1,
    updatedAt: typeof settings.updatedAt === 'string' ? settings.updatedAt : null,
    agentModels,
    warnings,
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

export function setAgentModel(settingsPath, agentId, model, variant = null) {
  const settings = readAgentModelSettings(settingsPath);
  const current = isPlainObject(settings.agentModels[agentId]) ? settings.agentModels[agentId] : {};
  settings.agentModels = {
    ...settings.agentModels,
    [agentId]: {
      ...current,
      model,
      ...(typeof variant === 'string' && variant.length > 0 ? { variant } : {}),
    },
  };
  writeAgentModelSettings(settingsPath, settings);
  return settings;
}

export function setAgentModelProfiles(settingsPath, agentId, profiles = []) {
  const settings = readAgentModelSettings(settingsPath);
  const current = isPlainObject(settings.agentModels[agentId]) ? settings.agentModels[agentId] : {};
  const normalizedProfiles = normalizeProfiles(profiles);
  const primaryProfile = normalizedProfiles[0] ?? null;

  settings.agentModels = {
    ...settings.agentModels,
    [agentId]: {
      ...current,
      ...(primaryProfile?.model ? { model: primaryProfile.model } : {}),
      ...(primaryProfile?.variant ? { variant: primaryProfile.variant } : {}),
      ...(primaryProfile?.fallback_models ? { fallback_models: primaryProfile.fallback_models } : {}),
      ...(primaryProfile?.auto_fallback ? { auto_fallback: primaryProfile.auto_fallback } : {}),
      ...(normalizedProfiles.length > 0 ? { profiles: normalizedProfiles } : {}),
    },
  };

  writeAgentModelSettings(settingsPath, settings);
  return settings;
}

export function setAgentFallbackModels(settingsPath, agentId, fallbackModels = []) {
  const settings = readAgentModelSettings(settingsPath);
  const current = isPlainObject(settings.agentModels[agentId]) ? settings.agentModels[agentId] : {};
  const normalizedFallbackModels = (Array.isArray(fallbackModels) ? fallbackModels : [fallbackModels]).filter(
    (entry) =>
      (typeof entry === 'string' && entry.trim().length > 0) ||
      (isPlainObject(entry) && typeof entry.model === 'string' && entry.model.trim().length > 0)
  );

  settings.agentModels = {
    ...settings.agentModels,
    [agentId]: {
      ...current,
      ...(typeof current.model === 'string' && current.model.length > 0 ? { model: current.model } : {}),
      ...(typeof current.variant === 'string' && current.variant.length > 0 ? { variant: current.variant } : {}),
      ...(normalizedFallbackModels.length > 0 ? { fallback_models: normalizedFallbackModels } : {}),
    },
  };

  writeAgentModelSettings(settingsPath, settings);
  return settings;
}

export function setAgentAutoFallback(settingsPath, agentId, autoFallback = null) {
  const settings = readAgentModelSettings(settingsPath);
  const current = isPlainObject(settings.agentModels[agentId]) ? settings.agentModels[agentId] : {};

  settings.agentModels = {
    ...settings.agentModels,
    [agentId]: {
      ...current,
      ...(typeof current.model === 'string' && current.model.length > 0 ? { model: current.model } : {}),
      ...(typeof current.variant === 'string' && current.variant.length > 0 ? { variant: current.variant } : {}),
      ...(Array.isArray(current.fallback_models) && current.fallback_models.length > 0
        ? { fallback_models: current.fallback_models }
        : {}),
      ...(autoFallback && typeof autoFallback === 'object' ? { auto_fallback: autoFallback } : {}),
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
    .map(([agentId, value]) => [
      agentId,
      {
        model: value.model,
        ...(typeof value.variant === 'string' && value.variant.length > 0 ? { variant: value.variant } : {}),
        ...(Array.isArray(value.fallback_models) && value.fallback_models.length > 0
          ? { fallback_models: value.fallback_models }
          : {}),
        ...(isPlainObject(value.auto_fallback) ? { auto_fallback: value.auto_fallback } : {}),
        ...(Array.isArray(value.profiles) && value.profiles.length > 0
          ? { profiles: normalizeProfiles(value.profiles) }
          : {}),
      },
    ]);

  if (agentEntries.length === 0) {
    return {};
  }

  return {
    agent: Object.fromEntries(agentEntries),
  };
}
