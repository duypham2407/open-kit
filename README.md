# OpenKit — AI Software Factory

OpenKit is a workflow kit that turns your AI coding assistant into a mode-aware software team. It combines OpenAgentsControl-style orchestration concepts with superpowers-style workflow discipline using explicit artifacts, approval gates, and resumable workflow state.

The repository currently runs on the live `Quick Task` + `Full Delivery` contract. FEATURE-002 records the approved future direction, including `Quick Task+` as successor semantics for the existing quick lane rather than a third live mode.

## Two Workflow Lanes

OpenKit now uses a hard split between two lanes:

1. **Quick Task**: For narrow, low-risk daily tasks that should move fast.
2. **Full Delivery**: For feature work and higher-risk changes that benefit from the full multi-role team flow.

`MasterOrchestrator` chooses the lane, records the decision in workflow state, and routes the work.

Approved future direction:

- `Quick Task+` is the intended evolution of the existing quick lane so it can handle a somewhat broader set of bounded daily tasks.
- Current command names and runtime mode enums remain unchanged until follow-on runtime and contract work lands.

## The 7-Role Team

The full-delivery lane uses 7 distinct team roles:

1. **Master Orchestrator**: Routes work, chooses the lane, and manages feedback loops.
2. **PM Agent**: Defines product goals and priorities.
3. **BA Agent**: Writes detailed specifications and acceptance criteria.
4. **Architect Agent**: Designs system architecture and technology choices.
5. **Tech Lead Agent**: Enforces standards and creates bite-sized implementation plans.
6. **Fullstack Agent**: Implements approved work.
7. **QA Agent**: Validates implementation and classifies issues.

Quick tasks use a smaller contract: `MasterOrchestrator -> FullstackAgent -> QAAgent (QA Lite) -> Done`.

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
- `context/core/workflow.md`: The hard-split Quick Task and Full Delivery workflow contract.
- `context/core/approval-gates.md`: Approval recording rules for stage transitions.
- `context/core/issue-routing.md`: QA issue classification and ownership routing.
- `context/core/session-resume.md`: Resume protocol for fresh sessions.

Directional artifacts for the next phase live in:

- `docs/briefs/2026-03-21-openkit-evolution-direction.md`
- `docs/specs/2026-03-21-openkit-improvement-analysis.md`
- `docs/architecture/2026-03-21-openkit-evolution-direction.md`
- `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md`

## Installation

This kit is designed to work natively with OpenCode.

1. Ensure `.opencode/opencode.json` is present in the project root.
2. Ensure `.opencode/workflow-state.json` is present so sessions can resume from explicit state.
3. The `hooks/session-start` script runs automatically on session start, emits an OpenKit runtime status block, and loads the `using-skills` meta-skill into the agent's context when that skill file exists.
4. Use `node .opencode/workflow-state.js status` to inspect the current runtime summary and `node .opencode/workflow-state.js doctor` to check whether key runtime files are present.

The default manifest currently carries a starter model value inherited from the existing repo setup. Treat that as a default, not as a statement that the kit only supports one model.

## Registry Metadata

OpenKit now includes a small checked-in metadata layer for local inspection:

- `registry.json` describes the component categories that exist in this repository today, including agents, skills, commands, artifact directories, runtime files, hooks, and a few anchor docs.
- `.opencode/install-manifest.json` records which local profile is active for this repository and points back to `registry.json`.
- `.opencode/opencode.json` now includes discoverable pointers to both metadata files plus the active profile name.

This metadata is local repository state, not a remote installer. It does not fetch, download, or update components from elsewhere.

Current checked-in profile:

- `openkit-core`: the full local OpenKit kit that matches the agents, skills, commands, docs, hooks, and runtime files currently present in this repository.

Additional non-default profile in the registry:

- `runtime-docs-surface`: a narrower local metadata profile for the checked-in runtime, hooks, command docs, artifact directories, and shared documentation surfaces. It is listed for inspection only and is not the active profile in this repository.

The install manifest is intended to make future runtime commands and diagnostics easier to implement and inspect. For now, treat it as honest local metadata only.

## Profile And Install-Manifest Workflow

The current workflow for profile metadata is local and inspectable:

1. `registry.json` defines the available component categories, checked-in components, and named profiles.
2. `.opencode/opencode.json` points to the registry and install manifest, and declares the repository's active profile.
3. `.opencode/install-manifest.json` records which profile is installed for this working tree and which broad component categories are present.
4. `node .opencode/workflow-state.js profiles` lists the named profiles from the registry.
5. `node .opencode/workflow-state.js show-profile <name>` shows whether a profile is the repository default and which component categories it includes.
6. `node .opencode/workflow-state.js sync-install-manifest <name>` updates `.opencode/install-manifest.json` so its recorded active profile matches a named local profile.

This is not a package installer. `sync-install-manifest` updates checked-in local metadata only; it does not create missing files, fetch remote assets, or switch the repository to a different command surface automatically.

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

This remains the current quick-lane artifact model. A richer quick-lane artifact or checklist model is future follow-on work, not a current requirement.

Full-delivery artifacts:

- `docs/briefs/`: PM product briefs
- `docs/specs/`: BA specs
- `docs/architecture/`: Architect design docs
- `docs/plans/`: Tech Lead implementation plans
- `docs/qa/`: QA reports
- `docs/adr/`: architecture decision records

Templates live in `docs/templates/` and examples live in `docs/examples/`.

## Usage

You can trigger workflows with the following commands:

- `/task` — Default entrypoint; Master chooses `Quick Task` or `Full Delivery`
- `/quick-task` — Explicit quick lane for small, localized work
- `/delivery` — Explicit full-delivery lane for feature work and higher-risk changes
- `/brainstorm` — Full-delivery only; explore product or design direction
- `/write-plan` — Full-delivery only; convert Spec and Architecture into an Implementation Plan
- `/execute-plan` — Full-delivery only; start building the approved plan

You can also type your request in normal language, and `MasterOrchestrator` will choose the appropriate lane.

The command surface above is the current live interface. This documentation phase does not rename `/quick-task` or add a third lane command.

Helpful wayfinding docs:

- `context/navigation.md` for context discovery
- `docs/examples/README.md` for quick-task and full-delivery walkthroughs
- `docs/briefs/README.md`, `docs/specs/README.md`, `docs/architecture/README.md`, `docs/plans/README.md`, `docs/qa/README.md`, and `docs/adr/README.md` for artifact-specific guidance
- `docs/governance/README.md` and `docs/operations/README.md` for policy and operational support

Workflow-state utility commands:

- `node .opencode/workflow-state.js status`
- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js set-approval <gate> <status> ...`
- `node .opencode/workflow-state.js link-artifact <kind> <path>`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

Operational guidance:

- `status` prints the project root, kit metadata, state file path, active mode, stage, workflow status, owner, and work item when present.
- `doctor` reports repository runtime checks such as the registry, install manifest, workflow-state file, workflow-state CLI, hooks config, and session-start hook.
- `profiles` lists the local registry profiles known to this repository and marks the repository default with `*`.
- `show-profile <name>` prints the profile name, whether it is the repository default, and the component categories referenced by that profile.
- `sync-install-manifest <name>` rewrites `.opencode/install-manifest.json` so its recorded active profile matches the named registry profile.
- the session-start hook prints a `<openkit_runtime_status>` block with `status` and `doctor` command hints, then prints a `<workflow_resume_hint>` block when workflow state contains resumable context.

## Safe Extension

When extending OpenKit, register what you add instead of leaving the metadata layer stale.

- New agent: add the file under `agents/`, add it to `.opencode/opencode.json` when it belongs in the runtime manifest, and add an `agents` entry in `registry.json`.
- New skill: add the file under `skills/`, then register it in `registry.json` so profiles and future diagnostics can see it.
- New command: add the command doc under `commands/`, update `.opencode/opencode.json` if it is part of the live command surface, and add a `commands` entry in `registry.json`.
- New operational or governance anchor doc: add it to the relevant docs directory and register it in the `docs` section of `registry.json` when it becomes part of the maintained kit surface.
- New profile: add a named profile in `registry.json` that references existing component categories; keep profile names descriptive and local to what the repository actually contains.

If an extension changes runtime behavior, profile semantics, or the long-term shape of the install-manifest/registry contract, also review `docs/governance/adr-policy.md` to decide whether the change needs an ADR rather than only a doc update.

## Approved Direction

FEATURE-002 records two follow-on priorities:

- evolve the current quick lane toward `Quick Task+` semantics while keeping the two-lane model intact
- harden runtime behavior with stronger bootstrap guidance, operational discoverability, and workflow-level verification

Until those implementation tasks land, rely on the current workflow contract and runtime surfaces that exist in the repository today.

## Current Validation Reality

This repository does not yet define a repo-native build, lint, or test command for application code. Agents must not invent stack-specific commands unless the repository later adopts them and documents them in `AGENTS.md` and `context/core/project-config.md`.
