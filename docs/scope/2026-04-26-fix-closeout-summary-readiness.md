---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-946
feature_slug: fix-closeout-summary-readiness
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Fix Closeout Summary Readiness

OpenKit should make `closeout-summary <work-item>` agree with the canonical readiness surfaces used by `workflow-state metrics`, `check-stage-readiness`, and `status --short`: a full-delivery work item at `full_done` with no open issues, required artifacts, valid verification evidence, and a valid task board must report ready to close, while still preserving historical visibility into resolved issues, optional recommendations, and scan evidence summaries.

## Goal

- Make `closeout-summary <work-item>` a trustworthy operator closeout read model for completed work items.
- Align closeout readiness with canonical workflow readiness semantics for full-delivery closure: terminal stage, no open blockers, required artifacts present, verification readiness satisfied, and task-board validity satisfied when a task board exists.
- Ensure resolved/closed issues remain visible as historical context without being counted as unresolved blockers.
- Ensure optional ADR recommendations remain visible as recommendations without blocking readiness unless ADR is explicitly required.
- Preserve existing scan evidence summary visibility in closeout output.

## Target Users

- **Operators / Master Orchestrator:** need one concise closeout summary that can be trusted before closing or archiving a work item.
- **Product Lead, Solution Lead, Code Reviewer, and QA Agent:** need resolved issues, optional recommendations, required artifacts, and verification evidence to be represented consistently across stage-readiness and closeout surfaces.
- **Maintainers:** need regression coverage that prevents read-model drift between `closeout-summary`, `check-stage-readiness`, `status --short`, and workflow metrics.

## Problem Statement

After FEATURE-942 and FEATURE-943, OpenKit can reach a state where `workflow-state metrics`, `check-stage-readiness`, and `status --short` report done/ready/no open blockers, but `closeout-summary <work-item>` reports `ready to close: no`, nonzero unresolved issue counts, and sometimes `recommended artifacts now: adr` for work items whose issues are resolved and whose ADR recommendation is optional. This creates an operator trust problem: the final closeout surface appears to contradict canonical state/readiness semantics and can delay closure even when required workflow evidence is complete.

## In Scope

- Correct the product behavior of `closeout-summary <work-item>` for full-delivery work items, especially completed `full_done` items.
- Define unresolved issue counts as open/blocking lifecycle states only; resolved/closed issue states must not increase unresolved counts or block closeout readiness.
- Preserve historical display of resolved/closed issues where closeout currently summarizes issue history, but label them as resolved/history rather than unresolved blockers.
- Treat `recommended-now` ADR output as optional unless the workflow/readiness model explicitly marks an ADR as required for the work item.
- Align closeout readiness with existing canonical readiness signals:
  - terminal full-delivery stage (`full_done`);
  - no unresolved/open issues;
  - required artifacts present for the mode/stage;
  - verification evidence/readiness satisfied;
  - full-delivery task-board validity satisfied when a board exists.
- Preserve scan evidence summary output in closeout summaries, including direct/substitute/manual distinctions, finding counts/classification summaries, caveats, validation-surface labels, and artifact references when present.
- Add regression coverage for resolved issue counts, optional ADR recommendation behavior, full_done ready state, and scan evidence summary retention.

## Out of Scope

- Implementing code or prescribing exact internal functions, storage schemas, parser logic, or CLI formatting internals.
- Changing the canonical stage-readiness rules themselves unless Solution Lead identifies a documented inconsistency that must be clarified separately.
- Changing issue lifecycle commands such as `record-issue`, `update-issue-status`, `list-stale-issues`, or issue routing semantics except as needed for closeout-summary read-model interpretation.
- Making optional ADR recommendations mandatory by default.
- Removing historical resolved issue visibility from closeout output.
- Removing or weakening scan evidence summaries from closeout output.
- Adding new workflow lanes, stage names, approval gates, role responsibilities, or target-project application validation commands.
- Treating OpenKit workflow-state checks, runtime checks, scan summaries, or CLI checks as target-project application build/lint/test validation.

## Users And User Journeys

1. **As an Operator, I want `closeout-summary <work-item>` to report ready when the work item is in `full_done` and the canonical readiness checks have no blockers, so that I can close completed work without reconciling contradictory read models.**
2. **As a QA Agent, I want resolved QA or review issues to remain visible as historical context but not counted as unresolved, so that closeout reflects actual remaining risk.**
3. **As a Solution Lead, I want optional ADR recommendations to stay visible without blocking closeout unless ADR is explicitly required, so that documentation suggestions do not become hidden gates.**
4. **As a Maintainer, I want regression tests around closeout readiness and scan evidence retention, so that future read-model changes do not reintroduce false blockers or lose evidence summaries.**

## Main Flows

- **Completed full-delivery closeout:** operator runs `closeout-summary <work-item>` for a `full_done` item with required artifacts, verification evidence, no open issues, and valid task board state; summary reports `ready to close: yes`.
- **Resolved issue history:** closeout summary includes resolved/closed issue history or counts, but unresolved issue counts only include open/blocking statuses and do not treat resolved/closed statuses as blockers.
- **Optional ADR recommendation:** closeout summary may display an ADR recommendation as optional/recommended, but readiness remains ready when no workflow rule marks ADR required.
- **Required ADR case:** closeout summary blocks readiness when the workflow/readiness model explicitly marks ADR as required and the required ADR artifact is missing.
- **Scan evidence preservation:** closeout summary continues to display compact scan evidence summaries while computing readiness independently from non-blocking historical findings or optional recommendations.

## Business Rules And Readiness Semantics

### Canonical Closeout Readiness

- For full-delivery work items, `closeout-summary` readiness must agree with the same closure semantics exposed by `check-stage-readiness`, `status --short`, and workflow metrics.
- A full-delivery work item is ready to close when all required conditions are true:
  - current stage is `full_done`;
  - no issue with an open/unresolved lifecycle status remains;
  - required mode/stage artifacts are present;
  - verification evidence/readiness requirements are satisfied;
  - any full-delivery task board is valid for closure, with no active/incomplete blocking tasks.
- `closeout-summary` must not introduce additional blocking criteria that are absent from canonical readiness semantics.
- If closeout readiness and canonical stage readiness differ, the summary must expose the actual blocking condition rather than silently returning `ready to close: no`.

### Issue Counting

- Only issues in open/unresolved lifecycle states may count toward `unresolved issues` or block closeout readiness.
- Issues in resolved, closed, accepted-fixed, or equivalent terminal non-open states must not count as unresolved and must not block readiness.
- Resolved/closed issues may still be shown in a separate historical/resolved section or count, provided the output does not label them as unresolved blockers.
- Issue severity, origin, or recommended owner must not override a resolved/closed lifecycle status into an unresolved blocker.
- Stale historical issue records must not block closeout if their current status is resolved/closed and no open duplicate remains.

### ADR Recommendation Semantics

- `recommended-now` or `recommended artifacts now: adr` is informational unless the workflow/readiness model explicitly marks an ADR artifact as required.
- Optional ADR recommendations must remain visible as recommendations, not disappear, but they must not produce `ready to close: no`.
- If ADR is required, closeout must clearly identify the missing required ADR as a blocking artifact condition.
- Closeout output must distinguish `required artifact missing` from `optional artifact recommended`.

### Required Artifacts, Verification, And Task Boards

- Required artifact readiness must follow the mode/stage contract for the work item, including full-delivery scope, solution, QA, and required approval/evidence artifacts where applicable.
- Verification readiness must be based on recorded verification evidence and unresolved issue state, not on optional documentation recommendations.
- Full-delivery task-board validity must block readiness only when canonical board validation says the board is invalid, active, incomplete, or otherwise not ready for closure.
- Completed, verified, or cancelled task-board entries that are valid under canonical task-board rules must not block closeout.

### Scan Evidence Summary Preservation

- Closeout summary must continue to show scan evidence summaries when present.
- Scan evidence summaries must preserve direct tool status, substitute/manual distinction, finding counts, classification summaries, false-positive or manual override caveats, validation-surface labels, and artifact refs where already available in the evidence read model.
- Historical scan findings that are classified/resolved/non-blocking must not be reinterpreted as unresolved issues unless a current open issue exists.
- High-volume raw scan output should remain summarized and referenced rather than pasted into closeout output.

## Acceptance Criteria Matrix

### Readiness Alignment

- **Given** a full-delivery work item is in `full_done` **and** `check-stage-readiness` reports ready/no blockers **and** `status --short` reports no open blockers, **when** an operator runs `closeout-summary <work-item>`, **then** the summary reports `ready to close: yes`.
- **Given** `workflow-state metrics` reports no open issues for a completed full-delivery work item, **when** `closeout-summary <work-item>` reports issue counts, **then** unresolved/open issue counts match the canonical open-issue count.
- **Given** required artifacts, verification evidence, and task-board validity are satisfied, **when** closeout readiness is computed, **then** optional recommendations do not change readiness from yes to no.
- **Given** a full-delivery work item is not in `full_done`, **when** `closeout-summary <work-item>` runs, **then** readiness is blocked with the non-terminal stage reason rather than issue or optional-ADR misclassification.

### Resolved Issue Counts

- **Given** a work item has one or more issues whose current status is resolved/closed, **when** `closeout-summary <work-item>` computes `unresolved issues`, **then** those resolved/closed issues are excluded from the unresolved count.
- **Given** a work item has only resolved/closed issues and no open issues, **when** closeout summary displays issue history, **then** it may show resolved issue history but must not report `unresolved issues: 1` or `ready to close: no` because of those resolved issues.
- **Given** a work item has both resolved/closed issues and open issues, **when** closeout summary reports issue counts, **then** only the open issues count as unresolved blockers and resolved issues remain separately historical.
- **Given** an issue was recorded as severe but later resolved/closed, **when** closeout readiness is computed, **then** severity does not keep the issue blocking after the terminal status is recorded.

### Optional ADR Recommendations

- **Given** an ADR appears only as `recommended-now` or `recommended artifacts now: adr`, **when** the workflow does not explicitly require an ADR, **then** `closeout-summary <work-item>` keeps the ADR recommendation visible but does not set `ready to close: no`.
- **Given** an ADR is explicitly required by the workflow/readiness model and is missing, **when** `closeout-summary <work-item>` runs, **then** readiness is blocked and the missing required ADR is reported as a required artifact blocker.
- **Given** an ADR recommendation is optional and all required closeout criteria are satisfied, **when** closeout summary prints recommended artifacts, **then** the output distinguishes optional recommendation text from blockers.

### Full Done Ready State

- **Given** a completed full-delivery work item has required scope, solution, QA, approvals/evidence, no open issues, and valid task-board state, **when** `closeout-summary <work-item>` runs, **then** the output reports ready to close.
- **Given** the task board exists and canonical task-board validation passes for closure, **when** closeout summary computes readiness, **then** task-board state does not falsely block readiness.
- **Given** canonical task-board validation fails because tasks are active/incomplete/blocking, **when** closeout summary computes readiness, **then** readiness is blocked with a task-board reason.

### Scan Evidence Summary Retention

- **Given** verification evidence contains `details.scan_evidence`, **when** `closeout-summary <work-item>` runs, **then** the scan evidence summary remains present in the output.
- **Given** scan evidence includes direct, substitute, or manual override distinctions, **when** closeout summary displays the evidence, **then** those distinctions and validation-surface labels remain visible.
- **Given** scan findings were classified as false positive, non-blocking noise, follow-up, or resolved by an issue that is now closed, **when** closeout readiness is computed, **then** those historical scan details do not become unresolved blockers without a current open issue.

## Edge Cases

- Work item has two historical issues: one resolved and one closed; closeout must report zero unresolved issues if no open issues remain.
- Work item has duplicate issue ids or repeated issue records where the latest/current status is terminal; closeout should use current lifecycle state rather than stale historical status text.
- Work item has optional ADR recommendation and no ADR artifact linked; readiness remains yes if ADR is not required.
- Work item has ADR explicitly required and no ADR artifact linked; readiness is no with a required-artifact blocker.
- Work item is `full_done` but verification evidence is missing; readiness is no because verification is required, not because of resolved issues or optional ADR.
- Work item is `full_done` with a task board containing only verified/cancelled closure-valid tasks; readiness is not blocked by the board.
- Work item is `full_done` with a task board containing active/incomplete tasks; readiness is blocked by task-board validity.
- Scan evidence exists only in stored workflow evidence; closeout should label it as stored/read-model evidence, not fresh direct tool execution.
- Scan evidence includes high-volume finding details; closeout should summarize compactly and preserve artifact refs.

## Error And Failure Cases

- `closeout-summary` reports `ready to close: no` solely because a resolved/closed issue exists.
- `closeout-summary` reports `unresolved issues: 1` or `2` when all current issues are terminal/resolved/closed.
- `closeout-summary` treats `recommended artifacts now: adr` as a blocker when ADR is optional.
- `closeout-summary` hides an actually required missing ADR by treating all ADR recommendations as optional.
- `closeout-summary` reports ready while required artifacts, verification evidence, or task-board validity are missing.
- `closeout-summary` loses scan evidence summaries while fixing readiness counts.
- `closeout-summary` shows scan summaries but drops direct/substitute/manual distinctions, validation-surface labels, or artifact refs that were present in stored evidence.
- `closeout-summary` claims OpenKit readiness checks or scan summaries as target-project application build/lint/test validation.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `compatibility_runtime` | Add regression tests around `.opencode/workflow-state.js closeout-summary <work-item>` and related read-model consistency: resolved/closed issue counts excluded from unresolved counts, optional ADR recommendation does not block readiness, explicitly required ADR does block, `full_done` completed work item reports ready, task-board validity is respected, and scan evidence summaries are retained. Validate consistency with `check-stage-readiness`, `status --short`, and workflow metrics for representative fixtures. |
| `runtime_tooling` | Required only if in-session workflow-state tools or runtime evidence readers are touched; validate they preserve the same readiness semantics, issue count interpretation, optional-vs-required artifact distinction, and scan evidence summary fields when reading compatibility-runtime state. |
| `documentation` | Required if operator, maintainer, workflow, runtime-surface, or runbook docs are updated; validate docs distinguish blockers from optional recommendations, resolved issue history from unresolved issues, and OpenKit runtime validation from target-project app validation. |
| `global_cli` | Required only if packaged/global CLI surfaces or bundle contents are touched; validate packaged behavior does not drift from checked-in compatibility runtime behavior for `closeout-summary` and related readiness reads. |
| `target_project_app` | Unavailable for this feature unless a real target project defines app-native build, lint, test, smoke, or regression commands; OpenKit workflow-state, scan, runtime, or CLI checks must not be reported as target-project application validation. |

## Open Questions And Assumptions

- Assumption: `check-stage-readiness`, `status --short`, and workflow metrics already represent the canonical readiness semantics for this defect; this scope fixes `closeout-summary` drift rather than redefining readiness globally.
- Assumption: issue records have lifecycle statuses sufficient to distinguish open/unresolved from resolved/closed terminal states; Solution Lead should confirm exact status values before implementation.
- Assumption: ADR recommendations can be distinguished between optional `recommended-now` output and explicit required artifact conditions in existing workflow/readiness data or can be made distinguishable without changing product semantics.
- Assumption: scan evidence summaries are already present in verification evidence/read models; this feature must preserve them while changing readiness logic.
- Risk: fixing only the displayed `ready to close` line without aligning unresolved counts, artifact recommendations, and scan evidence summaries would leave the operator trust issue unresolved.
- Risk: treating every ADR mention as optional would hide real required-documentation blockers; Solution Lead must preserve the required-vs-optional distinction.
- Risk: historical issue summaries could be valuable for audit; the solution should avoid deleting visibility while excluding terminal issues from blockers.

## Success Signal

- For representative completed full-delivery work items from the FEATURE-942/FEATURE-943 failure pattern, `closeout-summary <work-item>` reports ready to close when canonical readiness surfaces report ready/no open blockers, shows zero unresolved issues when all issues are resolved/closed, keeps optional ADR recommendations non-blocking, and preserves scan evidence summaries.

## Handoff Notes For Solution Lead

- Keep the solution focused on closeout-summary/read-model consistency; do not broaden into unrelated workflow-state redesign, scan-tool implementation, or issue lifecycle feature work.
- Define the exact open/unresolved versus resolved/closed status set before implementation and use it consistently in closeout readiness and issue counts.
- Preserve closeout output value: historical resolved issues and optional recommendations should remain visible but must be clearly non-blocking.
- Preserve scan evidence summary output and validation-surface labeling while fixing readiness logic.
- Include regression fixtures/tests for:
  - resolved/closed issues excluded from unresolved counts;
  - optional ADR recommendation does not block;
  - explicitly required ADR does block;
  - completed `full_done` item with canonical readiness satisfied reports ready;
  - task-board validity participates in readiness;
  - scan evidence summary survives closeout rendering.
- Treat `compatibility_runtime` validation as the primary surface. Use `runtime_tooling`, `documentation`, and `global_cli` validation only if those surfaces are touched. Keep `target_project_app` unavailable unless real app-native commands exist.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business/readiness rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/risks, and Solution Lead handoff notes for `product_to_solution` review.
