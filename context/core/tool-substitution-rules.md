# OpenKit Tool Substitution Rules

You are working within a codebase intelligence kit that provides specialized
tools for code understanding.  **Use these tools instead of OS-level commands.**

The runtime enforces these substitutions.  Bash calls for the listed OS
commands on source code files will be blocked in strict mode.

## Required Substitutions

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

## When Bash IS appropriate

Use Bash freely for these operations — they are **not blocked**:

- `git` commands (status, diff, log, commit, push, etc.)
- Package managers (`npm`, `pnpm`, `yarn`, `bun`, `pip`, `cargo`, `go`)
- Build / test runners (`node`, `tsc`, `jest`, `vitest`, `pytest`, `make`)
- Containers (`docker`, `kubectl`)
- System operations (`mkdir`, `cp`, `mv`, `rm`, `chmod`, `curl`)
- Linters and formatters (`eslint`, `prettier`, `semgrep`, `ast-grep`)

## Decision Guide

1. **Need to find files?** → Glob tool
2. **Need to search file contents?** → Grep tool
3. **Need to read a file?** → Read tool
4. **Need to modify a file?** → Edit tool
5. **Need to create a file?** → Write tool
6. **Need to run a program?** → Bash tool (allowed)
7. **Need to run git?** → Bash tool (allowed)
