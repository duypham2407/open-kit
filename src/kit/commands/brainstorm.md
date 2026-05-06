---
description: "Starts ambiguity-driven Migration or Full Delivery exploration with the brainstorming skill."
---

# Command: `/brainstorm`

Use `/brainstorm` when work is already in `Migration` or `Full Delivery` mode and meaningful ambiguity still needs exploration before scope or solution work can continue safely.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path, verification, and tool-substitution rules.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code. Prefer kit intelligence tools before basic built-in tools or OS commands.

## Preconditions

- The current `mode` must be `full` or `migration`
- The work needs design clarification, product exploration, architecture framing, or upgrade strategy exploration before solution-package execution
- If work is resuming, the current state must be readable before the session continues

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` when resuming
- `.opencode/work-items/` when managed work-item backing state is relevant; treat `.opencode/openkit/work-items/` as compatibility-only when present
- skill `brainstorming`

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- Confirm the work is in `Migration` or `Full Delivery` mode before starting brainstorming
- Use the brainstorming skill to explore the problem, compare approaches, and converge on a design
- In migration mode, use brainstorming to identify preserved invariants, migration blockers, seams, adapters, and slice boundaries before writing the migration solution package
- Create or refine the appropriate artifact for the active mode only when the skill outcome requires it
- Do not use brainstorming as the default first move when the request is already clear enough for `Product Lead` or `Solution Lead` to proceed directly
- Point back to `context/core/workflow.md` for stage order, approvals, and escalation rules instead of restating them here

## Rejection or escalation behavior

- If the work is still in the quick lane, stop and escalate into `Migration` or `Full Delivery` before using this command
- If the request is too incomplete to brainstorm safely, stop and ask for the missing context instead of fabricating direction
- Do not use this command to imply an alternate workflow or any live parallel execution feature that the repository does not currently document

## Validation guidance

- Use `node .opencode/openkit/workflow-state.js show` or `node .opencode/openkit/workflow-state.js validate` when resumable state needs confirmation
- Brainstorming output is design and workflow evidence, not app build/lint/test evidence
- If the repository has no app-native validation commands for the eventual implementation, record that constraint honestly in downstream artifacts
