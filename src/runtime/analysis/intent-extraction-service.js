import { IntentCacheManager } from './intent-cache-manager.js';

/**
 * IntentExtractionService — Layer 3 intent extraction.
 *
 * Extracts business rules, constraints, edge cases, design patterns, and
 * data transformations from symbols by combining structural metadata with
 * (eventually) LLM-driven analysis.  Results are cached via
 * {@link IntentCacheManager} keyed by code hash + extractor type + model so
 * repeated extractions for the same code are free.  Persisted intents land
 * in the `code_intents` table via {@link ProjectGraphDb#insertCodeIntent}.
 *
 * The current `_extract` method is a stub that returns mock intents; a real
 * implementation will dispatch to the configured `llmProvider` (Anthropic /
 * OpenAI / etc.) and parse structured responses.
 */
export class IntentExtractionService {
  constructor({
    db,
    llmProvider = 'anthropic',
    model = 'claude-sonnet-4.5',
    minConfidence = 0.6,
  } = {}) {
    this.db = db;
    this.llmProvider = llmProvider;
    this.model = model;
    this.minConfidence = minConfidence;
    this.cache = new IntentCacheManager();
  }

  /**
   * Extract intents for a single symbol.  Results are cached per
   * (code, extractorType, model) tuple and persisted to the `code_intents`
   * table when their confidence meets `minConfidence`.
   *
   * @param {number} symbolId
   * @param {string[]} [extractorTypes]
   * @returns {Promise<Array<{ type: string, description: string,
   *                            evidence: string, confidence: number }>>}
   */
  async extractForSymbol(
    symbolId,
    extractorTypes = ['business-rule', 'constraint', 'edge-case'],
  ) {
    const symbol = this.db.getSymbol(symbolId);
    if (!symbol) return [];

    const node = this._resolveNode(symbol.node_id);

    // Build context: symbol + surrounding code
    const context = this._buildContext(symbol, node);

    const results = [];
    // Track which intents are freshly extracted (vs. served from cache).
    // Only freshly-extracted intents are persisted — cache hits indicate
    // we have already processed this exact code/extractor/model tuple in
    // the current process, so re-inserting would create duplicate rows.
    const freshlyExtracted = [];
    for (const extractorType of extractorTypes) {
      // Check cache first
      const cached = this.cache.get(context.code, extractorType, this.model);
      if (cached) {
        results.push(...cached.result);
        continue;
      }

      // Extract (stub for now — real LLM call would go here)
      const extracted = await this._extract(context, extractorType);

      // Cache results
      this.cache.set(context.code, extractorType, this.model, extracted);
      results.push(...extracted);
      freshlyExtracted.push(...extracted);
    }

    // Store in DB (only intents that pass the confidence floor and were
    // freshly extracted — cache hits are not re-persisted).
    const timestamp = Date.now() / 1000;
    for (const intent of freshlyExtracted) {
      if (intent.confidence >= this.minConfidence) {
        this.db.insertCodeIntent({
          nodeId: node ? node.id : null,
          symbolId: symbol.id,
          intentType: intent.type,
          description: intent.description,
          evidenceCode: intent.evidence,
          confidence: intent.confidence,
          model: this.model,
          extractedAt: timestamp,
          validated: false,
        });
      }
    }

    return results;
  }

  /**
   * Background extraction for every non-trivial symbol in the supplied
   * file paths.  Test files and trivial getters/setters are skipped.
   *
   * @param {string[]} filePaths
   * @param {string[]} [extractorTypes]
   * @returns {Promise<Array>} Flattened intents across all symbols.
   */
  async extractForFiles(filePaths, extractorTypes) {
    const results = [];

    for (const filePath of filePaths) {
      const node = this.db.getNode(filePath);
      if (!node) continue;

      const symbols = this.db.getSymbols(node.id);
      for (const symbol of symbols) {
        // Skip test symbols and trivial getters/setters
        if (node.is_test || this._isTrivial(symbol)) continue;

        const extracted = await this.extractForSymbol(symbol.id, extractorTypes);
        results.push(...extracted);
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /**
   * Resolve the file node a symbol belongs to.  Symbols store `node_id` as
   * the numeric foreign key, so we use `getNodeById` rather than the
   * path-keyed `getNode` lookup.
   */
  _resolveNode(nodeId) {
    if (nodeId === null || nodeId === undefined) return null;
    if (typeof this.db.getNodeById === 'function') {
      return this.db.getNodeById(nodeId);
    }
    // Defensive fallback: some test doubles may only expose getNode.
    return this.db.getNode ? this.db.getNode(nodeId) : null;
  }

  _buildContext(symbol, node) {
    // Stub: in a real implementation we would read the file and extract
    // the surrounding lines (signature + body).  For now we synthesise a
    // minimal payload from what is already in the graph.
    return {
      code: symbol.signature || `${symbol.kind} ${symbol.name}`,
      symbol: symbol.name,
      file: node ? node.path : null,
    };
  }

  async _extract(context, extractorType) {
    // Stub: real implementation will call the configured LLM provider.
    // For now return a single deterministic mock intent so callers and
    // tests can exercise the caching + persistence pipeline.
    return [
      {
        type: extractorType,
        description: `Mock ${extractorType} for ${context.symbol}`,
        evidence: context.code,
        confidence: 0.85,
      },
    ];
  }

  _isTrivial(symbol) {
    // Skip simple getters/setters (e.g. `getName`, `setEmail`).
    const trivialNames = /^(get|set)[A-Z]/;
    return trivialNames.test(symbol.name) && symbol.kind === 'method';
  }
}
