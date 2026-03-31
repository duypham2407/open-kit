---
description: "Triggers the writing-solution skill to turn approved scope into a solution package and execution slices."
---

# Command: `/write-solution`

Use `/write-solution` to create a solution package for work currently in `Full Delivery` or `Migration` mode.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

## Preconditions

- The current `mode` must be `full` or `migration`
- The required solution context already exists for the current work item
- If the work is in `full`, an approved `Product Lead` scope package from `full_product` already exists for the current feature
- In `full`, `Solution Lead` is currently working in `full_solution`, not in parallel with `Product Lead`
- In `migration`, `Solution Lead` is currently working in `migration_strategy`

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json`
- `.opencode/work-items/` when managed work-item backing state is relevant; treat `.opencode/openkit/work-items/` as compatibility-only when present
- `.opencode/openkit/docs/templates/solution-package-template.md`
- `.opencode/openkit/docs/templates/migration-report-template.md` when migration work benefits from one running artifact
- skill `writing-solution`

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- Create or update `docs/solution/YYYY-MM-DD-<feature>.md` from `docs/templates/solution-package-template.md` for full delivery or `docs/templates/migration-solution-package-template.md` for migration work
- In `full`, use the approved `Product Lead` scope package as the upstream contract for the solution package
- Keep the solution package aligned with the current stage and approval context for the active mode
- Write feature-level solution slices, dependencies, validation strategy, and parallelization notes before any optional micro-task breakdown
- In migration mode, record preserved invariants, seam or adapter steps, and parity checks explicitly
- In migration mode, recommend scaffolding or updating `migration_report` when baseline, solution package, execution, and verification should stay visible in one artifact
- Record the real validation path, or a missing-validation-path note when the repository has no suitable command
- Return the solution package for review and approval through the canonical workflow for the active mode

## Rejection or escalation behavior

- If work is still in quick mode, reject this command and route the task into Migration or Full Delivery first
- If required solution input is incomplete, stop and require that upstream artifact before writing the solution package
- If work is in `full` and the `Product Lead` scope package is missing, incomplete, or unapproved, stop and require that upstream artifact before writing the solution package
- Do not use this command to open a new full lane implicitly or bypass the approval chain

## Validation guidance

- The solution package should name the strongest real validation path available in the repository
- In migration mode, use `migration_report` when handoffs would benefit from a single running narrative instead of scattered notes
- If no repo-native app build, lint, or test command exists, say that explicitly in the solution package instead of guessing a stack command
- Use `node .opencode/openkit/workflow-state.js validate` only to confirm workflow state, not to stand in for implementation verification
