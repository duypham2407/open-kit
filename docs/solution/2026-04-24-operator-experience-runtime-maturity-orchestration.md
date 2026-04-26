---
artifact_type: solution_package
version: 1
status: draft
feature_id: FEATURE-938
feature_slug: operator-experience-runtime-maturity-orchestration
source_scope_package: docs/scope/2026-04-24-operator-experience-runtime-maturity-orchestration.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Operator Experience, Runtime Maturity, and Execution Orchestration Roadmap

## Title

Three-phase roadmap implementation for clearer operator guidance, standardized runtime/tooling maturity, and conservative deeper orchestration visibility.

## Dependencies

- No new npm package dependency is required for this roadmap delivery.
- No new environment variable is required.
- Keep the existing Node runtime requirement from `package.json`: Node `>=18`.
- Use only existing validation surfaces from `package.json` and targeted Node tests:
  - `npm run verify:governance`
  - `npm run verify:runtime-foundation`
  - `npm run verify:all`
  - targeted `node --test ...` commands listed per slice
- Do not introduce app-native build, lint, test, CI, package-manager, or deployment commands for target projects. This feature is about OpenKit product/runtime surfaces, not arbitrary generated applications.
- If runtime/tooling status reporting is extended, tests must be written first for the expected state labels before production code changes.

## Chosen Approach

Implement the approved scope as a sequential roadmap hardening pass with three strictly ordered feature slices:

1. Phase 1 operator experience clarity through targeted operator, maintainer, workflow, and runtime-surface documentation alignment.
2. Phase 2 runtime/tooling maturity standardization through command-reality docs plus small runtime metadata/read-model updates where existing surfaces already expose health, resume, tool, issue, or evidence status.
3. Phase 3 execution orchestration deepening through visible orchestration expectations and conservative runtime/task-board readiness checks only after Phase 1 and Phase 2 are accepted.

This path avoids a new lane, command family, runtime mode, task-board model, or external dependency. It treats documentation as the primary product surface for the roadmap while allowing small runtime metadata/test updates where the approved acceptance criteria require inspectable status rather than prose alone.

## Impacted Surfaces

### Operator and maintainer documentation

- `README.md`
- `AGENTS.md`
- `docs/operator/README.md`
- `docs/operator/surface-contract.md`
- `docs/operator/supported-surfaces.md`
- `docs/operations/runbooks/openkit-daily-usage.md`
- `docs/operations/runbooks/workflow-state-smoke-tests.md`
- `docs/maintainer/README.md`
- `docs/maintainer/command-matrix.md`
- `docs/maintainer/test-matrix.md`
- `docs/maintainer/conditional-parallel-execution-note.md`
- `docs/maintainer/parallel-execution-matrix.md`
- `docs/maintainer/policy-execution-traceability.md`
- `docs/kit-internals/01-system-overview.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `docs/kit-internals/05-semantic-search-and-code-intelligence.md`
- `docs/kit-internals/07-operator-runbook.md`
- `docs/kit-internals/08-troubleshooting.md`

### Canonical workflow and runtime context

- `context/core/workflow.md`
- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`
- `context/core/session-resume.md`
- `context/core/approval-gates.md`
- `context/core/issue-routing.md`
- `context/core/workflow-state-schema.md`
- `context/navigation.md`

### Runtime and CLI metadata/read-model surfaces

- `bin/openkit.js`
- `src/cli/commands/doctor.js`
- `src/cli/commands/run.js`
- `src/runtime/runtime-config-loader.js`
- `src/runtime/capability-registry.js`
- `src/runtime/create-runtime-interface.js`
- `src/runtime/create-tools.js`
- `src/runtime/tools/tool-registry.js`
- `src/runtime/tools/analysis/embedding-index.js`
- `src/runtime/tools/graph/semantic-search.js`
- `src/runtime/tools/graph/import-graph.js`
- `src/runtime/tools/graph/find-dependencies.js`
- `src/runtime/tools/graph/find-dependents.js`
- `src/runtime/tools/graph/find-symbol.js`
- `src/runtime/tools/syntax/syntax-outline.js`
- `src/runtime/tools/syntax/syntax-context.js`
- `src/runtime/tools/syntax/syntax-locate.js`
- `src/runtime/tools/ast/ast-search.js`
- `src/runtime/tools/ast/ast-grep-search.js`
- `src/runtime/tools/codemod/codemod-preview.js`
- `src/runtime/tools/codemod/codemod-apply.js`
- `.opencode/lib/runtime-summary.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/workflow-state.js`
- `registry.json`
- `.opencode/install-manifest.json`

### Tests

- `.opencode/tests/workflow-contract-consistency.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/task-board-rules.test.js`
- `.opencode/tests/parallel-execution-runtime.test.js`
- `.opencode/tests/migration-lifecycle.test.js`
- `tests/cli/openkit-cli.test.js`
- `tests/cli/onboard.test.js`
- `tests/runtime/doctor.test.js`
- `tests/runtime/capability-registry.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/runtime/registry-metadata.test.js`
- `tests/runtime/graph-tools.test.js`
- `tests/runtime/semantic-memory.test.js`
- `tests/runtime/external-tools.test.js`
- `tests/install/materialize.test.js`
- `tests/global/doctor.test.js`

## Boundaries And Components

- Documentation is the primary implementation vehicle for Phase 1 and most of Phase 3.
- Runtime changes are allowed only where acceptance criteria require the existing CLI/runtime/workflow surfaces to expose standardized health, capability, readiness, issue, or evidence status.
- Existing command names and lane enums must remain unchanged: `quick`, `migration`, and `full`; `/task`, `/quick-task`, `/migrate`, and `/delivery`; `Quick Task`, `Migration`, and `Full Delivery`.
- `Quick Task+` remains current quick-lane semantics only. Do not add `quick_plus`, `quick_task_plus`, or a fourth mode.
- Full-delivery task boards remain full-only. Migration slice tracking remains migration-specific and parity-oriented.
- Master Orchestrator remains procedural. Do not assign scope, solution, implementation, code review, or QA judgment to it.
- Compatibility runtime commands remain maintainer diagnostics and state-inspection surfaces, not the preferred product install path.

## Interfaces And Data Contracts

### Capability status vocabulary

If runtime metadata is extended, standardize on this small vocabulary for capability and command state:

- `available`: implemented and dependencies/configuration required for use are present.
- `unavailable`: not usable in the current environment.
- `degraded`: usable through fallback behavior or with reduced accuracy/scope.
- `preview`: implemented as an early or partial surface whose limitations must be visible.
- `compatibility_only`: available for repository-local compatibility or maintainer diagnostics, not the preferred operator product path.
- `not_configured`: implemented but disabled because required local config or provider settings are absent.

Do not add new state names unless an implementation test proves the existing vocabulary cannot represent the case.

### Validation surface labels

Documentation and runtime summaries should label evidence with one of these surfaces:

- `global_cli`: `openkit ...` product commands.
- `in_session`: slash-command workflow path and stage/handoff behavior.
- `compatibility_runtime`: `.opencode/workflow-state.js` state and diagnostic commands.
- `runtime_tooling`: OpenKit runtime tools, graph, semantic search, AST, syntax, codemod, MCP, browser, or background execution surfaces.
- `documentation`: roadmap, operator, maintainer, governance, and runbook artifacts.
- `target_project_app`: application build/lint/test commands only when the target project actually defines them.

### Command reality contract

- Current commands must be documented as current only when they exist in `package.json`, `bin/openkit.js`, `.opencode/workflow-state.js`, or checked-in runtime command surfaces.
- Future example commands must be labeled illustrative or planned.
- If a command appears in operator docs but no longer exists, treat that as a documentation defect in Phase 1 or Phase 2, not as permission to invent behavior silently.

## Risks And Trade-offs

- `docs/operator/README.md` currently mentions `openkit install` in the onboarding path, while the approved scope emphasizes `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall`. Fullstack should reconcile this wording with implemented CLI reality rather than deleting valid compatibility/manual setup notes wholesale.
- Runtime capability state may already be partially represented in several places. Prefer centralizing status vocabulary in the capability registry/read-model rather than duplicating bespoke labels per tool.
- `npm run verify:all` is the strongest maintainer gate but can be slower than targeted tests. Use targeted tests while iterating, then run `npm run verify:all` before handoff when implementation touches runtime/CLI code.
- Documentation-only changes can still regress command reality. Use `npm run verify:governance` at minimum after docs/prompt/metadata changes.
- Parallel execution is not safe for this feature because the three phases intentionally modify overlapping command, workflow, operator, maintainer, and runtime-surface docs.

## Recommended Path

- Execute phases sequentially without a task board unless the active full-delivery runtime already requires one for FEATURE-938.
- Use TDD for any runtime or CLI logic change: add/update the relevant `node --test` expectation first, confirm it fails for the missing behavior, then implement the smallest runtime or CLI change.
- Keep Phase 1 mostly documentation and command-reality cleanup.
- Keep Phase 2 focused on standardizing existing runtime/read-model outputs rather than adding new tool systems.
- Keep Phase 3 as orchestration visibility and readiness hardening, not unrestricted parallel execution.

## Implementation Slices

### [ ] Slice 1: Phase 1 Operator Experience Clarity

- **Files**:
  - `README.md`
  - `AGENTS.md`
  - `docs/operator/README.md`
  - `docs/operator/surface-contract.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/operations/runbooks/openkit-daily-usage.md`
  - `docs/maintainer/README.md`
  - `docs/maintainer/command-matrix.md`
  - `context/core/workflow.md`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `context/navigation.md`
  - `.opencode/tests/workflow-contract-consistency.test.js`
  - `tests/runtime/governance-enforcement.test.js`
- **Goal**: make the preferred operator path, command-surface boundaries, lane expectations, artifact expectations, and missing app-native validation behavior obvious from the operator and maintainer entrypoints.
- **Validation Command**:
  - `npm run verify:governance`
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
- **Details**:
  - Align operator-facing onboarding around `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall` as the preferred product path.
  - Keep `openkit install`, `openkit install-global`, and repository-local workflow-state commands documented only as manual, compatibility, or diagnostic surfaces when they exist.
  - Make the three-surface model explicit everywhere an operator might start: product CLI path, in-session command path, and compatibility runtime path.
  - Add or tighten lane-aware artifact expectation tables for Quick Task, Migration, and Full Delivery. Mark quick task cards optional. Keep Product Lead scope before Solution Lead solution mandatory for full delivery.
  - State that missing target-project build/lint/test commands are a validation constraint. Do not substitute OpenKit runtime checks for app behavior.
  - Update command and navigation indexes so they point to canonical docs and do not contradict `context/core/workflow.md`, `context/core/project-config.md`, or `context/core/runtime-surfaces.md`.
  - Reviewer focus: stale or conflicting command names, accidental fourth-lane language, unclear product-vs-compatibility wording.
  - QA focus: a new operator can answer which command surface to use, what artifact to expect, and what validation is unavailable without reading source code.

### [ ] Slice 2: Phase 2 Runtime/Tooling Maturity Standardization

- **Files**:
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `context/core/session-resume.md`
  - `context/core/workflow-state-schema.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/maintainer/command-matrix.md`
  - `docs/maintainer/test-matrix.md`
  - `docs/operations/runbooks/workflow-state-smoke-tests.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `docs/kit-internals/05-semantic-search-and-code-intelligence.md`
  - `docs/kit-internals/07-operator-runbook.md`
  - `docs/kit-internals/08-troubleshooting.md`
  - `src/runtime/capability-registry.js`
  - `src/runtime/create-runtime-interface.js`
  - `src/runtime/runtime-config-loader.js`
  - `src/runtime/create-tools.js`
  - `src/runtime/tools/tool-registry.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/workflow-state.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `tests/runtime/capability-registry.test.js`
  - `tests/runtime/runtime-bootstrap.test.js`
  - `tests/runtime/doctor.test.js`
  - `tests/runtime/graph-tools.test.js`
  - `tests/runtime/semantic-memory.test.js`
  - `tests/runtime/external-tools.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
  - `.opencode/tests/workflow-state-controller.test.js`
- **Goal**: standardize how runtime health, resume state, command reality, tool capability state, validation evidence, active artifacts, issues, and work-item readiness are inspected.
- **Validation Command**:
  - `npm run verify:runtime-foundation`
  - `node --test "tests/runtime/doctor.test.js"`
  - `node --test "tests/runtime/capability-registry.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
- **TDD Expectation**:
  - Before changing any runtime/CLI output, add or update tests that assert the expected status vocabulary and validation-surface labels.
  - Minimum red tests should cover at least one `available`, one `degraded` or `not_configured`, and one `compatibility_only` report path if those paths are implemented in this slice.
- **Details**:
  - Add the capability status vocabulary to the capability registry/read-model only if the current runtime lacks a centralized way to report it.
  - Extend `openkit doctor` and workflow-state diagnostic docs to distinguish product install health from compatibility runtime integrity.
  - Make resume/status/readiness outputs and docs name active work item, workflow state, artifact links, issue state, verification evidence, and blocking-vs-informational conditions where those surfaces already exist.
  - Keep semantic search, graph, AST, syntax, codemod, MCP, browser verification, and background execution honest about dependency/config/indexing limitations.
  - Separate OpenKit runtime/CLI validation from `target_project_app` validation in docs and runtime summaries.
  - Update test-matrix and command-matrix docs so every documented validation path maps to a real command in `package.json`, `bin/openkit.js`, or `.opencode/workflow-state.js`.
  - Reviewer focus: duplicated status vocabularies, claims of full availability without dependency checks, command docs that drift from implemented behavior.
  - QA focus: doctor/resume/status/readiness surfaces show actionable state and do not imply target app validation.

### [ ] Slice 3: Phase 3 Execution Orchestration Deepening

- **Files**:
  - `context/core/workflow.md`
  - `context/core/approval-gates.md`
  - `context/core/issue-routing.md`
  - `context/core/workflow-state-schema.md`
  - `docs/maintainer/2026-03-26-role-operating-policy.md`
  - `docs/maintainer/conditional-parallel-execution-note.md`
  - `docs/maintainer/parallel-execution-matrix.md`
  - `docs/maintainer/policy-execution-traceability.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/kit-internals/01-system-overview.md`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/workflow-state.js`
  - `.opencode/tests/task-board-rules.test.js`
  - `.opencode/tests/parallel-execution-runtime.test.js`
  - `.opencode/tests/migration-lifecycle.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: make deeper full-delivery and migration orchestration inspectable while preserving phase-gate readiness, role boundaries, full-only task boards, conservative parallelism, and migration parity semantics.
- **Validation Command**:
  - `node --test ".opencode/tests/task-board-rules.test.js"`
  - `node --test ".opencode/tests/parallel-execution-runtime.test.js"`
  - `node --test ".opencode/tests/migration-lifecycle.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `npm run verify:governance`
- **TDD Expectation**:
  - If task-board readiness, integration checks, safe parallel zone reporting, QA ownership reporting, or migration slice status output changes, write failing workflow-state tests first.
  - Runtime tests must prove that missing safe parallel zones or sequential constraints keep coordination conservative rather than allowing unrestricted overlap.
- **Details**:
  - Add a Phase 3 readiness statement that Phase 1 and Phase 2 acceptance must be satisfied or explicitly listed as blockers before deeper orchestration is treated as ready.
  - Preserve existing full-delivery task-board semantics from `context/core/workflow.md`: task boards belong only to full-delivery work items, safe parallel zones are repo-relative artifact path-prefix allowlists, and sequential constraints are ordered chains.
  - Ensure role-boundary docs continue to describe Master Orchestrator as route/state/gate control only.
  - Make task owner, task status, artifact refs, dependencies/sequential constraints, safe parallel zones, QA owner, integration readiness, unresolved issues, and verification evidence inspectable when task-level coordination is used.
  - Keep migration orchestration separate: baseline evidence, preserved behavior, compatibility risk, staged sequencing, rollback checkpoints, parity evidence, and slice verification remain the emphasized surfaces.
  - Reviewer focus: accidental unrestricted parallelism, migration inheriting full-delivery task-board semantics, or role ownership blurring.
  - QA focus: runtime/status docs make task coordination resumable without requiring manual inspection of raw JSON files, and migration guidance remains parity-oriented.

### [ ] Slice 4: Integration Alignment And Final Verification

- **Files**:
  - `README.md`
  - `AGENTS.md`
  - `context/navigation.md`
  - `context/core/project-config.md`
  - `docs/operator/README.md`
  - `docs/maintainer/README.md`
  - `docs/maintainer/test-matrix.md`
  - `docs/operations/runbooks/openkit-daily-usage.md`
  - `registry.json`
  - `.opencode/install-manifest.json`
- **Goal**: remove cross-document drift and ensure final implementation evidence covers all three phases and all acceptance criteria.
- **Validation Command**:
  - `npm run verify:all`
  - `node .opencode/workflow-state.js doctor --short`
  - `node .opencode/workflow-state.js validate`
- **Details**:
  - Perform one final command-reality pass against `package.json`, `bin/openkit.js`, and `.opencode/workflow-state.js`.
  - Confirm roadmap-derived docs do not present compatibility runtime commands as the preferred product path.
  - Confirm every current-vs-planned statement is explicit.
  - Record verification evidence through the workflow-state evidence surface before requesting code review when implementation changes were made.
  - Reviewer focus: whole-feature consistency and missing acceptance mapping.
  - QA focus: final artifact trail, actual command output, and any explicitly documented missing target-project validation path.

## Dependency Graph

- Slice 1 must complete before Slice 2 because runtime/tooling maturity docs depend on the clarified operator surface model.
- Slice 2 must complete before Slice 3 because deeper orchestration must build on standardized health, command reality, capability states, and validation evidence.
- Slice 4 must run last because it checks cross-document and runtime metadata consistency after all phase changes.
- Critical path: `Slice 1 -> Slice 2 -> Slice 3 -> Slice 4`.
- No slice may start Phase 3 implementation while Phase 1 or Phase 2 acceptance is unresolved unless the blocker is explicitly recorded and approved for deferral.

## Parallelization Assessment

- parallel_mode: `none`
- why: all slices touch overlapping canonical docs and runtime/status language; the approved scope requires strict phase ordering; unsafe overlap could create contradictory command or lane guidance.
- safe_parallel_zones: []
- sequential_constraints:
  - `PHASE-1-OPERATOR-CLARITY -> PHASE-2-RUNTIME-MATURITY -> PHASE-3-ORCHESTRATION -> FINAL-INTEGRATION`
- integration_checkpoint: after each slice, run the listed targeted validation and check that no downstream phase claims readiness before upstream acceptance is satisfied.
- max_active_execution_tracks: 1

## Validation Matrix

| Acceptance Criterion | Concrete checks | Validation commands |
| --- | --- | --- |
| AC1.1 Preferred Operator Path Is Explicit | `docs/operator/README.md`, `docs/operator/surface-contract.md`, `docs/operator/supported-surfaces.md`, and `docs/operations/runbooks/openkit-daily-usage.md` identify `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall` as the preferred product path; compatibility commands are not framed as preferred install path | `npm run verify:governance` |
| AC1.2 Runtime Surface Boundaries Are Understandable | `context/core/runtime-surfaces.md` and operator docs distinguish `global_cli`, `in_session`, and `compatibility_runtime` responsibilities | `npm run verify:governance`; `node --test ".opencode/tests/workflow-contract-consistency.test.js"` |
| AC1.3 Lane And Artifact Expectations Are Inspectable | `context/core/workflow.md`, `AGENTS.md`, and operator docs list lane artifacts; quick task cards are optional; full delivery requires Product Lead scope before Solution Lead solution | `node --test ".opencode/tests/workflow-contract-consistency.test.js"`; `npm run verify:governance` |
| AC1.4 Missing App-Native Validation Is Handled Honestly | `context/core/project-config.md`, `AGENTS.md`, and validation docs state missing target-project app commands clearly and separate OpenKit runtime validation from app validation | `npm run verify:governance` |
| AC2.1 Runtime Health And Resume State Are Standardized | `openkit doctor`, workflow-state docs, runtime summary docs, and optional runtime read-model updates name health, resume, active work item, workflow state, artifact links, issues, evidence, and blocker/informational distinction | `node --test "tests/runtime/doctor.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"`; `node .opencode/workflow-state.js doctor --short` |
| AC2.2 Tool Availability States Are Explicit | Capability registry and tool docs report `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured` where applicable; dependency/config/indexing limitations are visible | `node --test "tests/runtime/capability-registry.test.js"`; `node --test "tests/runtime/graph-tools.test.js"`; `node --test "tests/runtime/semantic-memory.test.js"`; `node --test "tests/runtime/external-tools.test.js"` |
| AC2.3 Command Reality Stays Aligned With Implemented Behavior | Command matrix, project config, operator docs, and runbooks only mark existing commands as current; future examples are labeled illustrative; stale commands are fixed | `npm run verify:governance`; `npm run verify:all` before handoff |
| AC2.4 Runtime Validation Is Separated From Target-Project Validation | Validation docs and any runtime evidence labels distinguish OpenKit runtime/CLI validation from target-project app validation | `npm run verify:governance`; `node .opencode/workflow-state.js validate` |
| AC3.1 Orchestration Builds On Completed Foundations | Phase 3 docs and handoff notes state Phase 1 and Phase 2 acceptance are prerequisites or explicit blockers | `npm run verify:governance` |
| AC3.2 Role Boundaries Remain Visible | `context/core/workflow.md`, role policy, and orchestration docs preserve Product Lead, Solution Lead, Fullstack, Code Reviewer, QA Agent, and Master Orchestrator boundaries | `node --test ".opencode/tests/workflow-contract-consistency.test.js"`; `npm run verify:governance` |
| AC3.3 Task-Level Coordination Is Inspectable When Used | Full-delivery task-board docs/runtime outputs show task owner, status, artifact refs, dependencies/sequential constraints, safe parallel zones, QA owner, integration readiness, unresolved issues, and evidence without implying unrestricted parallelism | `node --test ".opencode/tests/task-board-rules.test.js"`; `node --test ".opencode/tests/parallel-execution-runtime.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"` |
| AC3.4 Migration Orchestration Preserves Migration Semantics | Migration docs/runtime outputs emphasize preserved behavior, baseline, compatibility risk, sequencing, rollback, parity, and slice verification; full-delivery task-board semantics are not applied by default | `node --test ".opencode/tests/migration-lifecycle.test.js"`; `npm run verify:governance` |

## Integration Checkpoint

Before requesting Code Review, Fullstack should produce one concise implementation evidence note that includes:

- Phase 1 operator guidance paths changed and the command-reality source checked.
- Phase 2 runtime/tooling status vocabulary and evidence labeling paths changed, or an explicit note that docs only were sufficient.
- Phase 3 orchestration readiness, task-board, parallelism, and migration semantics paths changed.
- Targeted test commands run after each slice.
- Final `npm run verify:all` result, unless a real environmental blocker prevents it.
- Workflow-state evidence record for the final verification claim when implementation changes are complete.

## Rollback Notes

- Documentation-only changes can be reverted by restoring the touched docs to the prior command and workflow wording.
- Runtime metadata/read-model changes should be small and covered by targeted tests; rollback by reverting the runtime/status changes and their tests together.
- Do not roll back unrelated existing runtime behavior or change workflow-state data manually.
- Do not remove valid compatibility commands merely because they are no longer the preferred product path; rollback should preserve the distinction between preferred, manual, and diagnostic surfaces.

## Reviewer Focus Points

- Verify the implementation stays inside the approved three phases and preserves their order.
- Check for accidental new lanes, renamed modes, new command families, or `Quick Task+` as a fourth mode.
- Check command reality against `package.json`, `bin/openkit.js`, and `.opencode/workflow-state.js`.
- Check runtime/tool status claims for honest `available`, `degraded`, `preview`, `compatibility_only`, `not_configured`, or `unavailable` labeling.
- Check that app-native validation is never invented for target projects.
- Check that Phase 3 does not enable unrestricted parallelism and does not apply full-delivery task-board semantics to migration by default.
- Check that Master Orchestrator remains procedural and does not own Product Lead, Solution Lead, implementation, review, or QA judgment.

## QA Focus Points

- Validate that a new operator can identify the preferred install/doctor/run/upgrade/uninstall path without reading source code.
- Validate that operator docs explain when to use product CLI commands, in-session workflow commands, and compatibility runtime commands.
- Validate that lane and artifact expectations match the canonical workflow.
- Validate that runtime health, resume, capability, issue, evidence, and readiness states are inspectable through documented commands.
- Validate that missing target-project validation is reported as unavailable, not replaced by OpenKit runtime tests.
- Validate that task-level coordination, if used, is resumable and conservative.
- Validate that migration orchestration remains behavior-preserving and parity-oriented.

## Fullstack Handoff

- Start with Slice 1 and do not begin Slice 2 until Slice 1 acceptance checks pass.
- Do not begin Slice 3 until Slice 1 and Slice 2 acceptance checks pass or blockers are explicitly recorded.
- Use documentation-only edits where they satisfy acceptance. Add runtime/CLI changes only when an inspectable output cannot otherwise meet the acceptance criteria.
- For every runtime/CLI change, write or update the targeted `node --test` test first and confirm it fails before implementing.
- Keep final implementation evidence tied to the validation matrix above.
- Do not create commits unless the user explicitly requests a commit.

## Optional Execution Breakdown

- `PHASE-1-OPERATOR-CLARITY`: documentation alignment for preferred path, surface boundaries, lanes, artifacts, and missing validation.
- `PHASE-2-RUNTIME-MATURITY`: status vocabulary, command reality, capability state, runtime validation separation, and evidence-readiness alignment.
- `PHASE-3-ORCHESTRATION`: readiness gates, role boundaries, task-board visibility, conservative parallelism, and migration parity semantics.
- `FINAL-INTEGRATION`: cross-document drift check, targeted tests, `npm run verify:all`, and workflow-state evidence capture.

## Task Board Recommendation

- Recommendation: no task board by default.
- Rationale: `parallel_mode` is `none`, the work is sequential by product rule, and the slices intentionally share many artifact surfaces.
- If the current full-delivery runtime requires a board for FEATURE-938, create a sequential full-delivery task board only, with these ordered tasks:
  - `PHASE-1-OPERATOR-CLARITY`
  - `PHASE-2-RUNTIME-MATURITY`
  - `PHASE-3-ORCHESTRATION`
  - `FINAL-INTEGRATION`
- Task-board constraint: `PHASE-1-OPERATOR-CLARITY -> PHASE-2-RUNTIME-MATURITY -> PHASE-3-ORCHESTRATION -> FINAL-INTEGRATION`.
- Do not mark any task as safely parallelizable for this feature.
