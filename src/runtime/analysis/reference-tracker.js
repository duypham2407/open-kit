// ---------------------------------------------------------------------------
// Reference Tracker
//
// Walks a tree-sitter CST for a single file and extracts identifier usages
// that reference known symbols (imported or declared).  This enables the
// `symbol_references` table in the project graph database.
//
// Approach: for each identifier node in the AST, check if it matches a known
// imported name or a declared export from another file.
//
// Phase 2 update: include lightweight lexical scope tracking so local shadowed
// names do not produce false-positive cross-file references.
// ---------------------------------------------------------------------------

/**
 * Build a set of identifier references for a single parsed file.
 *
 * @param {{
 *   tree: object,
 *   source: string,
 *   filePath: string,
 *   imports: Array<{ specifier: string, resolvedPath: string|null, importedNames: string[], line: number }>,
 *   symbols: Array<{ name: string, kind: string, isExport: boolean, line: number }>,
 *   db: { findSymbolByName: (name: string) => Array<{ id: number, node_id: number, name: string, path: string }> },
 * }} opts
 * @returns {Array<{ symbolId: number, line: number, col: number, kind: string }>}
 */
export function trackReferences({ tree, source, filePath, imports, symbols, db }) {
  const refs = [];

  // Build a map of locally imported names → resolved symbol IDs.
  // This lets us track which imported identifiers are actually used in the file.
  const importedNameMap = buildImportedNameMap(imports, db);

  // Walk the entire AST and collect identifier usages
  walkIdentifiers(tree.rootNode, source, (entry) => {
    const { name, line, col, context, nearestDeclarationKind } = entry;

    // Skip declaration sites — we only want usages
    if (context === 'declaration') return;

    // Local shadowing: if the nearest declaration is a local symbol
    // (non-import), do not treat this usage as imported/cross-file.
    if (nearestDeclarationKind === 'local') {
      return;
    }

    // Check if this identifier matches an imported name
    const symbolId = importedNameMap.get(name);
    if (symbolId != null) {
      refs.push({
        symbolId,
        line,
        col,
        kind: context === 'type-reference' ? 'type-reference' : 'usage',
      });
      return;
    }

    // If nearest declaration is import but import map has no resolved symbol,
    // skip cross-file fallback to avoid noisy results.
    if (nearestDeclarationKind === 'import') {
      return;
    }

    // Check if this identifier matches a known exported symbol in the DB
    // (cross-file reference not directly imported — e.g. via namespace or
    // re-export chains).
    const dbSymbols = db.findSymbolByName(name);
    // Only link if there's exactly one exported symbol with this name
    // to avoid ambiguous references
    const exportedMatches = dbSymbols.filter((s) => s.is_export === 1);
    if (exportedMatches.length === 1) {
      refs.push({
        symbolId: exportedMatches[0].id,
        line,
        col,
        kind: context === 'type-reference' ? 'type-reference' : 'usage',
      });
    }
  });

  return refs;
}

// ---------------------------------------------------------------------------
// Internal: build imported name → symbol ID map
// ---------------------------------------------------------------------------

function buildImportedNameMap(imports, db) {
  const map = new Map();

  for (const imp of imports) {
    if (!imp.resolvedPath) continue;

    for (const importedName of imp.importedNames) {
      // Skip namespace imports like "* as ns"
      if (importedName.startsWith('*')) continue;

      // Look up the symbol in the DB by name to get the symbol ID
      const dbSymbols = db.findSymbolByName(importedName);
      // Find the match from the resolved import path
      const match = dbSymbols.find((s) => s.path === imp.resolvedPath && s.is_export === 1);
      if (match) {
        map.set(importedName, match.id);
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Internal: AST walker for identifiers
// ---------------------------------------------------------------------------

/**
 * Walk the tree-sitter CST and invoke callback for each identifier usage.
 *
 * @param {object} rootNode
 * @param {string} source
 * @param {(entry: {name: string, line: number, col: number, context: string, nearestDeclarationKind: 'local'|'import'|null}) => void} callback
 */
function walkIdentifiers(rootNode, source, callback) {
  /** @type {Array<Map<string, 'local'|'import'>>} */
  const scopeStack = [new Map()];

  function enterScope() {
    scopeStack.push(new Map());
  }

  function exitScope() {
    scopeStack.pop();
  }

  function currentScope() {
    return scopeStack[scopeStack.length - 1];
  }

  function nearestDeclarationKind(name) {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const kind = scopeStack[i].get(name);
      if (kind) return kind;
    }
    return null;
  }

  function visit(node) {
    const createsScope = createsLexicalScope(node);
    if (createsScope) enterScope();

    if (node.type === 'identifier' || node.type === 'type_identifier') {
      const name = source.slice(node.startIndex, node.endIndex);
      const line = node.startPosition.row + 1;
      const col = node.startPosition.column;
      const context = classifyIdentifierContext(node);

      if (context === 'declaration') {
        const declKind = isImportDeclarationNode(node) ? 'import' : 'local';
        currentScope().set(name, declKind);
      }

      callback({
        name,
        line,
        col,
        context,
        nearestDeclarationKind: nearestDeclarationKind(name),
      });
    }

    const children = node.children ?? [];
    for (const child of children) {
      visit(child);
    }

    if (createsScope) exitScope();
  }

  visit(rootNode);
}

function createsLexicalScope(node) {
  if (!node) return false;
  return (
    node.type === 'program' ||
    node.type === 'function_declaration' ||
    node.type === 'function_expression' ||
    node.type === 'arrow_function' ||
    node.type === 'method_definition' ||
    node.type === 'class_declaration' ||
    node.type === 'class_body' ||
    node.type === 'statement_block'
  );
}

function isImportDeclarationNode(node) {
  const parent = node?.parent;
  if (!parent) return false;
  return parent.type === 'import_specifier' || parent.type === 'import_clause' || parent.type === 'namespace_import';
}

/**
 * Classify whether an identifier is at a declaration site, a type reference,
 * or a regular usage.
 */
function classifyIdentifierContext(node) {
  const parent = node.parent;
  if (!parent) return 'usage';

  // Declaration sites — the name field of various declaration kinds
  const declParents = new Set([
    'function_declaration',
    'class_declaration',
    'variable_declarator',
    'method_definition',
    'field_definition',
    'public_field_definition',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'import_specifier',
    'formal_parameters',
    'required_parameter',
    'optional_parameter',
    'rest_pattern',
  ]);

  if (declParents.has(parent.type)) {
    const nameField = parent.childForFieldName?.('name');
    if (nameField && nameField.id === node.id) {
      return 'declaration';
    }
    // For parameters, all identifiers within are declarations
    if (parent.type === 'formal_parameters' || parent.type === 'required_parameter' ||
        parent.type === 'optional_parameter' || parent.type === 'rest_pattern') {
      return 'declaration';
    }
  }

  // Import specifiers — mark as declaration
  if (parent.type === 'import_specifier' || parent.type === 'import_clause' ||
      parent.type === 'namespace_import') {
    return 'declaration';
  }

  // Type annotation contexts
  if (node.type === 'type_identifier') {
    return 'type-reference';
  }
  if (parent.type === 'type_annotation' || parent.type === 'type_arguments' ||
      parent.type === 'generic_type' || parent.type === 'type_predicate') {
    return 'type-reference';
  }

  return 'usage';
}
