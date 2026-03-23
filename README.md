# OpenKit — AI Software Factory

OpenKit is a workflow kit that turns your AI coding assistant into a mode-aware software team. It combines explicit artifacts, approval gates, resumable workflow state, and a bounded full-delivery task runtime with an emerging managed-wrapper product direction over OpenCode.

## Audience Navigation

Use the top-level docs as routing layers before diving into detailed references:

- `README.md`: concise top-level entrypoint for the repository surface
- `docs/operator/README.md`: operator-facing index for daily use, command selection, and wayfinding
- `docs/maintainer/README.md`: maintainer-facing index for canonical docs, runtime internals, and repository upkeep

Phase-1 docs layout also routes supporting material through dedicated hubs:

- `docs/operations/README.md`: operational support split into `runbooks/` and `internal-records/`
- `docs/templates/README.md`: template inventory and artifact-shape guardrails

Phase-1 authority rule:

- the new audience directories are index layers only
- they do not relocate or replace canonical workflow, runtime, governance, or operations docs
- `context/core/workflow.md` remains the canonical live workflow-semantics document
- companion core docs under `context/core/` remain the authoritative operational references they already were

## What Is Live Here

This repository currently contains two active surface types:

1. **Current checked-in runtime**
   - the live repository-local runtime rooted in `.opencode/`
   - the checked-in `agents/`, `commands/`, `skills/`, `hooks/`, `context/`, and runtime docs

2. **Managed wrapper product direction**
   - the emerging `openkit` CLI surface
   - install, doctor, and run flows intended to become the preferred top-level user path
   - additive wrapper behavior that does not erase the checked-in runtime in one step

Historical planning and example docs have been intentionally pruned from the working tree. If you need older rationale, use git history rather than treating removed docs as part of the live contract.

If you only need the live checked-in workflow/runtime behavior, prefer the current runtime docs and commands over older repository history.

The repository currently runs on the live `Quick Task+` successor semantics for the `quick` lane together with dedicated `Migration` and `Full Delivery` lanes. The system now supports three live modes: `quick`, `migration`, and `full`.

## Workflow Lanes

OpenKit now uses a hard split between three lanes:

1. **Quick Task**: For narrow, low-risk daily tasks that should move fast.
2. **Migration**: For upgrades, framework migrations, dependency modernization, and compatibility remediation.
3. **Full Delivery**: For feature work and higher-risk changes that benefit from the full multi-role team flow.

The Master Orchestrator chooses the lane, records the decision in workflow state, and routes the work.

Lane boundary heuristic:

- choose `Quick Task` for bounded low-risk work inside already-understood behavior
- choose `Migration` when behavior should stay the same and compatibility modernization is the main uncertainty
- choose `Full Delivery` when product behavior, requirements, or cross-boundary solution design are the main uncertainty

Concrete examples live in `context/core/workflow.md` under `Lane Decision Matrix`.
The stricter routing rubric and anti-patterns live in `context/core/lane-selection.md`.

Parallel-runtime guardrails now implemented:

- only `Full Delivery` work items can carry an execution task board
- quick and migration modes still have no task board and no task-level ownership model
- `.opencode/workflow-state.json` is now the active external compatibility mirror for the active work item, while `.opencode/work-items/` is the internal managed backing store
- safe parallel support is limited to the checked-in commands and validations; do not assume broader multi-agent safety than the runtime currently enforces

Live quick-lane guardrails:

- `Quick Task+` is the live successor semantics of the existing quick lane, not a third lane.
- Current command names remain unchanged.
- Runtime mode enums remain `quick`, `migration`, and `full`.

## Product Boundary And Migration Direction

Wrapper-first remains the intended product direction, but the migration is still staged in this worktree.

For the target wrapper path, once wrapper-owned files are actually present:

1. Run `openkit init` in a plain repository to create the wrapper-owned root `opencode.json` entrypoint and `.openkit/openkit-install.json` state file.
2. Run `openkit install` in a repository that already has `.opencode/opencode.json` when you want to add the wrapper path without replacing the checked-in runtime manifest.
3. Run `openkit doctor` to confirm the wrapper install is healthy, incomplete, or drifted before relying on `openkit run`.
4. Run `openkit run <args>` to launch `opencode` through the managed layering path for the current project.

In this worktree today:

- the wrapper path is the intended primary product surface, but it is still migration-stage rather than a fully checked-in replacement runtime here.
- the checked-in runtime surface remains the repository-local OpenKit implementation rooted in `.opencode/opencode.json`.
- docs may describe wrapper commands and wrapper-owned files as the target operator experience, but that does not mean those files are already present in this worktree.

OpenKit currently exposes two related but not identical surfaces:

- the intended managed wrapper surface for installation, readiness checks, and launch as migration completes
- the checked-in repository-local runtime surface that exists today in this worktree

Current boundary:

- `.opencode/opencode.json` is still the live runtime manifest in this checked-in repository runtime.
- `.opencode/workflow-state.json`, `.opencode/work-items/`, `.opencode/workflow-state.js`, `hooks/`, `agents/`, `skills/`, `commands/`, `context/`, and `docs/` remain repository-internal runtime or support surfaces.
- `registry.json` is local metadata describing repository surfaces and the migration-facing wrapper contract.
- `.opencode/install-manifest.json` records the local installed profile for this repository and remains additive metadata rather than a destructive installer.
- A wrapper-owned root `opencode.json` and `.openkit/openkit-install.json` are target wrapper surfaces, not checked-in current surfaces in this worktree.
- The checked-in agents, skills, commands, hooks, docs, and workflow-state files remain the source of truth for what actually exists.

Target migration direction:

- The wrapper entrypoint is intended to stay additive over the current repo-local surfaces rather than erase them in one step.
- The transition remains staged and non-destructive, with compatibility for existing repository-local runtime users during migration.
- When docs refer to raw `.opencode/*` files, treat them as repository/runtime internals that power the wrapper rather than as proof that the wrapper path is unsupported.

Repository-internal vs wrapper-facing summary:

- Wrapper-facing direction: `openkit init`, `openkit install`, `openkit doctor`, `openkit run`, a root `opencode.json`, and `.openkit/openkit-install.json` when that wrapper surface is actually installed.
- Repository-internal today: `.opencode/opencode.json`, workflow-state files, the workflow-state CLI, hooks, agents, skills, commands, context, and maintained docs.
- Wrapper-facing and repository-internal surfaces intentionally coexist; the wrapper does not imply the lower-level runtime vanished.

## The 7-Role Team

The full-delivery lane uses 7 distinct team roles:

1. **Master Orchestrator**: Routes work, chooses the lane, and manages feedback loops.
2. **PM Agent**: Defines product goals and priorities.
3. **BA Agent**: Writes detailed specifications and acceptance criteria.
4. **Architect Agent**: Designs system architecture and technology choices.
5. **Tech Lead Agent**: Enforces standards and creates bite-sized implementation plans.
6. **Fullstack Agent**: Implements approved work.
7. **QA Agent**: Validates implementation and classifies issues.

Quick tasks use the canonical `quick_*` stage chain defined in `context/core/workflow.md`, with the `QA Agent` operating in `QA Lite` mode.

Migration work uses the canonical `migration_*` stage chain defined in `context/core/workflow.md`, with validation centered on baseline evidence, compatibility checks, and staged regression rather than default TDD-first execution.

The migration lane is behavior-preserving by design: freeze invariants, decouple only the blockers that are tightly coupled to the old stack, migrate in slices, and clean up after parity is proven.

Repeatable migration support docs now include `docs/templates/migration-baseline-checklist.md` and `docs/templates/migration-verify-checklist.md`.

For teams that prefer one living artifact across the whole migration, `docs/templates/migration-report-template.md` is also available.

The runtime can now scaffold that artifact directly through `node .opencode/workflow-state.js scaffold-artifact migration_report <slug>` while in the right migration stage.

## Workflow & Skills

Agents use a library of **Skills** (standard operating procedures) to accomplish their tasks without relying purely on LLM instinct:

- `brainstorming`: Socratic design refinement.
- `writing-specs`: Converting vague ideas into BDD acceptance criteria.
- `writing-plans`: Creating bite-sized, atomic task plans.
- `test-driven-development`: The RED-GREEN-REFACTOR iron law.
- `subagent-driven-development`: Dispatching fresh subagents for execution.
- `systematic-debugging`: A 4-phase root cause analysis process.
- `code-review`: Two-stage review (compliance, then quality).

## Context System

Context is loaded dynamically based on the current phase, anchored by `context/navigation.md`. Critical contexts include:
- `context/core/code-quality.md`: The repo's coding standards.
- `context/core/workflow.md`: The canonical Quick Task, Migration, and Full Delivery workflow contract.
- `context/core/approval-gates.md`: Approval recording rules for stage transitions.
- `context/core/issue-routing.md`: QA issue classification and ownership routing.
- `context/core/session-resume.md`: Resume protocol for fresh sessions.

Historical planning background has been intentionally pruned from this worktree. Do not treat older git history as the live contract when repository state differs.

Current docs layout to keep straight:

- audience routing stays at `README.md`, `docs/operator/README.md`, and `docs/maintainer/README.md`
- artifact guidance stays with the owning directories such as `docs/briefs/`, `docs/specs/`, `docs/architecture/`, `docs/plans/`, `docs/qa/`, and `docs/adr/`
- operational support now routes through `docs/operations/runbooks/` and `docs/operations/internal-records/`
- the phase-1 derived install bundle is documented under `assets/install-bundle/opencode/` and does not replace the root authoring sources

## Maintainer Startup

Use this flow when you want to inspect or resume the checked-in OpenKit runtime directly. In this worktree, that remains the concrete checked-in path.

1. Ensure `.opencode/opencode.json` is present in the project root.
2. Ensure `.opencode/workflow-state.json` is present as the active compatibility mirror for the current work item.
3. Ensure `.opencode/work-items/` is present when you need task-aware full-delivery resume or work-item inspection.
4. In the OpenCode runtime configured by this repository, `hooks/session-start` is intended to run at session start, emit an OpenKit runtime status block, print `status`, `doctor`, and `show` command hints, and load the repo-local `using-skills` meta-skill into the agent's context when that skill file exists.
5. When workflow state is present, the session-start hook also prints a canonical resume hint that points back to `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, `.opencode/workflow-state.json`, and `context/core/session-resume.md`, plus active work-item and task-board summary when available.
6. Use `node .opencode/workflow-state.js status` to inspect the current runtime summary and `node .opencode/workflow-state.js doctor` to check whether key runtime files, work-item mirror alignment, and contract-alignment checks pass.

If the session-start JSON helper is unavailable, the hook degrades gracefully: runtime status still prints, but manifest-derived details and resume hints may be reduced until the helper works again.

Practical maintainer flow:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show
node --test ".opencode/tests/*.test.js"
```

The default manifest currently carries a starter model value inherited from the existing repo setup. Treat that as a default, not as a statement that the kit only supports one model.

## Registry Metadata

OpenKit includes a small checked-in metadata layer for local inspection and for the emerging managed-wrapper contract:

- `registry.json` describes the component categories that exist in this repository today, including agents, skills, commands, artifact directories, runtime files, hooks, and anchor docs, while also declaring which metadata participates in the emerging wrapper contract.
- `.opencode/install-manifest.json` records which local profile is active for this repository, points back to `registry.json`, and documents the current install stance as additive and non-destructive.
- `.opencode/opencode.json` remains the live repository-local manifest while also exposing pointers to both metadata files plus the active profile name and current wrapper-readiness status.

This metadata is local repository state, not a remote installer. It does not fetch, download, replace, or update components from elsewhere.

During migration, do not collapse these roles together: the metadata helps define the wrapper product surface, but the checked-in repository runtime remains the thing that actually runs.

Current checked-in profile:

- `openkit-core`: the full local OpenKit kit that matches the agents, skills, commands, docs, hooks, and runtime files currently present in this repository.

Additional non-default profile in the registry:

- `runtime-docs-surface`: a narrower local metadata profile for the checked-in runtime, hooks, command docs, artifact directories, and shared documentation surfaces. It is listed for inspection only and is not the active profile in this repository.

The install manifest is intended to make future runtime commands and diagnostics easier to implement and inspect. For now, treat it as honest local metadata only.

## Profile And Install-Manifest Workflow

The current workflow for profile metadata is local and inspectable:

1. `registry.json` defines the available component categories, checked-in components, and named profiles.
2. `.opencode/opencode.json` points to the registry and install manifest, declares the repository's active profile, and remains the live manifest for the current repository-local runtime.
3. `.opencode/install-manifest.json` records which profile is installed for this working tree, which broad component categories are present, and that installation remains additive rather than destructive.
4. `node .opencode/workflow-state.js profiles` lists the named profiles from the registry.
5. `node .opencode/workflow-state.js show-profile <name>` shows whether a profile is the repository default and which component categories it includes.
6. `node .opencode/workflow-state.js sync-install-manifest <name>` updates `.opencode/install-manifest.json` so its recorded active profile matches a named local profile.

This is not a package installer. `sync-install-manifest` updates checked-in local metadata only; it does not create missing files, fetch remote assets, remove existing runtime surfaces, or switch the repository to a different command surface automatically. It also does not mean the managed wrapper entrypoint has taken over unless a real root `opencode.json` is present.

Practical inspection flow:

- Run `node .opencode/workflow-state.js status` to see the active profile together with the runtime summary.
- Run `node .opencode/workflow-state.js doctor` to confirm the registry and install-manifest files are present and readable.
- Run `node .opencode/workflow-state.js profiles` before changing the manifest so you only reference a checked-in profile name.
- Run `node .opencode/workflow-state.js show-profile openkit-core` to inspect the currently documented default profile.
- Run `node .opencode/workflow-state.js sync-install-manifest openkit-core` when you need the install manifest to record the intended checked-in active profile again.

## Artifact Model

Artifacts depend on the active lane.

Quick-task artifact:

- `docs/tasks/`: lightweight quick-task cards when traceability beyond workflow state is useful

The live quick lane includes a first-class `quick_plan` stage for bounded planning. Task cards remain optional rather than mandatory. For the canonical quick-lane contract, including stage order, escalation, approvals, and artifact expectations, use `context/core/workflow.md`.

Full-delivery artifacts:

- `docs/briefs/`: PM product briefs
- `docs/specs/`: BA specs
- `docs/architecture/`: Architect design docs
- `docs/plans/`: Tech Lead implementation plans
- `docs/qa/`: QA reports
- `docs/adr/`: architecture decision records

Templates live in `docs/templates/`.

## Usage

You can trigger workflows with the following commands:

- `/task` — Default entrypoint; Master chooses `Quick Task`, `Migration`, or `Full Delivery`
- `/quick-task` — Explicit quick lane for small, localized work
- `/migrate` — Explicit migration lane for upgrades and modernization work
- `/delivery` — Explicit full-delivery lane for feature work and higher-risk changes
- `/brainstorm` — Migration or full-delivery only; explore design or upgrade direction
- `/write-plan` — Migration or full-delivery only; convert approved context into an Implementation Plan
- `/execute-plan` — Migration or full-delivery only; start building the approved plan

You can also type your request in normal language, and the Master Orchestrator will choose the appropriate lane.

The command surface above is the current live interface. The live contract keeps `/quick-task` and adds `/migrate` as the explicit upgrade lane command.

## Daily Operator Path

For normal day-to-day use:

- if a repository really has the wrapper surface installed, prefer `openkit init`, `openkit install`, `openkit doctor`, and `openkit run`
- in this checked-in repository runtime, use the lower-level runtime path below

1. Run `node .opencode/workflow-state.js status` to see whether work is already in progress.
2. Run `node .opencode/workflow-state.js doctor` if the runtime looks off or you are entering a repo for the first time.
3. Start with `/task` unless you already know the work must be `Quick Task`, `Migration`, or `Full Delivery`.
4. Use `node .opencode/workflow-state.js show` when you need the current state object or linked artifact paths.
5. Use `node .opencode/workflow-state.js validate` before trusting a resumed or manually edited workflow state.

For the step-by-step operator walkthrough, use `docs/operations/runbooks/openkit-daily-usage.md`.

This is the current checked-in operator surface for this worktree: `status`, `doctor`, `show`, `validate`, and the work-item/task-board inspection commands documented below. Treat those as bounded runtime helpers, not as evidence that arbitrary parallel execution support is safe.

## Command Selection Matrix

| If you want to... | Use | Notes |
| --- | --- | --- |
| let the system choose the lane | `/task` | default entrypoint for most requests |
| force bounded daily work into the quick lane | `/quick-task` | only when quick-lane criteria already fit |
| start upgrade or migration work in the migration lane | `/migrate` | use when the main risk is compatibility and upgrade sequencing |
| start feature or higher-risk work in the full lane | `/delivery` | use when the work clearly needs briefs, specs, architecture, or a plan |
| refine design or upgrade direction before planning | `/brainstorm` | migration or full-delivery only; follow the brainstorming skill |
| turn approved artifacts into an implementation plan | `/write-plan` | migration or full-delivery only; points to the planning skill and templates |
| execute an approved implementation plan | `/execute-plan` | migration or full-delivery only; follow the plan and report the real validation path |

Helpful wayfinding docs:

- `docs/operator/README.md` for operator-focused routing across the live surfaces
- `docs/maintainer/README.md` for maintainer-focused routing across canonical and support docs
- `context/navigation.md` for context discovery
- `docs/briefs/README.md`, `docs/specs/README.md`, `docs/architecture/README.md`, `docs/plans/README.md`, `docs/qa/README.md`, and `docs/adr/README.md` for artifact-specific guidance
- `docs/governance/README.md` and `docs/operations/README.md` for policy and operational support, including runbooks and sparse internal-records guidance
- `docs/operations/runbooks/openkit-daily-usage.md` for the detailed day-to-day usage path in this checked-in runtime
- `docs/operations/runbooks/workflow-state-smoke-tests.md` for runtime smoke checks and command examples
- `assets/install-bundle/opencode/README.md` for the derived phase-1 managed bundle boundary

## Operator Entry Points

Current checked-in operator entrypoints in this repository are:

- slash commands such as `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-plan`, and `/execute-plan`
- `node .opencode/workflow-state.js status`
- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js list-work-items`
- `node .opencode/workflow-state.js show-work-item <work_item_id>`
- `node .opencode/workflow-state.js list-tasks <work_item_id>` when the active full-delivery item uses a task board

Use those for the checked-in repository runtime, state inspection, and resume checks. When a real wrapper install exists in a repository, treat the wrapper commands as the preferred top-level operator path.

## Workflow-State Utility Commands

For the authoritative workflow-state command inventory, use `context/core/project-config.md`.

In this README, keep only the concise operator-facing surface:

- `node .opencode/workflow-state.js status`
- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js list-work-items`
- `node .opencode/workflow-state.js show-work-item <work_item_id>`
- `node .opencode/workflow-state.js list-tasks <work_item_id>` when the active full-delivery item uses a task board

Use lower-level mutation commands only when you are intentionally operating the checked-in workflow state machinery, and read `context/core/project-config.md` for the maintained full command list.

Operational guidance:

- `status` prints the project root, kit metadata, state file path, active mode, stage, workflow status, owner, and work item when present.
- `doctor` reports repository runtime checks such as the registry, install manifest, compatibility mirror, active work-item pointer, task-board validity, workflow-state CLI, hooks config, session-start hook, and lightweight contract-consistency checks for declared runtime surfaces and schema alignment.
- `profiles` lists the local registry profiles known to this repository and marks the repository default with `*`.
- `show-profile <name>` prints the profile name, whether it is the repository default, and the component categories referenced by that profile.
- `sync-install-manifest <name>` rewrites `.opencode/install-manifest.json` so its recorded active profile matches the named registry profile.
- `list-work-items` shows managed work items and marks the active one.
- `show-work-item <work_item_id>` prints the selected work item's mode, stage, and status.
- `list-tasks <work_item_id>` shows the task board for a full-delivery work item.
- `validate-work-item-board <work_item_id>` checks that a full-delivery task board is present and structurally valid.
- task commands only apply to full-delivery work items with an execution task board; quick and migration modes intentionally stay task-board free.
- `scaffold-artifact <task_card|plan|migration_report> <slug>` creates a narrow repo-native draft from a checked-in template and links it into the active workflow state when the target slot is still empty.
- `task_card` scaffolding is available only in `quick` mode and is intentionally allowed as optional traceability anywhere in the quick lane.
- `plan` scaffolding is available in `full` mode at `full_plan` and in `migration` mode at `migration_strategy`; it requires a linked architecture artifact before the draft is created.
- `migration_report` scaffolding is available in `migration` mode at `migration_baseline` or `migration_strategy` for one-file migration tracking.
- the session-start hook prints a `<openkit_runtime_status>` block with `status`, `doctor`, and `show` command hints, then prints a `<workflow_resume_hint>` block with canonical resume-reading guidance when workflow state contains resumable context.
- the same runtime surfaces may include active work-item id and task-board summaries for full-delivery work, but the hook still warns operators to confirm safety with `doctor` before relying on parallel task support.

Validation guidance in the current repository:

- `status`, `doctor`, `show`, and `validate` help inspect workflow runtime state; they are not substitutes for application build, lint, or test commands.
- work-item and task-board commands help inspect and coordinate the implemented full-delivery runtime; they are not a general-purpose distributed scheduler.
- This repository does not yet define repo-native app build/lint/test commands, so command docs and plans should name the real validation path honestly.
- When no app-native tooling exists, use the workflow-state utility where relevant and then record manual or artifact-based verification instead of inventing automation.

## Safe Extension

When extending OpenKit, register what you add instead of leaving the metadata layer stale.

- New agent: add the file under `agents/`, add it to `.opencode/opencode.json` when it belongs in the runtime manifest, and add an `agents` entry in `registry.json`.
- New skill: add the file under `skills/`, then register it in `registry.json` so profiles and future diagnostics can see it.
- New command: add the command doc under `commands/`, update `.opencode/opencode.json` if it is part of the live command surface, and add a `commands` entry in `registry.json`.
- New operational or governance anchor doc: add it to the relevant docs directory and register it in the `docs` section of `registry.json` when it becomes part of the maintained kit surface.
- New profile: add a named profile in `registry.json` that references existing component categories; keep profile names descriptive and local to what the repository actually contains.

If an extension changes runtime behavior, profile semantics, or the long-term shape of the install-manifest/registry contract, also review `docs/governance/adr-policy.md` to decide whether the change needs an ADR rather than only a doc update.

## Approved Direction

FEATURE-002 records the roadmap and rationale behind the contract that is already live today:

- continue refining the current quick lane after the `Quick Task+` successor semantics activation while keeping the explicit lane model coherent
- harden runtime behavior with stronger bootstrap guidance, operational discoverability, and workflow-level verification

Rely on the current workflow contract and runtime surfaces that exist in the repository today. Treat these artifacts as roadmap context, not as overrides for `context/core/workflow.md` or the implemented runtime.

## Current Validation Reality

This repository does not yet define a repo-native build, lint, or test command for application code. Agents must not invent stack-specific commands unless the repository later adopts them and documents them in `AGENTS.md` and `context/core/project-config.md`.
