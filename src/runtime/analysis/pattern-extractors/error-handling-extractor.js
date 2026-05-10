/**
 * ErrorHandlingExtractor — Layer 2 semantic pattern extractor.
 *
 * Detects error-handling patterns: exception handlers (`handle*`, `catch*`,
 * `*Error`, `*Exception`, `*Failure`) and retry / backoff helpers
 * (`retry*`, `*Backoff`, `*Attempt`).  Uses name-keyword heuristics; a real
 * implementation will look at try/catch AST nodes and decorator imports.
 *
 * Output shape:
 *   {
 *     type: 'error-handling',
 *     subtype: 'exception-handler' | 'retry-logic',
 *     symbolId,
 *     exampleCode,
 *     frequency,
 *     confidence
 *   }
 */
export class ErrorHandlingExtractor {
  extract(symbol, _node, _db) {
    const patterns = [];

    if (this._isErrorHandler(symbol)) {
      patterns.push({
        type: 'error-handling',
        subtype: 'exception-handler',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.87,
      });
    }

    if (this._isRetryLogic(symbol)) {
      patterns.push({
        type: 'error-handling',
        subtype: 'retry-logic',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.85,
      });
    }

    return patterns;
  }

  _isErrorHandler(symbol) {
    const errorKeywords = [
      'error',
      'catch',
      'handle',
      'exception',
      'failure',
    ];
    const name = (symbol?.name ?? '').toLowerCase();
    return errorKeywords.some((kw) => name.includes(kw));
  }

  _isRetryLogic(symbol) {
    const retryKeywords = ['retry', 'backoff', 'attempt'];
    const name = (symbol?.name ?? '').toLowerCase();
    return retryKeywords.some((kw) => name.includes(kw));
  }
}
