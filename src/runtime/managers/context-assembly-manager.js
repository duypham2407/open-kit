/**
 * ContextAssemblyManager (Phase 5)
 *
 * Orchestrates multi-layer intelligence queries (L1 structural, L2 semantic,
 * L3 intent) and assembles a ranked, budget-bound context package suitable
 * for downstream LLM reasoning.
 *
 * The manager keeps the query plan deliberately small for the initial
 * iteration:
 *   - L1 (structural)  — queried via the project graph (symbols + deps)
 *   - L2 (semantic)    — stub; returns empty results until wired
 *   - L3 (intent)      — stub; returns empty results until wired
 *
 * Items returned by each layer are normalised, ranked via the injected
 * ResultRanker, then trimmed via the BudgetManager to fit within the
 * caller-supplied token budget.  Metadata records the layers consulted,
 * the budget usage, and a confidence score derived from the ranked items.
 */
export class ContextAssemblyManager {
  /**
   * @param {{
   *   layers?: { structural?: { db: any }|null, semantic?: any|null, intent?: any|null },
   *   budgetManager: { applyBudget: Function },
   *   ranker: { rank: Function }
   * }} options
   */
  constructor({ layers = {}, budgetManager, ranker } = {}) {
    this.layers = {
      structural: layers.structural ?? null,
      semantic: layers.semantic ?? null,
      intent: layers.intent ?? null,
    };
    this.budgetManager = budgetManager;
    this.ranker = ranker;
  }

  /**
   * Gather context for a task.  Issues a multi-layer query plan, ranks the
   * combined results, and returns a budget-bound context package.
   *
   * @param {{
   *   task: string,
   *   focus?: string[],
   *   depth?: 'shallow'|'medium'|'deep',
   *   budget?: number,
   *   intentType?: string
   * }} input
   * @returns {Promise<{
   *   primaryContext: Array,
   *   metadata: {
   *     layersQueried: string[],
   *     layerContributions: Record<string, number>,
   *     coverageMetrics: { filesAnalyzed: number, symbolsIncluded: number, layersConsulted: number },
   *     budgetUsage: { used: number, total: number, allocated: number },
   *     confidenceScore: number,
   *     depth: string
   *   }
   * }>}
   */
  async gatherTaskContext(input = {}) {
    const {
      task = '',
      focus = [],
      depth = 'medium',
      budget = 8000,
      intentType = null,
    } = input;

    const layersQueried = [];

    // ---- L1: structural (project graph) ----
    let structuralResults = [];
    if (this.layers.structural?.db) {
      structuralResults = this._queryStructural({ focus });
      layersQueried.push('structural');
    }

    // ---- L2: semantic (stub for now) ----
    let semanticResults = [];
    if (this.layers.semantic) {
      semanticResults = await this._querySemantic({ task, focus });
      layersQueried.push('semantic');
    }

    // ---- L3: intent (stub for now) ----
    let intentResults = [];
    if (this.layers.intent) {
      intentResults = await this._queryIntent({ task, intentType });
      layersQueried.push('intent');
    }

    // Merge and tag items with the layers they appeared in (for multi-layer
    // bonus scoring).
    const combined = this._mergeLayerResults({
      structural: structuralResults,
      semantic: semanticResults,
      intent: intentResults,
    });

    const ranked = this.ranker
      ? this.ranker.rank(combined, { intentType })
      : combined;

    const budgetBound = this.budgetManager
      ? this.budgetManager.applyBudget(ranked, budget)
      : ranked;

    const used = budgetBound.reduce(
      (sum, item) => sum + (item.estimatedTokens || 0),
      0,
    );

    const confidenceScore = this._computeConfidence(budgetBound);
    const layerContributions = this._computeLayerContributions(budgetBound);
    const coverageMetrics = this._computeCoverageMetrics({
      items: budgetBound,
      layersQueried,
    });

    return {
      primaryContext: budgetBound,
      metadata: {
        layersQueried,
        layerContributions,
        coverageMetrics,
        budgetUsage: { used, total: budget, allocated: budget },
        confidenceScore,
        depth,
      },
    };
  }

  // ---------------------------------------------------------------------
  // Layer query implementations
  // ---------------------------------------------------------------------

  _queryStructural({ focus = [] } = {}) {
    const db = this.layers.structural?.db;
    if (!db || !Array.isArray(focus) || focus.length === 0) {
      return [];
    }

    const items = [];
    for (const filePath of focus) {
      const node = typeof db.getNode === 'function' ? db.getNode(filePath) : null;
      if (!node) continue;

      const symbols =
        typeof db.getSymbolsByNode === 'function'
          ? db.getSymbolsByNode(node.id)
          : [];
      for (const sym of symbols) {
        items.push({
          file: node.path,
          symbol: sym.name,
          kind: sym.kind,
          line: sym.line,
          layer: 'structural',
          category: 'critical',
          estimatedTokens: 100,
          graphHops: 0,
          foundInLayers: new Set(['structural']),
        });
      }
    }
    return items;
  }

  /**
   * L2 semantic query — combines embedding-search hits (when the configured
   * semantic layer exposes a `search` method) with raw `code_patterns` rows
   * pulled from the structural DB.  Each result is normalised into the same
   * shape the ranker / budget manager expects (`{ file, ..., foundInLayers }`)
   * and tagged with the `semantic` layer.
   */
  async _querySemantic({ task, focus = [] } = {}) {
    const results = [];

    // Embedding-side semantic search (optional — the layer may not expose
    // a `search` method yet).
    const semanticLayer = this.layers.semantic;
    if (semanticLayer && semanticLayer.available && typeof semanticLayer.search === 'function') {
      try {
        const embeddingResults = (await semanticLayer.search(task ?? focus, { limit: 20 })) || [];
        for (const item of embeddingResults) {
          results.push({
            ...item,
            layer: item.layer ?? 'semantic',
            foundInLayers: item.foundInLayers ?? new Set(['semantic']),
          });
        }
      } catch {
        // ignore search failures — fall back to pattern-only results
      }
    }

    // Pattern-side: pull persisted L2 patterns for each focused file.  We
    // reach through the structural layer's DB (the same project graph that
    // pattern recognition writes to).  When the DB isn't reachable we just
    // return whatever embedding hits we collected above.
    const structural = this.layers.structural;
    const db = structural?.db ?? structural ?? null;
    const innerDb = db?._db ?? db?.db ?? db ?? null;

    if (Array.isArray(focus) && focus.length > 0 && db && innerDb && typeof innerDb.prepare === 'function') {
      let patternStmt = null;
      try {
        patternStmt = innerDb.prepare(
          'SELECT * FROM code_patterns WHERE node_id = ?',
        );
      } catch {
        patternStmt = null;
      }

      if (patternStmt) {
        for (const file of focus) {
          const node = typeof db.getNode === 'function' ? db.getNode(file) : null;
          if (!node) continue;

          let patterns = [];
          try {
            patterns = patternStmt.all(node.id) || [];
          } catch {
            patterns = [];
          }

          for (const p of patterns) {
            results.push({
              file,
              pattern: p.pattern_type,
              confidence: p.confidence,
              layer: 'semantic',
              category: 'important',
              estimatedTokens: 50,
              foundInLayers: new Set(['semantic']),
            });
          }
        }
      }
    }

    return results;
  }

  async _queryIntent(/* { task, intentType } */) {
    // Stub — wired in a follow-up task.
    return [];
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  _mergeLayerResults({ structural = [], semantic = [], intent = [] } = {}) {
    // Items are keyed by (file, symbol).  When the same item appears in
    // multiple layers we union the layer set so the ranker's multi-layer
    // bonus fires correctly.
    const byKey = new Map();
    const layerLists = [
      ['structural', structural],
      ['semantic', semantic],
      ['intent', intent],
    ];

    for (const [layerName, list] of layerLists) {
      for (const item of list) {
        const key = `${item.file ?? ''}::${item.symbol ?? ''}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.foundInLayers.add(layerName);
        } else {
          byKey.set(key, {
            ...item,
            foundInLayers: item.foundInLayers ?? new Set([layerName]),
          });
        }
      }
    }
    return Array.from(byKey.values());
  }

  _computeConfidence(items) {
    if (!items || items.length === 0) return 0;
    const scored = items.filter((i) => typeof i.score === 'number');
    if (scored.length === 0) return 0.5;
    const avg = scored.reduce((s, i) => s + i.score, 0) / scored.length;
    return Math.max(0, Math.min(1, avg));
  }

  /**
   * Tally how many of the returned items appeared in each layer.  Items that
   * appear in multiple layers are counted in each — the totals are not
   * normalised.  Layers with zero hits are still reported as 0 so callers
   * can render a stable shape.
   *
   * @param {Array} items
   * @returns {Record<string, number>}
   */
  _computeLayerContributions(items) {
    const counts = { structural: 0, semantic: 0, intent: 0 };
    if (!items || items.length === 0) return counts;
    for (const item of items) {
      if (item.foundInLayers instanceof Set) {
        for (const layer of item.foundInLayers) {
          if (layer in counts) counts[layer] += 1;
        }
      } else if (typeof item.layer === 'string' && item.layer in counts) {
        counts[item.layer] += 1;
      }
    }
    return counts;
  }

  /**
   * Compute coarse coverage statistics for the assembled package: number of
   * unique files touched, symbols included, and how many layers ultimately
   * contributed to the returned items.
   *
   * @param {{ items: Array, layersQueried: string[] }} params
   * @returns {{ filesAnalyzed: number, symbolsIncluded: number, layersConsulted: number }}
   */
  _computeCoverageMetrics({ items = [], layersQueried = [] } = {}) {
    const files = new Set();
    let symbolsIncluded = 0;
    for (const item of items) {
      if (item.file) files.add(item.file);
      if (item.symbol) symbolsIncluded += 1;
    }
    return {
      filesAnalyzed: files.size,
      symbolsIncluded,
      layersConsulted: layersQueried.length,
    };
  }
}
