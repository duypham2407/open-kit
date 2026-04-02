import fs from 'node:fs';
import path from 'node:path';

import { SOURCE_EXTENSIONS } from './source-extensions.js';
import { isJsTsExtension, isLightweightExtension, extractLightweightGraph } from './language-support/index.js';

// ---------------------------------------------------------------------------
// Import Graph Builder
//
// Uses SyntaxIndexManager (tree-sitter) to parse a file and extract:
//   - import declarations (static import, require calls, dynamic import)
//   - re-exports, export declarations
//   - module specifiers (resolve relative paths to absolute)
//   - exported symbol names
// ---------------------------------------------------------------------------

const JS_EXTENSIONS = SOURCE_EXTENSIONS;

/**
 * Attempt to resolve a module specifier to an absolute file path.
 * Only resolves relative paths (starting with . or ..).
 * Returns null for bare/package specifiers.
 */
function resolveSpecifier(specifier, fromFile, projectRoot) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return null; // bare specifier — external package
  }

  const dir = path.dirname(fromFile);
  const base = specifier.startsWith('/')
    ? path.resolve(projectRoot, specifier.slice(1))
    : path.resolve(dir, specifier);

  // Try exact path first
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return base;
  }

  // Try adding extensions
  for (const ext of JS_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Try index file inside directory
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of JS_EXTENSIONS) {
      const indexCandidate = path.join(base, `index${ext}`);
      if (fs.existsSync(indexCandidate)) {
        return indexCandidate;
      }
    }
  }

  // Fallback: return the base with .js extension for graph edges even if file is missing
  return `${base}${path.extname(base) ? '' : '.js'}`;
}

// ---------------------------------------------------------------------------
// AST extractors
// ---------------------------------------------------------------------------

/**
 * Walk the tree-sitter CST and extract imports, exports, and symbols.
 */
function extractFromTree(tree, source, filePath, projectRoot) {
  const imports = [];
  const exports = [];
  const symbols = [];

  const root = tree.rootNode;
  const children = root.namedChildren;

  for (const node of children) {
    switch (node.type) {
      case 'import_statement':
        extractImportStatement(node, source, filePath, projectRoot, imports);
        break;

      case 'export_statement':
        extractExportStatement(node, source, filePath, projectRoot, imports, exports, symbols);
        break;

      case 'lexical_declaration':
      case 'variable_declaration':
        extractVariableDeclaration(node, source, symbols, false);
        break;

      case 'function_declaration':
        extractFunctionDeclaration(node, source, symbols, false);
        break;

      case 'class_declaration':
        extractClassDeclaration(node, source, symbols, false);
        break;

      case 'expression_statement':
        // Check for require() calls: const x = require('...')
        extractRequireExpression(node, source, filePath, projectRoot, imports);
        break;

      // TypeScript-specific
      case 'interface_declaration':
        extractInterfaceDeclaration(node, source, symbols, false);
        break;

      case 'type_alias_declaration':
        extractTypeAliasDeclaration(node, source, symbols, false);
        break;

      case 'enum_declaration':
        extractEnumDeclaration(node, source, symbols, false);
        break;

      default:
        break;
    }
  }

  return { imports, exports, symbols };
}

// ---------------------------------------------------------------------------
// Import statement: import { a, b } from 'mod'; import x from 'mod'; import 'mod';
// ---------------------------------------------------------------------------

function extractImportStatement(node, source, filePath, projectRoot, imports) {
  const sourceNode = node.childForFieldName?.('source');
  if (!sourceNode) return;

  const specifier = stripQuotes(textOf(source, sourceNode));
  const resolvedPath = resolveSpecifier(specifier, filePath, projectRoot);
  const importedNames = [];

  // Default import
  const defaultImport = node.namedChildren.find((c) => c.type === 'identifier');
  if (defaultImport) {
    importedNames.push(textOf(source, defaultImport));
  }

  // Named imports: import_clause -> named_imports -> import_specifier
  const namedImports = node.descendantsOfType?.('import_specifier') ?? findDescendants(node, 'import_specifier');
  for (const spec of namedImports) {
    const nameNode = spec.childForFieldName?.('name') ?? spec.namedChildren?.[0];
    if (nameNode) {
      importedNames.push(textOf(source, nameNode));
    }
  }

  // Namespace import: import * as ns from 'mod'
  const nsImport = node.descendantsOfType?.('namespace_import') ?? findDescendants(node, 'namespace_import');
  for (const ns of nsImport) {
    const nameNode = ns.namedChildren?.[0];
    if (nameNode) {
      importedNames.push(`* as ${textOf(source, nameNode)}`);
    }
  }

  imports.push({
    specifier,
    resolvedPath,
    importedNames,
    line: node.startPosition.row + 1,
    kind: 'static',
  });
}

// ---------------------------------------------------------------------------
// Export statement
// ---------------------------------------------------------------------------

function extractExportStatement(node, source, filePath, projectRoot, imports, exports, symbols) {
  // Re-export: export { a } from 'mod' or export * from 'mod'
  const sourceNode = node.childForFieldName?.('source');
  if (sourceNode) {
    const specifier = stripQuotes(textOf(source, sourceNode));
    const resolvedPath = resolveSpecifier(specifier, filePath, projectRoot);
    const importedNames = [];

    const exportSpecifiers = node.descendantsOfType?.('export_specifier') ?? findDescendants(node, 'export_specifier');
    for (const spec of exportSpecifiers) {
      const nameNode = spec.childForFieldName?.('name') ?? spec.namedChildren?.[0];
      if (nameNode) {
        const name = textOf(source, nameNode);
        importedNames.push(name);
        exports.push({ name, kind: 're-export', line: node.startPosition.row + 1 });
      }
    }

    // export * from 'mod'
    if (importedNames.length === 0) {
      importedNames.push('*');
      exports.push({ name: '*', kind: 're-export', line: node.startPosition.row + 1 });
    }

    imports.push({
      specifier,
      resolvedPath,
      importedNames,
      line: node.startPosition.row + 1,
      kind: 're-export',
    });
    return;
  }

  // export default ...
  const isDefault = source.slice(node.startIndex, node.startIndex + 30).includes('default');

  // export function / export class / export const / etc.
  const declaration = node.namedChildren.find((c) =>
    c.type.includes('declaration') || c.type === 'lexical_declaration'
  );

  if (declaration) {
    switch (declaration.type) {
      case 'function_declaration':
        extractFunctionDeclaration(declaration, source, symbols, true);
        break;
      case 'class_declaration':
        extractClassDeclaration(declaration, source, symbols, true);
        break;
      case 'lexical_declaration':
      case 'variable_declaration':
        extractVariableDeclaration(declaration, source, symbols, true);
        break;
      case 'interface_declaration':
        extractInterfaceDeclaration(declaration, source, symbols, true);
        break;
      case 'type_alias_declaration':
        extractTypeAliasDeclaration(declaration, source, symbols, true);
        break;
      case 'enum_declaration':
        extractEnumDeclaration(declaration, source, symbols, true);
        break;
      default:
        break;
    }

    // Add to exports list
    for (const sym of symbols) {
      if (sym.isExport && sym.line === (declaration.startPosition.row + 1)) {
        exports.push({ name: sym.name, kind: sym.kind, line: sym.line });
      }
    }
    return;
  }

  // export { a, b }  (no source)
  const exportSpecifiers = node.descendantsOfType?.('export_specifier') ?? findDescendants(node, 'export_specifier');
  for (const spec of exportSpecifiers) {
    const nameNode = spec.childForFieldName?.('name') ?? spec.namedChildren?.[0];
    if (nameNode) {
      const name = textOf(source, nameNode);
      exports.push({ name, kind: 'named', line: node.startPosition.row + 1 });
    }
  }

  if (isDefault && exports.length === 0) {
    exports.push({ name: 'default', kind: 'default', line: node.startPosition.row + 1 });
  }
}

// ---------------------------------------------------------------------------
// require() calls in expression statements
// ---------------------------------------------------------------------------

function extractRequireExpression(node, source, filePath, projectRoot, imports) {
  // Look for patterns like: const x = require('mod')
  // These appear as expression_statement > assignment or as lexical_declaration
  const text = textOf(source, node);
  const match = text.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  if (!match) return;

  const specifier = match[1];
  const resolvedPath = resolveSpecifier(specifier, filePath, projectRoot);

  imports.push({
    specifier,
    resolvedPath,
    importedNames: [],
    line: node.startPosition.row + 1,
    kind: 'require',
  });
}

// ---------------------------------------------------------------------------
// Declaration extractors
// ---------------------------------------------------------------------------

function extractFunctionDeclaration(node, source, symbols, isExport, scope = null) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'function',
      isExport,
      line: node.startPosition.row + 1,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      signature: extractFunctionSignature(node, source),
      docComment: extractDocComment(node, source),
      scope,
    });
  }
}

function extractClassDeclaration(node, source, symbols, isExport, scope = null) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    const className = textOf(source, nameNode);
    symbols.push({
      name: className,
      kind: 'class',
      isExport,
      line: node.startPosition.row + 1,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      signature: extractClassSignature(node, source),
      docComment: extractDocComment(node, source),
      scope,
    });

    // Extract class members
    extractClassMembers(node, source, symbols, className);
  }
}

function extractVariableDeclaration(node, source, symbols, isExport, scope = null) {
  const declarators = node.namedChildren.filter((c) => c.type === 'variable_declarator');
  for (const decl of declarators) {
    const nameNode = decl.childForFieldName?.('name');
    if (nameNode) {
      // Attempt to determine if the value is a function/class/object
      const valueNode = decl.childForFieldName?.('value');
      let kind = 'variable';
      let signature = null;
      if (valueNode) {
        if (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression' || valueNode.type === 'function') {
          kind = 'function';
          signature = extractFunctionSignature(valueNode, source);
        } else if (valueNode.type === 'class') {
          kind = 'class';
        }
      }
      symbols.push({
        name: textOf(source, nameNode),
        kind,
        isExport,
        line: node.startPosition.row + 1,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        signature,
        docComment: extractDocComment(node, source),
        scope,
      });
    }
  }
}

function extractInterfaceDeclaration(node, source, symbols, isExport, scope = null) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'interface',
      isExport,
      line: node.startPosition.row + 1,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope,
    });
  }
}

function extractTypeAliasDeclaration(node, source, symbols, isExport, scope = null) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'type',
      isExport,
      line: node.startPosition.row + 1,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope,
    });
  }
}

function extractEnumDeclaration(node, source, symbols, isExport, scope = null) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'enum',
      isExport,
      line: node.startPosition.row + 1,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope,
    });
  }
}

// ---------------------------------------------------------------------------
// Signature extraction
// ---------------------------------------------------------------------------

/**
 * Extract a concise function signature: `(param1, param2): ReturnType`
 */
function extractFunctionSignature(node, source) {
  const params = node.childForFieldName?.('parameters');
  if (!params) return null;

  const paramsText = textOf(source, params);

  // Check for return type annotation (TypeScript)
  const returnType = node.childForFieldName?.('return_type');
  if (returnType) {
    return `${paramsText}: ${textOf(source, returnType).replace(/^:\s*/, '')}`;
  }

  return paramsText;
}

/**
 * Extract a class signature: `extends Base implements IFoo`
 */
function extractClassSignature(node, source) {
  const parts = [];
  for (const child of node.namedChildren) {
    if (child.type === 'class_heritage' || child.type === 'extends_clause') {
      parts.push(`extends ${textOf(source, child).replace(/^extends\s+/, '')}`);
    }
    if (child.type === 'implements_clause') {
      parts.push(`implements ${textOf(source, child).replace(/^implements\s+/, '')}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

// ---------------------------------------------------------------------------
// JSDoc extraction
// ---------------------------------------------------------------------------

/**
 * Find the JSDoc comment immediately preceding a declaration node.
 */
function extractDocComment(node, source) {
  // Walk backward through siblings to find a comment
  let prev = node.previousNamedSibling;

  // tree-sitter may place comments as unnamed children; check previous sibling
  if (!prev) {
    // Try unnamed previous sibling
    const parent = node.parent;
    if (!parent) return null;
    const children = parent.children ?? [];
    const idx = children.indexOf(node);
    if (idx <= 0) return null;
    prev = children[idx - 1];
  }

  if (!prev) return null;

  // Check if it's a comment node directly before the declaration
  if (prev.type === 'comment') {
    const text = textOf(source, prev).trim();
    if (text.startsWith('/**') && text.endsWith('*/')) {
      return text;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Class member extraction
// ---------------------------------------------------------------------------

/**
 * Extract methods and properties from a class body.
 */
function extractClassMembers(classNode, source, symbols, className) {
  const body = classNode.childForFieldName?.('body');
  if (!body) return;

  for (const member of body.namedChildren) {
    switch (member.type) {
      case 'method_definition':
      case 'public_field_definition':
      case 'field_definition': {
        const nameNode = member.childForFieldName?.('name');
        if (nameNode) {
          const memberName = textOf(source, nameNode);
          const isMethod = member.type === 'method_definition';
          symbols.push({
            name: memberName,
            kind: isMethod ? 'method' : 'property',
            isExport: false,
            line: member.startPosition.row + 1,
            startLine: member.startPosition.row + 1,
            endLine: member.endPosition.row + 1,
            signature: isMethod ? extractFunctionSignature(member, source) : null,
            docComment: extractDocComment(member, source),
            scope: className,
          });
        }
        break;
      }
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Require calls inside variable declarations (e.g. const x = require('mod'))
// ---------------------------------------------------------------------------

function extractRequireFromDeclaration(node, source, filePath, projectRoot, imports) {
  const declarators = node.namedChildren.filter((c) => c.type === 'variable_declarator');
  for (const decl of declarators) {
    const valueNode = decl.childForFieldName?.('value');
    if (!valueNode) continue;

    const text = textOf(source, valueNode);
    const match = text.match(/^require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (!match) continue;

    const specifier = match[1];
    const resolvedPath = resolveSpecifier(specifier, filePath, projectRoot);
    const nameNode = decl.childForFieldName?.('name');
    const importedNames = nameNode ? [textOf(source, nameNode)] : [];

    imports.push({
      specifier,
      resolvedPath,
      importedNames,
      line: node.startPosition.row + 1,
      kind: 'require',
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textOf(source, node) {
  return source.slice(node.startIndex, node.endIndex);
}

function stripQuotes(text) {
  if ((text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith('`') && text.endsWith('`'))) {
    return text.slice(1, -1);
  }
  return text;
}

function findDescendants(node, type) {
  const results = [];
  const queue = [...(node.namedChildren ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.type === type) {
      results.push(current);
    }
    if (current.namedChildren) {
      queue.push(...current.namedChildren);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the import/export graph data for a single file.
 *
 * @param {{ syntaxIndexManager: SyntaxIndexManager, filePath: string, projectRoot: string }} opts
 * @returns {Promise<{ filePath: string, mtime: number, imports: Array, exports: Array, symbols: Array } | null>}
 */
export async function buildFileGraph({ syntaxIndexManager, filePath, projectRoot }) {
  if (isLightweightExtension(filePath) && !isJsTsExtension(filePath)) {
    let source = '';
    let mtime = 0;
    try {
      source = fs.readFileSync(filePath, 'utf8');
      mtime = fs.statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
    const { imports, exports, symbols } = extractLightweightGraph({ source, filePath });
    return {
      filePath,
      mtime,
      imports,
      exports,
      symbols,
      tree: null,
      source,
    };
  }

  const parsed = await syntaxIndexManager.readFile(filePath);
  if (parsed.status !== 'parsed') {
    return null;
  }

  let mtime = 0;
  try {
    mtime = fs.statSync(parsed.filePath).mtimeMs;
  } catch {
    // non-critical
  }

  const { imports, exports, symbols } = extractFromTree(
    parsed.tree,
    parsed.source,
    parsed.filePath,
    projectRoot,
  );

  // Also check top-level variable declarations for require() calls
  const root = parsed.tree.rootNode;
  for (const child of root.namedChildren) {
    if (child.type === 'lexical_declaration' || child.type === 'variable_declaration') {
      extractRequireFromDeclaration(child, parsed.source, parsed.filePath, projectRoot, imports);
    }
  }

  return {
    filePath: parsed.filePath,
    mtime,
    imports,
    exports,
    symbols,
    tree: parsed.tree,
    source: parsed.source,
  };
}
