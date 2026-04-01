import fs from 'node:fs';
import path from 'node:path';

/**
 * Applies a jscodeshift codemod transformation and writes changes to disk.
 * This is the mutating counterpart to codemod-preview.
 * Only files that actually change are written.
 */
export function createCodemodApplyTool({ projectRoot }) {
  return {
    id: 'tool.codemod-apply',
    name: 'Codemod Apply Tool',
    description: 'Applies a jscodeshift codemod transformation and writes changes to disk. Requires prior preview.',
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
          applied: [],
        };
      }

      const transformPath = input.transform;
      const targetFiles = Array.isArray(input.files) ? input.files : input.file ? [input.file] : [];
      const inlineTransform = input.inlineTransform ?? null;
      const dryRun = input.dryRun === true;

      if (!transformPath && !inlineTransform) {
        return {
          status: 'invalid-input',
          provider: 'jscodeshift',
          message: 'Either transform (file path) or inlineTransform (function source) is required.',
          applied: [],
        };
      }

      if (targetFiles.length === 0) {
        return {
          status: 'invalid-input',
          provider: 'jscodeshift',
          message: 'At least one target file is required.',
          applied: [],
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
            applied: [],
          };
        }
      } else {
        const resolvedPath = path.isAbsolute(transformPath) ? transformPath : path.resolve(projectRoot, transformPath);
        try {
          const mod = await import(resolvedPath);
          transformFn = mod.default ?? mod;
        } catch (error) {
          return {
            status: 'transform-error',
            provider: 'jscodeshift',
            message: `Failed to load transform: ${error.message}`,
            applied: [],
          };
        }
      }

      const applied = [];
      for (const file of targetFiles) {
        const resolvedFile = path.isAbsolute(file) ? file : path.resolve(projectRoot, file);
        if (!fs.existsSync(resolvedFile)) {
          applied.push({ filePath: file, status: 'file-not-found', written: false });
          continue;
        }

        const source = fs.readFileSync(resolvedFile, 'utf8');
        const fileInfo = { path: resolvedFile, source };
        const api = { jscodeshift, j: jscodeshift, stats: () => {} };

        try {
          const result = transformFn(fileInfo, api);
          const output = typeof result === 'string' ? result : source;

          if (output === source) {
            applied.push({ filePath: file, status: 'no-change', written: false });
            continue;
          }

          if (!dryRun) {
            fs.writeFileSync(resolvedFile, output, 'utf8');
          }

          applied.push({ filePath: file, status: 'applied', written: !dryRun });
        } catch (error) {
          applied.push({ filePath: file, status: 'transform-error', error: error.message, written: false });
        }
      }

      return {
        status: 'ok',
        provider: 'jscodeshift',
        transform: transformPath ?? '(inline)',
        dryRun,
        applied,
        appliedCount: applied.filter((a) => a.status === 'applied').length,
        totalCount: applied.length,
      };
    },
  };
}
