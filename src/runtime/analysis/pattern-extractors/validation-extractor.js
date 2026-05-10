/**
 * ValidationExtractor — Layer 2 semantic pattern extractor.
 *
 * Detects validation patterns: input validation helpers (`validate*`,
 * `verify*`, `sanitize*`, `check*`, `assert*`) and schema-based validators
 * (Zod / Yup / Joi / generic `*Schema`).  Uses lightweight name keyword
 * heuristics for now; a real implementation will inspect imports and AST
 * call expressions.
 *
 * Output shape:
 *   {
 *     type: 'validation',
 *     subtype: 'input-validation' | 'schema-validation',
 *     symbolId,
 *     exampleCode,
 *     frequency,
 *     confidence
 *   }
 */
export class ValidationExtractor {
  extract(symbol, _node, _db) {
    const patterns = [];

    if (this._isValidation(symbol)) {
      patterns.push({
        type: 'validation',
        subtype: 'input-validation',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.88,
      });
    }

    if (this._isSchemaValidation(symbol)) {
      patterns.push({
        type: 'validation',
        subtype: 'schema-validation',
        symbolId: symbol.id,
        exampleCode: symbol.signature || symbol.name,
        frequency: 1,
        confidence: 0.92,
      });
    }

    return patterns;
  }

  _isValidation(symbol) {
    const validationKeywords = [
      'validate',
      'check',
      'verify',
      'sanitize',
      'assert',
    ];
    const name = (symbol?.name ?? '').toLowerCase();
    return validationKeywords.some((kw) => name.includes(kw));
  }

  _isSchemaValidation(symbol) {
    const schemaKeywords = ['schema', 'zod', 'yup', 'joi'];
    const name = (symbol?.name ?? '').toLowerCase();
    return schemaKeywords.some((kw) => name.includes(kw));
  }
}
