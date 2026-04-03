// ---------------------------------------------------------------------------
// Source Extensions — Single source of truth
//
// Every module that needs to know which file extensions are "source code"
// MUST import from here. Do NOT define local SOURCE_EXTENSIONS constants.
// ---------------------------------------------------------------------------

/**
 * Map from file extension to tree-sitter language ID.
 * Used by syntax-index-manager to select the correct grammar.
 * @type {Map<string, string>}
 */
export const EXTENSION_TO_LANGUAGE = new Map([
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.cjs', 'javascript'],
  ['.mjs', 'javascript'],
  ['.ts', 'typescript'],
  ['.tsx', 'tsx'],
  ['.cts', 'typescript'],
  ['.mts', 'typescript'],
]);

/**
 * Extensions supported by tree-sitter parsing in SyntaxIndexManager.
 * Keep this aligned with EXTENSION_TO_LANGUAGE keys.
 * @type {string[]}
 */
export const PARSER_SOURCE_EXTENSIONS = [...EXTENSION_TO_LANGUAGE.keys()];

/**
 * JS/TS family extensions used by heuristic LSP and JS-specific tooling.
 * @type {string[]}
 */
export const JS_TS_SOURCE_EXTENSIONS = [...EXTENSION_TO_LANGUAGE.keys()];

/**
 * Additional source/document/config extensions supported by lightweight
 * language handlers in import-graph-builder.
 * @type {string[]}
 */
export const LIGHTWEIGHT_SOURCE_EXTENSIONS = [
  '.py',
  '.go',
  '.css',
  '.html',
  '.md',
  '.markdown',
  '.yaml',
  '.yml',
  '.toml',
];

/**
 * Flat array of all recognised source extensions.
 * @type {string[]}
 */
export const SOURCE_EXTENSIONS = [
  ...PARSER_SOURCE_EXTENSIONS,
  ...LIGHTWEIGHT_SOURCE_EXTENSIONS,
];

/**
 * Set variant for O(1) membership tests (file-watcher, heuristic-lsp, etc.).
 * @type {Set<string>}
 */
export const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS);
