function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function extractLightweightHtml({ source, filePath }) {
  const imports = [];
  const symbols = [];

  const scriptSrcRe = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  const linkHrefRe = /<link[^>]*\shref=["']([^"']+)["'][^>]*>/gi;

  let match = null;
  while ((match = scriptSrcRe.exec(source)) !== null) {
    imports.push({
      kind: 'import',
      specifier: match[1],
      resolvedPath: null,
      importedNames: [],
      line: lineOfIndex(source, match.index),
    });
  }

  while ((match = linkHrefRe.exec(source)) !== null) {
    imports.push({
      kind: 'import',
      specifier: match[1],
      resolvedPath: null,
      importedNames: [],
      line: lineOfIndex(source, match.index),
    });
  }

  return {
    imports,
    exports: [],
    symbols,
  };
}
