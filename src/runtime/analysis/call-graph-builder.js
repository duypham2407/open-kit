// ---------------------------------------------------------------------------
// Call Graph Builder
//
// Walks a tree-sitter CST for a single file and extracts function call
// relationships.  For each callable symbol declared in the file (functions,
// methods, arrow-function variables, constructors), it finds all call
// expressions within that symbol's body and records the callee name + line.
//
// Callee resolution is name-based: we record the callee identifier and
// resolve it to a node_id (file) and optionally a symbol_id if the callee
// name matches an exported symbol in the imported file.
// ---------------------------------------------------------------------------

/**
 * Build the call graph entries for a single parsed file.
 *
 * @param {{
 *   tree: object,
 *   source: string,
 *   filePath: string,
 *   symbols: Array<{ name: string, kind: string, line: number, startLine?: number, endLine?: number, signature?: string }>,
 *   imports: Array<{ resolvedPath: string|null, importedNames: string[] }>,
 *   db: {
 *     findSymbolByName: (name: string) => Array<{ id: number, node_id: number, path: string, is_export: number }>,
 *     getNode: (path: string) => { id: number } | null,
 *     getSymbolsByNode?: (nodeId: number) => Array<{ id: number, name: string, is_export: number }>,
 *   },
 *   symbolIds: Map<string, number>,
 * }} opts
 * @returns {Array<{ callerSymbolId: number, calleeName: string, calleeNodeId: number|null, calleeSymbolId: number|null, line: number }>}
 */
export function buildCallGraph({ tree, source, filePath, symbols, imports, db, symbolIds }) {
  const calls = [];

  // Build a map from imported name → resolved file node ID for callee resolution
  const importResolveMap = buildImportResolveMap(imports, db);

  const root = tree.rootNode;

  for (const sym of symbols) {
    // G09: expand caller kinds beyond function/method
    if (!isCallableSymbol(sym)) continue;

    const symbolId = symbolIds.get(symbolKey(sym));
    if (symbolId == null) continue;

    // Find the AST node that corresponds to this symbol
    const astNode = findSymbolNode(root, source, sym);
    if (!astNode) continue;

    // Walk the body and collect call expressions
    let bodyNode = astNode.childForFieldName?.('body') ?? astNode;
    if (sym.kind === 'class') {
      // For classes, track constructor calls under the class symbol.
      const constructor = findConstructorMethod(astNode, source);
      if (!constructor) {
        continue;
      }
      bodyNode = constructor.childForFieldName?.('body') ?? constructor;
    }
    extractCallExpressions(bodyNode, source, symbolId, importResolveMap, db, calls);
  }

  return calls;
}

// ---------------------------------------------------------------------------
// Internal: determine if a symbol should be tracked as a caller
// ---------------------------------------------------------------------------

/**
 * A symbol is callable (and thus a potential caller) if it is:
 * - a function or method declaration
 * - a variable whose signature indicates an arrow/function expression
 *   (the import-graph-builder records signatures like "=> ..." or "(params) => ...")
 * - a class (we track the constructor's calls under the class symbol)
 */
function isCallableSymbol(sym) {
  if (sym.kind === 'function' || sym.kind === 'method') return true;
  if (sym.kind === 'variable' && sym.signature && (
    sym.signature.includes('=>') || sym.signature.includes('function')
  )) {
    return true;
  }
  // For classes, we want to track constructor calls
  if (sym.kind === 'class') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Internal: build imported name → node_id map
// ---------------------------------------------------------------------------

function buildImportResolveMap(imports, db) {
  const map = new Map();

  for (const imp of imports) {
    if (!imp.resolvedPath) continue;
    const targetNode = db.getNode(imp.resolvedPath);
    if (!targetNode) continue;

    for (const name of imp.importedNames) {
      if (name.startsWith('*')) continue;
      map.set(name, targetNode.id);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Internal: find the AST node for a given symbol
// ---------------------------------------------------------------------------

function findSymbolNode(root, source, sym) {
  // Use start/end line range if available for precise matching
  if (sym.startLine != null && sym.endLine != null) {
    return findNodeByLineRange(root, sym.startLine - 1, sym.endLine - 1);
  }

  // Fallback: find by name and line
  return findNodeByNameAndLine(root, source, sym.name, sym.line - 1);
}

function findNodeByLineRange(node, startRow, endRow) {
  // BFS for the deepest node matching this line range
  const children = node.namedChildren ?? [];
  for (const child of children) {
    if (child.startPosition.row === startRow && child.endPosition.row === endRow) {
      return child;
    }
    if (child.startPosition.row <= startRow && child.endPosition.row >= endRow) {
      const deeper = findNodeByLineRange(child, startRow, endRow);
      if (deeper) return deeper;
    }
  }
  if (node.startPosition.row === startRow && node.endPosition.row === endRow) {
    return node;
  }
  return null;
}

function findNodeByNameAndLine(root, source, name, row) {
  const queue = [...(root.namedChildren ?? [])];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.startPosition.row === row) {
      const nameField = node.childForFieldName?.('name');
      if (nameField && source.slice(nameField.startIndex, nameField.endIndex) === name) {
        return node;
      }
    }
    if (node.namedChildren) {
      queue.push(...node.namedChildren);
    }
  }
  return null;
}

function findConstructorMethod(classNode, source) {
  const body = classNode.childForFieldName?.('body') ?? classNode;
  const children = body.namedChildren ?? [];
  for (const child of children) {
    if (child.type !== 'method_definition') continue;
    const nameField = child.childForFieldName?.('name');
    if (!nameField) continue;
    const name = source.slice(nameField.startIndex, nameField.endIndex);
    if (name === 'constructor') {
      return child;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal: extract call expressions from a function body
// ---------------------------------------------------------------------------

function extractCallExpressions(node, source, callerSymbolId, importResolveMap, db, calls) {
  const queue = [node];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.type === 'call_expression') {
      const calleeName = extractCalleeName(current, source);
      if (calleeName) {
        // Try to resolve the callee to a known imported file node
        const calleeNodeId = importResolveMap.get(calleeName) ?? null;
        const calleeSymbolId = resolveCalleeSymbolId(db, calleeName, calleeNodeId);

        calls.push({
          callerSymbolId,
          calleeName,
          calleeNodeId,
          calleeSymbolId,
          line: current.startPosition.row + 1,
        });
      }
    }

    // Recurse — but skip nested function/class declarations
    // (their calls belong to their own symbol)
    const children = current.children ?? [];
    for (const child of children) {
      if (child.type === 'function_declaration' || child.type === 'class_declaration' ||
          child.type === 'arrow_function' || child.type === 'function_expression' ||
          child.type === 'method_definition') {
        continue; // skip nested scopes
      }
      queue.push(child);
    }
  }
}

function resolveCalleeSymbolId(db, calleeName, calleeNodeId) {
  if (!calleeNodeId || !db?.getSymbolsByNode) return null;
  const symbols = db.getSymbolsByNode(calleeNodeId) ?? [];
  const exported = symbols.find((s) => s.name === calleeName && Number(s.is_export) === 1);
  return exported?.id ?? null;
}

/**
 * Extract the callee name from a call expression.
 * Handles:
 *   - Simple calls: `foo()` → 'foo'
 *   - Member calls: `obj.method()` → 'method'
 *   - Chained member: `a.b.c()` → 'c'
 */
function extractCalleeName(callNode, source) {
  const fn = callNode.childForFieldName?.('function') ?? callNode.namedChildren?.[0];
  if (!fn) return null;

  if (fn.type === 'identifier') {
    return source.slice(fn.startIndex, fn.endIndex);
  }

  if (fn.type === 'member_expression') {
    const property = fn.childForFieldName?.('property');
    if (property) {
      return source.slice(property.startIndex, property.endIndex);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function symbolKey(sym) {
  return `${sym.name}:${sym.line}:${sym.scope ?? ''}`;
}

export { symbolKey };
