/**
 * OpenKit Tool Enforcement Plugin
 *
 * Intercepts OS-level commands (grep, cat, find, sed, awk, etc.) in Bash tool
 * calls and redirects agents to use the appropriate OpenKit kit tools or
 * OpenCode built-in tools instead.
 *
 * Enforcement levels by workflow mode:
 *   - quick / full: STRICT  -- blocked commands throw, halting the tool call
 *   - migration:    MODERATE -- logged warning + suggestion, not blocked
 *   - (default):    STRICT  -- treats unknown modes as strict
 *
 * Design notes:
 *   - The plugin runs inside OpenCode's plugin runtime (Bun), NOT inside the
 *     kit's own Node.js runtime.  It must be self-contained (no imports from
 *     src/ or .opencode/lib/).
 *   - Reads OPENKIT_ENFORCEMENT_LEVEL and OPENKIT_WORKFLOW_MODE env vars so
 *     the kit launcher or session-start hook can override behavior.
 *   - An allowlist of safe Bash commands (git, npm, node, docker, etc.) is
 *     checked first so legitimate system operations are never blocked.
 */

// ---------------------------------------------------------------------------
// Substitution rules
// ---------------------------------------------------------------------------

const SUBSTITUTION_RULES = [
  {
    // grep on source code files
    pattern: /(?:^|\||\&\&|\;)\s*(?:grep|egrep|fgrep|rg)\b/,
    category: 'search',
    suggestion:
      'Use the Grep tool (built-in) for regex search, or ast-grep for structural code patterns.',
  },
  {
    // find for file discovery
    pattern: /(?:^|\||\&\&|\;)\s*find\b.*(?:-name|-type|-iname|-regex)/,
    category: 'file-discovery',
    suggestion:
      'Use the Glob tool (built-in) for file patterns.',
  },
  {
    // cat on source code files
    pattern: /(?:^|\||\&\&|\;)\s*cat\b\s+\S+\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts|py|go|rs|java|rb|c|cpp|h|hpp|css|scss|html|json|yaml|yml|toml|xml|md|mdx|vue|svelte)\b/,
    category: 'file-read',
    suggestion:
      'Use the Read tool (built-in) for file contents with line numbers.',
  },
  {
    // head / tail on source code (with or without flags like -20)
    pattern: /(?:^|\||\&\&|\;)\s*(?:head|tail)\b(?:\s+-\S+)*\s+\S+\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts|py|go|rs|java|rb|c|cpp|h|hpp|css|scss|html|json|yaml|yml|toml|xml|md|mdx|vue|svelte)\b/,
    category: 'file-read-partial',
    suggestion:
      'Use the Read tool (built-in) with offset and limit parameters.',
  },
  {
    // sed in-place or piped transforms
    pattern: /(?:^|\||\&\&|\;)\s*sed\b/,
    category: 'text-transform',
    suggestion:
      'Use the Edit tool (built-in) for precise text replacements, or ast-grep for AST-aware rewrites.',
  },
  {
    // awk
    pattern: /(?:^|\||\&\&|\;)\s*awk\b/,
    category: 'text-transform',
    suggestion:
      'Use the Edit tool (built-in) for edits, or the Read tool + agent logic for data extraction.',
  },
  {
    // wc -l or wc on code files
    pattern: /(?:^|\||\&\&|\;)\s*wc\b.*\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts|py|go|rs|java|rb|c|cpp|h|hpp|css|scss|html|json|yaml|yml|toml|xml|md|mdx)\b/,
    category: 'metrics',
    suggestion:
      'Use the Read tool (built-in) to read the file, which provides line numbers.',
  },
  {
    // ls for directory listing of source dirs
    pattern: /(?:^|\||\&\&|\;)\s*ls\b/,
    category: 'directory-list',
    suggestion:
      'Use the Read tool (built-in) on a directory path, or the Glob tool for pattern matching.',
  },
  {
    // echo used for file writing  (echo ... > file  or  echo ... >> file)
    pattern: /(?:^|\||\&\&|\;)\s*echo\b.*(?:>>?)\s*\S+\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts|py|go|rs|java|rb|c|cpp|h|hpp|css|scss|html|json|yaml|yml|toml|xml|md|mdx)\b/,
    category: 'file-write',
    suggestion:
      'Use the Write tool (built-in) to create files, or the Edit tool to modify existing files.',
  },
];

// ---------------------------------------------------------------------------
// Allowlist — commands that should NEVER be blocked
// ---------------------------------------------------------------------------

const ALLOWED_COMMAND_PREFIXES = [
  'git ', 'git\t',
  'npm ', 'npx ',
  'pnpm ', 'pnpx ',
  'yarn ',
  'bun ',
  'node ',
  'deno ',
  'docker ', 'docker-compose ',
  'kubectl ',
  'curl ', 'wget ',
  'chmod ', 'chown ',
  'mkdir ', 'rmdir ',
  'cp ', 'mv ', 'rm ',
  'tar ', 'zip ', 'unzip ',
  'make ',
  'cargo ',
  'go ',
  'python ', 'python3 ', 'pip ', 'pip3 ',
  'ruby ', 'gem ', 'bundle ',
  'brew ',
  'apt ', 'apt-get ',
  'openkit ', 'opencode ',
  'semgrep ',
  'ast-grep ',
  'jscodeshift ',
  'tsc ', 'tsx ',
  'eslint ', 'prettier ',
  'jest ', 'vitest ', 'mocha ',
  'pytest ',
];

function isAllowedCommand(command) {
  const trimmed = command.trimStart();
  for (const prefix of ALLOWED_COMMAND_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return true;
    }
  }
  // Also allow bare command names without arguments  (e.g. `git`)
  const firstWord = trimmed.split(/\s/)[0];
  const allowedBare = new Set([
    'git', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'node', 'deno',
    'docker', 'kubectl', 'cargo', 'go', 'make', 'python', 'python3',
    'ruby', 'brew', 'tsc', 'tsx', 'openkit', 'opencode',
  ]);
  return allowedBare.has(firstWord);
}

// ---------------------------------------------------------------------------
// Enforcement level resolution
// ---------------------------------------------------------------------------

function resolveEnforcementLevel(env) {
  // Explicit override takes priority
  const explicit = env?.OPENKIT_ENFORCEMENT_LEVEL;
  if (explicit === 'strict' || explicit === 'moderate' || explicit === 'permissive') {
    return explicit;
  }

  // Derive from workflow mode
  const mode = env?.OPENKIT_WORKFLOW_MODE;
  if (mode === 'migration') {
    return 'moderate';
  }

  // Default to strict (quick / full / unknown)
  return 'strict';
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const ToolEnforcementPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    'tool.execute.before': async (input, output) => {
      // Only intercept bash tool calls
      if (input.tool !== 'bash') {
        return;
      }

      const command = output?.args?.command;
      if (!command || typeof command !== 'string') {
        return;
      }

      // Never block allowed system commands
      if (isAllowedCommand(command)) {
        return;
      }

      const level = resolveEnforcementLevel(process.env);

      // In permissive mode, do nothing
      if (level === 'permissive') {
        return;
      }

      // Check each substitution rule
      for (const rule of SUBSTITUTION_RULES) {
        if (rule.pattern.test(command)) {
          const message = [
            `[OpenKit Tool Enforcement] Blocked bash command (category: ${rule.category}).`,
            `Command: ${command.length > 120 ? command.slice(0, 120) + '...' : command}`,
            `Suggestion: ${rule.suggestion}`,
            '',
            'If this command is intentional and cannot be replaced by a kit tool,',
            'set OPENKIT_ENFORCEMENT_LEVEL=permissive to bypass this check.',
          ].join('\n');

          if (level === 'strict') {
            throw new Error(message);
          }

          // moderate — log warning but allow
          if (client?.app?.log) {
            await client.app.log({
              body: {
                service: 'openkit-tool-enforcement',
                level: 'warn',
                message: `OS command detected (${rule.category}): ${command.slice(0, 80)}`,
                extra: { suggestion: rule.suggestion },
              },
            });
          }
          return;
        }
      }
    },
  };
};
