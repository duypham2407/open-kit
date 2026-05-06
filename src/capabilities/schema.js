import { assertCapabilityGraph, assertCapabilityGraphNode, buildCapabilityGraph } from './capability-graph.js';
import { assertMcpCatalogEntry, listMcpCatalogEntries } from './mcp-catalog.js';
import { assertSkillCatalogValid, listCanonicalSkillMetadata } from './skill-catalog.js';

export function validateMcpCatalog(entries = listMcpCatalogEntries()) {
  return entries.map(assertMcpCatalogEntry);
}

export function validateSkillCatalog(entries = listCanonicalSkillMetadata()) {
  return assertSkillCatalogValid(entries);
}

export function validateCapabilityGraph(graph = buildCapabilityGraph()) {
  return assertCapabilityGraph(graph);
}

export function validateCapabilityGraphNode(node) {
  return assertCapabilityGraphNode(node);
}
