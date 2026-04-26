// ---------------------------------------------------------------------------
// src/mcp-server/tool-schemas.js
//
// Maps kit tool IDs to JSON Schema input definitions for the MCP protocol.
// Each tool that agents should be able to call needs an entry here.
// ---------------------------------------------------------------------------

/** @type {Record<string, { description: string, inputSchema: object }>} */
export const TOOL_SCHEMAS = {
  // ── Graph tools ──────────────────────────────────────────────────────
  'tool.find-symbol': {
    description:
      'Search the project import graph for a symbol by name. Returns all files that declare or export the given symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Symbol name to search for' },
      },
      required: ['name'],
    },
  },

  'tool.find-dependencies': {
    description:
      'Find what files a given file imports (its dependencies). Returns the list of files that the target file depends on.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute or project-relative file path' },
        depth: { type: 'number', description: 'Traversal depth (default 1)' },
      },
      required: ['filePath'],
    },
  },

  'tool.find-dependents': {
    description:
      'Find what files import a given file (reverse dependencies). Returns the list of files that depend on the target.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute or project-relative file path' },
        depth: { type: 'number', description: 'Traversal depth (default 1)' },
      },
      required: ['filePath'],
    },
  },

  'tool.import-graph': {
    description:
      'Query the project import graph. Actions: "status" (graph status), "index" (trigger full project indexing), "index-file" (index a single file), "summary" (node/edge/symbol counts).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'index', 'index-file', 'summary'],
          description: 'Action to perform (default: status)',
        },
        filePath: { type: 'string', description: 'File path (required for index-file action)' },
        maxFiles: { type: 'number', description: 'Max files to index (default 2000, for index action)' },
      },
    },
  },

  'tool.goto-definition': {
    description:
      'Find the definition(s) of a symbol using the project graph database.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to look up' },
      },
      required: ['symbol'],
    },
  },

  'tool.find-references': {
    description:
      'Find all references to a symbol across the project. Returns both definitions and usage sites.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to find references for' },
      },
      required: ['symbol'],
    },
  },

  'tool.call-hierarchy': {
    description:
      'Navigate the call hierarchy of a symbol. Use direction "outgoing" to see what it calls, or "incoming" to see who calls it.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name' },
        direction: {
          type: 'string',
          enum: ['incoming', 'outgoing'],
          description: 'Call direction (default: outgoing)',
        },
      },
      required: ['symbol'],
    },
  },

  'tool.rename-preview': {
    description:
      'Preview a rename: find all definitions, references, and import sites of a symbol and show what would change. Does not apply changes.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Current symbol name' },
        newName: { type: 'string', description: 'Desired new name' },
      },
      required: ['symbol', 'newName'],
    },
  },

  'tool.semantic-search': {
    description:
      'Search the project for relevant code using semantic context. Combines session memory, import graph, and symbol index. ' +
      'Actions: "search" (keyword or embedding), "context" (build context for a file/symbol), "session" (session touches), "recent" (recent activity).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'context', 'session', 'recent'],
          description: 'Action to perform (default: search)',
        },
        query: { type: 'string', description: 'Search query (required for search action)' },
        topK: { type: 'number', description: 'Max results (default 20)' },
        minScore: { type: 'number', description: 'Minimum similarity threshold (default 0.1)' },
        filePath: { type: 'string', description: 'File path (for context action)' },
        symbol: { type: 'string', description: 'Symbol name (for context action)' },
        recentLimit: { type: 'number', description: 'Max recent entries (default 20, for context action)' },
        limit: { type: 'number', description: 'Max entries (default 50, for recent action)' },
      },
    },
  },

  // ── Syntax tools ─────────────────────────────────────────────────────
  'tool.syntax-outline': {
    description:
      'Returns a Tree-sitter-derived outline for supported files. Pass filePath for a single file, or projectWide=true for a condensed project-wide symbol map.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'File path for single-file outline' },
        projectWide: { type: 'boolean', description: 'Scan entire project (default false)' },
        maxFiles: { type: 'number', description: 'Max files for project-wide scan (default 500)' },
      },
    },
  },

  'tool.syntax-context': {
    description:
      'Returns the nearest syntax node, parent, and children around a position in a file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Target file path' },
        line: { type: 'number', description: 'Line number' },
        column: { type: 'number', description: 'Column number' },
        depth: { type: 'number', description: 'Tree depth' },
      },
      required: ['filePath'],
    },
  },

  'tool.syntax-locate': {
    description:
      'Finds nodes of a given syntax type in a supported file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Target file path' },
        nodeType: { type: 'string', description: 'AST node type to locate (default: program)' },
      },
      required: ['filePath'],
    },
  },

  // ── AST tools ────────────────────────────────────────────────────────
  'tool.ast-search': {
    description:
      'Structured search over parsed document trees. Supports JSON/JSONC (key/value search) and JS/TS (AST node type and text search via tree-sitter).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Target file path' },
        query: {
          description: 'Search query: a string, or object with {nodeType, text} for JS/TS or {key, value} for JSON',
          oneOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: {
                nodeType: { type: 'string' },
                text: { type: 'string' },
                key: { type: 'string' },
                value: { type: 'string' },
              },
            },
          ],
        },
      },
      required: ['filePath'],
    },
  },

  'tool.ast-grep-search': {
    description:
      'Structural code search using ast-grep patterns. Finds code matching an AST pattern across the project or a specific file.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'ast-grep pattern, e.g. "console.log($A)"' },
        lang: { type: 'string', description: 'Language (default: typescript). Also accepts "language"' },
        path: { type: 'string', description: 'Target file or directory (default: project root)' },
      },
      required: ['pattern'],
    },
  },

  'tool.ast-replace': {
    description:
      'Previews structured JSON or JSONC replacement without mutating files.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Target JSON/JSONC file' },
        pointer: { type: 'string', description: 'JSON Pointer path (default: /)' },
        replacement: { description: 'Value to replace at the pointer location' },
      },
      required: ['filePath', 'replacement'],
    },
  },

  // ── Codemod tools ────────────────────────────────────────────────────
  'tool.codemod-preview': {
    description:
      'Previews a jscodeshift codemod transformation without writing changes. Returns a diff of what would change.',
    inputSchema: {
      type: 'object',
      properties: {
        transform: { type: 'string', description: 'Path to jscodeshift transform file' },
        inlineTransform: { type: 'string', description: 'Inline transform function source: (fileInfo, api) => ...' },
        files: { type: 'array', items: { type: 'string' }, description: 'Target file paths' },
        file: { type: 'string', description: 'Single target file (alternative to files)' },
      },
    },
  },

  'tool.codemod-apply': {
    description:
      'Applies a jscodeshift codemod transformation and writes changes to disk.',
    inputSchema: {
      type: 'object',
      properties: {
        transform: { type: 'string', description: 'Path to jscodeshift transform file' },
        inlineTransform: { type: 'string', description: 'Inline transform function source' },
        files: { type: 'array', items: { type: 'string' }, description: 'Target file paths' },
        file: { type: 'string', description: 'Single target file (alternative to files)' },
        dryRun: { type: 'boolean', description: 'Skip writing to disk (default false)' },
      },
    },
  },

  // ── Audit tools ──────────────────────────────────────────────────────
  'tool.rule-scan': {
    description:
      'Run the Semgrep-backed OpenKit quality/rule scan against the current project or a target path. Returns structured availability, findings, triage summary, and evidence hints.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative or in-project absolute target path (default: project root)' },
        config: { type: 'string', description: 'Semgrep config alias or path (default: auto bundled quality pack)' },
      },
    },
  },

  'tool.security-scan': {
    description:
      'Run the Semgrep-backed OpenKit security scan against the current project or a target path. Returns structured availability, findings, triage summary, and evidence hints.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative or in-project absolute target path (default: project root)' },
        config: { type: 'string', description: 'Semgrep config alias or path (default: bundled security-audit pack)' },
      },
    },
  },

  // ── Workflow tools ───────────────────────────────────────────────────
  'tool.workflow-state': {
    description:
      'Read governed workflow runtime state. Commands: "status", "show", "doctor", "metrics".',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['status', 'show', 'doctor', 'metrics'],
          description: 'Command to run (default: status)',
        },
      },
    },
  },

  'tool.runtime-summary': {
    description: 'Reads workflow-backed runtime summary including capabilities and tool availability.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  'tool.evidence-capture': {
    description: 'Records verification evidence through the workflow kernel.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Evidence identifier' },
        kind: { type: 'string', description: 'Evidence kind (default: runtime)' },
        scope: { type: 'string', description: 'Evidence scope' },
        summary: { type: 'string', description: 'Human-readable summary' },
        source: { type: 'string', description: 'Source identifier (default: runtime-tool)' },
        command: { type: 'string', description: 'Command that produced the evidence' },
        exit_status: { type: 'number', description: 'Exit code' },
        artifact_refs: { type: 'array', items: { type: 'string' }, description: 'Related artifact references' },
      },
      required: ['id', 'scope', 'summary'],
    },
  },

  // ── Analysis tools ───────────────────────────────────────────────────
  'tool.look-at': {
    description: 'Inspects one file or directory with lightweight metadata (size, type, line count, first lines).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'File or directory path to inspect' },
      },
      required: ['filePath'],
    },
  },

  'tool.embedding-index': {
    description:
      'Manage the project embedding index for semantic code search. Actions: "status" (show indexer stats), "index-file" (embed a single file), "index-project" (embed all indexed files).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'index-file', 'index-project'],
          description: 'Action to perform (default: status)',
        },
        filePath: { type: 'string', description: 'File path (required for index-file action)' },
        maxFiles: { type: 'number', description: 'Max files (default 2000, for index-project action)' },
        force: { type: 'boolean', description: 'Force re-index (default false, for index-project action)' },
      },
    },
  },

  // ── LSP tools ────────────────────────────────────────────────────────
  'tool.lsp-symbols': {
    description:
      'Project symbol index for JavaScript and TypeScript. Uses graph database when available, falls back to heuristic regex.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter by symbol name (omit for all symbols)' },
      },
    },
  },

  'tool.lsp-diagnostics': {
    description: 'Source diagnostics using the project graph database for import analysis.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  'tool.lsp-goto-definition': {
    description: 'Find symbol definitions. Uses graph database when available, falls back to heuristic.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to look up' },
        filePath: { type: 'string', description: 'Scope to a specific file' },
      },
      required: ['symbol'],
    },
  },

  'tool.lsp-find-references': {
    description: 'Find symbol references across the project using graph database or heuristic fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to find references for' },
      },
      required: ['symbol'],
    },
  },

  'tool.lsp-prepare-rename': {
    description: 'Preview rename safety for a symbol using graph-backed cross-file analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to check rename readiness for' },
      },
      required: ['symbol'],
    },
  },

  'tool.lsp-rename': {
    description: 'Preview multi-file rename impact without mutating files.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Current symbol name' },
        newName: { type: 'string', description: 'Desired new name' },
      },
      required: ['symbol', 'newName'],
    },
  },

  // ── External tools ───────────────────────────────────────────────────
  'tool.typecheck': {
    description:
      'Run TypeScript compiler in --noEmit mode to surface type errors. Returns structured diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Filter diagnostics to this file' },
        project: { type: 'string', description: 'Override tsconfig path' },
        timeout: { type: 'number', description: 'Execution timeout in ms (default 60000)' },
      },
    },
  },

  'tool.lint': {
    description:
      'Run the project linter (ESLint or Biome) and return structured findings.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Scope lint to a specific file (default: all)' },
        fix: { type: 'boolean', description: 'Auto-fix fixable issues (default false)' },
        timeout: { type: 'number', description: 'Execution timeout in ms (default 60000)' },
      },
    },
  },

  'tool.test-run': {
    description:
      'Run project tests and return structured pass/fail results. Auto-detects the test framework.',
    inputSchema: {
      type: 'object',
      properties: {
        testFile: { type: 'string', description: 'Run a specific test file' },
        testName: { type: 'string', description: 'Run a specific test by name' },
        timeout: { type: 'number', description: 'Execution timeout in ms (default 120000)' },
      },
    },
  },
};

/**
 * Returns the set of tool IDs that should be exposed via MCP.
 * Internal/workflow-state-mutating tools (continuation, delegation, session,
 * profile-switch, etc.) are intentionally excluded — they are runtime-internal.
 */
export function getMcpExposedToolIds() {
  return new Set(Object.keys(TOOL_SCHEMAS));
}
