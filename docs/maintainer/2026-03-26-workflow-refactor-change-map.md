# Workflow Refactor Change Map

Date: 2026-03-26

## Target Contract

- `Master Orchestrator` remains a procedural workflow controller only.
- `Product Lead` replaces the PM/BA handoff chain for active full-delivery work.
- `Solution Lead` replaces the Architect/Tech Lead handoff chain for active full-delivery and migration planning work.
- `Code Reviewer` becomes an explicit review stage before QA in both `full` and `migration` modes.
- `Quick Task` remains lightweight and does not gain a required review stage.

## Canonical Enums To Adopt Everywhere

### Full stages

- `full_intake`
- `full_product`
- `full_solution`
- `full_implementation`
- `full_code_review`
- `full_qa`
- `full_done`

### Migration stages

- `migration_intake`
- `migration_baseline`
- `migration_strategy`
- `migration_upgrade`
- `migration_code_review`
- `migration_verify`
- `migration_done`

### Full approvals

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

### Migration approvals

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

## File-Level Implementation Map

### Core docs

- `context/core/workflow.md`
  - Replace the old full chain `full_brief -> full_spec -> full_architecture -> full_plan` with `full_product -> full_solution`.
  - Insert `full_code_review` before `full_qa`.
  - Insert `migration_code_review` before `migration_verify`.
  - State explicitly that `Master Orchestrator` routes, dispatches, tracks gates, and handles escalation only.
  - Update all feedback loops so product issues route to `full_product`, technical design issues route to `full_solution`, and implementation issues route to `full_implementation`.

- `context/core/approval-gates.md`
  - Replace full-lane gate names with the new chain.
  - Add migration review gates.
  - Keep closure authority with `MasterOrchestrator` only for `qa_to_done` and `migration_verified` closure transitions.

- `context/core/workflow-state-schema.md`
  - Replace old full stages and owners.
  - Add `full_code_review` and `migration_code_review` to the allowed stage enums.
  - Update approval map and owner map.

- `context/core/issue-routing.md`
  - Route full `design_flaw` to `full_solution` / `SolutionLead`.
  - Route full `requirement_gap` to `full_product` / `ProductLead`.
  - Route migration design defects to `migration_strategy` / `SolutionLead`.
  - Add reviewer-originated finding classes so review output can route without guesswork.

- `context/core/session-resume.md`
  - Teach resume logic about `full_code_review` and `migration_code_review`.
  - Replace references to the legacy PM/BA/Architect/Tech Lead chain.

### Agents

- `agents/master-orchestrator.md`
  - Remove any phrasing that suggests business or technical content analysis.
  - Add explicit prohibitions against writing scope, specs, architecture, plans, code, or review findings.

- `agents/product-lead-agent.md`
  - New active role combining PM and BA responsibilities.
  - Owns problem framing, scope, business rules, acceptance criteria, and edge cases.

- `agents/solution-lead-agent.md`
  - New active role combining Architect and Tech Lead responsibilities.
  - Owns baseline, strategy, approach, sequencing, dependency mapping, and validation planning.

- `agents/code-reviewer.md`
  - Change dispatch language from `FullstackAgent`-owned to workflow-owned.
  - Emit routed finding classes: `implementation_issue`, `solution_issue`, `product_scope_issue`, `migration_parity_issue`.

- `agents/fullstack-agent.md`
  - Expect `Solution Lead` handoff instead of `Tech Lead` handoff.
  - Prepare implementation evidence for reviewer-first handoff.

- `agents/qa-agent.md`
  - Focus on behavior, regression, and closure evidence after code review passes.
  - Stop duplicating code-review scope.

- Legacy compatibility role files:
  - `agents/pm-agent.md`
  - `agents/ba-agent.md`
  - `agents/architect-agent.md`
  - `agents/tech-lead-agent.md`
  - Mark as compatibility/deprecated views under `Product Lead` or `Solution Lead`.

### Commands and skills

- `commands/task.md`
  - Route `full` to `Product Lead` and `migration` to `Solution Lead`.

- `commands/delivery.md`
  - Replace `PM Agent` handoff with `Product Lead` handoff.

- `commands/migrate.md`
  - Replace Architect/Tech Lead split with `Solution Lead` ownership and add review stage wording.

- `commands/write-solution.md`
  - Reframe planning as `Solution Lead` work.
  - Stop describing the output as only bite-sized tasks.

- `commands/brainstorm.md`
  - Make brainstorming conditional on ambiguity.
  - Remove any implication that it is the mandatory first move for all design work.

- `skills/writing-solution/SKILL.md`
  - Replace `Tech Lead Agent` ownership with `Solution Lead` ownership.
  - Change the main output from micro-checklists to feature-level solution slices plus validation matrix.

- `skills/writing-scope/SKILL.md`
  - Replace `BA Agent` ownership with `Product Lead` ownership.

- `skills/brainstorming/SKILL.md`
  - Replace mandatory PM/Architect usage language with optional Product Lead/Solution Lead usage when ambiguity remains high.

### Runtime code

- `.opencode/lib/workflow-state-rules.js`
  - Replace full and migration stage sequences.
  - Replace stage owners.
  - Replace approval gates.
  - Update rework routing and recommended owners.

- `.opencode/lib/runtime-guidance.js`
  - Replace next-action strings, artifact readiness windows, and definition-of-done gate lists.

- `.opencode/lib/parallel-execution-rules.js`
  - Replace `TechLeadAgent` authorities with `SolutionLead`.

- `.opencode/lib/workflow-state-controller.js`
  - Replace stage gating from `full_plan` to `full_solution` where planning is the board-ready stage.
  - Replace approval checks for `tech_lead_to_fullstack` with `solution_to_fullstack`.
  - Update task and migration-slice `created_by` defaults to `SolutionLead`.

- `.opencode/workflow-state.js`
  - Ensure help text, summaries, and readiness outputs rely on the updated runtime rules.

- `.opencode/lib/contract-consistency.js`
  - Ensure docs, runtime rules, and schema all agree on the new enums.

### Tests and fixtures

- `.opencode/workflow-state.json`
  - Update the shipped example to the new full-lane approvals.

- `.opencode/tests/workflow-behavior.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `.opencode/tests/workflow-contract-consistency.test.js`
- `.opencode/tests/session-start-hook.test.js`
  - Replace old full stages, full approvals, and legacy owner names.
  - Add explicit assertions for `full_code_review` and `migration_code_review`.

### Registry and bundle sync

- `registry.json`
  - Add `Product Lead` and `Solution Lead` as active runtime roles.
  - Keep legacy split roles only as compatibility metadata.

- `src/install/asset-manifest.js`
  - Add bundled assets for `ProductLead` and `SolutionLead`.
  - Keep asset ids aligned with the checked-in source files.

- `tests/install/install-state.test.js`
  - Update expected bundled asset ids.

- `assets/install-bundle/opencode/**`
  - Mirror all changed active agent, command, and skill files.

## Risk Controls

- Stage and gate rename drift
  - Update `workflow.md`, `workflow-state-schema.md`, runtime rules, CLI, and tests in one batch.

- Runtime hardcoding drift
  - Grep and replace all old full-stage and gate names in `.opencode/lib/` before running tests.

- Registry and bundle drift
  - Update `registry.json`, `src/install/asset-manifest.js`, `tests/install/install-state.test.js`, and bundled mirrors before closing the refactor.

- Master Orchestrator prompt drift
  - Rewrite the prompt to procedural-only language and grep for any remaining content-analysis verbs tied to the orchestrator.

- Planning skill drift
  - Rewrite `skills/writing-solution/SKILL.md` so `Solution Lead` outputs feature-level slices, dependencies, and validation strategy instead of defaulting to micro-tasks.

- Review routing drift
  - Update `agents/code-reviewer.md`, `context/core/issue-routing.md`, and `workflow-state-rules.js` together so every reviewer finding maps to a concrete workflow route.

## Validation Checklist

- Run the workflow-state test suite and fix failures until the new stage and gate names are green.
- Run the install-state tests so asset-manifest and bundle ids stay aligned.
- Grep the repository for legacy active-chain literals:
  - `full_brief`
  - `full_spec`
  - `full_architecture`
  - `full_plan`
  - `pm_to_ba`
  - `ba_to_architect`
  - `architect_to_tech_lead`
  - `tech_lead_to_fullstack`
  - `PMAgent`
  - `BAAgent`
  - `ArchitectAgent`
  - `TechLeadAgent`
- Legacy mentions may remain only in release notes, historical examples, or explicit deprecation notes.
