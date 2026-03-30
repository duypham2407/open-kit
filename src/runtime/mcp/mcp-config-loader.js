import fs from 'node:fs';
import path from 'node:path';

function replaceEnvPlaceholders(content, env) {
  return content.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => env[name] ?? '');
}

export function loadMcpConfig({ projectRoot = process.cwd(), env = process.env } = {}) {
  const candidates = [path.join(projectRoot, '.mcp.json'), path.join(projectRoot, '.opencode', 'mcp.json')];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    return {
      path: candidate,
      config: JSON.parse(replaceEnvPlaceholders(fs.readFileSync(candidate, 'utf8'), env)),
    };
  }

  return {
    path: null,
    config: null,
  };
}
