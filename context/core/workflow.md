# Team Workflow — Open Kit

Defines the canonical live workflow contract for OpenKit.

Use this file as the source of truth for workflow semantics. Companion docs such as `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` must align to it and should focus on their local concerns.

For the stricter routing rubric, examples, and anti-patterns behind lane choice, use `context/core/lane-selection.md`.

The current live contract uses `Quick Task+` successor semantics for the existing quick lane while supporting three runtime modes: `quick`, `migration`, and `full`.

## Workflow Lanes

OpenKit now has three explicitly separate operating lanes:

- `Quick Task` for narrow, low-risk daily work
- `Migration` for upgrades, framework migrations, dependency modernization, and compatibility remediation
- `Full Delivery` for feature work and higher-risk changes

The Master Orchestrator is the entry point for both lanes and is responsible for choosing the lane, recording the choice in workflow state, and routing the work.

Terminology guardrail:

- `Quick Task+` is approved as the successor semantics for the existing quick lane
- `Quick Task+` is not a third operating mode
- current runtime mode enums are `quick`, `migration`, and `full`
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
- full-delivery parallel work is conditional, not automatic; the PM, BA, Architect, and Tech Lead chain must bless a plan that explicitly says parallel execution is safe
- when the plan does not approve parallel execution, full-delivery work remains sequential even if multiple Fullstack or QA agents are available
- singleton roles remain singleton: one PM, one BA, one Architect, and one Tech Lead define the work; worker pools apply only to Fullstack and QA execution after planning

## Migration Lane

Canonical stage sequence:

`migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_verify -> migration_done`

Pipeline:

```
User Request
    ↓
Master Orchestrator
    ↓
Architect Agent      ← baseline, compatibility map, risk framing
    ↓
Tech Lead Agent      ← staged upgrade strategy and rollback checkpoints
    ↓
Fullstack Agent      ← execute upgrade slices and remediation
    ↓
QA Agent             ← regression, smoke, and compatibility verification
    ↓
Master Orchestrator
```

Migration mode exists for work where the core problem is changing an existing system safely rather than defining net-new product behavior.

Migration mode expectations:

- freeze the behavior, layout, contracts, and core logic that must remain equivalent
- baseline capture before code changes
- preserve existing behavior first, then change technology under that preserved behavior
- compatibility and dependency risk mapping before implementation
- decouple only the framework-coupled blockers that prevent a safe migration
- use adapters, seams, and compatibility shims where they reduce migration risk
- staged upgrade sequencing with rollback notes
- migrate in slices instead of performing a big-bang rewrite
- verification based on real before/after evidence, smoke tests, builds, type checks, codemods, and regression passes
- no assumption that the upgrader fully understands legacy logic up front
- no task board in the current live contract
- migration parallel execution is conditional, not automatic; baseline and strategy work stay singleton-led and sequential until the migration strategy explicitly blesses safe slices
- even when parallel migration slices are approved later, one Architect and one Tech Lead still own baseline and strategy as singleton coordination stages

Migration guardrails:

- do not treat migration as an excuse to rewrite the product from scratch
- refactor only to create safe migration seams or to remove blockers discovered by the upgrade
- keep presentation and layout changes out of the migration unless the target stack forces a documented exception
- do not mix net-new feature scope into migration slices
- cleanup and structural polishing happen after parity is proven, not before

Migration validation rule:

- migration work is not TDD-first by default
- verify parity, not novelty; the main question is whether the migrated system still behaves like the preserved baseline
- use the strongest real validation path available from the target project and repository state
- favor characterization checks, smoke tests, regression tests, visual checks, contract comparisons, and manual before/after evidence
- write focused tests when the migration reveals a safe, well-understood behavior gap and working test tooling exists
- do not force RED-GREEN-REFACTOR as the primary control loop for broad upgrades where compatibility drift, framework semantics, and legacy unknowns dominate the risk

Canonical migration heuristic:

`freeze invariants -> capture baseline -> decouple blockers -> migrate incrementally -> verify parity -> cleanup last`

## Lane Selection Rules

Primary routing heuristic:

- choose by the dominant purpose of the work, not by estimated size alone
- `Quick Task` is for bounded low-risk delivery inside already-understood behavior
- `Migration` is for behavior-preserving modernization where technical compatibility is the main uncertainty
- `Full Delivery` is for new behavior, product ambiguity, or changes that need deliberate definition across product, requirements, architecture, and delivery

Tie-breaker rule:

- if the main uncertainty is product behavior, requirements, acceptance, or cross-boundary solution design, choose `Full Delivery`
- if the main uncertainty is framework, dependency, runtime, or compatibility modernization while preserved behavior is already known, choose `Migration`
- if neither product ambiguity nor compatibility uncertainty dominates and the work stays tightly bounded with a short verification path, choose `Quick Task`

Choose `Quick Task` only when all are true:

- scope is bounded and remains within one tightly related area or two closely related surfaces
- acceptance criteria are already clear
- no new architecture or design trade-off is required
- no API, schema, auth, billing, permission, or security model change is involved
- validation can be done with a short, direct verification path
- framework or dependency compatibility is not the main source of risk

Choose `Full Delivery` when any are true:

- the task introduces a new feature or workflow
- requirements are ambiguous or likely to change
- multiple subsystems or responsibility boundaries are involved
- product-facing architecture, user-facing contracts, or business-significant data semantics are affected
- explicit product, spec, architecture, or plan artifacts are needed
- the task has elevated rework risk

Choose `Migration` when all or most are true:

- the main goal is upgrading or replacing existing technology rather than inventing a new feature
- the expected outcome is behavior preservation under a changed stack or code structure
- current-state baseline and compatibility discovery are required before implementation is trustworthy
- framework-coupled logic or integration seams must be untangled to make the upgrade safe
- framework, dependency, runtime, or API deprecation risk is central to the work
- validation depends more on regression, smoke, build, type, and compatibility evidence than on greenfield TDD slices
- rollback checkpoints or staged remediation are needed
- product requirements are mostly known already, but the technical path is uncertain

Explicit lane exclusions:

- do not use `Quick Task` when compatibility risk, deprecation handling, or upgrade sequencing is the main problem, even if the code diff may stay small
- do not use `Migration` when the work is expected to create new product behavior, redefine acceptance, or renegotiate business semantics
- do not use `Full Delivery` for straightforward behavior-preserving modernization work just because architecture or internal code structure must change during the upgrade

## Lane Decision Matrix

| Situation | Dominant uncertainty | Choose | Why |
| --- | --- | --- | --- |
| Fix wording in one operator doc | None beyond a local edit | `Quick Task` | Bounded low-risk change with short verification |
| Replace one deprecated helper call in one module with clear expected output | Local implementation only | `Quick Task` | No product ambiguity and no meaningful modernization program |
| Upgrade React 16 to React 19 while preserving screens and flows | Compatibility and framework modernization | `Migration` | Behavior should stay the same; technical compatibility is the main risk |
| Migrate data fetching from ad-hoc requests to React Query without changing UX or business rules | Compatibility and integration seams | `Migration` | Technology and structure change, but expected behavior is preserved |
| Upgrade Next.js and redesign routing behavior for a new user journey | Product behavior and solution design | `Full Delivery` | The work is no longer only modernization; it changes user-facing behavior |
| Introduce a new billing workflow | Product and requirement definition | `Full Delivery` | New behavior, new acceptance, and cross-boundary planning are required |
| Small dependency bump with known codemod and no compatibility uncertainty | Local low-risk maintenance | `Quick Task` | The dominant problem is still a bounded edit, not a migration program |
| Dependency upgrade where legacy lifecycle patterns must be untangled first | Compatibility and upgrade sequencing | `Migration` | Even if scope is moderate, upgrade safety and seam creation dominate |
| Refactor internals during an upgrade only to create adapters and preserve behavior | Compatibility and migration safety | `Migration` | Refactor is in service of behavior-preserving modernization |
| Refactor internals and also change validation rules or acceptance behavior | Business semantics and acceptance | `Full Delivery` | Once acceptance changes, the work needs the full-definition lane |

Fast tie-break examples:

- "Small diff but compatibility is the main risk" -> `Migration`
- "Large diff but behavior stays the same" -> usually `Migration`
- "Small diff but product meaning changes" -> `Full Delivery`
- "Small, clear, local, and low-risk" -> `Quick Task`

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

Parallel execution rule for full delivery:

- parallel implementation and per-task QA are allowed only after `full_plan` when the implementation plan explicitly records a `Parallelization Assessment`
- if the plan says `parallel_mode = none`, task tracking may exist for traceability but execution must remain sequential
- if the plan says `parallel_mode = limited` or `enabled`, the runtime may activate multiple Fullstack or QA owners only within the validated task graph and conflict rules

### Migration loop

```
Fullstack → QA → (pass) → migration_done
                → (bug) → migration_upgrade
                → (design flaw or compatibility flaw) → migration_strategy
                → (requirement gap or product ambiguity) → escalate to Full Delivery
```

Parallel execution rule for migration:

- migration remains sequential by default
- migration slices may run in parallel only after `migration_strategy` records a `Parallelization Assessment` that blesses slice-based execution
- migration parallelism must preserve baseline invariants, rollback checkpoints, and parity verification targets for every approved slice

## Escalation Rule

Escalation paths are one-way only:

- `Quick Task -> Full Delivery`
- `Migration -> Full Delivery`

Quick work must escalate immediately when it encounters:

- `design_flaw`
- `requirement_gap`
- scope expansion across a second subsystem or responsibility boundary
- verification needs that are no longer short and local

There is no downgrade path from full mode back into quick mode.
There is no downgrade path from full mode back into migration mode, and no downgrade path from migration mode back into quick mode.

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

### Migration

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_verify`
- `migration_verified`

Approval authorities:

- `baseline_to_strategy`: `Tech Lead Agent`
- `strategy_to_upgrade`: `Fullstack Agent`
- `upgrade_to_verify`: `QA Agent`
- `migration_verified`: `QA Agent`

Migration handoff-ready expectations:

- `migration_intake -> migration_baseline`: migration goal, target stack, and current-system scope are clear enough to inspect baseline reality
- `migration_baseline -> migration_strategy`: dependency versions, compatibility hotspots, constraints, preserved invariants, and likely migration blockers are inspectable
- `migration_strategy -> migration_upgrade`: staged sequence, rollback checkpoints, seam or adapter decisions, validation path, and blast-radius notes are explicit
- `migration_upgrade -> migration_verify`: the executed upgrade slices, changed surfaces, decoupling steps, and real verification evidence are inspectable
- `migration_verify -> migration_done`: regression evidence is inspectable, open compatibility issues are resolved or escalated, and `migration_verified` is approved

Standard repeatable checklists:

- `docs/templates/migration-baseline-checklist.md` for `migration_baseline`
- `docs/templates/migration-verify-checklist.md` for `migration_verify`

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

### Migration

- baseline and strategy notes recorded in workflow communication and state
- preserved invariants and parity expectations recorded in workflow communication and state
- optional architecture document when the migration needs an explicit compatibility or boundary design
- migration plan in `docs/plans/YYYY-MM-DD-<migration>.md`
- optional consolidated migration report in `docs/plans/YYYY-MM-DD-<migration>-report.md` when one artifact is useful for baseline, execution, and verification continuity
- reusable baseline and verify checklists available from `docs/templates/`
- concise regression and compatibility evidence in workflow communication and state
- no execution task board in the current live contract

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
3. **Use migration for upgrades** — Framework or dependency modernization should preserve baseline evidence, compatibility reasoning, and known behavior instead of pretending it is greenfield feature delivery.
4. **Keep role boundaries explicit** — Even in a minimal repository, responsibilities stay conceptually separate.
5. **Use Master Orchestrator for routing** — All inter-agent delegation goes through Master.
6. **Escalate honestly** — Quick mode stops when the work becomes a design or requirements problem, and migration mode stops when the work becomes a product-definition problem.
7. **Report real validation** — If tooling does not exist, document the actual verification path instead of inventing commands.
8. **Make handoffs inspectable** — Every stage boundary should leave enough recorded context that the next role can resume without hidden assumptions.

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
- escalation metadata when quick or migration work is promoted to full delivery

When full delivery is using task-aware execution, task-board state is stored beside the active work item rather than inside the top-level mirrored state file.

State-shape changes for future quick-lane behavior are out of scope for this phase. Preserve compatibility with the current schema until a later task changes runtime support deliberately.
