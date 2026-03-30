import { createExploreSpecialist } from './explore.js';
import { createLibrarianSpecialist } from './librarian.js';
import { createMetisSpecialist } from './metis.js';
import { createMomusSpecialist } from './momus.js';
import { createMultimodalLookerSpecialist } from './multimodal-looker.js';
import { createOracleSpecialist } from './oracle.js';

export function createSpecialistRegistry() {
  const specialists = [
    createOracleSpecialist(),
    createLibrarianSpecialist(),
    createExploreSpecialist(),
    createMultimodalLookerSpecialist(),
    createMetisSpecialist(),
    createMomusSpecialist(),
  ];

  return {
    specialists,
    byId: Object.fromEntries(specialists.map((entry) => [entry.id, entry])),
  };
}
