import { createCodeSearchMcp } from './code-search.js';
import { createDocsSearchMcp } from './docs-search.js';
import { createWebsearchMcp } from './websearch.js';

export function listBuiltinMcps() {
  return [createWebsearchMcp(), createDocsSearchMcp(), createCodeSearchMcp()];
}
