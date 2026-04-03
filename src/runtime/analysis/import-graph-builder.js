import fs from 'node:fs';
import path from 'node:path';

import { extractReferences } from './reference-tracker.js';
import { extractCallEdges } from './call-graph-builder.js';

// ---------------------------------------------------------------------------
// Import Graph Builder
//
// Uses SyntaxIndexManager (tree-sitter) to parse a file and extract:
//   - import declarations (static import, require calls, dynamic import)
//   - re-exports, export declarations
//   - module specifiers (resolve relative paths to absolute)
//   - exported symbol names
// ---------------------------------------------------------------------------

const JS_EXTENSIONS = ['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx'];

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

/**
 * Extract the JSDoc comment (/** ... *​/) immediately preceding a node.
 * Looks at previousSibling (comment nodes are typically unnamed siblings).
 */
function extractDocComment(node, source) {
  // tree-sitter may place the comment as a previousSibling (unnamed or named).
  let prev = node.previousSibling;
  // Skip past any whitespace-only text nodes (unlikely in tree-sitter but safe).
  while (prev && prev.type !== 'comment') {
    // Only skip export_statement wrappers — if we hit anything else, bail
    if (prev.type === 'export_statement') {
      prev = prev.previousSibling;
    } else {
      break;
    }
  }

  if (!prev || prev.type !== 'comment') return null;

  const text = textOf(source, prev);
  // Only treat block comments starting with /** as JSDoc
  if (!text.startsWith('/**')) return null;

  return text;
}

/**
 * Walk node.parent chain to detect scope (class or function).
 */
function detectScope(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'class_body') {
      const classNode = current.parent;
      const nameNode = classNode?.childForFieldName?.('name');
      if (nameNode) {
        return nameNode.text ?? 'unknown';
      }
      return 'class';
    }
    if (current.type === 'function_declaration' || current.type === 'method_definition') {
      const nameNode = current.childForFieldName?.('name');
      if (nameNode) {
        return nameNode.text ?? 'function';
      }
      return 'function';
    }
    current = current.parent;
  }
  return 'module';
}

/**
 * Build a signature string for a function declaration or method.
 */
function buildFunctionSignature(node, source, name) {
  const paramsNode = node.childForFieldName?.('parameters');
  const paramsText = paramsNode ? textOf(source, paramsNode) : '()';

  // TypeScript return type
  const returnTypeNode = node.childForFieldName?.('return_type');
  const returnType = returnTypeNode ? textOf(source, returnTypeNode) : '';

  return `${name}${paramsText}${returnType}`;
}

function extractFunctionDeclaration(node, source, symbols, isExport) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    const name = textOf(source, nameNode);
    symbols.push({
      name,
      kind: 'function',
      isExport,
      line: node.startPosition.row + 1,
      signature: buildFunctionSignature(node, source, name),
      docComment: extractDocComment(node, source),
      scope: detectScope(node),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  }
}

function extractClassDeclaration(node, source, symbols, isExport) {
  const nameNode = node.childForFieldName?.('name');
  if (!nameNode) return;

  const className = textOf(source, nameNode);
  symbols.push({
    name: className,
    kind: 'class',
    isExport,
    line: node.startPosition.row + 1,
    signature: className,
    docComment: extractDocComment(node, source),
    scope: detectScope(node),
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  });

  // Extract class members (methods and fields)
  const body = node.childForFieldName?.('body');
  if (!body) return;

  for (const member of body.namedChildren ?? []) {
    if (member.type === 'method_definition') {
      const methodNameNode = member.childForFieldName?.('name');
      if (methodNameNode) {
        const methodName = textOf(source, methodNameNode);
        symbols.push({
          name: methodName,
          kind: 'method',
          isExport: false,
          line: member.startPosition.row + 1,
          signature: buildFunctionSignature(member, source, methodName),
          docComment: extractDocComment(member, source),
          scope: className,
          startLine: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
        });
      }
    } else if (
      member.type === 'public_field_definition' ||
      member.type === 'field_definition' ||
      member.type === 'property_definition'
    ) {
      const propNameNode = member.childForFieldName?.('name') ?? member.namedChildren?.[0];
      if (propNameNode) {
        symbols.push({
          name: textOf(source, propNameNode),
          kind: 'property',
          isExport: false,
          line: member.startPosition.row + 1,
          signature: null,
          docComment: extractDocComment(member, source),
          scope: className,
          startLine: member.startPosition.row + 1,
          endLine: member.endPosition.row + 1,
        });
      }
    }
  }
}

function extractVariableDeclaration(node, source, symbols, isExport) {
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
          const name = textOf(source, nameNode);
          signature = buildFunctionSignature(valueNode, source, name);
        } else if (valueNode.type === 'class') {
          kind = 'class';
        }
      }
      symbols.push({
        name: textOf(source, nameNode),
        kind,
        isExport,
        line: node.startPosition.row + 1,
        signature,
        docComment: extractDocComment(node, source),
        scope: detectScope(node),
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
  }
}

function extractInterfaceDeclaration(node, source, symbols, isExport) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'interface',
      isExport,
      line: node.startPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope: detectScope(node),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  }
}

function extractTypeAliasDeclaration(node, source, symbols, isExport) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'type',
      isExport,
      line: node.startPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope: detectScope(node),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  }
}

function extractEnumDeclaration(node, source, symbols, isExport) {
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) {
    symbols.push({
      name: textOf(source, nameNode),
      kind: 'enum',
      isExport,
      line: node.startPosition.row + 1,
      signature: null,
      docComment: extractDocComment(node, source),
      scope: detectScope(node),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
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
 * @returns {Promise<{ filePath: string, mtime: number, imports: Array, exports: Array,
 *                      symbols: Array, refs: Array, callEdges: Array } | null>}
 */
export async function buildFileGraph({ syntaxIndexManager, filePath, projectRoot }) {
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

  // Extract identifier references
  const refs = extractReferences({ tree: parsed.tree, source: parsed.source });

  // Extract call edges
  const callEdges = extractCallEdges({ tree: parsed.tree, source: parsed.source });

  return {
    filePath: parsed.filePath,
    mtime,
    imports,
    exports,
    symbols,
    refs,
    callEdges,
  };
}
