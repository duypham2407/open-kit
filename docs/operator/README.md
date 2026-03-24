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
- Read `docs/operations/runbooks/openkit-daily-usage.md` for the detailed day-to-day usage path in this repository
- Install the CLI with `npm install -g @duypham93/openkit`, then run `openkit run` for first-time setup and `openkit doctor` to verify readiness
- Once OpenCode is open, use `Ctrl+P` and choose `/task`, `/quick-task`, `/migrate`, or `/delivery` to enter the right workflow lane
- Use `/task` unless you already know the work must start in `Quick Task`, `Migration`, or `Full Delivery`
- Use `context/navigation.md` when you need to locate deeper workflow or standards references

## Operator Routes

- Workflow contract: `context/core/workflow.md`
- Lane examples and tie-breakers: `context/core/workflow.md`
- Session resume: `context/core/session-resume.md`
- Command and runtime reality: `context/core/project-config.md`
- Detailed usage walkthrough: `docs/operations/runbooks/openkit-daily-usage.md`
- Runtime smoke tests: `docs/operations/runbooks/workflow-state-smoke-tests.md`
- Governance policy: `docs/governance/README.md`
- Operations support: `docs/operations/README.md`

## Live Operator Surfaces In This Repository

- Slash commands: `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-plan`, `/execute-plan`
- Global diagnostics: `openkit doctor`
- Global launcher: `openkit run`
- Global lifecycle: `npm install -g @duypham93/openkit`, `openkit upgrade`, `openkit uninstall`
- Runtime inspection: `node .opencode/workflow-state.js status`
- Compatibility diagnostics: `node .opencode/workflow-state.js doctor`
- Current state view: `node .opencode/workflow-state.js show`
- Validation: `node .opencode/workflow-state.js validate`

## Boundary Notes

- The preferred user path is the global OpenKit install in the OpenCode home directory
- `openkit install-global` remains available as a manual or compatibility setup command, but it is no longer the preferred onboarding step
- `.opencode/opencode.json` remains the checked-in repository-local OpenCode config in this repository
- `Quick Task+` remains the current semantics of the `quick` lane, not a third live mode
