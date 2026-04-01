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
- Read `docs/operator/surface-contract.md` when you need a fast answer to "which OpenKit surface should I use right now?"
- Install the CLI with `npm install -g @duypham93/openkit`, then run `openkit install` to provision all runtime tooling, then `openkit run` for first-time setup and `openkit doctor` to verify readiness
- Once OpenCode is open, use `Ctrl+P` and choose `/task`, `/quick-task`, `/migrate`, or `/delivery` to enter the right workflow lane
- If you want different providers or models per agent, run `/configure-agent-models`, `openkit configure-agent-models --interactive`, or `openkit configure-agent-models --models` before starting the session you care about
- Use `/task` unless you already know the work must start in `Quick Task`, `Migration`, or `Full Delivery`
- Use `context/navigation.md` when you need to locate deeper workflow or standards references

## Minimal First Session

- `npm install -g @duypham93/openkit`
- `openkit install`
- `openkit doctor`
- `openkit run`
- Wait for OpenCode to open with `master-orchestrator`
- Press `Ctrl+P`
- Run `/task <what you want to do>`
- Fall back to `/quick-task`, `/migrate`, or `/delivery` only when the lane is obvious
- If workflow context already exists and you need a plain-language resume snapshot, use `node .opencode/workflow-state.js resume-summary`

## Operator Routes

- Workflow contract: `context/core/workflow.md`
- Lane examples and tie-breakers: `context/core/workflow.md`
- Session resume: `context/core/session-resume.md`
- Command and runtime reality: `context/core/project-config.md`
- Surface contract: `docs/operator/surface-contract.md`
- Supported product and compatibility surfaces: `docs/operator/supported-surfaces.md`
- Detailed usage walkthrough: `docs/operations/runbooks/openkit-daily-usage.md`
- Role boundary quick policy: `docs/maintainer/2026-03-26-role-operating-policy.md`
- AI reading-surface map: `docs/maintainer/2026-03-26-ai-surface-map.md`
- Runtime smoke tests: `docs/operations/runbooks/workflow-state-smoke-tests.md`
- Semgrep integration: `docs/operator/semgrep.md`
- Codemod integration: `docs/operator/codemod.md`
- Governance policy: `docs/governance/README.md`
- Operations support: `docs/operations/README.md`

## Live Operator Surfaces In This Repository

- Slash commands: `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-solution`, `/execute-solution`, `/configure-agent-models`
- Global diagnostics: `openkit doctor`
- Global launcher: `openkit run`
- Global lifecycle: `npm install -g @duypham93/openkit`, `openkit install`, `openkit upgrade`, `openkit uninstall`
- Onboarding helper: `openkit onboard`
- Runtime foundation visibility: `openkit doctor`
- Runtime foundation config template: `assets/openkit.runtime.jsonc.template`
- Runtime inspection: `node .opencode/workflow-state.js status`
- Runtime resume snapshot: `node .opencode/workflow-state.js resume-summary`
- Compatibility diagnostics: `node .opencode/workflow-state.js doctor`
- Current state view: `node .opencode/workflow-state.js show`
- Validation: `node .opencode/workflow-state.js validate`

## Validation Story

- OpenKit does have validation for its own runtime and CLI surfaces through `tests/` and `.opencode/tests/`
- This repository still does not define repo-native build, lint, or test commands for arbitrary generated application code
- Treat `openkit doctor` and `node .opencode/workflow-state.js doctor` as OpenKit/runtime verification, not as substitutes for target-project app testing

## Boundary Notes

- The preferred user path is the global OpenKit install in the OpenCode home directory
- `openkit install-global` remains available as a manual or compatibility setup command, but it is no longer the preferred onboarding step
- `.opencode/opencode.json` remains the checked-in repository-local OpenCode config in this repository
- `src/runtime/` now adds a capability-runtime foundation without changing the canonical workflow path
- `Quick Task+` remains the current semantics of the `quick` lane, not a third live mode
- When role boundaries feel fuzzy, use `docs/maintainer/2026-03-26-role-operating-policy.md` as the short-form contract for who owns scope, solution, code review, and runtime verification
- When AI reading scope or file priority feels fuzzy, use `docs/maintainer/2026-03-26-ai-surface-map.md` as the strict map for active versus historical surfaces
