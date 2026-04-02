function lineOfIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function extractLightweightConfig({ source, filePath }) {
  const imports = [];
  const symbols = [];

  // YAML keys: key:
  const yamlKeyRe = /^\s*([A-Za-z0-9_.-]+)\s*:/gm;
  // TOML keys: key = value OR [section]
  const tomlKeyRe = /^\s*([A-Za-z0-9_.-]+)\s*=.+$/gm;
  const tomlSectionRe = /^\s*\[([^\]]+)\]\s*$/gm;

  let match = null;
  while ((match = yamlKeyRe.exec(source)) !== null) {
    const name = match[1];
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: 'config-key',
      isExport: false,
      line,
      startLine: line,
      endLine: line,
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  while ((match = tomlKeyRe.exec(source)) !== null) {
    const name = match[1];
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: 'config-key',
      isExport: false,
      line,
      startLine: line,
      endLine: line,
      signature: null,
      docComment: null,
      scope: null,
    });
  }

  while ((match = tomlSectionRe.exec(source)) !== null) {
    const name = match[1];
    const line = lineOfIndex(source, match.index);
    symbols.push({
      name,
      kind: 'config-section',
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
