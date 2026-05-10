import { ApiUsageExtractor } from './pattern-extractors/api-usage-extractor.js';
import { ValidationExtractor } from './pattern-extractors/validation-extractor.js';
import { ErrorHandlingExtractor } from './pattern-extractors/error-handling-extractor.js';

/**
 * PatternRecognitionService — Layer 2 semantic orchestrator.
 *
 * Composes individual pattern extractors (`api-usage`, `validation`,
 * `error-handling`) and persists their results to the `code_patterns` table
 * via {@link ProjectGraphDb#insertCodePattern}.  The current extractors are
 * lightweight name-keyword heuristics; later milestones will swap them for
 * tree-sitter AST analyses without changing this orchestration layer.
 *
 * Usage:
 *   const service = new PatternRecognitionService({ db });
 *   service.extractForSymbol(symbolId);
 *   service.extractForFiles(['/src/app.js', '/src/api.js']);
 */
export class PatternRecognitionService {
  /**
   * @param {{ db: object,
   *           enabledPatterns?: Array<'api-usage'|'validation'|'error-handling'> }} options
   */
  constructor({
    db,
    enabledPatterns = ['api-usage', 'validation', 'error-handling'],
  } = {}) {
    if (!db) {
      throw new Error('PatternRecognitionService requires a db instance');
    }
    this.db = db;
    this.extractors = this._createExtractors(enabledPatterns);
  }

  _createExtractors(enabledPatterns) {
    const all = {
      'api-usage': new ApiUsageExtractor(),
      validation: new ValidationExtractor(),
      'error-handling': new ErrorHandlingExtractor(),
    };

    return enabledPatterns
      .filter((name) => all[name])
      .map((name) => all[name]);
  }

  /**
   * Extract patterns for a single symbol and persist them in `code_patterns`.
   * Returns the in-memory pattern descriptors regardless of insert success.
   *
   * @param {number} symbolId
   * @returns {Array<object>}
   */
  extractForSymbol(symbolId) {
    const symbol = this.db.getSymbol(symbolId);
    if (!symbol) return [];

    const node = this._resolveNode(symbol.node_id);

    const allPatterns = [];
    for (const extractor of this.extractors) {
      const patterns = extractor.extract(symbol, node, this.db);
      allPatterns.push(...patterns);
    }

    for (const pattern of allPatterns) {
      this.db.insertCodePattern({
        patternType: pattern.type,
        primarySymbolId: pattern.symbolId,
        relatedSymbolsJson: pattern.related ?? null,
        nodeId: node ? node.id : null,
        exampleCode: pattern.exampleCode,
        frequency: pattern.frequency,
        confidence: pattern.confidence,
      });
    }

    return allPatterns;
  }

  /**
   * Extract patterns for every symbol in the supplied files.  Test files are
   * skipped (matches the convention used by IntentExtractionService).
   *
   * @param {string[]} filePaths
   * @returns {Array<object>}
   */
  extractForFiles(filePaths) {
    const allPatterns = [];

    for (const filePath of filePaths) {
      const node = this.db.getNode(filePath);
      if (!node || node.is_test) continue;

      const symbols = this.db.getSymbols(node.id);
      for (const symbol of symbols) {
        const patterns = this.extractForSymbol(symbol.id);
        allPatterns.push(...patterns);
      }
    }

    return allPatterns;
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /**
   * Resolve a file node from a symbol's `node_id` foreign key.  Mirrors
   * IntentExtractionService._resolveNode so the two services behave the
   * same when given identical DB instances or test doubles.
   */
  _resolveNode(nodeId) {
    if (nodeId === null || nodeId === undefined) return null;
    if (typeof this.db.getNodeById === 'function') {
      return this.db.getNodeById(nodeId);
    }
    return this.db.getNode ? this.db.getNode(nodeId) : null;
  }
}
