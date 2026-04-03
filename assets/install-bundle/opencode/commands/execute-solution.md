---
description: "Executes an approved Full Delivery or Migration solution package."
---

# Command: `/execute-solution`

Use `/execute-solution` when an approved Full Delivery or Migration solution package is ready to be carried out.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path, verification, and tool-substitution rules.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code. Prefer kit intelligence tools before basic built-in tools or OS commands.

## Preconditions

- The current `mode` must be `full` or `migration`
- An approved solution package exists in `docs/solution/` for the current work item
- Any required upstream approvals for the active mode are already recorded in workflow state

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/session-resume.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/context/core/workflow-state-schema.md`
- `.opencode/openkit/workflow-state.json`
- `.opencode/work-items/` when managed work-item backing state is relevant; treat `.opencode/openkit/work-items/` as compatibility-only when present

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- Confirm the current state is compatible with implementation work for the active mode
- Read the approved solution package and execute it without redefining the canonical workflow rules
- Use the real implementation workflow available in the repository; do not imply live parallel execution support beyond what the checked-in runtime documents today
- Report the actual validation path taken for each meaningful change

## Rejection or escalation behavior

- If the work is still in quick mode, stop and route it into `Migration` or `Full Delivery` before using this command
- If workflow state is invalid, contradictory, or missing required approvals, stop and correct state or inputs before implementation
- If the solution package is missing, stale, or unapproved, stop and send the work back to the planning step instead of improvising a new one inline

## Validation guidance

- Run `node .opencode/openkit/workflow-state.js validate` when you need to confirm workflow-state integrity before execution
- Use repo-native app build, lint, or test commands only if they actually exist and are documented
- If the repository still lacks app-native validation tooling, report manual checks or other real evidence instead of inventing automation
