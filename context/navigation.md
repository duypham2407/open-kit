# Context Navigation — Open Kit

This file is the entry point for context discovery. Agents should read this first to locate relevant standards and workflow guides.

Repository policies outside `context/` that agents should also consult when relevant:

- `docs/governance/`: naming, severity, ADR, and done criteria
- `docs/operations/`: execution log, decision log, and review history guidance

## Structure

```
context/
├── navigation.md          ← You are here
├── core/
│   ├── approval-gates.md  ← Approval recording rules
│   ├── code-quality.md    ← Coding standards (all agents)
│   ├── issue-routing.md   ← QA classification and routing
│   ├── project-config.md  ← Current command reality
│   ├── session-resume.md  ← New-session resume protocol
│   ├── workflow-state-schema.md ← Canonical workflow-state fields and enums
│   └── workflow.md        ← Hard-split Quick Task and Full Delivery contract
```

## Discovery Rules

| Task type | Load first |
|-----------|-----------|
| Any implementation | `core/code-quality.md` |
| Understanding team workflow | `core/workflow.md` |
| Recording approvals | `core/approval-gates.md` |
| Routing QA issues | `core/issue-routing.md` |
| Resuming a session | `core/session-resume.md` |
| Updating workflow state | `core/workflow-state-schema.md` |
| Applying governance policy | `../docs/governance/` |
| Recording operational history | `../docs/operations/` |
| Starting a new feature | Both |

## Priority

- **Critical**: `core/code-quality.md` before any code generation
- **High**: `core/workflow.md` before any agent delegation
- **High**: `core/session-resume.md` before continuing an in-flight feature
- **Medium**: Task-specific context discovered through agent instructions
