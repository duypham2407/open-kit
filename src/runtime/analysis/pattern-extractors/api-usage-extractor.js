/**
 * ApiUsageExtractor — Layer 2 semantic pattern extractor.
 *
 * Detects API-usage patterns such as HTTP client calls and database queries
 * via lightweight name-keyword heuristics.  A real implementation will use
 * tree-sitter AST analysis on the symbol's body; this stub produces
 * deterministic patterns from the symbol metadata that already lives in the
 * project graph.
 *
 * Output shape:
 *   {
 *     type: 'api-usage',
 *     subtype: 'http-client' | 'database-query',
 *     symbolId,
 *     exampleCode,
 *     frequency,
 *     confidence
 *   }
 */
export class ApiUsageExtractor {
  /**
   * @param {object} symbol  Row from `symbols` table.
   * @param {object|null} _node  File node row (unused in stub).
   * @param {object} _db  ProjectGraphDb (unused in stub).
   * @returns {Array<object>} Pattern descriptors (may be empty).
   */
  extract(symbol, _node, _db) {
    const patterns = [];

    if (this._isHttpCall(symbol)) {
      patterns.push({
        type: 'api-usage',
        subtype: 'http-client',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.9,
      });
    }

    if (this._isDatabaseQuery(symbol)) {
      patterns.push({
        type: 'api-usage',
        subtype: 'database-query',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.85,
      });
    }

    return patterns;
  }

  _isHttpCall(symbol) {
    const httpKeywords = [
      'fetch',
      'axios',
      'request',
      'get',
      'post',
      'put',
      'delete',
      'patch',
    ];
    const name = (symbol?.name ?? '').toLowerCase();
    return httpKeywords.some((kw) => name.includes(kw));
  }

  _isDatabaseQuery(symbol) {
    const dbKeywords = [
      'query',
      'findone',
      'findmany',
      'insert',
      'update',
      'delete',
      'select',
    ];
    const name = (symbol?.name ?? '').toLowerCase();
    return dbKeywords.some((kw) => name.includes(kw));
  }
}
