// ---------------------------------------------------------------------------
// Data Flow Analyzer (Phase 2, Layer 2 — Semantic, Task 2.2)
//
// Provides graph-traversal queries over the L1 `type_flows` edge table:
//
//   * traceFlow              — BFS shortest path from a source symbol to a
//                              target symbol, walking outgoing flow edges.
//   * buildDependencyChain   — Direct (one-hop) dependencies for a symbol,
//                              annotated with flow type/line metadata, plus
//                              a transitive depth measurement.
//   * calculateTransitiveDepth — Recursive maximum depth of incoming flows
//                              for a symbol; cycles are short-circuited via
//                              a per-branch visited set.
//
// The analyzer is read-only and consumes the ProjectGraphDb API directly.
// Used by L3 Intent extraction and L4 Context Assembly.
// ---------------------------------------------------------------------------

export class DataFlowAnalyzer {
  /**
   * @param {object} db - ProjectGraphDb instance (or compatible) exposing
   *   `getSymbol(id)` and `getTypeFlows({ fromSymbolId?, toSymbolId? })`.
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Trace a data-flow path from one symbol to another using breadth-first
   * search.  Returns the chain of symbol rows from source to target
   * (inclusive), or an empty array when no path exists within `maxDepth`.
   *
   * @param {{ from: number, to: number, maxDepth?: number }} opts
   * @returns {Array<object>} Symbol rows along the discovered path.
   */
  traceFlow({ from, to, maxDepth = 10 }) {
    const visited = new Set();
    const queue = [{ symbolId: from, path: [] }];

    while (queue.length > 0) {
      const { symbolId, path } = queue.shift();

      if (visited.has(symbolId)) continue;
      visited.add(symbolId);

      const symbol = this.db.getSymbol(symbolId);
      const currentPath = [...path, symbol];

      if (symbolId === to) {
        return currentPath;
      }

      if (currentPath.length >= maxDepth) continue;

      // Find outgoing flows
      const flows = this.db.getTypeFlows({ fromSymbolId: symbolId });
      for (const flow of flows) {
        if (!visited.has(flow.to_symbol_id)) {
          queue.push({ symbolId: flow.to_symbol_id, path: currentPath });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Build a one-hop dependency chain describing all symbols that flow into
   * the given symbol.  Each dependency row is annotated with the flow type
   * and source line.  The `transitiveDepth` field records the maximum
   * recursive depth of incoming-flow edges (cycle-safe).
   *
   * @param {number} symbolId
   * @returns {{ symbol: object, dependsOn: Array<object>, transitiveDepth: number }}
   */
  buildDependencyChain(symbolId) {
    const symbol = this.db.getSymbol(symbolId);
    const flows = this.db.getTypeFlows({ toSymbolId: symbolId });

    const dependsOn = flows.map((flow) => {
      const depSymbol = this.db.getSymbol(flow.from_symbol_id);
      return {
        ...depSymbol,
        flowType: flow.flow_type,
        line: flow.line,
      };
    });

    return {
      symbol,
      dependsOn,
      transitiveDepth: this.calculateTransitiveDepth(symbolId),
    };
  }

  /**
   * Recursively walk incoming flow edges from `symbolId` and return the
   * maximum depth observed.  A per-branch `visited` set prevents infinite
   * recursion when the flow graph contains cycles.
   *
   * @param {number} symbolId
   * @param {Set<number>} [visited]
   * @returns {number}
   */
  calculateTransitiveDepth(symbolId, visited = new Set()) {
    if (visited.has(symbolId)) return 0;
    visited.add(symbolId);

    const flows = this.db.getTypeFlows({ toSymbolId: symbolId });
    if (flows.length === 0) return 0;

    const depths = flows.map(
      (flow) => 1 + this.calculateTransitiveDepth(flow.from_symbol_id, new Set(visited))
    );

    return Math.max(...depths);
  }
}
