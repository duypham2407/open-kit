import fs from 'node:fs';

import { isInsideProjectRoot, resolveProjectPath } from '../shared/project-file-utils.js';

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createHashlineEditTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.hashline-edit',
    name: 'Hashline Edit Tool',
    description: 'Previews anchor-safe file edits without mutating files.',
    family: 'safer-edit',
    stage: 'foundation',
    status: 'active',
    execute({ filePath, anchor, replacement }) {
      const resolvedPath = resolveProjectPath(projectRoot, filePath);
      if (!resolvedPath || !isInsideProjectRoot(projectRoot, resolvedPath)) {
        return {
          status: 'invalid-path',
          filePath,
          strategy: 'hashline-anchor',
        };
      }

      if (!fs.existsSync(resolvedPath)) {
        return {
          status: 'missing-file',
          filePath: resolvedPath,
          strategy: 'hashline-anchor',
        };
      }

      const content = fs.readFileSync(resolvedPath, 'utf8');
      const lines = content.split('\n');
      const matches = lines.reduce((entries, line, index) => {
        if (typeof anchor === 'string' && anchor.length > 0 && line.includes(anchor)) {
          entries.push({
            lineNumber: index + 1,
            line,
            lineHash: hashString(line),
          });
        }
        return entries;
      }, []);

      return {
        status: matches.length === 1 ? 'preview-ready' : matches.length === 0 ? 'anchor-missing' : 'anchor-ambiguous',
        filePath: resolvedPath,
        anchor,
        replacement,
        strategy: 'hashline-anchor',
        matchCount: matches.length,
        matches,
        preview: matches[0]
          ? {
              lineNumber: matches[0].lineNumber,
              before: matches[0].line,
              after: typeof replacement === 'string' ? matches[0].line.replace(anchor, replacement) : null,
            }
          : null,
      };
    },
  };
}
