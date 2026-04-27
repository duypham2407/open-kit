import { assertMcpCatalogEntry, listMcpCatalogEntries } from './mcp-catalog.js';
import { assertSkillCatalogValid, listCanonicalSkillMetadata } from './skill-catalog.js';

export function validateMcpCatalog(entries = listMcpCatalogEntries()) {
  return entries.map(assertMcpCatalogEntry);
}

export function validateSkillCatalog(entries = listCanonicalSkillMetadata()) {
  return assertSkillCatalogValid(entries);
}
