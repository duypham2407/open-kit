import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { Language, Parser } from 'web-tree-sitter';

import { listProjectFiles, resolveProjectFilePath } from '../tools/shared/project-file-utils.js';
import { EXTENSION_TO_LANGUAGE, SOURCE_EXTENSIONS } from '../analysis/source-extensions.js';

const require = createRequire(import.meta.url);
const parserWasmPath = require.resolve('web-tree-sitter/web-tree-sitter.wasm');
const javascriptWasmPath = require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm');
const typescriptWasmPath = require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm');
const tsxWasmPath = require.resolve('tree-sitter-typescript/tree-sitter-tsx.wasm');

// Use shared EXTENSION_TO_LANGUAGE as the single source of truth
const SUPPORTED_EXTENSIONS = EXTENSION_TO_LANGUAGE;

let parserRuntimeReady = false;
let parserRuntimePromise = null;
let javascriptLanguage = null;
let typescriptLanguage = null;
let tsxLanguage = null;

function resolveLanguage(filePath) {
  return SUPPORTED_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

function withSyntaxMetadata(result, extra = {}) {
  return {
    ...result,
    ...extra,
    validationSurface: 'runtime_tooling',
  };
}

function getLanguageInstance(languageId) {
  switch (languageId) {
    case 'javascript': return javascriptLanguage;
    case 'typescript': return typescriptLanguage;
    case 'tsx': return tsxLanguage;
    default: return null;
  }
}

async function ensureParserRuntime() {
  if (parserRuntimeReady) {
    return;
  }

  if (!parserRuntimePromise) {
    parserRuntimePromise = (async () => {
      await Parser.init({
        locateFile(scriptName) {
          if (scriptName === 'web-tree-sitter.wasm') {
            return pathToFileURL(parserWasmPath).href;
          }
          return scriptName;
        },
      });

      [javascriptLanguage, typescriptLanguage, tsxLanguage] = await Promise.all([
        Language.load(javascriptWasmPath),
        Language.load(typescriptWasmPath),
        Language.load(tsxWasmPath),
      ]);
      parserRuntimeReady = true;
    })().catch((error) => {
      parserRuntimePromise = null;
      throw error;
    });
  }

  await parserRuntimePromise;
}

function textPreview(source, node, limit = 240) {
  return source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + limit));
}

function collectOutline(rootNode, source, maxNodes = 200) {
  const queue = [rootNode];
  const outline = [];

  while (queue.length > 0 && outline.length < maxNodes) {
    const node = queue.shift();
    if (!node?.isNamed) {
      continue;
    }

    outline.push({
      type: node.type,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      textPreview: textPreview(source, node, 160),
      namedChildCount: node.namedChildCount,
    });

    for (const child of node.namedChildren) {
      queue.push(child);
    }
  }

  return outline;
}

function collectNamedChildren(node, source, depth = 1, maxChildren = 20) {
  return node.namedChildren.slice(0, maxChildren).map((child) => ({
    type: child.type,
    startPosition: child.startPosition,
    endPosition: child.endPosition,
    textPreview: textPreview(source, child, 120),
    ...(depth > 1 ? { children: collectNamedChildren(child, source, depth - 1, maxChildren) } : {}),
  }));
}

function getNodeAtPosition(tree, line, column = 0) {
  return tree.rootNode.descendantForPosition({ row: Math.max(0, line - 1), column: Math.max(0, column) });
}

// ---------------------------------------------------------------------------
// LRU Cache
// ---------------------------------------------------------------------------

class ParseCache {
  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
    this.cache = new Map();   // path -> { mtime, source, tree, language, outline }
  }

  get(filePath) {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      const entry = this.cache.get(filePath);
      if (entry && entry.mtime === mtime) {
        // Move to end (most recently used)
        this.cache.delete(filePath);
        this.cache.set(filePath, entry);
        return entry;
      }
    } catch {
      // stat failed — file may have been deleted
      this.cache.delete(filePath);
    }
    return null;
  }

  set(filePath, data) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(filePath, data);
  }

  invalidate(filePath) {
    this.cache.delete(filePath);
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      cachedFiles: [...this.cache.keys()],
    };
  }
}

// ---------------------------------------------------------------------------
// SyntaxIndexManager
// ---------------------------------------------------------------------------

export class SyntaxIndexManager {
  constructor({ projectRoot, cacheSize = 100 }) {
    this.projectRoot = projectRoot;
    this._cache = new ParseCache(cacheSize);
  }

  describe() {
    return {
      provider: 'web-tree-sitter',
      supportedLanguages: [...new Set(SUPPORTED_EXTENSIONS.values())],
      cache: this._cache.stats(),
    };
  }

  async readFile(filePath) {
    const pathResolution = resolveProjectFilePath(this.projectRoot, filePath);
    if (pathResolution.status !== 'ok') {
      return withSyntaxMetadata(pathResolution, {
        filePath: pathResolution.resolvedPath ?? filePath,
        language: null,
      });
    }

    const resolvedPath = pathResolution.resolvedPath;

    const language = resolveLanguage(resolvedPath);
    if (!language) {
      return withSyntaxMetadata(pathResolution, {
        status: 'unsupported-language',
        reason: 'unsupported-language',
        filePath: resolvedPath,
        language: null,
      });
    }

    // Check cache first
    const cached = this._cache.get(resolvedPath);
    if (cached) {
      return {
        ...pathResolution,
        status: 'parsed',
        filePath: resolvedPath,
        language: cached.language,
        source: cached.source,
        tree: cached.tree,
        outline: cached.outline,
        fromCache: true,
        validationSurface: 'runtime_tooling',
      };
    }

    // Parse fresh
    try {
      await ensureParserRuntime();
    } catch (error) {
      return withSyntaxMetadata(pathResolution, {
        status: 'parser-unavailable',
        reason: error instanceof Error ? error.message : 'parser-unavailable',
        filePath: resolvedPath,
        language,
      });
    }

    let source;
    try {
      source = fs.readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      return withSyntaxMetadata(pathResolution, {
        status: error?.code === 'ENOENT' ? 'missing-file' : 'read-error',
        reason: error?.code === 'ENOENT' ? 'file-disappeared' : (error?.code === 'EACCES' ? 'permission-denied' : 'read-error'),
        filePath: resolvedPath,
        language,
      });
    }

    let tree;
    try {
      const parser = new Parser();
      parser.setLanguage(getLanguageInstance(language));
      tree = parser.parse(source);
    } catch (error) {
      return withSyntaxMetadata(pathResolution, {
        status: 'parse-error',
        reason: error instanceof Error ? error.message : 'parse-error',
        filePath: resolvedPath,
        language,
      });
    }

    const outline = collectOutline(tree.rootNode, source);

    // Cache result
    try {
      const stat = fs.statSync(resolvedPath);
      this._cache.set(resolvedPath, {
        mtime: stat.mtimeMs,
        source,
        tree,
        language,
        outline,
      });
    } catch {
      this._cache.delete(resolvedPath); // Parsing succeeded; failed cache population just means the next call reparses.
    }

    return {
      ...pathResolution,
      status: 'parsed',
      filePath: resolvedPath,
      language,
      source,
      tree,
      outline,
      fromCache: false,
      validationSurface: 'runtime_tooling',
    };
  }

  async getOutline(filePath) {
    const parsed = await this.readFile(filePath);
    if (parsed.status !== 'parsed') {
      return parsed;
    }

    return {
      status: 'ok',
      filePath: parsed.filePath,
      requestedPath: parsed.requestedPath,
      resolvedPath: parsed.resolvedPath,
      relativePath: parsed.relativePath,
      pathResolution: parsed.pathResolution,
      validationSurface: 'runtime_tooling',
      language: parsed.language,
      nodeCount: parsed.outline.length,
      outline: parsed.outline,
    };
  }

  /**
   * Project-wide outline scan.
   * Returns a condensed symbol map: { file -> top-level symbols }
   */
  async getProjectOutline({ maxFiles = 500 } = {}) {
    await ensureParserRuntime();
    const files = listProjectFiles(this.projectRoot, {
      extensions: SOURCE_EXTENSIONS,
      maxFiles,
    });

    const results = [];
    for (const file of files) {
      const parsed = await this.readFile(file);
      if (parsed.status !== 'parsed') {
        continue;
      }

      // Extract top-level named nodes only (depth 1)
      const topLevel = parsed.tree.rootNode.namedChildren
        .filter((node) => node.isNamed)
        .slice(0, 50)
        .map((node) => ({
          type: node.type,
          name: extractNodeName(node, parsed.source),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        }));

      results.push({
        filePath: path.relative(this.projectRoot, file),
        language: parsed.language,
        symbolCount: topLevel.length,
        symbols: topLevel,
      });
    }

    return {
      status: 'ok',
      fileCount: results.length,
      files: results,
      validationSurface: 'runtime_tooling',
    };
  }

  async getContext(filePath, { line = 1, column = 0, depth = 2 } = {}) {
    const parsed = await this.readFile(filePath);
    if (parsed.status !== 'parsed') {
      return parsed;
    }

    const node = getNodeAtPosition(parsed.tree, line, column);
    if (!node) {
      return {
        status: 'missing-node',
        filePath: parsed.filePath,
        requestedPath: parsed.requestedPath,
        resolvedPath: parsed.resolvedPath,
        relativePath: parsed.relativePath,
        pathResolution: parsed.pathResolution,
        validationSurface: 'runtime_tooling',
        language: parsed.language,
      };
    }

    const parent = node.parent ?? null;
    return {
      status: 'ok',
      filePath: parsed.filePath,
      requestedPath: parsed.requestedPath,
      resolvedPath: parsed.resolvedPath,
      relativePath: parsed.relativePath,
      pathResolution: parsed.pathResolution,
      validationSurface: 'runtime_tooling',
      language: parsed.language,
      position: { line, column },
      node: {
        type: node.type,
        startPosition: node.startPosition,
        endPosition: node.endPosition,
        textPreview: textPreview(parsed.source, node),
      },
      parent: parent
        ? {
            type: parent.type,
            startPosition: parent.startPosition,
            endPosition: parent.endPosition,
            textPreview: textPreview(parsed.source, parent),
          }
        : null,
      children: collectNamedChildren(node, parsed.source, depth),
    };
  }

  async locateType(filePath, type) {
    const parsed = await this.readFile(filePath);
    if (parsed.status !== 'parsed') {
      return parsed;
    }

    const matches = [];
    const queue = [parsed.tree.rootNode];
    while (queue.length > 0 && matches.length < 100) {
      const node = queue.shift();
      if (!node?.isNamed) {
        continue;
      }
      if (node.type === type) {
        matches.push({
          type: node.type,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
          textPreview: textPreview(parsed.source, node),
        });
      }
      for (const child of node.namedChildren) {
        queue.push(child);
      }
    }

    return {
      status: 'ok',
      filePath: parsed.filePath,
      requestedPath: parsed.requestedPath,
      resolvedPath: parsed.resolvedPath,
      relativePath: parsed.relativePath,
      pathResolution: parsed.pathResolution,
      validationSurface: 'runtime_tooling',
      language: parsed.language,
      nodeType: type,
      matchCount: matches.length,
      matches,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable name from a top-level AST node.
 * Handles: function_declaration, class_declaration, variable_declaration,
 * lexical_declaration, export_statement, interface_declaration, type_alias_declaration, enum_declaration
 */
function extractNodeName(node, source) {
  // Direct name child (function/class/interface/type/enum)
  const nameChild = node.childForFieldName?.('name');
  if (nameChild) {
    return textPreview(source, nameChild, 80).trim();
  }

  // Variable/lexical declarations: first declarator's name
  if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
    const declarator = node.namedChildren.find((child) => child.type === 'variable_declarator');
    if (declarator) {
      const declName = declarator.childForFieldName?.('name');
      if (declName) {
        return textPreview(source, declName, 80).trim();
      }
    }
  }

  // Export statements: drill into the declaration
  if (node.type === 'export_statement') {
    const declaration = node.namedChildren.find((child) =>
      child.type.includes('declaration') || child.type === 'lexical_declaration'
    );
    if (declaration) {
      return extractNodeName(declaration, source);
    }
  }

  // Fallback: first 40 chars of text
  return textPreview(source, node, 40).split('\n')[0].trim();
}
