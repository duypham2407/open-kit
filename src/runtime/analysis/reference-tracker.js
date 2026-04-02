// ---------------------------------------------------------------------------
// Reference Tracker
//
// Walks a tree-sitter CST for a single file and extracts identifier usages
// that reference known symbols (imported or declared).  This enables the
// `symbol_references` table in the project graph database.
//
// Approach: for each identifier node in the AST, check if it matches a known
// imported name or a declared export from another file.  We do NOT attempt
// full scope analysis — instead we rely on import-level resolution and
// exported symbol names, which gives good recall for cross-file references
// with minimal false-positives.
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

  // Build a set of locally declared symbol names for this file so we skip
  // self-references (the declaration itself is not a "usage" reference).
  const localDeclarations = new Map();
  for (const sym of symbols) {
    localDeclarations.set(sym.name, sym.line);
  }

  // Walk the entire AST and collect identifier usages
  walkIdentifiers(tree.rootNode, source, (name, line, col, context) => {
    // Skip declaration sites — we only want usages
    if (context === 'declaration') return;

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

    // Check if this identifier matches a known exported symbol in the DB
    // (cross-file reference not directly imported — e.g. via namespace or
    // re-export chains).  We only do this for identifiers that are NOT
    // locally declared to avoid noise.
    if (!localDeclarations.has(name)) {
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
 * @param {(name: string, line: number, col: number, context: string) => void} callback
 */
function walkIdentifiers(rootNode, source, callback) {
  const queue = [rootNode];

  while (queue.length > 0) {
    const node = queue.shift();

    if (node.type === 'identifier' || node.type === 'type_identifier') {
      const name = source.slice(node.startIndex, node.endIndex);
      const line = node.startPosition.row + 1;
      const col = node.startPosition.column;
      const context = classifyIdentifierContext(node);
      callback(name, line, col, context);
    }

    // Recurse into children
    const children = node.children ?? [];
    for (const child of children) {
      queue.push(child);
    }
  }
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
