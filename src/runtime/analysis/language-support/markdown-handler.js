function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function extractLightweightMarkdown({ source, filePath }) {
  const imports = [];
  const symbols = [];

  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;

  let match = null;
  while ((match = headingRe.exec(source)) !== null) {
    const level = match[1].length;
    const name = (match[2] ?? '').trim();
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: `heading-h${level}`,
      isExport: false,
      line,
      startLine: line,
      endLine: line,
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  while ((match = linkRe.exec(source)) !== null) {
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
