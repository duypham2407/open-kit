// ---------------------------------------------------------------------------
// Reference Tracker
//
// Walks a tree-sitter CST and extracts all identifier usages (references).
// Classifies each as: 'usage' | 'assignment' | 'type-ref' | 'import'
// Skips declaration names (the name node of a declaration is not a reference).
// ---------------------------------------------------------------------------

/**
 * Set of node types whose `name` child is a declaration site, not a usage.
 */
const DECLARATION_PARENTS = new Set([
  'function_declaration',
  'class_declaration',
  'method_definition',
  'variable_declarator',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'import_specifier',
  'namespace_import',
  'formal_parameters',
  'required_parameter',
  'optional_parameter',
  'property_signature',
  'public_field_definition',
  'field_definition',
  'property_definition',
  'enum_assignment',
]);

/**
 * Determine if this identifier node is the declaration name of its parent.
 */
function isDeclarationName(node) {
  const parent = node.parent;
  if (!parent) return false;

  // Direct name field of a declaration
  if (DECLARATION_PARENTS.has(parent.type)) {
    const nameChild = parent.childForFieldName?.('name');
    if (nameChild && nameChild.id === node.id) return true;
    // variable_declarator: first named child is the name
    if (parent.type === 'variable_declarator') {
      const first = parent.namedChildren?.[0];
      if (first && first.id === node.id) return true;
    }
  }

  // Shorthand property in object pattern (destructuring declaration)
  if (parent.type === 'shorthand_property_identifier_pattern') return true;

  // Labeled statement
  if (parent.type === 'labeled_statement') {
    const label = parent.childForFieldName?.('label');
    if (label && label.id === node.id) return true;
  }

  return false;
}

/**
 * Classify a reference node into a ref_kind.
 */
function classifyRef(node) {
  const parent = node.parent;
  if (!parent) return 'usage';

  // import specifier
  if (parent.type === 'import_specifier' || parent.type === 'namespace_import') {
    return 'import';
  }

  // Assignment target (left side of =)
  if (parent.type === 'assignment_expression') {
    const left = parent.childForFieldName?.('left');
    if (left && left.id === node.id) return 'assignment';
  }

  // Update expression (++, --)
  if (parent.type === 'update_expression') {
    return 'assignment';
  }

  // Type annotation / type reference
  if (
    parent.type === 'type_annotation' ||
    parent.type === 'type_identifier' ||
    parent.type === 'generic_type' ||
    parent.type === 'type_arguments' ||
    parent.type === 'constraint' ||
    parent.type === 'extends_clause' ||
    parent.type === 'implements_clause'
  ) {
    return 'type-ref';
  }

  return 'usage';
}

/**
 * Extract all identifier references from a parsed tree.
 *
 * @param {{ tree: object, source: string, filePath: string }} opts
 * @returns {Array<{ name: string, line: number, col: number, refKind: string }>}
 */
export function extractReferences({ tree, source }) {
  const refs = [];
  const queue = [tree.rootNode];

  while (queue.length > 0) {
    const node = queue.shift();

    if (node.type === 'identifier' || node.type === 'type_identifier') {
      // Skip if this is a declaration name
      if (!isDeclarationName(node)) {
        const name = source.slice(node.startIndex, node.endIndex);
        // Skip very common built-ins / keywords that would be noise
        if (name.length > 0 && name !== 'undefined' && name !== 'null') {
          refs.push({
            name,
            line: node.startPosition.row + 1,
            col: node.startPosition.column,
            refKind: classifyRef(node),
          });
        }
      }
    }

    // Recurse into children
    const children = node.namedChildren ?? [];
    for (const child of children) {
      queue.push(child);
    }
  }

  return refs;
}
