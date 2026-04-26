import { assertMcpCatalogEntry, listMcpCatalogEntries } from './mcp-catalog.js';
import { listBundledSkills } from './skill-catalog.js';
import { STANDARD_CAPABILITY_STATES } from './status.js';

export function validateMcpCatalog(entries = listMcpCatalogEntries()) {
  return entries.map(assertMcpCatalogEntry);
}

export function validateSkillCatalog(entries = listBundledSkills()) {
  for (const entry of entries) {
    if (!entry?.id?.startsWith('skill.')) {
      throw new Error('Skill catalog entry requires a skill.* id.');
    }
    if (!STANDARD_CAPABILITY_STATES.includes(entry.status)) {
      throw new Error(`Skill catalog entry '${entry.name}' has unsupported status '${entry.status}'.`);
    }
  }

  return entries;
}
