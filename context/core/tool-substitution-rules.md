# OpenKit Tool Substitution Rules

You are working within a codebase intelligence kit that provides specialized
tools for code understanding.  **Use these tools instead of OS-level commands.**

The runtime enforces these substitutions. Bash calls for the listed OS
commands on source code files are blocked or downgraded based on the active
enforcement level.

## Enforcement Levels

- `strict`: block banned OS-command usage on source code files. This is the default for `quick` and `full` work.
- `moderate`: warn on banned OS-command usage and allow it to proceed only when the lane intentionally tolerates compatibility-oriented fallback. This is the default for `migration` work.
- `permissive`: do not block or warn. Use only for explicit debugging or compatibility escape hatches.

`OPENKIT_ENFORCEMENT_LEVEL` may override the mode-derived default when the runtime explicitly sets it.

## Required Substitutions (Level 1 — OS commands → built-in tools)

| Instead of              | Use                                                |
|-------------------------|----------------------------------------------------|
| `grep <pattern> <file>` | **Grep tool** (built-in) for regex search          |
| `grep -r <pattern> .`  | **Grep tool** with path parameter                  |
| `cat <file>`           | **Read tool** (built-in) — returns line numbers    |
| `head/tail <file>`     | **Read tool** with offset and limit parameters     |
| `find . -name <pat>`   | **Glob tool** (built-in) for file pattern matching |
| `ls <dir>`             | **Read tool** on directory path                    |
| `sed` / `awk`          | **Edit tool** (built-in) for precise replacements  |
| `echo > file`          | **Write tool** (built-in) for creating files       |
| `wc -l <file>`         | **Read tool** — line numbers are included          |

## Preferred Escalations (Level 2 — built-in tools → kit intelligence tools)

When the kit's intelligence tools are available, **prefer them over the basic
built-in tools** for the corresponding task.  These are not runtime-blocked but
are strongly recommended — they provide structural and semantic understanding
that regex and glob cannot match.

| Task | Basic tool | Preferred kit tool | When to escalate |
|---|---|---|---|
| Search code by meaning | Grep tool | `tool.semantic-search` | Exploring unfamiliar code, vague queries, conceptual search |
| Search code structure | Grep tool | `tool.ast-grep-search` | Looking for structural patterns (function shapes, class members) |
| Find a symbol definition | Glob tool | `tool.find-symbol` | Know the symbol name, want its definition location |
| Trace imports/exports | Glob + Grep | `tool.import-graph` | Need to know what a file imports or who imports it |
| Map module dependencies | Glob + Grep | `tool.find-dependencies` / `tool.find-dependents` | Dependency graph traversal |
| Understand file structure | Read tool (full file) | `tool.syntax-outline` | Want the shape of a file before reading it all |
| Get context at position | Read tool (offset) | `tool.syntax-context` | Need surrounding code around a specific location |
| Locate a construct | Read tool + search | `tool.syntax-locate` | Find the line/position of a named construct in a file |
| Quick symbol navigation | Read + Grep | `tool.heuristic-lsp` | Lightweight symbol navigation when graph-backed tools are unavailable |
| Navigate to definition | Read + Grep | `tool.graph-goto-definition` | IDE-style "go to definition" |
| Find all references | Grep tool | `tool.graph-find-references` | Find every usage of a symbol across the codebase |
| Understand call chains | Manual tracing | `tool.graph-call-hierarchy` | Need to see callers/callees of a function |
| Preview multi-file rename | Grep + Edit | `tool.graph-rename-preview` | Want to see all locations that would change before renaming |
| Multi-file code transform | Edit tool (repeated) | `tool.codemod-preview` / `tool.codemod-apply` | Same transformation applied across many files |
| Quality/security scan | Manual review | `tool.rule-scan` / `tool.security-scan` | Before handoff or completion claims |

**Fallback rule:** if a kit tool is unavailable, not indexed, or degraded, fall
back to the corresponding basic built-in tool.  But always try the smarter tool
first.

## When Bash IS appropriate

Use Bash freely for these operations — they are **not blocked**:

- `git` commands (status, diff, log, commit, push, etc.)
- Package managers (`npm`, `pnpm`, `yarn`, `bun`, `pip`, `cargo`, `go`)
- Build / test runners (`node`, `tsc`, `jest`, `vitest`, `pytest`, `make`)
- Containers (`docker`, `kubectl`)
- System operations (`mkdir`, `cp`, `mv`, `rm`, `chmod`, `curl`)
- Linters and formatters (`eslint`, `prettier`, `semgrep`, `ast-grep`)

## Decision Guide

1. **Need to find files?** → Glob tool (or `tool.find-symbol` if you know the symbol name)
2. **Need to search file contents?** → Grep tool (or `tool.semantic-search` for meaning-based search, or `tool.ast-grep-search` for structural patterns)
3. **Need to read a file?** → Read tool (or `tool.syntax-outline` first to understand structure)
4. **Need to understand dependencies?** → `tool.import-graph` / `tool.find-dependencies` / `tool.find-dependents`
5. **Need to navigate code?** → `tool.graph-goto-definition` / `tool.graph-find-references` / `tool.graph-call-hierarchy`
6. **Need to modify a file?** → Edit tool (or `tool.codemod-preview` → `tool.codemod-apply` for multi-file transforms)
7. **Need to create a file?** → Write tool
8. **Need to run a program?** → Bash tool (allowed)
9. **Need to run git?** → Bash tool (allowed)
