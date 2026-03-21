# Team Workflow — Open Kit

Defines the current hard-split workflow contract for OpenKit.

Use this file together with `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, and `context/core/workflow-state-schema.md`.

FEATURE-003 activates `Quick Task+` as the live successor semantics of the existing quick lane while preserving the two-lane model and the `quick` / `full` mode enums.

## Workflow Lanes

OpenKit now has two explicitly separate operating lanes:

- `Quick Task` for narrow, low-risk daily work
- `Full Delivery` for feature work and higher-risk changes

`MasterOrchestrator` is the entry point for both lanes and is responsible for choosing the lane, recording the choice in workflow state, and routing the work.

Terminology guardrail:

- `Quick Task+` is approved as the successor semantics for the existing quick lane
- `Quick Task+` is not a third operating mode
- current runtime mode enums remain `quick` and `full`
- current command names remain unchanged unless a separate explicit implementation changes them
- use `MasterOrchestrator` for the role name and `QA Lite` for the lighter quick-lane verification pass

## Contract Alignment Status

FEATURE-003 makes the stronger quick-lane semantics live. Companion workflow docs and runtime state are expected to align on the same active quick contract in this phase.

## Quick Task Lane

Canonical stage sequence:

`quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`

Pipeline:

```
User Request
    ↓
    MasterOrchestrator    ← classify task, define quick scope
    ↓
Fullstack Agent       ← implement the smallest safe change
    ↓
    QAAgent               ← QA Lite verification
    ↓
    MasterOrchestrator    ← close or reroute
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
- `quick_plan` is a first-class quick stage for checklist-oriented planning and verification setup
- optional task cards remain allowed when traceability helps, but are still not mandatory for every quick task

## Full Delivery Lane

Canonical stage sequence:

`full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`

Pipeline:

```
User Request
    ↓
MasterOrchestrator
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
MasterOrchestrator
```

Full mode preserves the structured team workflow for work that benefits from deliberate requirements, design, planning, implementation, and QA handoffs.

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

### Quick Task

- `quick_verified` is the only required gate
- the original user request is treated as implicit approval to begin unless the task is ambiguous or risky

### Full Delivery

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Approval state should be recorded in `.opencode/workflow-state.json` before advancing stages.

## Document Outputs By Mode

### Quick Task

- optional lightweight task card: `docs/tasks/YYYY-MM-DD-<task>.md`
- source code changes
- bounded quick-plan/checklist state in `quick_plan`
- concise QA Lite evidence in workflow communication and state

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

## Workflow State

The canonical persisted runtime state lives in `.opencode/workflow-state.json`.

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

State-shape changes for future quick-lane behavior are out of scope for this phase. Preserve compatibility with the current schema until a later task changes runtime support deliberately.
