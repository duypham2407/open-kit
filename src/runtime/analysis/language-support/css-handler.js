function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function extractLightweightCss({ source, filePath }) {
  const imports = [];
  const symbols = [];

  const importRe = /@import\s+(?:url\()?['"]([^'")]+)['"]/g;
  const selectorRe = /(^|\n)\s*([^{@\n][^{\n]+)\s*\{/g;

  let match = null;
  while ((match = importRe.exec(source)) !== null) {
    imports.push({
      kind: 'import',
      specifier: match[1],
      resolvedPath: null,
      importedNames: [],
      line: lineOfIndex(source, match.index),
    });
  }

  while ((match = selectorRe.exec(source)) !== null) {
    const selector = (match[2] ?? '').trim();
    if (!selector) continue;
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name: selector,
      kind: 'selector',
      isExport: false,
      line,
      startLine: line,
      endLine: line,
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  return {
    imports,
    exports: [],
    symbols,
  };
}
