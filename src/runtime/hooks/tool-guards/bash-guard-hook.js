/**
 * Bash Guard Hook
 *
 * Internal kit hook that detects OS-level commands in tool arguments and
 * returns an advisory { allowed: false } result.  This is consumed by
 * wrap-tool-execution.js when guardHooks are wired.
 *
 * The hook mirrors the substitution rules in the OpenCode plugin
 * (.opencode/plugins/tool-enforcement.js) but operates inside the kit's
 * own runtime for tools registered through the kit tool registry.
 */

const CODE_EXTENSIONS_PATTERN = '(?:js|jsx|ts|tsx|mjs|cjs|mts|cts|py|go|rs|java|rb|c|cpp|h|hpp|css|scss|html|json|yaml|yml|toml|xml|md|mdx|vue|svelte)';

const SUBSTITUTION_RULES = [
  {
    pattern: /\bgrep\b|\begrep\b|\bfgrep\b|\brg\b/,
    category: 'search',
    suggestion: 'Use Grep tool (built-in), tool.semantic-search for meaning-based search, or tool.ast-grep-search for structural patterns.',
  },
  {
    pattern: new RegExp(`\\bfind\\b.*(?:-name|-type|-iname|-regex)`),
    category: 'file-discovery',
    suggestion: 'Use Glob tool (built-in) for file patterns, or tool.find-symbol to locate a symbol definition.',
  },
  {
    pattern: new RegExp(`\\bcat\\b\\s+\\S+\\.(?:${CODE_EXTENSIONS_PATTERN})\\b`),
    category: 'file-read',
    suggestion: 'Use Read tool (built-in) for file contents, or tool.syntax-outline to understand file structure first.',
  },
  {
    pattern: new RegExp(`\\b(?:head|tail)\\b.*\\.(?:${CODE_EXTENSIONS_PATTERN})\\b`),
    category: 'file-read-partial',
    suggestion: 'Use Read tool (built-in) with offset/limit, or tool.syntax-context for position-aware context.',
  },
  {
    pattern: /\bsed\b/,
    category: 'text-transform',
    suggestion: 'Use Edit tool (built-in), or tool.codemod-preview / tool.codemod-apply for multi-file AST-aware rewrites.',
  },
  {
    pattern: /\bawk\b/,
    category: 'text-transform',
    suggestion: 'Use Edit tool (built-in) for edits, or Read tool + agent logic.',
  },
  {
    pattern: new RegExp(`\\becho\\b\\s+.*>\\s*\\S+\\.(?:${CODE_EXTENSIONS_PATTERN})\\b`),
    category: 'file-write',
    suggestion: 'Use Write tool (built-in) for creating files.',
  },
  {
    pattern: new RegExp(`\\bwc\\s+-l\\b.*\\.(?:${CODE_EXTENSIONS_PATTERN})\\b`),
    category: 'line-count',
    suggestion: 'Use Read tool (built-in) — line numbers are included in output.',
  },
  {
    pattern: new RegExp(`\\bls\\b\\s+(?!-)`),
    category: 'directory-list',
    suggestion: 'Use Read tool (built-in) on the directory path, or Glob tool for pattern matching.',
  },
];

const ALLOWED_PREFIXES = [
  'git', 'npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'node', 'deno',
  'docker', 'docker-compose', 'kubectl', 'curl', 'wget', 'chmod', 'chown',
  'mkdir', 'rmdir', 'cp', 'mv', 'rm', 'tar', 'zip', 'unzip', 'make',
  'cargo', 'go', 'python', 'python3', 'pip', 'pip3', 'ruby', 'gem',
  'bundle', 'brew', 'apt', 'apt-get', 'openkit', 'opencode', 'semgrep',
  'ast-grep', 'jscodeshift', 'tsc', 'tsx', 'eslint', 'prettier',
  'jest', 'vitest', 'mocha', 'pytest',
];

function isAllowedCommand(command) {
  const trimmed = command.trimStart();
  const firstWord = trimmed.split(/\s/)[0];
  return ALLOWED_PREFIXES.includes(firstWord);
}

export function createBashGuardHook({ enforcementLevel = 'strict' } = {}) {
  return {
    id: 'hook.bash-guard',
    name: 'Bash Guard Hook',
    stage: 'foundation',
    run({ toolId, args } = {}) {
      // Only guard bash-like tool calls within kit tools
      if (!args || typeof args !== 'object') {
        return { allowed: true };
      }

      const command = args.command ?? args.cmd ?? null;
      if (!command || typeof command !== 'string') {
        return { allowed: true };
      }

      if (isAllowedCommand(command)) {
        return { allowed: true };
      }

      for (const rule of SUBSTITUTION_RULES) {
        if (rule.pattern.test(command)) {
          const reason = `OS-level command detected (${rule.category}). ${rule.suggestion}`

          if (enforcementLevel === 'permissive') {
            return { allowed: true }
          }

          if (enforcementLevel === 'moderate') {
            return {
              allowed: true,
              warning: reason,
              warnedBy: [`bash-guard:${rule.category}`],
            }
          }

          return {
            allowed: false,
            blocked: true,
            blockedBy: [`bash-guard:${rule.category}`],
            reason,
          };
        }
      }

      return { allowed: true };
    },
  };
}
