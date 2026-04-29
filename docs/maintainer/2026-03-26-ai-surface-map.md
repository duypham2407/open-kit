# AI Surface Map

Date: 2026-03-26

This document defines the intended reading surface for AI agents working inside OpenKit.

The goal is simple: keep AI anchored to the active workflow contract and away from archive or test noise unless the task explicitly requires that history.

## Single Source Of Truth

AI should treat these files as the highest-priority active contract:

1. `AGENTS.md`
2. `context/core/active-contract.json`
3. `context/core/workflow.md`
4. `context/core/approval-gates.md`
5. `context/core/issue-routing.md`
6. `context/core/workflow-state-schema.md`

If these sources and any historical material disagree, the files above win.

## Active Role Surface

Only these role prompts are active:

- `agents/master-orchestrator.md`
- `agents/quick-agent.md`
- `agents/product-lead-agent.md`
- `agents/solution-lead-agent.md`
- `agents/fullstack-agent.md`
- `agents/code-reviewer.md`
- `agents/qa-agent.md`

If a role file is not in this list, AI should not infer that it is part of the active workflow.

## Active Artifact Surface

Primary artifact directories:

- `docs/tasks/`
- `docs/scope/`
- `docs/solution/`
- `docs/qa/`
- `docs/adr/`

Primary templates:

- `docs/templates/scope-package-template.md`
- `docs/templates/solution-package-template.md`
- `docs/templates/qa-report-template.md`
- `docs/templates/adr-template.md`

AI should think in terms of:

- `scope_package`
- `solution_package`
- `qa_report`

Not in terms of legacy split artifacts such as brief/spec/architecture/plan.

## Active Command Surface

Active commands:

- `/task`
- `/quick-task`
- `/migrate`
- `/delivery`
- `/brainstorm`
- `/write-solution`
- `/execute-solution`
- `/configure-agent-models`
- `/switch-profiles`

## Active Skill Surface

Active skills:

- `brainstorming`
- `find-skills`
- `writing-solution`
- `writing-scope`
- `code-review`
- `verification-before-completion`
- `systematic-debugging`
- `subagent-driven-development`
- `test-driven-development`
- `vercel-composition-patterns`
- `vercel-react-best-practices`
- `vercel-react-native-skills`
- `using-skills`

## Runtime Operational Surface

When resuming or mutating workflow state, AI should rely on:

- `.opencode/workflow-state.json`
- `.opencode/work-items/`
- `.opencode/workflow-state.js`
- `.opencode/lib/workflow-state-rules.js`
- `.opencode/lib/workflow-state-controller.js`
- `src/global/workspace-state.js`

## Ignore By Default

AI should not read these surfaces unless the task explicitly asks for history, audit, migration rationale, or test/debug work.

### Historical and archived material

- `docs/archive/`

### Historical maintainer notes

- `docs/archive/maintainer/2026-03-26-workflow-refactor-audit.md`
- `docs/archive/maintainer/2026-03-26-workflow-refactor-change-map.md`
- `docs/archive/maintainer/2026-03-26-workflow-refactor-release-note.md`
- `docs/archive/maintainer/2026-03-26-workflow-migration-note.md`

### Tests and fixtures

- `.opencode/tests/`
- `tests/`

These locations may still contain legacy wording, transitional examples, or fixture-specific noise that is not part of the live workflow contract.

## Workflow Mental Model

AI should internalize the active workflow like this:

### Quick

- `Quick Agent` (single owner of all quick stages; no other agents participate)

### Migration

- `Master Orchestrator`
- `Solution Lead`
- `Fullstack Agent`
- `Code Reviewer`
- `QA Agent`
- `Master Orchestrator`

### Full Delivery

- `Master Orchestrator`
- `Product Lead`
- `Solution Lead`
- `Fullstack Agent`
- `Code Reviewer`
- `QA Agent`
- `Master Orchestrator`

## Routing Heuristic

- `what are we building?` -> `Product Lead`
- `how should we build it?` -> `Solution Lead`
- `does the code match the approved direction?` -> `Code Reviewer`
- `does the running behavior pass?` -> `QA Agent`
- `what lane, stage, or reroute is next?` -> `Master Orchestrator`

`Master Orchestrator` is routing-only. It must never write code, apply the solution, or impersonate `Fullstack Agent` even when the fix looks trivial.

## Vocabulary Guardrail

AI should avoid reintroducing these names into active workflow output:

- `PM Agent`
- `BA Agent`
- `Architect Agent`
- `Tech Lead Agent`
- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `full_brief`
- `full_spec`
- `full_architecture`
- `full_plan`
- `/write-plan`
- `/execute-plan`
- `writing-plans`
- `writing-specs`

If these terms appear in archive or test surfaces, AI should treat them as non-active noise unless the task is explicitly historical.

## One-Line Rule

Only trust concepts that appear consistently across `AGENTS.md`, `context/core/active-contract.json`, and the current runtime files; everything else is secondary, archival, or task-specific.
