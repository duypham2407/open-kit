import fs from 'node:fs';
import path from 'node:path';

import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';

/**
 * Runs a jscodeshift transform against a source string and returns the transformed result
 * without writing anything to disk (preview-only).
 *
 * The transform can be:
 * - A file path to a jscodeshift transform module (default export)
 * - An inline function source string that receives (fileInfo, api) arguments
 */
function loadTransform(transformPath) {
  if (!fs.existsSync(transformPath)) {
    return null;
  }

  // jscodeshift transforms are CommonJS by convention, but we support ESM too
  return import(transformPath).then((mod) => mod.default ?? mod);
}

function computeDiff(original, transformed, filePath) {
  if (original === transformed) {
    return { changed: false, filePath, diff: null };
  }

  const originalLines = original.split('\n');
  const transformedLines = transformed.split('\n');
  const hunks = [];
  let i = 0;
  const maxLen = Math.max(originalLines.length, transformedLines.length);

  while (i < maxLen) {
    if (originalLines[i] !== transformedLines[i]) {
      const start = i;
      while (i < maxLen && originalLines[i] !== transformedLines[i]) {
        i++;
      }
      hunks.push({
        startLine: start + 1,
        endLine: i,
        removed: originalLines.slice(start, i).filter(Boolean),
        added: transformedLines.slice(start, i).filter(Boolean),
      });
    } else {
      i++;
    }
  }

  return { changed: true, filePath, hunks, linesBefore: originalLines.length, linesAfter: transformedLines.length };
}

export function createCodemodPreviewTool({ projectRoot }) {
  return {
    id: 'tool.codemod-preview',
    name: 'Codemod Preview Tool',
    description: 'Previews a jscodeshift codemod transformation without writing changes. Returns a diff of what would change.',
    family: 'codemod',
    stage: 'foundation',
    status: 'active',
    async execute(input = {}) {
      let jscodeshift;
      try {
        const mod = await import('jscodeshift');
        jscodeshift = mod.default ?? mod;
      } catch {
        return {
          status: 'dependency-missing',
          provider: 'jscodeshift',
          previews: [],
        };
      }

      const transformPath = input.transform;
      const targetFiles = Array.isArray(input.files) ? input.files : input.file ? [input.file] : [];
      const inlineTransform = input.inlineTransform ?? null;

      if (!transformPath && !inlineTransform) {
        return {
          status: 'invalid-input',
          provider: 'jscodeshift',
          message: 'Either transform (file path) or inlineTransform (function source) is required.',
          previews: [],
        };
      }

      if (targetFiles.length === 0) {
        return {
          status: 'invalid-input',
          provider: 'jscodeshift',
          message: 'At least one target file is required.',
          previews: [],
        };
      }

      let transformFn;
      if (inlineTransform) {
        try {
          // eslint-disable-next-line no-new-func
          transformFn = new Function('fileInfo', 'api', inlineTransform);
        } catch (error) {
          return {
            status: 'transform-error',
            provider: 'jscodeshift',
            message: `Failed to compile inline transform: ${error.message}`,
            previews: [],
          };
        }
      } else {
        const resolvedPath = resolveProjectPath(projectRoot, transformPath);
        if (!resolvedPath || !isInsideProjectRoot(projectRoot, resolvedPath)) {
          return {
            status: 'invalid-path',
            provider: 'jscodeshift',
            message: 'Transform path must stay inside the project root.',
            previews: [],
          };
        }
        try {
          transformFn = await loadTransform(resolvedPath);
        } catch (error) {
          return {
            status: 'transform-error',
            provider: 'jscodeshift',
            message: `Failed to load transform: ${error.message}`,
            previews: [],
          };
        }

        if (!transformFn) {
          return {
            status: 'transform-not-found',
            provider: 'jscodeshift',
            message: `Transform file not found: ${resolvedPath}`,
            previews: [],
          };
        }
      }

      const previews = [];
      for (const file of targetFiles) {
        const resolvedFile = resolveProjectPath(projectRoot, file);
        if (!resolvedFile || !isInsideProjectRoot(projectRoot, resolvedFile)) {
          previews.push({ filePath: file, status: 'invalid-path', diff: null });
          continue;
        }

        if (!fs.existsSync(resolvedFile)) {
          previews.push({ filePath: file, status: 'file-not-found', diff: null });
          continue;
        }

        const source = fs.readFileSync(resolvedFile, 'utf8');
        const fileInfo = { path: resolvedFile, source };
        const api = { jscodeshift, j: jscodeshift, stats: () => {} };

        try {
          const result = transformFn(fileInfo, api);
          const output = typeof result === 'string' ? result : source;
          const diff = computeDiff(source, output, file);
          previews.push({ filePath: file, status: diff.changed ? 'preview-ready' : 'no-change', diff });
        } catch (error) {
          previews.push({ filePath: file, status: 'transform-error', error: error.message, diff: null });
        }
      }

      return {
        status: 'ok',
        provider: 'jscodeshift',
        transform: transformPath ?? '(inline)',
        previews,
        changedCount: previews.filter((p) => p.status === 'preview-ready').length,
        totalCount: previews.length,
      };
    },
  };
}
