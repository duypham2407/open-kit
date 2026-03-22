# Operator Guide

This directory is the operator-facing index layer for phase 1 information architecture.

Use it to find the right live docs quickly. Do not treat it as a canonical replacement for the docs it points to.

## Phase-1 Authority Rule

- this directory is an index, not a moved source-of-truth surface
- `README.md` remains the concise top-level repository entrypoint
- `context/core/workflow.md` remains the canonical live workflow-semantics document
- companion operational details remain canonical in `context/core/`
- governance and operations policies remain canonical in `docs/governance/` and `docs/operations/`

## Start Here

- Read `README.md` for the top-level product and runtime boundary summary
- Use `/task` unless you already know the work must start in `Quick Task` or `Full Delivery`
- Use `context/navigation.md` when you need to locate deeper workflow or standards references

## Operator Routes

- Workflow contract: `context/core/workflow.md`
- Session resume: `context/core/session-resume.md`
- Command and runtime reality: `context/core/project-config.md`
- Runtime smoke tests: `docs/operations/runbooks/workflow-state-smoke-tests.md`
- Governance policy: `docs/governance/README.md`
- Operations support: `docs/operations/README.md`

## Live Operator Surfaces In This Repository

- Slash commands: `/task`, `/quick-task`, `/delivery`, `/brainstorm`, `/write-plan`, `/execute-plan`
- Runtime inspection: `node .opencode/workflow-state.js status`
- Diagnostics: `node .opencode/workflow-state.js doctor`
- Current state view: `node .opencode/workflow-state.js show`
- Validation: `node .opencode/workflow-state.js validate`

## Boundary Notes

- The managed wrapper remains a staged direction unless wrapper-owned files actually exist in the worktree
- `.opencode/opencode.json` remains the live checked-in runtime manifest in phase 1
- `Quick Task+` remains the current semantics of the `quick` lane, not a third live mode
