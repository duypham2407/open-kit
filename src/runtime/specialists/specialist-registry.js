import { deepMergeConfig } from '../../global/config-merge.js';
import { createExploreSpecialist } from './explore.js';
import { createLibrarianSpecialist } from './librarian.js';
import { createMetisSpecialist } from './metis.js';
import { createMomusSpecialist } from './momus.js';
import { createMultimodalLookerSpecialist } from './multimodal-looker.js';
import { createOracleSpecialist } from './oracle.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function hydrateSpecialistPrompts(entry) {
  if (!entry?.systemPromptPath || typeof entry.systemPromptPath !== 'string') {
    return entry;
  }

  const promptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), entry.systemPromptPath);
  if (!fs.existsSync(promptPath)) {
    return {
      ...entry,
      systemPrompt: null,
    };
  }

  return {
    ...entry,
    systemPrompt: fs.readFileSync(promptPath, 'utf8'),
  };
}

export function createSpecialistRegistry(config = {}) {
  const defaults = [
    createOracleSpecialist(),
    createLibrarianSpecialist(),
    createExploreSpecialist(),
    createMultimodalLookerSpecialist(),
    createMetisSpecialist(),
    createMomusSpecialist(),
  ];
  const disabled = new Set(config.disabled?.agents ?? []);
  const specialists = defaults
    .map((entry) => deepMergeConfig(entry, config.agents?.[entry.id] ?? {}))
    .map((entry) => hydrateSpecialistPrompts(entry))
    .filter((entry) => !disabled.has(entry.id));

  return {
    specialists,
    byId: Object.fromEntries(specialists.map((entry) => [entry.id, entry])),
  };
}
