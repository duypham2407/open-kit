// ---------------------------------------------------------------------------
// Semantic Layer Enhancer
//
// Enriches embedding chunks with Layer 2 (pattern) and Layer 3 (intent)
// metadata before the chunks are persisted by the EmbeddingIndexer.  Both
// layers are optional — callers may disable them via config and the enhancer
// falls back to a no-op for the disabled side.
//
// The enhancer is intentionally tolerant of partial chunk metadata so it can
// be exercised both from the indexer (where metadata.symbols is absent and
// chunks are keyed by symbolName) and from tests / future callers that
// attach explicit symbol id lists to chunk metadata.
// ---------------------------------------------------------------------------

import { PatternRecognitionService } from './pattern-recognition-service.js';
import { IntentExtractionService } from './intent-extraction-service.js';

export class SemanticLayerEnhancer {
  /**
   * @param {{
   *   db: object,
   *   patternConfig?: { enabled?: boolean, patterns?: string[] },
   *   intentConfig?: { enabled?: boolean, llmProvider?: string, model?: string, minConfidence?: number }
   * }} options
   */
  constructor({ db, patternConfig = {}, intentConfig = {} } = {}) {
    if (!db) {
      throw new Error('SemanticLayerEnhancer requires a db instance');
    }
    this.db = db;

    this.patternService =
      patternConfig.enabled !== false
        ? new PatternRecognitionService({
            db,
            ...(patternConfig.patterns ? { enabledPatterns: patternConfig.patterns } : {}),
          })
        : null;

    // Intent extraction is intentionally disabled by default — it triggers
    // LLM calls (or stubbed work today) and is meant to run as a background
    // pass, not inline with embedding indexing.
    if (intentConfig.enabled === true) {
      const { enabled: _ignored, ...intentOpts } = intentConfig;
      this.intentService = new IntentExtractionService({ db, ...intentOpts });
    } else {
      this.intentService = null;
    }
  }

  /**
   * Enhance a batch of chunks belonging to a single file (node).  Patterns
   * are extracted synchronously per symbol; intents are extracted via the
   * async IntentExtractionService when enabled.  Mutates `chunks` in place
   * and also returns them for convenience.
   *
   * @param {Array<{ chunkId: string, content: string, metadata: object }>} chunks
   * @param {number} nodeId
   * @returns {Promise<Array>}
   */
  async enhanceChunks(chunks, nodeId) {
    if (!Array.isArray(chunks) || chunks.length === 0) return chunks;
    if (nodeId === null || nodeId === undefined) return chunks;

    const symbols =
      typeof this.db.getSymbols === 'function'
        ? this.db.getSymbols(nodeId) || []
        : typeof this.db.getSymbolsByNode === 'function'
          ? this.db.getSymbolsByNode(nodeId) || []
          : [];

    // Extract patterns (L2) for all symbols — synchronous extractors.
    const patternsBySymbol = new Map();
    const patternsByName = new Map();
    if (this.patternService) {
      for (const symbol of symbols) {
        try {
          const patterns = await this.patternService.extractForSymbol(symbol.id);
          patternsBySymbol.set(symbol.id, patterns || []);
          if (symbol.name) {
            patternsByName.set(symbol.name, patterns || []);
          }
        } catch {
          patternsBySymbol.set(symbol.id, []);
        }
      }
    }

    // Extract intents (L3) for all symbols — async, optional.
    const intentsBySymbol = new Map();
    const intentsByName = new Map();
    if (this.intentService) {
      for (const symbol of symbols) {
        try {
          const intents = await this.intentService.extractForSymbol(symbol.id);
          intentsBySymbol.set(symbol.id, intents || []);
          if (symbol.name) {
            intentsByName.set(symbol.name, intents || []);
          }
        } catch {
          intentsBySymbol.set(symbol.id, []);
        }
      }
    }

    for (const chunk of chunks) {
      if (!chunk.metadata) chunk.metadata = {};

      const explicitSymbols = Array.isArray(chunk.metadata.symbols)
        ? chunk.metadata.symbols
        : [];
      const symbolIds = explicitSymbols
        .map((s) => (typeof s === 'object' ? s?.id : s))
        .filter((id) => id !== null && id !== undefined);

      const symbolName = chunk.metadata.symbolName;

      const chunkPatterns = symbolIds.length > 0
        ? symbolIds.flatMap((id) => patternsBySymbol.get(id) || [])
        : symbolName && patternsByName.has(symbolName)
          ? [...patternsByName.get(symbolName)]
          : [];

      const chunkIntents = symbolIds.length > 0
        ? symbolIds.flatMap((id) => intentsBySymbol.get(id) || [])
        : symbolName && intentsByName.has(symbolName)
          ? [...intentsByName.get(symbolName)]
          : [];

      chunk.metadata.patterns = chunkPatterns;
      chunk.metadata.intents = chunkIntents;
      chunk.metadata.confidence = this._calculateConfidence(chunk.metadata);
    }

    return chunks;
  }

  /**
   * Confidence heuristic — base 0.5, +0.2 for pattern hits, +0.2 for intent
   * hits, +0.1 for any explicit symbol metadata.  Capped at 1.0.
   */
  _calculateConfidence(metadata) {
    let score = 0.5;
    if (Array.isArray(metadata.patterns) && metadata.patterns.length > 0) score += 0.2;
    if (Array.isArray(metadata.intents) && metadata.intents.length > 0) score += 0.2;
    if (Array.isArray(metadata.symbols) && metadata.symbols.length > 0) score += 0.1;
    // Round to 2dp to keep score arithmetic free of float-rounding artefacts
    // (0.5 + 0.2 + 0.2 + 0.1 == 0.9999999999999999 in IEEE-754).
    return Math.min(Math.round(score * 100) / 100, 1.0);
  }
}
