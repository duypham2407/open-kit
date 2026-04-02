function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function extractLightweightPython({ source, filePath }) {
  const imports = [];
  const symbols = [];

  const importRe = /^\s*import\s+([A-Za-z0-9_.,\s]+)$/gm;
  const fromImportRe = /^\s*from\s+([A-Za-z0-9_\.]+)\s+import\s+([A-Za-z0-9_.*,\s]+)$/gm;
  const defRe = /^\s*(async\s+def|def)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;
  const classRe = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\(|:)/gm;

  let match = null;
  while ((match = importRe.exec(source)) !== null) {
    const names = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      imports.push({
        kind: 'import',
        specifier: name,
        resolvedPath: null,
        importedNames: [name.split('.')[0]],
        line: lineOfIndex(source, match.index),
      });
    }
  }

  while ((match = fromImportRe.exec(source)) !== null) {
    const moduleName = match[1];
    const imported = match[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s !== '*');
    imports.push({
      kind: 'import',
      specifier: moduleName,
      resolvedPath: null,
      importedNames: imported,
      line: lineOfIndex(source, match.index),
    });
  }

  while ((match = defRe.exec(source)) !== null) {
    symbols.push({
      name: match[2],
      kind: 'function',
      isExport: !match[2].startsWith('_'),
      line: lineOfIndex(source, match.index),
      startLine: lineOfIndex(source, match.index),
      endLine: lineOfIndex(source, match.index),
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  while ((match = classRe.exec(source)) !== null) {
    symbols.push({
      name: match[1],
      kind: 'class',
      isExport: !match[1].startsWith('_'),
      line: lineOfIndex(source, match.index),
      startLine: lineOfIndex(source, match.index),
      endLine: lineOfIndex(source, match.index),
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
