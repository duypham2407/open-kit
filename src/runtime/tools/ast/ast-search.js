import fs from 'node:fs';
import path from 'node:path';

import { getAstToolingStatus } from './ast-tooling-status.js';
import { parseJsonc, toJsonPointer } from '../shared/jsonc-utils.js';
import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';

// ---------------------------------------------------------------------------
// JSON/JSONC search (original functionality)
// ---------------------------------------------------------------------------

function walkJson(value, visitor, pathSegments = []) {
  visitor(value, pathSegments);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJson(entry, visitor, [...pathSegments, index]));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      walkJson(entry, visitor, [...pathSegments, key]);
    }
  }
}

function searchJson(filePath, content, query, tooling) {
  const json = parseJsonc(content, filePath);
  const matches = [];

  walkJson(json, (value, pathSegments) => {
    if (query === null || query === undefined) {
      return;
    }

    if (typeof query === 'string') {
      const key = pathSegments[pathSegments.length - 1];
      if (String(key) === query || String(value) === query) {
        matches.push({ path: toJsonPointer(pathSegments), value });
      }
      return;
    }

    if (query && typeof query === 'object') {
      const key = pathSegments[pathSegments.length - 1];
      const keyMatches = query.key !== undefined ? String(key) === String(query.key) : true;
      const valueMatches = query.value !== undefined ? String(value) === String(query.value) : true;
      if (keyMatches && valueMatches) {
        matches.push({ path: toJsonPointer(pathSegments), value });
      }
    }
  });

  return {
    status: tooling.degraded ? 'degraded' : 'ok',
    filePath,
    query,
    language: filePath.endsWith('.jsonc') ? 'jsonc' : 'json',
    tooling,
    matches,
    matchCount: matches.length,
  };
}

// ---------------------------------------------------------------------------
// JS/TS AST search via tree-sitter (new capability)
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isJsonFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.json' || ext === '.jsonc';
}

/**
 * Search a tree-sitter AST for nodes matching criteria.
 *
 * Supported query shapes:
 *   - { nodeType: "function_declaration" }       — match by AST node type
 *   - { nodeType: "identifier", text: "foo" }    — match node type + text content
 *   - { text: "TODO" }                            — match any node containing text
 *   - "function_declaration"                       — shorthand for { nodeType: ... }
 */
function searchTreeSitter(parsed, query) {
  const matches = [];
  const maxMatches = 200;

  let nodeType = null;
  let textPattern = null;

  if (typeof query === 'string') {
    // Heuristic: if it looks like an AST node type (snake_case), search by type;
    // otherwise treat as text pattern
    if (/^[a-z_]+$/.test(query)) {
      nodeType = query;
    } else {
      textPattern = query;
    }
  } else if (query && typeof query === 'object') {
    nodeType = query.nodeType ?? null;
    textPattern = query.text ?? null;
  }

  const queue = [parsed.tree.rootNode];

  while (queue.length > 0 && matches.length < maxMatches) {
    const node = queue.shift();
    if (!node?.isNamed) {
      for (const child of (node?.namedChildren ?? [])) {
        queue.push(child);
      }
      continue;
    }

    let match = true;

    if (nodeType && node.type !== nodeType) {
      match = false;
    }

    if (match && textPattern) {
      const nodeText = parsed.source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 500));
      if (!nodeText.includes(textPattern)) {
        match = false;
      }
    }

    if (match && (nodeType || textPattern)) {
      matches.push({
        type: node.type,
        startPosition: { row: node.startPosition.row + 1, column: node.startPosition.column },
        endPosition: { row: node.endPosition.row + 1, column: node.endPosition.column },
        text: parsed.source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 200)),
      });
    }

    for (const child of node.namedChildren) {
      queue.push(child);
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createAstSearchTool({ projectRoot = process.cwd(), syntaxIndexManager = null } = {}) {
  return {
    id: 'tool.ast-search',
    name: 'AST Search Tool',
    description:
      'Structured search over parsed document trees. Supports JSON/JSONC (key/value search) and JS/TS (AST node type and text search via tree-sitter).',
    family: 'ast',
    stage: 'foundation',
    status: 'active',
    async execute(input = {}) {
      const filePath = resolveProjectPath(projectRoot, typeof input === 'string' ? input : input.filePath);
      if (!filePath || !isInsideProjectRoot(projectRoot, filePath)) {
        return { status: 'invalid-path', matches: [] };
      }

      if (!fs.existsSync(filePath)) {
        return { status: 'missing-file', filePath, matches: [] };
      }

      const query = typeof input === 'string' ? null : input.query ?? null;
      const tooling = getAstToolingStatus(process.env);

      // --- JSON/JSONC path (original) ---
      if (isJsonFile(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return searchJson(filePath, content, query, tooling);
      }

      // --- JS/TS path (new: tree-sitter AST search) ---
      if (isSourceFile(filePath) && syntaxIndexManager) {
        const parsed = await syntaxIndexManager.readFile(filePath);
        if (parsed.status !== 'parsed') {
          return {
            status: parsed.status,
            filePath,
            query,
            language: null,
            matches: [],
            matchCount: 0,
          };
        }

        const matches = searchTreeSitter(parsed, query);
        return {
          status: 'ok',
          filePath,
          query,
          language: parsed.language,
          tooling,
          matches,
          matchCount: matches.length,
        };
      }

      // Fallback: unsupported file type
      if (isSourceFile(filePath) && !syntaxIndexManager) {
        return {
          status: 'degraded',
          filePath,
          query,
          language: 'source',
          tooling,
          matches: [],
          matchCount: 0,
          reason: 'JS/TS AST search requires syntaxIndexManager; falling back to no results.',
        };
      }

      // For other file types, try JSON parse as last resort
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return searchJson(filePath, content, query, tooling);
      } catch {
        return {
          status: 'unsupported-language',
          filePath,
          query,
          matches: [],
          matchCount: 0,
        };
      }
    },
  };
}
