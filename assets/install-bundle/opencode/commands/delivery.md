---
description: "Starts the Full Delivery lane for feature work and higher-risk changes."
---

# Command: `/delivery`

Use `/delivery` when work needs the full lane from the start or when quick or migration work has already escalated.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

## Preconditions

- The request satisfies one or more full-lane triggers in `context/core/workflow.md`
- If this is resumed work, escalation context or the current full stage must be read from workflow state before continuing

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` when resuming
- `.opencode/work-items/` when managed work-item backing state is relevant; treat `.opencode/openkit/work-items/` as compatibility-only when present

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The user chose this lane explicitly; record `lane_source = user_explicit`, `mode = full`, and `mode_reason` in workflow state
- Tell the user the next action in full-delivery language: initialize intake, route to `Product Lead` for `full_product`, then hand off to `Solution Lead` for `full_solution`
- Initialize `full_intake`
- Route to `Product Lead` to begin the Full Delivery chain defined in `context/core/workflow.md`
- Track approval gates in workflow state before each stage advance
- Use this lane when the dominant uncertainty is product behavior, requirements, or cross-boundary solution design rather than compatibility modernization

## Lane authority

The user selected `/delivery` explicitly. This is a **lane lock**: the Master Orchestrator must honor the user's lane choice.

- Do **not** reject, reroute, or override the lane to `quick` or `migration`
- If the command is entered from an active quick or migration context, preserve escalation metadata while moving into `full_intake`
- If the Master Orchestrator sees risk factors that suggest a different lane would be more appropriate (e.g. the work is behavior-preserving modernization that fits migration), it must issue a **single advisory warning** explaining the concern and the recommended alternative
- After the warning, if the user does not change their mind, proceed in full delivery mode without further objection
- If required full-mode context is missing or state is contradictory, stop at intake and report the mismatch instead of skipping a stage
- Do not create a new lane, new stage, or alternate full-entry chain outside the canonical workflow doc

## Validation guidance

- Use `node .opencode/openkit/workflow-state.js show` or `node .opencode/openkit/workflow-state.js validate` when resumable full-mode state needs confirmation
- Keep implementation and QA validation honest to the repository's actual tooling
- Do not overstate automation when the repository still lacks app-native build, lint, or test commands

## Example transcript

```text
User: /delivery add a new approval workflow for enterprise billing
OpenKit: This belongs in Full Delivery because the work changes product behavior and needs explicit product scope before technical direction.
OpenKit: Next action: initialize full_intake, have Product Lead create the scope package in full_product, then hand that approved package to Solution Lead in full_solution.
```
