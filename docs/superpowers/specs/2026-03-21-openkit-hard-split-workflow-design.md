# OpenKit Hard-Split Workflow Design

> Approved design for evolving OpenKit from a single full-delivery pipeline into two explicitly separate operating lanes: `Quick Task` and `Full Delivery`.

## Goal

Reduce workflow overhead for daily tasks without weakening the structured delivery model that makes OpenKit auditable, resumable, and team-like.

## Decision

Adopt a hard split between two workflow modes.

- `Quick Task` is a lightweight lane for narrow, low-risk work.
- `Full Delivery` is the existing multi-role delivery lane for feature work and higher-risk changes.
- The split is explicit in docs, state, commands, and agent contracts.
- This is a breaking clean cut, not a backward-compatible transition layer.

## Why A Hard Split

The current workflow is strong for structured delivery, but it is too heavy for many daily tasks because even small changes conceptually inherit the same approval, artifact, and handoff burden as a feature-sized effort.

The hard-split model preserves the strengths of the current system while avoiding false ceremony:

1. Small tasks stop paying the full pipeline cost.
2. Large tasks keep the full team workflow.
3. Agents get clearer behavioral boundaries.
4. Users can deliberately choose speed or depth at task start.

## Non-Goals

- Creating a single adaptive pipeline that partially collapses stages
- Preserving legacy workflow state shape for backward compatibility
- Allowing quick tasks to quietly grow into architecture work without mode promotion
- Introducing build, lint, or test tooling that the repository does not already define

## Operating Lanes

### Quick Task

Canonical stage sequence:

`quick_intake -> quick_build -> quick_verify -> quick_done`

Participants:

- `MasterOrchestrator`
- `FullstackAgent`
- `QAAgent` in `QA Lite` mode

Characteristics:

- single narrow goal
- clear acceptance bullets up front
- no architecture or requirement exploration
- minimal artifact burden
- fast verify-and-close loop

### Full Delivery

Canonical stage sequence:

`full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`

Participants:

- `MasterOrchestrator`
- `PMAgent`
- `BAAgent`
- `ArchitectAgent`
- `TechLeadAgent`
- `FullstackAgent`
- `QAAgent`

Characteristics:

- explicit multi-role handoffs
- complete artifact chain
- full approval gating
- feedback routing by issue type

## Lane Selection Rules

### Choose Quick Task when all are true

- scope is small and localized
- acceptance criteria are already clear
- no new architecture or design trade-off is required
- no API, schema, auth, billing, permission, or security model change is involved
- validation can be done with a short, direct verification path

### Choose Full Delivery when any are true

- the task introduces a new feature or workflow
- requirements are ambiguous or likely to change during execution
- multiple subsystems or responsibility boundaries are involved
- the change affects architecture, contracts, or data models
- the task needs deliberate product, spec, or design artifacts
- the task has elevated rework risk

## Escalation Rules

Escalation is one-way only:

`Quick Task -> Full Delivery`

Quick work must escalate immediately when it encounters:

- `requirement_gap`
- `design_flaw`
- scope expansion into a second subsystem or responsibility boundary
- a verification path that is no longer short and local

After escalation:

- quick execution stops
- the reason is recorded in workflow state
- the task restarts at `full_intake`
- the quick task context becomes input to the full-delivery lane

There is no `Full Delivery -> Quick Task` downgrade path.

## Workflow State Contract

`.opencode/workflow-state.json` remains the single runtime source of truth.

### Required Top-Level Fields

- `feature_id`
- `feature_slug`
- `mode`
- `mode_reason`
- `current_stage`
- `status`
- `current_owner`
- `artifacts`
- `approvals`
- `issues`
- `retry_count`
- `escalated_from`
- `escalation_reason`
- `updated_at`

### `mode` Values

- `quick`
- `full`

### `current_stage` Values

- `quick_intake`
- `quick_build`
- `quick_verify`
- `quick_done`
- `full_intake`
- `full_brief`
- `full_spec`
- `full_architecture`
- `full_plan`
- `full_implementation`
- `full_qa`
- `full_done`

### `status` Values

- `idle`
- `in_progress`
- `blocked`
- `done`

### Stage Ownership Map

| Stage | Default owner |
| --- | --- |
| `quick_intake` | `MasterOrchestrator` |
| `quick_build` | `FullstackAgent` |
| `quick_verify` | `QAAgent` |
| `quick_done` | `MasterOrchestrator` |
| `full_intake` | `MasterOrchestrator` |
| `full_brief` | `PMAgent` |
| `full_spec` | `BAAgent` |
| `full_architecture` | `ArchitectAgent` |
| `full_plan` | `TechLeadAgent` |
| `full_implementation` | `FullstackAgent` |
| `full_qa` | `QAAgent` |
| `full_done` | `MasterOrchestrator` |

### Artifact Shape

Use one unified artifact object across both modes:

- `task_card`
- `brief`
- `spec`
- `architecture`
- `plan`
- `qa_report`
- `adr`

Mode usage:

- `Quick Task` uses `task_card` and may leave all other fields `null` or `[]`.
- `Full Delivery` uses the existing artifact chain and leaves `task_card` as `null`.

## Approval Model

### Quick Task approvals

Quick mode uses a minimal approval surface:

- `quick_verified`

Meaning:

- user request is treated as implicit approval to begin unless the task is ambiguous or risky
- `quick_verified` is set only after `QA Lite` passes

### Full Delivery approvals

Full mode keeps the explicit gate chain:

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Validation rule:

- when `mode = quick`, only quick approvals are required and validated
- when `mode = full`, only full-delivery approvals are required and validated

## Issue Routing Contract

### Quick Task routing

- `bug` -> `quick_build`
- `design_flaw` -> escalate to `full_intake`
- `requirement_gap` -> escalate to `full_intake`

### Full Delivery routing

- `bug` -> `full_implementation`
- `design_flaw` -> `full_architecture` or `full_plan`
- `requirement_gap` -> `full_spec`

This keeps quick mode operationally simple and prevents it from turning into an undocumented version of the full pipeline.

## Command Surface

### New entry commands

- `/task` — default entry; Master classifies the lane
- `/quick-task` — explicit request for quick mode
- `/delivery` — explicit request for full mode

### Existing commands after the split

- `/brainstorm` — full-delivery only
- `/write-plan` — full-delivery only
- `/execute-plan` — full-delivery only

### Command behavior rules

- `/quick-task` must reject quick mode when any hard trigger for full mode is present
- `/task` must record `mode` and `mode_reason` in workflow state
- `/delivery` always initializes `full_intake`

## Agent Behavior Changes

### MasterOrchestrator

New responsibilities:

- classify incoming work into `quick` or `full`
- record the chosen lane in workflow state
- create the quick intake brief for quick tasks
- route rework by issue type and current mode
- escalate quick work to full delivery when quick-mode limits are crossed

### FullstackAgent

Must support two separate execution contracts.

#### Quick Task mode

- input is the quick intake brief, not a full implementation plan
- optimize for the smallest safe change that satisfies acceptance bullets
- use the closest available verification path
- stop and report to Master when the task becomes a design or requirements problem

#### Full Delivery mode

- continue to implement from `docs/plans/YYYY-MM-DD-<feature>.md`
- continue to follow the stricter plan-driven delivery flow

### QAAgent

Must support two separate validation contracts.

#### QA Lite for quick tasks

- verify acceptance bullets
- check nearby regression surface
- record short evidence for pass or fail
- classify failures without editing code

#### Full QA for delivery work

- continue to produce `docs/qa/YYYY-MM-DD-<feature>.md`
- continue to validate against spec, architecture, and plan artifacts

## Quick Task Artifact

When traceability beyond workflow state is needed, quick mode writes a single lightweight file:

`docs/tasks/YYYY-MM-DD-<slug>.md`

Recommended contents:

- goal
- scope
- acceptance bullets
- touched files
- verification path
- verification result
- escalation note if applicable

Quick mode must not require `brief`, `spec`, `architecture`, `plan`, or `qa_report` artifacts.

## Breaking Clean-Cut Migration

This design intentionally drops legacy single-pipeline state semantics.

### Breaking changes

- legacy stage names such as `intake`, `brief`, `spec`, `architecture`, `plan`, `implementation`, `qa`, and `done` are removed from the canonical schema
- workflow state must include `mode`
- approval validation becomes mode-aware
- commands and agent docs must describe two lanes, not one universal pipeline

### Migration rule

Update docs, commands, state schema, agent contracts, and examples in the same change set so the repository has one coherent workflow definition.

## Required Repository Updates

### Core docs

- `AGENTS.md`
- `context/core/workflow.md`
- `context/core/workflow-state-schema.md`
- `context/core/approval-gates.md`
- `context/core/issue-routing.md`
- `context/core/project-config.md`
- `context/core/session-resume.md`

### Runtime files

- `.opencode/opencode.json`
- `.opencode/workflow-state.json`
- `.opencode/workflow-state.js`

### Agent contracts

- `agents/master-orchestrator.md`
- `agents/fullstack-agent.md`
- `agents/qa-agent.md`
- optionally tighten `agents/pm-agent.md`, `agents/ba-agent.md`, `agents/architect-agent.md`, and `agents/tech-lead-agent.md` to make clear they are full-delivery only

### Commands

- add `commands/task.md`
- add `commands/quick-task.md`
- add `commands/delivery.md`
- update `commands/brainstorm.md`
- update `commands/write-plan.md`
- update `commands/execute-plan.md`

### Templates and examples

- add `docs/templates/quick-task-template.md`
- add at least one quick-task example under `docs/examples/`
- retain and update the existing full-delivery golden path examples as needed

## Verification Expectations

The repository still does not define a general application build, lint, or test toolchain. The design therefore requires explicit reporting of the real validation path:

- quick mode may use concise manual or command-based verification when no repo-native test command exists
- full mode must continue to call out when validation tooling is unavailable rather than inventing commands

## Success Criteria

This redesign succeeds when:

1. Small daily tasks can complete without the full artifact and approval burden.
2. Feature work still benefits from explicit multi-role delivery.
3. Quick tasks cannot silently absorb design or requirements work.
4. Workflow state unambiguously identifies the active lane.
5. Repository documentation no longer describes a single universal pipeline.
