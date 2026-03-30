import fs from 'node:fs';

import { parseJsonc, toJsonPointer } from '../shared/jsonc-utils.js';
import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';

function readJsonPath(root, pointer) {
  const segments = pointer.split('/').slice(1).map((entry) => entry.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return { found: false, value: null };
    }
    current = current[segment];
  }

  return { found: true, value: current, segments };
}

function cloneAndSet(root, segments, nextValue) {
  const copy = JSON.parse(JSON.stringify(root));
  let current = copy;

  for (let index = 0; index < segments.length - 1; index += 1) {
    current = current[segments[index]];
  }

  current[segments[segments.length - 1]] = nextValue;
  return copy;
}

export function createAstReplaceTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.ast-replace',
    name: 'AST Replace Tool',
    description: 'Previews structured JSON or JSONC replacement without mutating files.',
    family: 'ast',
    stage: 'foundation',
    status: 'active',
    execute({ filePath, pointer, replacement }) {
      const resolvedPath = resolveProjectPath(projectRoot, filePath);
      if (!resolvedPath || !isInsideProjectRoot(projectRoot, resolvedPath)) {
        return { status: 'invalid-path' };
      }

      if (!fs.existsSync(resolvedPath)) {
        return { status: 'missing-file', filePath: resolvedPath };
      }

      const content = fs.readFileSync(resolvedPath, 'utf8');
      const json = parseJsonc(content, resolvedPath);
      const located = readJsonPath(json, pointer ?? '/');
      if (!located.found) {
        return { status: 'pointer-missing', filePath: resolvedPath, pointer, replacement };
      }

      const preview = pointer === '/'
        ? replacement
        : cloneAndSet(json, located.segments, replacement);

      return {
        status: 'preview-ready',
        filePath: resolvedPath,
        pointer: pointer ?? '/',
        before: located.value,
        after: pointer === '/' ? replacement : readJsonPath(preview, pointer).value,
        preview,
        previewRootPointer: toJsonPointer([]),
      };
    },
  };
}
