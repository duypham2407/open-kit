# Context Navigation — Open Kit

This file is the entry point for context discovery after reading `AGENTS.md`. Use it to locate relevant standards and workflow guides.

Use it to distinguish between live workflow contract docs and background/historical artifacts.

Use it to keep the managed-wrapper migration story honest: the live repository-local runtime still centers on `.opencode/opencode.json`, while any future root `opencode.json` wrapper entrypoint remains planned direction until it exists in the tree.

Audience index layers outside `context/`:

- `README.md` is the concise top-level repository entrypoint
- `docs/operator/README.md` is the operator-facing index layer
- `docs/maintainer/README.md` is the maintainer-facing index layer
- in phase 1, those files route readers to canonical docs; they do not replace canonical docs

Repository policies outside `context/` that agents should also consult when relevant:

- `docs/operator/README.md`: operator routing across live surfaces
- `docs/maintainer/README.md`: maintainer routing across canonical and support surfaces
- `docs/governance/`: naming, severity, ADR, and done criteria
- `docs/operations/`: runbook guidance and durable operational-record policy

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

Most historical roadmap and archive docs were intentionally pruned from the working tree during cleanup. If you need older rationale, use git history rather than expecting archived background docs to remain present.

Migration-contract references for the emerging managed wrapper should stay aligned across:

- `README.md`
- `AGENTS.md`
- `context/core/project-config.md`
- `registry.json`
- `.opencode/install-manifest.json`
- `.opencode/opencode.json`

Use `context/core/workflow.md` when you need the current live workflow semantics, and use the companion core docs only for their local operational details. Use git history only when historical rationale matters more than current repository behavior.

## Phase-1 Authority Rule

- `README.md`, `docs/operator/README.md`, and `docs/maintainer/README.md` are navigation layers
- canonical workflow semantics still live in `context/core/workflow.md`
- canonical operational details still live in the relevant `context/core/` files
- governance and operations policies remain canonical in their existing `docs/governance/` and `docs/operations/` locations
- artifact-specific guidance remains canonical in the artifact directories that already own those docs

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
| Daily operator wayfinding | `../docs/operator/README.md` |
| Maintainer wayfinding | `../docs/maintainer/README.md` |
| Starting a new feature | `core/workflow.md` |

## Current Vs Future Reading Rule

- `context/core/workflow.md` is the canonical live workflow-semantics document
- `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` define local operational details and must stay aligned with `context/core/workflow.md`
- older roadmap rationale may no longer be present in the working tree; use git history when historical intent matters more than current behavior
- do not treat `Quick Task+` as a live third mode; current runtime terms remain `Quick Task`, `Full Delivery`, `quick`, and `full`
- do not describe the managed wrapper as fully shipped while `.opencode/opencode.json` remains the live manifest and no root `opencode.json` exists
- do not describe the new audience index layers as canonical replacements for the docs they route to

## Priority

- **Critical**: `core/code-quality.md` before any code generation
- **High**: `core/workflow.md` before any agent delegation
- **High**: `core/session-resume.md` before continuing an in-flight feature
- **Medium**: `../docs/operator/README.md` and `../docs/maintainer/README.md` for audience-specific routing
- **Medium**: Task-specific context discovered through agent instructions
