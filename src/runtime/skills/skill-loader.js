import fs from 'node:fs';
import path from 'node:path';

import { getSkillScopes } from './skill-scope-loader.js';

function loadSkillsFromDir(directory, scope) {
  if (!directory || !fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const filePath = path.join(directory, entry.name, 'SKILL.md');
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return {
        name: entry.name,
        path: filePath,
        scope,
        mcpRefs: entry.name === 'browser-automation' ? ['mcp.websearch'] : [],
      };
    })
    .filter(Boolean);
}

export function loadRuntimeSkills({ projectRoot = process.cwd(), env = process.env } = {}) {
  const scopes = getSkillScopes({ projectRoot, env });
  return [
    ...loadSkillsFromDir(scopes.project, 'project'),
    ...loadSkillsFromDir(scopes.projectOpencode, 'project-opencode'),
    ...loadSkillsFromDir(scopes.user, 'user'),
  ];
}
