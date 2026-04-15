---
artifact_type: scope_package
version: 1
status: draft
feature_id: FEATURE-936
feature_slug: quick-task-brainstorm-before-options
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Quick Task Brainstorm Before Options

## Goal

Make the quick lane require explicit user alignment before any solution analysis begins, then move option analysis and plan confirmation into `quick_plan`, so quick tasks stay fast without allowing premature solutioning or unstable narrow fixes.

## Target Users

- Users invoking `/quick-task` for small or medium bounded work
- Quick Agent operating the single-agent quick lane
- Maintainers relying on the quick-stage contract to stay consistent and inspectable

## Problem Statement

The current quick-lane contract allows solution options too early in `quick_brainstorm`. That lets the agent move from intake into analysis before the user has explicitly confirmed the agent's understanding of the task. The result is avoidable misalignment, especially on small tasks where the agent may assume the problem is obvious and jump straight into options or implementation planning. The quick lane needs a stricter confirmation gate without changing lane selection, escalation policy, or stage names.

## In Scope

- Redefine `quick_brainstorm` as a clarify-and-align stage.
- Require explicit user confirmation before any solution analysis or option comparison begins.
- Apply that confirmation rule to all quick tasks, including very small ones.
- Allow the agent, before confirmation, to ask more questions or present a draft understanding and wait.
- Redefine `quick_plan` as the stage for solution analysis, option presentation, option selection, execution planning, and plan confirmation.
- Set the default option count to 3.
- Allow fewer than 3 options only when there are not 3 meaningfully different approaches, with an explicit explanation.
- Require options to be holistic and to protect project stability and consistency across logic and workflow, not just local file-level fixes.
- Require a separate confirm-plan checkpoint before implementation starts.
- Preserve the existing quick-stage names.

## Out of Scope

- Renaming any quick-stage names.
- Changing lane selection rules or escalation policy.
- Changing the full-delivery or migration lane contracts.
- Designing implementation mechanics, prompts, storage changes, or runtime enforcement details.
- Defining code-level solution approaches for how the workflow change will be implemented.

## Main Flows

- **As a quick-task user,** I want the agent to confirm its understanding before presenting solutions, so that I can correct misunderstandings before analysis begins.
- **As a quick-task user,** I want to review and choose among solution options during `quick_plan`, so that I stay in control of the approach.
- **As a quick-task user,** I want a separate plan confirmation step before implementation, so that the agent does not start coding on an unapproved plan.
- **As a maintainer,** I want the quick-lane contract to keep stage names stable while clarifying stage responsibilities, so that workflow semantics stay consistent.

## Business Rules

1. `quick_brainstorm` is a clarification and alignment stage, not a solution-analysis stage.
2. The agent must not present solution options, recommend approaches, compare approaches, or begin execution planning until the user has explicitly confirmed the agent's understanding.
3. This confirmation requirement applies to every quick task, including very small tasks.
4. Before confirmation, the agent may ask follow-up questions or present a draft understanding and wait for confirmation.
5. If the user has not confirmed understanding, the agent must remain in clarification behavior and must not move into option analysis.
6. `quick_plan` is the stage for solution analysis after understanding is confirmed.
7. The default `quick_plan` behavior is to present 3 meaningfully different options.
8. Fewer than 3 options are allowed only when 3 meaningfully different approaches do not actually exist, and the agent must explain why.
9. Options must be holistic enough to preserve project stability and consistency across logic and workflow; they must not be framed as isolated local patch choices when broader consistency is affected.
10. The user must choose an option before the agent produces the execution plan.
11. After the agent produces the execution plan, the user must explicitly confirm that plan before implementation starts.
12. Stage names, lane-selection behavior, and escalation policy remain unchanged.

## Acceptance Criteria Matrix

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A quick task has entered `quick_brainstorm` | The agent has not yet received explicit user confirmation of its understanding | The agent does not present solution options or solution analysis |
| AC-2 | A quick task has entered `quick_brainstorm` | The agent needs more certainty about the request | The agent may ask follow-up questions or present a draft understanding and wait for confirmation |
| AC-3 | A quick task is very small and appears straightforward | The user has not explicitly confirmed the agent's understanding | The agent still does not begin solution analysis |
| AC-4 | The agent has stated its understanding of the quick task | The user explicitly confirms that understanding | The workflow may proceed to `quick_plan` for solution analysis |
| AC-5 | A quick task is in `quick_plan` after user confirmation | The agent presents approaches | The default presentation contains 3 meaningfully different options |
| AC-6 | A quick task is in `quick_plan` | The agent presents fewer than 3 options | The agent explicitly explains why 3 meaningfully different approaches do not exist |
| AC-7 | A quick task is in `quick_plan` | The agent presents options | The options address project-level stability and consistency implications, not only narrow local fixes |
| AC-8 | A quick task is in `quick_plan` | The user has not yet chosen an option | The agent does not produce a final execution plan |
| AC-9 | A quick task is in `quick_plan` | The user chooses an option | The agent produces an execution plan for the selected option |
| AC-10 | A quick task has an execution plan | The user has not explicitly confirmed the plan | The agent does not start `quick_implement` |
| AC-11 | A quick task has an execution plan | The user explicitly confirms the plan | The workflow may proceed to `quick_implement` |
| AC-12 | The quick-lane contract is updated by this feature | The workflow is reviewed | Quick-stage names remain `quick_intake -> quick_brainstorm -> quick_plan -> quick_implement -> quick_test -> quick_done` |
| AC-13 | The quick-lane contract is updated by this feature | Lane policy is reviewed | Lane selection and escalation behavior remain unchanged from the existing contract |

## Edge Cases

- The user gives a vague request; the agent must stay in clarification behavior until the user confirms a concrete understanding.
- The user says the task is obvious or tiny; explicit confirmation is still required before option analysis.
- The user responds with corrections instead of confirmation; the agent must update its understanding and seek confirmation again.
- Only one or two realistic approaches exist; the agent may present fewer than 3 options only with an explicit explanation.
- A local code tweak appears possible, but broader workflow or logic consistency could be affected; options must still account for project-wide stability, not only the narrow tweak.
- The user confirms understanding but later changes the requested outcome before implementation; the agent must return to alignment behavior before continuing planning or implementation.

## Error And Failure Cases

- The agent presents options before explicit user confirmation in `quick_brainstorm`.
- The agent treats implicit approval or silence as confirmation.
- The agent skips from confirmed understanding directly to implementation without the `quick_plan` option-selection and plan-confirmation flow.
- The agent presents fewer than 3 options without explaining why.
- The agent presents options that are only local fixes and do not consider broader project consistency when broader consistency is relevant.
- The agent starts implementation after option selection but before explicit plan confirmation.

## Open Questions

- None from product scope at this stage. Implementation mechanics remain for Solution Lead.

## Success Signal

- Quick-task work always shows an explicit understanding-confirmation checkpoint before any solution analysis.
- `quick_plan` becomes the inspectable place where options are compared, the user selects an option, and the user confirms the execution plan before implementation.
- The quick-lane contract stays stable in naming and lane policy while becoming stricter about alignment and approval checkpoints.

## Handoff Notes For Solution Lead

- Preserve the current quick-stage names exactly.
- Preserve current lane-selection and escalation policy exactly.
- Treat this as a behavioral workflow change, not a prompt-only wording tweak unless the solution can still guarantee the acceptance criteria.
- Do not collapse the two user approvals into one: there is one confirmation before option analysis and a separate confirmation before implementation.
- Keep the solution focused on quick-lane stage semantics and approval checkpoints; do not expand into broader lane redesign.
