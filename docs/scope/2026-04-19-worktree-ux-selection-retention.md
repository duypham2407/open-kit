---
artifact_type: scope_package
version: 1
status: draft
feature_id: FEATURE-936
feature_slug: worktree-ux-selection-retention
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Worktree UX Selection and Retention

## Title

OpenKit worktree selection, retained reuse/reopen flow, cleanup separation, and safe opt-in `.env` propagation.

## Goal

Give OpenKit operators explicit, low-surprise control over workspace isolation. Operators must be able to choose whether a run creates a new managed worktree, reuses or reopens an existing one, or uses no worktree at all; follow-up fixes on the same feature or work-item lineage should default intelligently; finishing work must not immediately destroy useful context; and optional `.env` propagation must be visible, opt-in, and safer by default.

## Target Users

- OpenKit operators starting or resuming work in a repository through the OpenKit launcher and workflow commands
- Operators returning for follow-up fixes, QA rework, or resumed work on the same feature or work-item lineage
- Maintainers who need predictable, inspectable worktree behavior without excessive prompt friction

## Problem Statement

Current OpenKit worktree behavior is too automatic in the wrong places and not explicit enough where operator intent matters. Operators do not have a first-class product choice between creating a new worktree, continuing in an existing one, reopening a retained one, or avoiding worktrees entirely. A completed quick task can immediately trigger worktree cleanup, which removes a useful working context before the operator knows whether a follow-up fix or re-entry is needed. Projects that rely on local `.env` files also need a deliberate, safe way to make those files available in a worktree without OpenKit silently duplicating secrets or asking for confirmation at every internal workflow step. The product contract needs to reduce surprise, preserve context, and keep the CLI fast.

## In Scope

- Define an explicit four-mode worktree choice contract: `new`, `reuse`, `reopen`, and `none`
- Define product-level semantics for each mode so Solution Lead can design from one clear behavior contract
- Smart defaulting for follow-up fixes, rework, and resumed work on the same feature or work-item lineage
- Separate retention and cleanup behavior from task completion, workflow completion, and normal launcher exit
- Define safe opt-in `.env` propagation behavior with `none`, `symlink`, and `copy` modes
- Prefer `symlink` over `copy` at the product level when env propagation is requested and symlink is available
- Define warnings, conflict behavior, and non-silent fallback rules for env propagation
- Define CLI usability expectations for explicit flags/config and interactive prompting when a choice is still required
- Define prompt-minimization expectations so the operator is not asked to reconfirm routine internal workflow steps
- Define bounded behavior when requested reuse or reopen targets are missing, ambiguous, or unsafe

## Out of Scope

- Redesigning git internals, branch naming, merge strategy, or worktree directory layout
- Defining code-level implementation details, storage schema changes, or exact CLI flag names
- Automatic secret discovery, secret encryption, secret rotation, or secret redaction systems
- Propagating arbitrary ignored files or local tooling files beyond the `.env` propagation contract
- Cross-machine sync or sharing of retained worktrees
- Background garbage collection, age-based pruning, or advanced retention automation beyond the requirement that cleanup is not tied to task completion
- Changing lane selection rules, approval gates, or the overall workflow stage model
- A broader session-resume redesign outside the worktree selection, retention, and env-propagation UX covered here

## User Stories

- As an operator starting work, I want to choose `new`, `reuse`, `reopen`, or `none` so that OpenKit matches how I want to work in this repository.
- As an operator returning to fix something on the same feature or work-item lineage, I want OpenKit to prefer the previously retained worktree when safe so that I keep context instead of recreating it.
- As an operator finishing a quick task, I want the worktree to remain available unless I explicitly clean it up so that follow-up work is easy.
- As an operator who needs local env files in a worktree, I want an explicit `none` / `symlink` / `copy` choice with clear warnings so that I understand the trade-offs before secrets or config are duplicated.
- As an operator who already supplied the needed choices, I want OpenKit to continue without repeated internal confirmations so that the CLI stays fast.
- As a maintainer, I want the scope to stay bounded to worktree choice, retention, and env propagation so that solution work does not turn into a general workspace-management redesign.

## Business Rules

1. OpenKit must support four explicit worktree modes:
   - `new`: create a fresh managed worktree for the current run or work context.
   - `reuse`: use the currently available retained worktree already associated with the current lineage instead of creating a new one.
   - `reopen`: resume a previously retained worktree from the same lineage when the operator is coming back after an earlier run, interruption, or completion boundary.
   - `none`: run against the repository root without using a managed worktree.
2. Worktree mode is an operator-facing choice. If the operator explicitly selected a mode, OpenKit must honor it and must not silently substitute a different mode.
3. If the operator did not explicitly select a mode, OpenKit may recommend or preselect a default only when it can determine a safe default from the current feature or work-item lineage.
4. Smart defaulting must prefer an existing retained worktree for follow-up fixes, QA rework, reopened work, or resumed work on the same lineage when that retained worktree is still available.
5. Smart defaulting must not automatically attach the operator to an unrelated or ambiguous worktree. If lineage matching is unclear or multiple equally plausible candidates exist, OpenKit must not guess silently.
6. `reuse` and `reopen` are distinct product behaviors:
   - `reuse` continues with the obvious current retained worktree for the same active lineage.
   - `reopen` is for intentionally returning to a previously retained worktree after a prior run or completion boundary.
7. If the operator chooses `none`, OpenKit must use the repository root as the working context and must not create, reuse, or reopen a managed worktree.
8. Marking work done, advancing workflow stages, or exiting a normal run must not by themselves destroy, merge, or remove a managed worktree.
9. Cleanup must be a separate operator-directed action or policy surface, not an implicit side effect of task completion.
10. Destructive cleanup remains confirmation-worthy. Non-destructive selection, reuse, reopen, and normal workflow progress should not require repeated confirmation.
11. `.env` propagation is opt-in only. The safe default is `none` unless the operator explicitly chose another mode or a previously saved choice for the same context is being reused.
12. `.env` propagation applies only when the selected execution context is a managed worktree. If worktree mode is `none`, env propagation is not applicable and must not copy or link env files.
13. `.env` propagation modes are:
   - `none`: do not propagate env files into the managed worktree.
   - `symlink`: link selected env files from the source context into the managed worktree. This is the preferred mode when available because it avoids drift.
   - `copy`: copy selected env files into the managed worktree. This is higher risk than symlink because the files can drift and secret material is duplicated.
14. OpenKit must not silently downgrade `symlink` to `copy`. If symlink is unavailable, unsupported, or unsafe, OpenKit must show a visible warning and require a clear next choice or a safe skip outcome.
15. OpenKit must warn before `copy` mode that copied env files can drift from the source and duplicate secrets.
16. OpenKit must not silently overwrite an existing env file in the target worktree when propagation would conflict. The operator must receive a visible conflict outcome and a next-step choice or skip behavior.
17. The scope covers existing repository-local `.env` and `.env.*` files that the operator already manages. It does not require OpenKit to invent new env files, infer secrets, or manage secret contents.
18. The CLI should support two equivalent product paths:
   - explicit input up front, so OpenKit can proceed without prompting
   - a concise interactive prompt when required input is still missing
19. If a prompt is needed, OpenKit should group the choice at the point of launch or resume, not spread the same decision across multiple internal workflow steps.
20. Once the operator has provided the worktree and env choices for the current launch flow, internal workflow stages, approvals, and other non-destructive internal events must not ask again just because the workflow advanced.
21. This feature improves worktree choice, retained context, cleanup separation, and safe env propagation. It does not promise a full secret-management system or a generalized workspace-orchestration platform.

## Acceptance Criteria Matrix

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-1 | An operator starts or resumes OpenKit work and no explicit worktree mode was provided | OpenKit needs a worktree decision and no safe default is available | OpenKit presents or requests an explicit choice among `new`, `reuse`, `reopen`, and `none` |
| AC-2 | An operator explicitly selects `new` | OpenKit prepares the work context | OpenKit creates a fresh managed worktree and does not silently switch to `reuse`, `reopen`, or `none` |
| AC-3 | An operator explicitly selects `reuse` and a retained worktree for the same lineage is available | OpenKit prepares the work context | OpenKit uses that retained worktree instead of creating a new one |
| AC-4 | An operator explicitly selects `reopen` and a previously retained worktree for the same lineage is available | OpenKit prepares the work context | OpenKit resumes that retained worktree rather than creating a new worktree or falling back silently |
| AC-5 | An operator explicitly selects `none` | OpenKit prepares the work context | OpenKit runs from the repository root and does not create, reuse, or reopen a managed worktree |
| AC-6 | A follow-up fix or resumed change is started on the same feature or work-item lineage and a retained worktree is available | The operator did not explicitly choose a worktree mode | OpenKit recommends or preselects reuse/reopen behavior instead of defaulting to a brand-new worktree |
| AC-7 | A work request has no clear lineage match or multiple plausible retained worktrees | The operator did not explicitly choose a worktree mode | OpenKit does not silently attach to one candidate as if it were certain |
| AC-8 | A task reaches done status or a normal run exits | The current work used a managed worktree | The managed worktree is retained and not automatically removed just because work finished |
| AC-9 | A managed worktree exists for completed work | No explicit cleanup action was requested | OpenKit does not auto-destroy the worktree as part of task completion or launcher exit |
| AC-10 | An operator initiates cleanup or another destructive removal path | The action would remove or destroy a managed worktree | OpenKit treats the cleanup as a distinct, explicit action rather than a hidden side effect |
| AC-11 | A managed worktree is selected | The operator leaves env propagation at `none` | OpenKit does not copy or link `.env` files into the worktree |
| AC-12 | A managed worktree is selected and env propagation is requested | The operator chooses `symlink` and symlink is available | OpenKit uses `symlink` as the propagation mode |
| AC-13 | A managed worktree is selected and env propagation is requested | The operator chooses `symlink` but symlink is unavailable, unsupported, or unsafe | OpenKit shows a visible warning and does not silently fall back to `copy` |
| AC-14 | A managed worktree is selected and env propagation is requested | The operator chooses `copy` | OpenKit shows a visible warning that copied env files can drift and duplicate secret material |
| AC-15 | A propagation action would overwrite or conflict with an existing env file in the target worktree | OpenKit evaluates the propagation request | OpenKit does not silently overwrite the existing file |
| AC-16 | The operator supplied explicit worktree and env choices up front | OpenKit enters internal workflow stages after launch | OpenKit does not reprompt for the same choices during routine internal stage progression |
| AC-17 | A prompt is needed because required worktree choice input is missing | OpenKit asks the operator | The prompt is scoped to the decision point and does not require separate confirmations at each later internal workflow step |
| AC-18 | Worktree mode is `none` | The operator also supplied an env propagation preference | OpenKit treats env propagation as not applicable and does not copy or link `.env` files into the repository-root context |
| AC-19 | An operator chooses `reuse` or `reopen` but the requested retained worktree is missing, inaccessible, or otherwise unusable | OpenKit prepares the work context | OpenKit reports that the requested retained worktree is unavailable and requires a clear next choice or safe fallback path rather than silently pretending the request succeeded |

## Edge Cases

- A follow-up fix arrives after the prior work item is already marked done; the retained worktree should still be eligible for reopen behavior if it remains available.
- Multiple retained worktrees plausibly match the same lineage; OpenKit must not silently guess which one the operator meant.
- The operator requests `reuse` or `reopen`, but the retained worktree path was manually deleted or is no longer accessible.
- The operator requests `reuse` or `reopen`, but the retained worktree exists in an unsafe or blocked state; OpenKit should surface that condition instead of silently converting it into a different mode.
- The repository cannot support managed worktrees for this run; OpenKit should explain that worktree modes are unavailable instead of failing opaquely.
- The operator selects `none`; any env propagation setting becomes not applicable for that run.
- The project has no `.env` or `.env.*` files to propagate; OpenKit should present that outcome clearly instead of pretending propagation occurred.
- Symlink is unavailable on the current platform, filesystem, or permission model; OpenKit must warn and cannot silently copy instead.
- A target worktree already contains env files from earlier work; OpenKit must surface conflicts instead of overwriting them implicitly.
- The operator returns repeatedly for small follow-up fixes; OpenKit should not force a brand-new worktree or repeated confirmations every time when a clear retained context already exists.

## Error And Failure Cases

- Requested `reuse` or `reopen` target does not exist anymore.
- Requested `reuse` or `reopen` target exists but cannot be safely used.
- Managed worktree cleanup is requested while the worktree is not in a removable state.
- Env propagation is requested but the source env files are missing.
- Env propagation would overwrite target files or create an ambiguous conflict.
- `symlink` is requested but the environment cannot create a safe symlink.

## Operator Experience Notes

- The default operator path should be fast: if the operator already specified the desired worktree and env choices, OpenKit should proceed without extra prompts.
- If OpenKit needs input, it should ask once at the launch or resume decision point, not repeatedly during internal workflow progression.
- The worktree choice UX should make all four modes visible with concise descriptions, not bury `reuse`, `reopen`, or `none` behind hidden fallback behavior.
- When smart defaulting applies, OpenKit should make the recommended default understandable by telling the operator why that default was chosen, such as same-lineage follow-up or retained context availability.
- When `reuse` or `reopen` is possible, the operator should be shown enough context to understand what will be opened, such as the relevant lineage or retained context identity.
- Env propagation should be a separate, clearly labeled choice that appears only when a managed worktree is being used.
- `symlink` should be presented as the preferred safer convenience option; `copy` should be presented as available but riskier.
- Warnings should be concise and actionable. They should explain the risk or conflict and the next safe choice, not just emit a generic failure message.
- Post-run messaging should make it clear that a managed worktree was retained and is available for reuse, reopen, or later cleanup.
- Internal workflow stage changes should feel automatic once the operator has made the relevant setup choices; the CLI should not behave as though every internal stage requires fresh human confirmation.

## Open Questions

- None that block Solution Lead. Solution work should define the specific UX surface and decision order while preserving the behavior contract above.

## Success Signal

- Operators can intentionally choose `new`, `reuse`, `reopen`, or `none` instead of being forced into automatic worktree behavior.
- Follow-up fixes on the same lineage commonly return to retained context instead of recreating it.
- Completing work no longer immediately destroys the worktree context by default.
- Env propagation is explicit, opt-in, and visible, with `symlink` preferred over `copy` and no silent downgrade.
- The CLI stays low-friction because choices happen at meaningful decision points rather than every internal workflow step.

## Handoff Notes For Solution Lead

- Preserve the explicit four-mode contract: `new`, `reuse`, `reopen`, and `none` must remain first-class product behaviors.
- Preserve the separation between work completion and worktree cleanup. Do not let task completion implicitly remove the working context.
- Preserve the prompt-minimization rule: ask when a real operator decision is needed, not on every internal workflow transition.
- Preserve the env-propagation safety contract: opt-in only, `none` / `symlink` / `copy`, `symlink` preferred, no silent downgrade to `copy`, and no silent overwrite on conflict.
- Keep the solution bounded. Do not broaden this into a full secret-management initiative, a generalized workspace-orchestration system, or a redesign of lane/workflow semantics.
- Solution work must define how lineage-based defaulting and unavailable-target handling are surfaced, but it must not erase the product distinctions between `reuse` and `reopen`.
