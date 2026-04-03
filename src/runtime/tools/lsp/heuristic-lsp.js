import fs from 'node:fs';
import path from 'node:path';

import { listProjectFiles, readTextFile, resolveProjectPath } from '../shared/project-file-utils.js';
import { JS_TS_SOURCE_EXTENSIONS } from '../../analysis/source-extensions.js';

const SUPPORTED_EXTENSIONS = JS_TS_SOURCE_EXTENSIONS;
const SYMBOL_PATTERNS = [
  { kind: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g },
  { kind: 'class', regex: /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g },
  { kind: 'variable', regex: /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g },
  { kind: 'interface', regex: /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/g },
  { kind: 'type', regex: /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g },
  { kind: 'enum', regex: /(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/g },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineNumberFromIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function collectProjectSourceFiles(projectRoot) {
  return listProjectFiles(projectRoot, { extensions: SUPPORTED_EXTENSIONS });
}

export function extractSymbolsFromText(content, filePath) {
  const symbols = [];

  for (const { kind, regex } of SYMBOL_PATTERNS) {
    for (const match of content.matchAll(regex)) {
      const index = match.index ?? 0;
      symbols.push({
        symbol: match[1],
        kind,
        filePath,
        line: lineNumberFromIndex(content, index),
      });
    }
  }

  return symbols;
}

export function collectProjectSymbols(projectRoot, { filePath = null, symbol = null } = {}) {
  const resolvedFilePath = resolveProjectPath(projectRoot, filePath);
  const files = resolvedFilePath ? [resolvedFilePath] : collectProjectSourceFiles(projectRoot);
  const allSymbols = [];

  for (const candidate of files) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }

    const content = readTextFile(candidate);
    if (content === null) {
      continue;
    }

    allSymbols.push(...extractSymbolsFromText(content, candidate));
  }

  return symbol
    ? allSymbols.filter((entry) => entry.symbol === symbol)
    : allSymbols;
}

function resolveImportTarget(filePath, importPath) {
  const basePath = path.resolve(path.dirname(filePath), importPath);
  const candidates = [
    basePath,
    ...SUPPORTED_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SUPPORTED_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

export function collectHeuristicDiagnostics(projectRoot) {
  const diagnostics = [];
  const files = collectProjectSourceFiles(projectRoot);
  const allSymbols = [];

  for (const filePath of files) {
    const content = readTextFile(filePath);
    if (content === null) {
      continue;
    }

    allSymbols.push(...extractSymbolsFromText(content, filePath));

    for (const match of content.matchAll(/(?:import\s+[^'"\n]+from\s+|require\()['"](\.[^'"]+)['"]/g)) {
      const importPath = match[1];
      if (!resolveImportTarget(filePath, importPath)) {
        diagnostics.push({
          severity: 'warning',
          code: 'missing-relative-import',
          filePath,
          importPath,
        });
      }
    }
  }

  const bySymbol = new Map();
  for (const symbol of allSymbols) {
    const entries = bySymbol.get(symbol.symbol) ?? [];
    entries.push(symbol);
    bySymbol.set(symbol.symbol, entries);
  }

  for (const [symbol, entries] of bySymbol.entries()) {
    if (entries.length > 1) {
      diagnostics.push({
        severity: 'info',
        code: 'duplicate-top-level-symbol',
        symbol,
        definitions: entries,
      });
    }
  }

  return diagnostics;
}

export function collectSymbolReferences(projectRoot, symbol) {
  const files = collectProjectSourceFiles(projectRoot);
  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'g');
  const references = [];

  for (const filePath of files) {
    const content = readTextFile(filePath);
    if (content === null) {
      continue;
    }

    for (const match of content.matchAll(pattern)) {
      references.push({
        symbol,
        filePath,
        line: lineNumberFromIndex(content, match.index ?? 0),
      });
    }
  }

  return references;
}

export function prepareRename(projectRoot, { symbol, newName, filePath = null } = {}) {
  const definitions = collectProjectSymbols(projectRoot, { filePath, symbol });
  const references = symbol ? collectSymbolReferences(projectRoot, symbol) : [];
  const conflicts = newName ? collectProjectSymbols(projectRoot, { symbol: newName }) : [];

  return {
    provider: 'heuristic-index',
    symbol,
    newName,
    definitions,
    references,
    conflicts,
    ready: definitions.length > 0 && conflicts.length === 0 && typeof newName === 'string' && newName.trim().length > 0,
  };
}

export function previewRename(projectRoot, { symbol, newName } = {}) {
  const preparation = prepareRename(projectRoot, { symbol, newName });
  if (!preparation.ready) {
    return {
      ...preparation,
      replacements: [],
    };
  }

  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'g');
  const replacements = preparation.references.reduce((accumulator, reference) => {
    const entry = accumulator.get(reference.filePath) ?? { filePath: reference.filePath, replacementCount: 0 };
    entry.replacementCount += 1;
    accumulator.set(reference.filePath, entry);
    return accumulator;
  }, new Map());

  return {
    ...preparation,
    replacements: [...replacements.values()],
    patternSource: pattern.source,
    patternFlags: pattern.flags,
  };
}
