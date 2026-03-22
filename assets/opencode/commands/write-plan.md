---
description: "Triggers the writing-plans skill to create bite-sized tasks from specs."
---

# Command: `/write-plan`

Use `/write-plan` to create an implementation plan for work currently in `Full Delivery` mode.

## Preconditions

- The current `mode` must be `full`
- The required spec and architecture artifacts already exist for the current feature
- The Tech Lead Agent is at the stage where `docs/plans/...` should be created

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/project-config.md`
- `.opencode/workflow-state.json`
- `docs/templates/implementation-plan-template.md`
- skill `writing-plans`

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- Create or update `docs/plans/YYYY-MM-DD-<feature>.md`
- Keep the plan aligned with the current full-mode stage and approval context
- Record the real validation path, or a missing-validation-path note when the repository has no suitable command
- Return the plan for review and approval through the canonical full workflow

## Rejection or escalation behavior

- If work is still in quick mode, reject this command and route the task into Full Delivery first
- If spec or architecture inputs are incomplete, stop and require those upstream artifacts before writing the plan
- Do not use this command to open a new full lane implicitly or bypass the approval chain

## Validation guidance

- The plan should name the strongest real validation path available in the repository
- If no repo-native app build, lint, or test command exists, say that explicitly in the plan instead of guessing a stack command
- Use `node .opencode/workflow-state.js validate` only to confirm workflow state, not to stand in for implementation verification
