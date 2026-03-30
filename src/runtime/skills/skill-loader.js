import fs from 'node:fs';
import path from 'node:path';

import { getSkillScopes } from './skill-scope-loader.js';

function parseSkillMcpRefs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const refs = [];
  for (const match of content.matchAll(/mcp\.[A-Za-z0-9_-]+/g)) {
    refs.push(match[0]);
  }
  return [...new Set(refs)];
}

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
        mcpRefs: parseSkillMcpRefs(filePath),
        compatibility: scope === 'project' ? 'project-local' : scope === 'user' ? 'user-local' : 'opencode-local',
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
