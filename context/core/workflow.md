# Team Workflow — Open Kit

Defines the canonical live workflow contract for OpenKit.

Use this file as the source of truth for workflow semantics. Companion docs such as `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` must align to it and should focus on their local concerns.

The current live contract uses `Quick Task+` successor semantics for the existing quick lane while preserving the two-lane model and the `quick` / `full` mode enums.

## Workflow Lanes

OpenKit now has two explicitly separate operating lanes:

- `Quick Task` for narrow, low-risk daily work
- `Full Delivery` for feature work and higher-risk changes

The Master Orchestrator is the entry point for both lanes and is responsible for choosing the lane, recording the choice in workflow state, and routing the work.

Terminology guardrail:

- `Quick Task+` is approved as the successor semantics for the existing quick lane
- `Quick Task+` is not a third operating mode
- current runtime mode enums remain `quick` and `full`
- current command names remain unchanged unless a separate explicit implementation changes them
- use human-readable role labels such as `Master Orchestrator` in prose, and use `QA Lite` for the lighter quick-lane verification pass
- in narrative prose, prefer human-readable role labels such as `Master Orchestrator`, `QA Agent`, and `Tech Lead Agent`; use exact runtime identifiers only when naming owners, files, commands, or schema values

## Contract Alignment Status

The stronger quick-lane semantics are live in the current contract. Companion workflow docs and runtime state are expected to align on the same active quick contract in this phase.

## Quick Task Lane

Canonical stage sequence:

`quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`

Pipeline:

```
User Request
    ↓
    Master Orchestrator   ← classify task, define quick scope
    ↓
    quick_plan            ← bounded checklist and verification setup
    ↓
    Fullstack Agent       ← implement the smallest safe change
    ↓
    QA Agent              ← QA Lite verification
    ↓
    Master Orchestrator   ← close or reroute
```

Quick mode exists to reduce overhead, not to bypass quality.

Quick mode expectations:

- clear scope up front
- bounded planning before implementation
- short acceptance bullet list
- direct verification path
- no architecture exploration
- no full artifact chain requirement

Live Quick Task+ expectations:

- the quick lane can handle bounded small-to-medium work, not only the tiniest localized changes
- `quick_plan` is a required quick stage for checklist-oriented planning and verification setup
- optional task cards remain allowed when traceability helps, but are not mandatory for every quick task

## Full Delivery Lane

Canonical stage sequence:

`full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`

Pipeline:

```
User Request
    ↓
Master Orchestrator
    ↓
PM Agent
    ↓
BA Agent
    ↓
Architect Agent
    ↓
Tech Lead Agent
    ↓
Fullstack Agent
    ↓
QA Agent
    ↓
Master Orchestrator
```

Full mode preserves the structured team workflow for work that benefits from deliberate requirements, design, planning, implementation, and QA handoffs.

Implemented full-delivery task-runtime note:

- from `full_plan` onward, a full-delivery work item may carry an execution task board under `.opencode/work-items/<work_item_id>/tasks.json`
- task boards belong only to full-delivery work items
- task-level ownership does not replace the feature-stage owner recorded in workflow state
- operators must still treat parallel support conservatively and rely only on the runtime checks and commands that exist today

## Lane Selection Rules

Choose `Quick Task` only when all are true:

- scope is bounded and remains within one tightly related area or two closely related surfaces
- acceptance criteria are already clear
- no new architecture or design trade-off is required
- no API, schema, auth, billing, permission, or security model change is involved
- validation can be done with a short, direct verification path

Choose `Full Delivery` when any are true:

- the task introduces a new feature or workflow
- requirements are ambiguous or likely to change
- multiple subsystems or responsibility boundaries are involved
- architecture, contracts, or data models are affected
- explicit product, spec, architecture, or plan artifacts are needed
- the task has elevated rework risk

## Feedback Loops

### Quick Task loop

```
Fullstack → QA Lite → (pass) → quick_done
                    → (bug)  → quick_build
                    → (design flaw or requirement gap) → escalate to Full Delivery
```

### Full Delivery loop

```
Fullstack → QA → (pass) → full_done
                → (bug) → full_implementation
                → (design flaw) → full_architecture
                → (requirement gap) → full_spec
```

## Escalation Rule

Escalation is one-way only:

`Quick Task -> Full Delivery`

Quick work must escalate immediately when it encounters:

- `design_flaw`
- `requirement_gap`
- scope expansion across a second subsystem or responsibility boundary
- verification needs that are no longer short and local

There is no downgrade path from full mode back into quick mode.

## Approval Gates

Approval requirements are mode-specific.

Approval-authority rule for all live gates:

- the gate owner preparing the handoff cannot self-approve the handoff as complete
- the receiving role is the default approval authority for readiness to begin its stage
- the Master Orchestrator is the approval authority for workflow closure gates that end a lane
- approval notes should confirm both readiness and any blocking assumptions that remain

### Quick Task

- `quick_verified` is the only required gate
- the original user request is treated as implicit approval to begin unless the task is ambiguous or risky
- `quick_plan` is required before `quick_build`, but it does not introduce a second approval gate
- `QA Agent` is the approval authority for `quick_verified`
- `quick_verified` means QA Lite evidence is inspected, recorded, and judged sufficient for closure

Quick handoff-ready expectations:

- `quick_intake -> quick_plan`: scope, lane fit, and intended validation path are clear enough for bounded planning
- `quick_plan -> quick_build`: the checklist, acceptance bullets, and direct verification path are recorded and inspectable
- `quick_build -> quick_verify`: the smallest safe change is implemented and the builder provides enough context for QA Lite to inspect it efficiently
- `quick_verify -> quick_done`: QA Lite evidence is recorded, open issues are either resolved or escalated, and `quick_verified` is approved

### Full Delivery

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Approval authorities:

- `pm_to_ba`: `BA Agent`
- `ba_to_architect`: `Architect Agent`
- `architect_to_tech_lead`: `Tech Lead Agent`
- `tech_lead_to_fullstack`: `Fullstack Agent`
- `fullstack_to_qa`: `QA Agent`
- `qa_to_done`: `Master Orchestrator`

Full-delivery handoff-ready expectations:

- `full_intake -> full_brief`: lane choice, problem framing, and expected outcome are clear enough for PM scoping
- `full_brief -> full_spec`: the brief states goals, constraints, success criteria, and unresolved product questions
- `full_spec -> full_architecture`: the specification defines functional scope, edge cases, and acceptance expectations the architect can design against
- `full_architecture -> full_plan`: the design identifies boundaries, dependencies, risks, and decisions the Tech Lead can turn into executable work
- `full_plan -> full_implementation`: the plan breaks the work into implementable steps with validation expectations and any sequencing constraints
- `full_implementation -> full_qa`: implementation artifacts and verification evidence are inspectable, and known deviations are called out explicitly
- `full_qa -> full_done`: QA findings are resolved or routed correctly, final evidence is inspectable, and closure notes are ready for the Master Orchestrator

Approval state should be recorded in the managed active work-item state before advancing stages, and the active compatibility mirror at `.opencode/workflow-state.json` should reflect that updated state.

## Document Outputs By Mode

### Quick Task

- optional lightweight task card: `docs/tasks/YYYY-MM-DD-<task>.md`
- source code changes
- bounded quick-plan/checklist state in `quick_plan`
- concise QA Lite evidence in workflow communication and state

Quick-task artifact rule:

- `quick_plan` is mandatory as a workflow stage
- `docs/tasks/...` remains optional as a documentation artifact
- the required quick-plan content is live workflow state and communication, not a separate mandatory board or third quick artifact type
- QA Lite evidence is part of the live quick contract already and should be inspectable on resume even when no standalone QA document exists
- quick mode must stay free of execution task boards

### Full Delivery

| Agent | Produces |
| --- | --- |
| PM | `docs/briefs/YYYY-MM-DD-<feature>.md` |
| BA | `docs/specs/YYYY-MM-DD-<feature>.md` |
| Architect | `docs/architecture/YYYY-MM-DD-<feature>.md` |
| Tech Lead | `docs/plans/YYYY-MM-DD-<feature>.md` |
| Fullstack | Source code, tests |
| QA | `docs/qa/YYYY-MM-DD-<feature>.md` |

## Key Principles

1. **Always use feedback loops** — Never mark work complete without verification.
2. **Choose the right lane early** — Do not force small tasks through the full pipeline, and do not under-scope feature work into quick mode.
3. **Keep role boundaries explicit** — Even in a minimal repository, responsibilities stay conceptually separate.
4. **Use Master Orchestrator for routing** — All inter-agent delegation goes through Master.
5. **Escalate honestly** — Quick mode stops when the work becomes a design or requirements problem.
6. **Report real validation** — If tooling does not exist, document the actual verification path instead of inventing commands.
7. **Make handoffs inspectable** — Every stage boundary should leave enough recorded context that the next role can resume without hidden assumptions.

## Workflow State

The active external compatibility mirror lives in `.opencode/workflow-state.json`.

Managed per-item state lives under `.opencode/work-items/`, and the active work item is mirrored into `.opencode/workflow-state.json` for compatibility with the existing command and resume surface.

Field definitions and allowed enums live in `context/core/workflow-state-schema.md`.

At minimum it must track:

- mode
- current stage
- current owner
- linked artifacts
- gate approvals for the active mode
- open issues
- retry count
- escalation metadata when quick work is promoted to full delivery

When full delivery is using task-aware execution, task-board state is stored beside the active work item rather than inside the top-level mirrored state file.

State-shape changes for future quick-lane behavior are out of scope for this phase. Preserve compatibility with the current schema until a later task changes runtime support deliberately.
