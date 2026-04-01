import fs from 'node:fs';

import { getAstToolingStatus } from './ast-tooling-status.js';
import { parseJsonc, toJsonPointer } from '../shared/jsonc-utils.js';
import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';

function walkJson(value, visitor, pathSegments = []) {
  visitor(value, pathSegments);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJson(entry, visitor, [...pathSegments, index]));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      walkJson(entry, visitor, [...pathSegments, key]);
    }
  }
}

export function createAstSearchTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.ast-search',
    name: 'AST Search Tool',
    description: 'Structured JSON or JSONC search over parsed document trees.',
    family: 'ast',
    stage: 'foundation',
    status: 'active',
    execute(input = {}) {
      const filePath = resolveProjectPath(projectRoot, typeof input === 'string' ? input : input.filePath);
      if (!filePath || !isInsideProjectRoot(projectRoot, filePath)) {
        return { status: 'invalid-path', matches: [] };
      }

      if (!fs.existsSync(filePath)) {
        return { status: 'missing-file', filePath, matches: [] };
      }

      const query = typeof input === 'string' ? null : input.query ?? null;
      const content = fs.readFileSync(filePath, 'utf8');
      const json = parseJsonc(content, filePath);
      const matches = [];
      const tooling = getAstToolingStatus(process.env);

      walkJson(json, (value, pathSegments) => {
        if (query === null || query === undefined) {
          return;
        }

        if (typeof query === 'string') {
          const key = pathSegments[pathSegments.length - 1];
          if (String(key) === query || String(value) === query) {
            matches.push({ path: toJsonPointer(pathSegments), value });
          }
          return;
        }

        if (query && typeof query === 'object') {
          const key = pathSegments[pathSegments.length - 1];
          const keyMatches = query.key !== undefined ? String(key) === String(query.key) : true;
          const valueMatches = query.value !== undefined ? String(value) === String(query.value) : true;
          if (keyMatches && valueMatches) {
            matches.push({ path: toJsonPointer(pathSegments), value });
          }
        }
      });

      return {
        status: tooling.degraded ? 'degraded' : 'ok',
        filePath,
        query,
        language: filePath.endsWith('.jsonc') ? 'jsonc' : 'json',
        tooling,
        matches,
        matchCount: matches.length,
      };
    },
  };
}
