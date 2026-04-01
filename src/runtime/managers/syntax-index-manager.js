import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Language, Parser } from 'web-tree-sitter';

import { isInsideProjectRoot, resolveProjectPath } from '../tools/shared/project-file-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const parserWasmPath = path.join(repoRoot, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm');
const javascriptWasmPath = path.join(repoRoot, 'node_modules', 'tree-sitter-javascript', 'tree-sitter-javascript.wasm');

const SUPPORTED_EXTENSIONS = new Map([
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.cjs', 'javascript'],
  ['.mjs', 'javascript'],
]);

let parserRuntimeReady = false;
let javascriptLanguage = null;

function resolveLanguage(filePath) {
  return SUPPORTED_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

async function ensureParserRuntime() {
  if (parserRuntimeReady) {
    return;
  }

  await Parser.init({
    locateFile(scriptName) {
      if (scriptName === 'web-tree-sitter.wasm') {
        return pathToFileURL(parserWasmPath).href;
      }
      return scriptName;
    },
  });

  javascriptLanguage = await Language.load(javascriptWasmPath);
  parserRuntimeReady = true;
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

export class SyntaxIndexManager {
  constructor({ projectRoot }) {
    this.projectRoot = projectRoot;
  }

  describe() {
    return {
      provider: 'web-tree-sitter',
      supportedLanguages: [...new Set(SUPPORTED_EXTENSIONS.values())],
    };
  }

  async readFile(filePath) {
    const resolvedPath = resolveProjectPath(this.projectRoot, filePath);
    if (!resolvedPath || !isInsideProjectRoot(this.projectRoot, resolvedPath)) {
      return {
        status: 'invalid-path',
        filePath,
        language: null,
      };
    }

    if (!fs.existsSync(resolvedPath)) {
      return {
        status: 'missing-file',
        filePath: resolvedPath,
        language: null,
      };
    }

    const language = resolveLanguage(resolvedPath);
    if (!language) {
      return {
        status: 'unsupported-language',
        filePath: resolvedPath,
        language: null,
      };
    }

    await ensureParserRuntime();
    const source = fs.readFileSync(resolvedPath, 'utf8');
    const parser = new Parser();
    parser.setLanguage(javascriptLanguage);
    const tree = parser.parse(source);

    return {
      status: 'parsed',
      filePath: resolvedPath,
      language,
      source,
      tree,
      outline: collectOutline(tree.rootNode, source),
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
      language: parsed.language,
      nodeCount: parsed.outline.length,
      outline: parsed.outline,
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
        language: parsed.language,
      };
    }

    const parent = node.parent ?? null;
    return {
      status: 'ok',
      filePath: parsed.filePath,
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
      language: parsed.language,
      nodeType: type,
      matchCount: matches.length,
      matches,
    };
  }
}
