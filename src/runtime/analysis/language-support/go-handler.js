function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function isExportedGoName(name) {
  return /^[A-Z]/.test(name);
}

export function extractLightweightGo({ source, filePath }) {
  const imports = [];
  const symbols = [];

  const importSingleRe = /^\s*import\s+"([^"]+)"\s*$/gm;
  const importBlockRe = /^\s*import\s*\(([^)]*)\)/gms;
  const funcRe = /^\s*func\s*(?:\([^)]*\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;
  const typeRe = /^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm;

  let match = null;
  while ((match = importSingleRe.exec(source)) !== null) {
    imports.push({
      kind: 'import',
      specifier: match[1],
      resolvedPath: null,
      importedNames: [],
      line: lineOfIndex(source, match.index),
    });
  }

  while ((match = importBlockRe.exec(source)) !== null) {
    const block = match[1] ?? '';
    const line = lineOfIndex(source, match.index);
    const entries = block.match(/"([^"]+)"/g) ?? [];
    for (const entry of entries) {
      imports.push({
        kind: 'import',
        specifier: entry.replace(/"/g, ''),
        resolvedPath: null,
        importedNames: [],
        line,
      });
    }
  }

  while ((match = funcRe.exec(source)) !== null) {
    const name = match[1];
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: 'function',
      isExport: isExportedGoName(name),
      line,
      startLine: line,
      endLine: line,
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  while ((match = typeRe.exec(source)) !== null) {
    const name = match[1];
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: 'type',
      isExport: isExportedGoName(name),
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
