import { createCodeSearchMcp } from './code-search.js';
import { createDocsSearchMcp } from './docs-search.js';
import { createWebsearchMcp } from './websearch.js';

export function listBuiltinMcps({ sessionMemoryManager = null } = {}) {
  return [
    createWebsearchMcp(),
    createDocsSearchMcp(),
    createCodeSearchMcp({ sessionMemoryManager }),
  ];
}
