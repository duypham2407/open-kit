# Context Navigation — Open Kit

This file is the entry point for context discovery. Agents should read this first to locate relevant standards and workflow guides.

## Structure

```
context/
├── navigation.md          ← You are here
├── core/
│   ├── code-quality.md    ← Coding standards (all agents)
│   └── workflow.md        ← 7-agent pipeline, feedback loops, approval gates
```

## Discovery Rules

| Task type | Load first |
|-----------|-----------|
| Any implementation | `core/code-quality.md` |
| Understanding team workflow | `core/workflow.md` |
| Starting a new feature | Both |

## Priority

- **Critical**: `core/code-quality.md` before any code generation
- **High**: `core/workflow.md` before any agent delegation
- **Medium**: Task-specific context discovered through agent instructions
