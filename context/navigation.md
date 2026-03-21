# Context Navigation — Open Kit

This file is the entry point for context discovery after reading `AGENTS.md`. Use it to locate relevant standards and workflow guides.

Use it to distinguish between live workflow contract docs and approved future-direction artifacts.

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

Directional artifacts for approved future work:

- `docs/briefs/2026-03-21-openkit-evolution-direction.md`
- `docs/specs/2026-03-21-openkit-improvement-analysis.md`
- `docs/architecture/2026-03-21-openkit-evolution-direction.md`
- `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md`

Read those FEATURE-002 artifacts when you need the approved roadmap that led to the live Quick Task+ activation and runtime hardening work. Use `context/core/workflow.md` and companion core docs when you need the current live contract.

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
| Starting a new feature | `core/workflow.md` and FEATURE-002 direction artifacts |

## Current Vs Future Reading Rule

- `context/core/workflow.md`, `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, and `context/core/workflow-state-schema.md` define the live operational contract
- the FEATURE-002 brief, spec, architecture, and ADR define the approved roadmap that informed the current live quick-lane contract
- do not treat `Quick Task+` as a live third mode; current runtime terms remain `Quick Task`, `Full Delivery`, `quick`, and `full`

## Priority

- **Critical**: `core/code-quality.md` before any code generation
- **High**: `core/workflow.md` before any agent delegation
- **High**: `core/session-resume.md` before continuing an in-flight feature
- **Medium**: Task-specific context discovered through agent instructions
