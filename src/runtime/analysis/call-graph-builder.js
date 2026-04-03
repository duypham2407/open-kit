// ---------------------------------------------------------------------------
// Call Graph Builder
//
// Walks a tree-sitter CST and extracts call sites.
// For each call_expression, records:
//   - callerSymbolName: the enclosing function/method name, or '<module>'
//   - calleeName: the name of the called function
//   - line: source line number (1-indexed)
// ---------------------------------------------------------------------------

/**
 * Find the enclosing function or method name for a node.
 * Returns '<module>' if the call is at module-level.
 */
function findEnclosingSymbol(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'function_declaration' ||
      current.type === 'method_definition'
    ) {
      const nameNode = current.childForFieldName?.('name');
      if (nameNode) {
        return nameNode.text ?? '<anonymous>';
      }
      return '<anonymous>';
    }
    // Arrow functions / function expressions assigned to a variable
    if (current.type === 'arrow_function' || current.type === 'function_expression' || current.type === 'function') {
      const parent = current.parent;
      if (parent?.type === 'variable_declarator') {
        const nameNode = parent.childForFieldName?.('name');
        if (nameNode) {
          return nameNode.text ?? '<anonymous>';
        }
      }
      // pair in object literal: { key: () => {} }
      if (parent?.type === 'pair') {
        const keyNode = parent.childForFieldName?.('key');
        if (keyNode) {
          return keyNode.text ?? '<anonymous>';
        }
      }
      return '<anonymous>';
    }
    current = current.parent;
  }
  return '<module>';
}

/**
 * Extract the callee name from a call_expression node.
 * Handles:
 *   - foo()           -> 'foo'
 *   - obj.method()    -> 'obj.method'
 *   - obj.a.b()       -> 'obj.a.b'
 *   - new Foo()       -> 'Foo'
 * Returns null for computed calls or expressions we can't statically resolve.
 */
function extractCalleeName(node, source) {
  const fnNode = node.childForFieldName?.('function');
  if (!fnNode) return null;

  if (fnNode.type === 'identifier') {
    return source.slice(fnNode.startIndex, fnNode.endIndex);
  }

  if (fnNode.type === 'member_expression') {
    return source.slice(fnNode.startIndex, fnNode.endIndex);
  }

  return null;
}

/**
 * Extract all call sites from a parsed tree.
 *
 * @param {{ tree: object, source: string }} opts
 * @returns {Array<{ callerSymbolName: string, calleeName: string, line: number }>}
 */
export function extractCallEdges({ tree, source }) {
  const callEdges = [];
  const queue = [tree.rootNode];

  while (queue.length > 0) {
    const node = queue.shift();

    if (node.type === 'call_expression') {
      const calleeName = extractCalleeName(node, source);
      if (calleeName) {
        callEdges.push({
          callerSymbolName: findEnclosingSymbol(node),
          calleeName,
          line: node.startPosition.row + 1,
        });
      }
    }

    if (node.type === 'new_expression') {
      const ctorNode = node.childForFieldName?.('constructor');
      if (ctorNode) {
        const name = source.slice(ctorNode.startIndex, ctorNode.endIndex);
        if (name) {
          callEdges.push({
            callerSymbolName: findEnclosingSymbol(node),
            calleeName: name,
            line: node.startPosition.row + 1,
          });
        }
      }
    }

    // Recurse
    const children = node.namedChildren ?? [];
    for (const child of children) {
      queue.push(child);
    }
  }

  return callEdges;
}
