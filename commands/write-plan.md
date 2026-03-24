---
description: "Triggers the writing-plans skill to create bite-sized tasks from specs."
---

# Command: `/write-plan`

Use `/write-plan` to create an implementation plan for work currently in `Full Delivery` or `Migration` mode.

## Global OpenKit path rule

- In globally installed OpenKit sessions, treat `.opencode/openkit/` as the repo-local compatibility surface for OpenKit-owned docs, templates, and workflow tools.
- Read canonical OpenKit docs from `.opencode/openkit/...`, not from repo-root `context/`, repo-root `AGENTS.md`, or repo-root `.opencode/`.
- Use `.opencode/openkit/workflow-state.json` for resumable workflow state.
- Use `node .opencode/openkit/workflow-state.js <command>` for workflow-state checks in global mode.

## Preconditions

- The current `mode` must be `full` or `migration`
- The required architecture artifact already exists for the current work item
- If the work is in `full`, the required spec artifact already exists for the current feature
- The Tech Lead Agent is at the stage where `docs/plans/...` should be created

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/workflow-state.json`
- `.opencode/openkit/docs/templates/implementation-plan-template.md`
- `.opencode/openkit/docs/templates/migration-report-template.md` when migration work benefits from one running artifact
- skill `writing-plans`

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- Create or update `docs/plans/YYYY-MM-DD-<feature>.md`
- Keep the plan aligned with the current stage and approval context for the active mode
- In migration mode, record preserved invariants, seam or adapter steps, and parity checks explicitly
- In migration mode, recommend scaffolding or updating `migration_report` when baseline, plan, execution, and verification should stay visible in one artifact
- Record the real validation path, or a missing-validation-path note when the repository has no suitable command
- Return the plan for review and approval through the canonical workflow for the active mode

## Rejection or escalation behavior

- If work is still in quick mode, reject this command and route the task into Migration or Full Delivery first
- If required architecture input is incomplete, stop and require that upstream artifact before writing the plan
- If work is in `full` and the spec input is incomplete, stop and require that upstream artifact before writing the plan
- Do not use this command to open a new full lane implicitly or bypass the approval chain

## Validation guidance

- The plan should name the strongest real validation path available in the repository
- In migration mode, use `migration_report` when handoffs would benefit from a single running narrative instead of scattered notes
- If no repo-native app build, lint, or test command exists, say that explicitly in the plan instead of guessing a stack command
- Use `node .opencode/openkit/workflow-state.js validate` only to confirm workflow state, not to stand in for implementation verification
