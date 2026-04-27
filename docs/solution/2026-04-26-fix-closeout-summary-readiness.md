---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-946
feature_slug: fix-closeout-summary-readiness
source_scope_package: docs/scope/2026-04-26-fix-closeout-summary-readiness.md
owner: SolutionLead
approval_gate: solution_to_fullstack
handoff_rubric: pass
---

# Solution Package: Fix Closeout Summary Readiness

## Source Scope And Approval Context

- Upstream scope: `docs/scope/2026-04-26-fix-closeout-summary-readiness.md`.
- Current lane/stage: `full` / `full_solution` for work item `feature-946`.
- Approval context: Product scope is approved for Solution Lead planning; this package is the `solution_to_fullstack` handoff artifact.
- Scope preservation: fix closeout-summary/read-model drift only. Do not redefine workflow lanes, issue lifecycle commands, required artifact policy, scan-tool behavior, or target-project application validation.

## Chosen Approach

Use one small compatibility-runtime correction path: make `closeout-summary` consume the same readiness primitives as `workflow-metrics`, `check-stage-readiness`, and `status --short`, then update the CLI output to separate blockers from non-blocking recommendations and historical context.

This is enough because the inspected runtime already has most canonical pieces:

- `.opencode/lib/workflow-state-controller.js#buildReadinessSummary` filters resolved/closed issues out of unresolved readiness blockers.
- `.opencode/lib/runtime-guidance.js#getIssueTelemetry` reports open issue counts using the same terminal-status idea.
- `.opencode/lib/runtime-guidance.js#getArtifactReadiness` already distinguishes `missing-required` from `recommended-now`; ADR is currently optional in `ARTIFACT_RULES.full`.
- `.opencode/lib/scan-evidence-summary.js` already preserves compact scan evidence summaries, including direct/substitute/manual distinctions, finding counts, classification summaries, validation surface labels, caveats, and artifact refs.
- `.opencode/workflow-state.js#printCloseoutSummary` is the CLI output seam where blocker/recommendation wording can be made unambiguous.

The implementation should avoid a broad workflow-state redesign. The defect is primarily a stale closeout read model that bypasses existing canonical readiness helpers.

## Root Cause Hypotheses

Fullstack should validate or falsify these hypotheses during Slice 1 before changing behavior.

1. **Closeout counts every issue as unresolved.**
   - Inspected code in `.opencode/lib/workflow-state-controller.js#getWorkItemCloseoutSummary` sets `unresolvedIssues = Array.isArray(state.issues) ? state.issues : []`.
   - In contrast, `buildReadinessSummary` filters out `current_status === "resolved"` and `current_status === "closed"`, and `getIssueTelemetry` reports open issues with the same terminal-status exclusion.
   - Result: resolved/closed historical issues can make `closeout-summary` print `unresolved issues: N` and compute `readyToClose: false` while metrics/readiness report no open blockers.

2. **Closeout readiness is recomputed locally instead of using a shared closeout-readiness model.**
   - `readyToClose` is currently an inline boolean combining `state.status`, missing required artifacts, verification readiness, raw issue count, active task count, and migration slice completion.
   - That inline logic has already drifted from canonical readiness semantics and makes future drift likely.

3. **Optional recommendations are printed too close to blockers.**
   - `recommended artifacts now: adr` comes from `artifactReadiness.status === "recommended-now"`.
   - Current full-delivery ADR rules mark ADR as optional (`requiredFrom: null`, `optional: true`), but the output does not label the ADR line as optional/non-blocking.
   - This makes a correct recommendation look like a readiness reason, especially when `ready to close: no` is caused by unrelated raw issue counting.

4. **Task-board closure semantics are under-modeled in closeout.**
   - `closeout-summary` only checks `claimed`, `in_progress`, and `qa_in_progress` active tasks.
   - Full task-board validation in `.opencode/lib/task-board-rules.js` requires every task to be `done` or `cancelled` at `full_done` and rejects open blocking board issues.
   - Closeout should report task-board validity blockers instead of silently relying on a partial active-task list or throwing before it can explain the problem.

5. **Scan evidence is not the likely cause, but it is a regression risk.**
   - Closeout already calls `summarizeScanEvidence` and `summarizeScanEvidenceLines`.
   - The fix must not remove or reinterpret stored scan evidence summaries as live blockers unless there is a current open issue or a canonical scan/policy blocker.

## Impacted Surfaces And File Targets

### Primary compatibility-runtime files

- `.opencode/lib/workflow-state-controller.js`
  - Add or reuse shared open-issue filtering for closeout.
  - Replace inline `readyToClose` logic with a closeout-readiness helper/read model.
  - Add task-board closeout readiness reporting that uses canonical board validation semantics.
  - Preserve existing scan evidence summary fields in the returned closeout object.
- `.opencode/lib/runtime-guidance.js`
  - Prefer a shared issue-status helper for `getIssueTelemetry` so metrics/status/closeout do not drift again.
  - Keep current artifact rules unless an existing explicit required-ADR mechanism is found.
- `.opencode/lib/scan-evidence-summary.js`
  - Expected read-only. Touch only if tests show closeout needs a small helper to preserve existing summary fields.
- `.opencode/workflow-state.js`
  - Update `printCloseoutSummary` to separate blockers, open issues, resolved issue history, optional recommendations, verification readiness, task-board status, and scan evidence lines.

### Optional helper module

- `.opencode/lib/issue-readiness.js` (recommended if the implementation would otherwise duplicate status filtering)
  - Export `isOpenIssueStatus`, `isTerminalIssueStatus`, `getOpenIssues`, and `getResolvedIssueHistory`.
  - Treat `open` and `in_progress` as open/unresolved; treat `resolved` and `closed` as terminal historical statuses.
  - Do not invent unsupported issue statuses. If aliases such as `accepted-fixed` appear in future persisted data, handle them only with a deliberate schema/backward-compatibility change.

### Tests

- `.opencode/tests/workflow-state-controller.test.js`
  - Unit-level read-model and readiness tests.
- `.opencode/tests/workflow-state-cli.test.js`
  - CLI output and exit-code tests for `closeout-summary`, plus consistency checks against `workflow-metrics`, `check-stage-readiness`, and `status --short` where practical.
- `package.json`
  - Read-only for command reality. Do not add scripts unless the implementation truly introduces a new reusable package verification command.

### Documentation/package surfaces

- No documentation update is required if behavior is self-evident from CLI output and tests.
- If docs that describe closeout output or readiness are touched, validate them as `documentation` and keep `context/core/project-config.md` / `AGENTS.md` command reality accurate.
- Global CLI packaging is not expected to change. If package/install-bundle surfaces change, run the appropriate package verification listed below.

## Boundaries And Component Decisions

- **Canonical readiness stays canonical.** Do not change stage names, approval gates, artifact requirements, verification evidence requirements, or issue lifecycle commands unless tests prove an existing inconsistency that blocks this fix.
- **Closeout is a read model.** It should explain why a work item is or is not closeable; it should not mutate issue statuses, task statuses, artifacts, verification evidence, or approvals.
- **Resolved issues remain visible.** Resolved/closed issues should move to historical/resolved output and must not disappear from the closeout read model.
- **Optional ADR remains non-blocking.** ADR is a recommendation unless `getArtifactReadiness` (or another existing canonical readiness mechanism) marks it `missing-required`.
- **Task-board closure uses canonical validation.** At `full_done`, a present full-delivery board must be valid for closure: required tasks are `done` or `cancelled`, and no board issue with `blocks_completion: true` remains open.
- **Scan evidence remains evidence, not issue state.** Stored scan summaries should still print in closeout output but should not be converted into unresolved issues without a current open workflow issue or explicit canonical blocker.
- **No target-project app validation claim.** Workflow-state checks, package tests, scan summaries, and CLI checks validate OpenKit compatibility/runtime surfaces, not a target application.

## Readiness Semantics Design

### Closeout readiness inputs

For full-delivery closeout, `readyToClose` should be true only when all conditions are true:

1. `state.mode === "full"` and `state.current_stage === "full_done"`.
2. `state.status === "done"`.
3. No open issue remains, where open statuses are `open` and `in_progress`.
4. No required artifact is missing (`artifactReadiness.status === "missing-required"`).
5. Verification readiness is not `missing-evidence`.
6. If a full-delivery task board exists, it is valid for `full_done`; every required task is `done` or `cancelled`, and no open blocking board issue remains.

For quick and migration closeout, keep current command compatibility but use the mode terminal stage (`quick_done`, `migration_done`) and existing migration slice readiness logic. Do not apply full-delivery task-board rules to migration.

### Issue partitioning

Add one shared issue partition used by closeout and, ideally, `getIssueTelemetry`:

```js
openIssues = issues.filter(issue => ["open", "in_progress"].includes(issue.current_status))
resolvedIssueHistory = issues.filter(issue => ["resolved", "closed"].includes(issue.current_status))
```

Rules:

- `unresolvedIssues` in the closeout read model must mean `openIssues` for backward-compatible callers.
- Severity, origin, recommended owner, stale markers, repeat count, or previous blocked state must not override a terminal `resolved`/`closed` status into an open blocker.
- Open duplicates still count as open blockers even when another related issue record is resolved.

### Artifact and ADR semantics

- `missingRequiredArtifacts = artifactReadiness.filter(status === "missing-required")` are blockers.
- `recommendedArtifacts = artifactReadiness.filter(status === "recommended-now")` are recommendations only.
- Current full-delivery `adr` readiness is optional (`recommended-now`), so it must not block closeout.
- If an existing supported mechanism makes ADR required and `getArtifactReadiness` returns `adr: missing-required`, closeout must report it as a blocker: `missing required artifacts: adr`.
- Do not add a new ADR-required schema solely for this defect unless implementation discovers an already-documented required-ADR capability that closeout fails to honor.

### Verification readiness

- Continue using `.opencode/lib/runtime-guidance.js#getVerificationReadiness`.
- `missing-evidence` blocks closeout and should print as a blocker with missing kinds when available.
- `ready` and `not-required-yet` should not block by themselves. For full_done, full QA evidence is expected by current rules.

### Task-board validity

Implement a closeout-specific task-board readiness helper such as `getFullTaskBoardCloseoutReadiness(runtimeRoot, workItemId, state)`:

```js
{
  present: boolean,
  valid: boolean | null,
  blockers: string[],
  activeTaskIds: string[],
  incompleteTaskIds: string[],
  closureValidTaskIds: string[]
}
```

Rules:

- If no board exists, treat it as non-blocking for closeout unless canonical readiness already requires one for that state.
- If a board exists, validate it using `validateTaskBoard({ ...buildBoardView(state, board), current_stage: "full_done" })` or equivalent closure-stage validation.
- Catch validation failures and return a readable task-board blocker in closeout rather than throwing before the operator sees the summary.
- Include active/incomplete ids in output when present. At `full_done`, anything other than `done` or `cancelled` should be a task-board blocker.

### Scan evidence summary preservation

- Keep using `summarizeScanEvidence(state)` and `summarizeScanEvidenceLines(state)`.
- Preserve direct/substitute/manual distinctions, validation-surface labels, finding counts, classification summaries, false-positive/manual caveats, and artifact refs.
- Do not paste raw high-volume findings into closeout output.
- Historical scan findings classified as false positive, non-blocking noise, follow-up, or resolved context do not become closeout blockers unless a current open workflow issue or canonical policy/readiness blocker exists.

## Closeout Output Design

Update `printCloseoutSummary` to make the read model operator-safe:

```text
Work item: feature-946
ready to close: yes
blockers: none
recommendations:
- optional artifact: adr
open issues: none
resolved issue history: 2
verification readiness: ready
task board: valid for closeout
scan evidence: <existing compact scan evidence lines>
```

When blocked, prefer explicit blocker lines:

```text
ready to close: no
blockers:
- unresolved/open issues: 1
- task board not ready: A full_done board requires every required task to be done or cancelled
recommendations:
- optional artifact: adr
open issues: 1
resolved issue history: 2
```

Backward-compatibility notes:

- `unresolvedIssues` in the returned object can remain for callers, but it must contain only open issues.
- It is acceptable to replace `recommended artifacts now: adr` with clearer wording such as `recommended artifacts (optional): adr` or the `recommendations:` block above.
- Existing scan evidence line text should remain stable unless a test documents the clearer output change.

## Implementation Slices

### [ ] Slice 1: Regression fixtures and failing tests

- **Files**:
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: capture the reported drift before changing runtime behavior.
- **Dependencies**: none.
- **Test-first expectations**:
  - Completed `full_done` item with required scope/solution/QA artifacts, full QA evidence, optional ADR recommendation, no open issues, and only resolved/closed issues reports `readyToClose === true`.
  - CLI output does not print `unresolved issues: 1` when all issues are terminal.
  - `workflow-metrics`, `check-stage-readiness`, `status --short`, and `closeout-summary` agree on ready/no open blockers for the representative fixture.
  - Existing scan evidence fixture still appears in closeout output.
- **Validation Command**: initially expect focused failures, then pass after later slices:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
- **Reviewer focus**: tests should assert behavior and output semantics, not private implementation details.

### [ ] Slice 2: Shared issue and closeout readiness model

- **Files**:
  - `.opencode/lib/issue-readiness.js` (recommended new helper) or equivalent local helpers if kept inside controller
  - `.opencode/lib/runtime-guidance.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/tests/workflow-state-controller.test.js`
- **Goal**: make closeout use canonical open-issue filtering and a readable blocker/recommendation/readiness object.
- **Details**:
  - Introduce shared issue status helpers and use them in `buildReadinessSummary`, `getIssueTelemetry`, and `getWorkItemCloseoutSummary`.
  - Add `resolvedIssueHistory` or `historicalIssues` to the closeout result.
  - Add `blockers` and `recommendations` arrays to the closeout result while preserving `missingRequiredArtifacts`, `recommendedArtifacts`, `unresolvedIssues`, `verificationReadiness`, `scanEvidence`, and `scanEvidenceLines` for existing callers.
  - Require full-delivery terminal stage `full_done` and `status === "done"` for closeout readiness.
  - Keep optional ADR as a recommendation by consuming `recommended-now` separately from `missing-required`.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
- **Reviewer focus**:
  - Resolved/closed severe issues must remain historical and non-blocking.
  - Open/in-progress issues must still block.
  - No new issue lifecycle status or ADR-required schema should appear without separate justification.

### [ ] Slice 3: Task-board closeout validity

- **Files**:
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: make closeout readiness respect full-delivery task-board validity and report board blockers clearly.
- **Details**:
  - Add a task-board closeout helper that reads an existing board, validates closure state, and converts validation failures into `task_board` blockers instead of an unexplained command failure.
  - Treat a valid board containing only `done`/`cancelled` tasks as non-blocking.
  - Treat active/incomplete/blocking task state as a closeout blocker with task ids or validation reason.
  - Avoid applying full-delivery board rules to quick or migration work items.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
- **Reviewer focus**:
  - Do not weaken `validateTaskBoard`; closeout should summarize invalidity, not bypass it.
  - Ensure release readiness still receives a false closeout when task-board validity fails.

### [ ] Slice 4: CLI output separation and scan evidence preservation

- **Files**:
  - `.opencode/workflow-state.js`
  - `.opencode/lib/scan-evidence-summary.js` (expected read-only)
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: make `closeout-summary` output distinguish blockers, recommendations, open issues, historical resolved issues, verification readiness, task-board status, and scan evidence.
- **Details**:
  - Print `blockers: none` when ready and no blockers exist.
  - Print blocker lines only from the closeout `blockers` array.
  - Print optional ADR under recommendations, not as a blocker.
  - Print open/unresolved issue count separately from resolved issue history.
  - Keep scan evidence lines in the same compact form currently generated by `summarizeScanEvidenceLines`.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
- **Reviewer focus**:
  - Output should be clearer but not noisy; avoid dumping raw issue/evidence payloads.

### [ ] Slice 5: Integration validation and compatibility-runtime handoff evidence

- **Files**:
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
  - `package.json` (read-only command source)
  - Documentation files only if implementation changes documented command behavior.
- **Goal**: prove closeout/readiness consistency and record honest validation surfaces.
- **Validation Commands**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js workflow-metrics`
  - `node .opencode/workflow-state.js check-stage-readiness`
  - `node .opencode/workflow-state.js status --short`
  - `node .opencode/workflow-state.js closeout-summary feature-001`
  - `npm run verify:governance` if docs/governance or command-contract tests are touched.
  - `npm run verify:install-bundle` if package/install-bundle surfaces are touched.
  - `npm run verify:all` as the final package regression gate when environment/tooling permits.
- **Reviewer focus**:
  - Label all above checks as `compatibility_runtime`, `documentation`, `runtime_tooling`, or package/runtime regression evidence as appropriate.
  - `target_project_app` validation is unavailable for this feature because no target app build/lint/test command is defined.

## Regression Test Strategy

| Scenario | Expected proof |
| --- | --- |
| Resolved and closed issues only | `getWorkItemCloseoutSummary` returns `readyToClose: true`, `unresolvedIssues.length === 0`, resolved history count > 0; CLI exits 0 and does not print unresolved blocker. |
| Mixed open and resolved issues | Only `open`/`in_progress` issues appear in `unresolvedIssues`; CLI exits 1 with `unresolved/open issues: N`; resolved issues remain historical. |
| Severe issue resolved | Severity does not block after `current_status` becomes `resolved` or `closed`. |
| Optional ADR recommendation | `recommendedArtifacts` includes `adr`, output labels it optional/recommended, and readiness remains true when all required criteria pass. |
| Required ADR if supported | If existing readiness support can make `adr` `missing-required`, closeout blocks with `missing required artifacts: adr`; otherwise cover the generic `missing-required` branch and document that no explicit required-ADR mechanism exists today. |
| Not at `full_done` | Closeout blocks with terminal-stage reason instead of blaming resolved issues or optional ADR. |
| `full_done` ready | Scope, solution, QA report, approvals/evidence, no open issues, and valid/absent board produce `ready to close: yes`. |
| Valid task board | Board with only `done`/`cancelled` tasks does not block. |
| Invalid or active task board | Board with active/incomplete required tasks or open blocking board issue blocks with task-board reason. |
| Scan evidence summary preserved | Direct, substitute, and manual override scan evidence lines still show validation surface, direct/substitute/manual distinction, finding counts/classification summaries, caveats, and artifact refs. |
| Read-model consistency | Representative fixture has `workflow-metrics` open issue count, `check-stage-readiness`, `status --short`, and `closeout-summary` aligned. |

## Dependency Graph

- Closeout issue readiness depends on shared issue-status helpers.
- Closeout artifact blocker/recommendation separation depends on `getArtifactReadiness` statuses.
- CLI output depends on the closeout result object shape from `getWorkItemCloseoutSummary`.
- Scan evidence output depends on existing `summarizeScanEvidenceLines`; avoid changing it unless tests require a preservation fix.
- Release readiness depends on `getWorkItemCloseoutSummary.readyToClose` and `unresolvedIssues`; keep those semantics backward-compatible but corrected to open issues only.

Critical path:

`REGRESSION-TESTS -> ISSUE-CLOSEOUT-READINESS -> TASK-BOARD-CLOSEOUT -> CLI-OUTPUT -> INTEGRATION-VALIDATION`

## Parallelization Assessment

- parallel_mode: `none`
- why: the fix is small but touches shared read-model semantics. Parallel edits across controller, runtime guidance, CLI output, and tests would risk field-shape drift or tests asserting old output while helpers change underneath.
- safe_parallel_zones: []
- sequential_constraints:
  - `REGRESSION-TESTS -> ISSUE-CLOSEOUT-READINESS -> TASK-BOARD-CLOSEOUT -> CLI-OUTPUT -> INTEGRATION-VALIDATION`
- integration_checkpoint: after Slice 4, run both workflow-state test files and manually compare `workflow-metrics`, `check-stage-readiness`, `status --short`, and `closeout-summary` on a representative full_done fixture before requesting Code Review.
- max_active_execution_tracks: 1

## Validation Matrix

| Acceptance target | Validation surface | Commands / checks |
| --- | --- | --- |
| Resolved/closed issues do not block closeout | `compatibility_runtime` | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"` |
| Open/in-progress issues still block | `compatibility_runtime` | Same targeted workflow-state tests |
| Optional ADR recommendation is non-blocking | `compatibility_runtime` | Closeout controller and CLI tests with `adr: recommended-now` |
| Required artifact blockers still block, including ADR if supported | `compatibility_runtime` | Missing-required artifact branch tests; required ADR branch if current runtime supports it |
| `full_done` ready state aligns with metrics/readiness/status | `compatibility_runtime` | `node .opencode/workflow-state.js workflow-metrics`; `check-stage-readiness`; `status --short`; `closeout-summary <fixture>` |
| Task-board validity participates in closeout | `compatibility_runtime` | Controller/CLI tests for valid board, active/incomplete board, and open blocking board issue |
| Scan evidence summary retained | `compatibility_runtime` read model over stored `runtime_tooling` evidence | CLI tests using `details.scan_evidence` fixtures; inspect closeout lines |
| Package regression | package/runtime regression | `npm run verify:all` when environment permits; otherwise record targeted passing commands and exact blocker |
| Documentation consistency if docs change | `documentation` | `npm run verify:governance`; `node --test ".opencode/tests/workflow-contract-consistency.test.js"` if relevant |
| Target application validation | `target_project_app` | Unavailable; no target-project app-native build/lint/test command is defined for this OpenKit feature |

## Task Board Recommendation

Create a small full-delivery task board after `solution_to_fullstack` approval because the change has distinct test, controller, CLI-output, and validation responsibilities. Keep execution sequential.

Recommended tasks:

1. `REGRESSION-TESTS` — add failing controller and CLI tests for closeout/readiness drift.
2. `ISSUE-CLOSEOUT-READINESS` — centralize open/resolved issue filtering and closeout blocker/recommendation model.
3. `TASK-BOARD-CLOSEOUT` — add closeout task-board validity reporting.
4. `CLI-OUTPUT` — update `closeout-summary` formatting to separate blockers/recommendations/history and preserve scan evidence.
5. `INTEGRATION-VALIDATION` — run targeted workflow-state tests, package verification, and record handoff evidence.

Recommended board settings:

- `parallel_mode`: `none`
- `safe_parallel_zones`: `[]`
- `sequential_constraints`: `REGRESSION-TESTS -> ISSUE-CLOSEOUT-READINESS -> TASK-BOARD-CLOSEOUT -> CLI-OUTPUT -> INTEGRATION-VALIDATION`
- `max_active_execution_tracks`: `1`

Do not create the task board from this solution package step unless the orchestrator/implementation owner requests it; this artifact only recommends the board.

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide one concise evidence bundle showing:

- The representative completed full-delivery fixture returns ready/no blockers from `workflow-metrics`, `check-stage-readiness`, `status --short`, and `closeout-summary`.
- Resolved/closed issue history is visible but not counted as unresolved.
- Open/in-progress issues and invalid task boards still block closeout with explicit blocker lines.
- Optional ADR recommendation remains visible as optional and non-blocking.
- Required missing artifacts still block readiness.
- Scan evidence lines remain present with direct/substitute/manual distinction and validation-surface labels.
- Target-project application validation is explicitly unavailable.

## Rollback Notes

- Roll back issue-status helper changes together with `runtime-guidance` and controller tests so metrics/closeout semantics do not split again.
- Roll back CLI output changes together with CLI tests; do not leave tests expecting blocker/recommendation separation when output reverts.
- If task-board closeout helper causes unexpected command failures, revert that helper and keep the issue/ADR fix isolated rather than weakening `validateTaskBoard`.
- Do not roll back by hiding issues, clearing historical issue arrays, making ADR mandatory by default, suppressing scan evidence, or marking workflow-state checks as target-project app validation.
- No data migration is expected; this should be a read-model change over existing state. Existing work items with resolved issues should become closeout-ready without state edits when all canonical criteria are satisfied.

## Risks And Mitigations

- **Risk: new helper changes metrics semantics unintentionally.** Mitigation: keep helper statuses identical to current `buildReadinessSummary` / `getIssueTelemetry` behavior for supported statuses and add regression tests around metrics/readiness consistency.
- **Risk: required ADR support is not currently modeled.** Mitigation: do not invent a schema; rely on `missing-required` artifact readiness and test the generic branch. Add required-ADR-specific coverage only if an existing supported mechanism is found.
- **Risk: invalid task boards may currently fail validation before closeout can summarize.** Mitigation: make closeout board validation report-safe, but keep strict board validation for mutation/stage gates.
- **Risk: output wording changes could break brittle tests.** Mitigation: update tests around intended operator semantics and keep stable key phrases such as `ready to close: yes/no`, `blockers`, `open issues`, `resolved issue history`, and `scan evidence`.
- **Risk: scan evidence gets lost while refactoring closeout.** Mitigation: keep existing scan summary helpers and add direct closeout regression coverage.

## Reviewer Focus Points

- Confirm `unresolvedIssues` now means only open/in-progress issues.
- Confirm resolved/closed issue history remains visible.
- Confirm optional ADR appears under recommendations and does not affect `readyToClose`.
- Confirm missing required artifacts, missing verification evidence, open issues, non-terminal stage, and invalid task boards still block closeout.
- Confirm `workflow-metrics`, `check-stage-readiness`, `status --short`, and `closeout-summary` agree for the representative completed fixture.
- Confirm scan evidence summaries are preserved and not overclaimed as target-project validation.

## QA Focus Points

- Exercise both ready and blocked closeout paths through the CLI, not only direct controller calls.
- Verify CLI exit status: `0` when ready, `1` when blocked.
- Verify historical resolved issues, optional recommendations, blockers, and scan evidence are all visible in one closeout output without ambiguity.
- Verify target-project app validation remains unavailable in QA reporting.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: this package identifies the likely root cause, chooses one bounded compatibility-runtime approach, names exact file surfaces, defines readiness/output semantics, sequences implementation slices, gives regression and validation strategy, recommends a sequential task board, and records rollback/risk guidance without expanding scope beyond the approved Product Lead package.
