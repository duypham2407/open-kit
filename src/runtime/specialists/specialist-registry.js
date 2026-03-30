import { deepMergeConfig } from '../../global/config-merge.js';
import { createExploreSpecialist } from './explore.js';
import { createLibrarianSpecialist } from './librarian.js';
import { createMetisSpecialist } from './metis.js';
import { createMomusSpecialist } from './momus.js';
import { createMultimodalLookerSpecialist } from './multimodal-looker.js';
import { createOracleSpecialist } from './oracle.js';

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
    .filter((entry) => !disabled.has(entry.id));

  return {
    specialists,
    byId: Object.fromEntries(specialists.map((entry) => [entry.id, entry])),
  };
}
