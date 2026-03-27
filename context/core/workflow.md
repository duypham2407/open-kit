# Team Workflow — Open Kit

Defines the canonical live workflow contract for OpenKit.

Use this file as the source of truth for workflow semantics. Companion docs such as `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` must align to it and should focus on their local concerns.

For the stricter routing rubric, examples, and anti-patterns behind lane choice, use `context/core/lane-selection.md`.
For product-vs-compatibility runtime boundaries, use `context/core/runtime-surfaces.md`.

The current live contract uses `Quick Task+` successor semantics for the existing quick lane while supporting three runtime modes: `quick`, `migration`, and `full`.

`Quick Task+` is not a third lane or a fourth runtime mode.

## Workflow Lanes

OpenKit has three explicitly separate operating lanes:

- `Quick Task` for narrow, low-risk daily work
- `Migration` for upgrades, framework migrations, dependency modernization, and compatibility remediation
- `Full Delivery` for feature work and higher-risk changes

The Master Orchestrator is the entry point for all lanes and is responsible for choosing the lane, recording the choice in workflow state, dispatching the next owner, and controlling approvals and escalation.

Important role boundary:

- `Master Orchestrator` is a procedural workflow controller
- `Master Orchestrator` does not own business analysis, technical design, planning content, implementation, review, or QA judgment
- `Product Lead` owns scope and acceptance content for full delivery
- `Solution Lead` owns technical direction, planning, and migration strategy content

## Quick Task Lane

Canonical stage sequence:

`quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`

Pipeline:

```text
User Request
    ↓
Master Orchestrator
    ↓
quick_plan
    ↓
Fullstack Agent
    ↓
QA Agent
    ↓
Master Orchestrator
```

Quick mode exists to reduce overhead, not to bypass quality.

Quick mode expectations:

- clear scope up front
- bounded planning before implementation
- short acceptance bullet list
- direct verification path
- no architecture exploration
- no full artifact chain requirement
- no required code-review stage

## Full Delivery Lane

Canonical stage sequence:

`full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`

Pipeline:

```text
User Request
    ↓
Master Orchestrator   ← route, dispatch, record state
    ↓
Product Lead          ← define problem, scope, and acceptance
    ↓
Master Orchestrator   ← record gate and dispatch
    ↓
Solution Lead         ← choose approach, slices, and validation path
    ↓
Master Orchestrator   ← record gate and dispatch
    ↓
Fullstack Agent       ← implement approved work
    ↓
Master Orchestrator   ← request review and route findings
    ↓
Code Reviewer         ← scope compliance first, code quality second
    ↓
Master Orchestrator   ← route review outcome
    ↓
QA Agent              ← verify behavior and closure evidence
    ↓
Master Orchestrator   ← close or reroute
```

Full mode preserves the structured team workflow for work that benefits from deliberate product definition, solution design, implementation, review, and QA handoffs.

Implemented full-delivery task-runtime note:

- from `full_solution` onward, a full-delivery work item may carry an execution task board under `.opencode/work-items/<work_item_id>/tasks.json`
- task boards belong only to full-delivery work items
- task-level ownership does not replace the feature-stage owner recorded in workflow state
- full-delivery parallel work is conditional, not automatic; `Solution Lead` must bless a solution package that explicitly says parallel execution is safe
- when the solution package does not approve parallel execution, full-delivery work remains sequential even if multiple Fullstack or QA agents are available
- singleton planning roles remain singleton: one `Product Lead` and one `Solution Lead` define the work; worker pools apply only to implementation and QA execution after planning is approved

## Migration Lane

Canonical stage sequence:

`migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`

Pipeline:

```text
User Request
    ↓
Master Orchestrator
    ↓
Solution Lead         ← baseline, preserved invariants, and upgrade strategy
    ↓
Fullstack Agent       ← execute migration slices
    ↓
Code Reviewer         ← review for parity drift and unsafe rewrite
    ↓
QA Agent              ← regression, smoke, and compatibility verification
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
- verify parity with real before/after evidence, smoke tests, builds, type checks, codemods, and regression passes
- no task board in the current live contract

Canonical migration heuristic:

`freeze invariants -> capture baseline -> decouple blockers -> migrate incrementally -> review for parity drift -> verify parity -> cleanup last`

## Lane Selection Rules

Primary routing heuristic:

- choose by the dominant purpose of the work, not by estimated size alone
- `Quick Task` is for bounded low-risk delivery inside already-understood behavior
- `Migration` is for behavior-preserving modernization where technical compatibility is the main uncertainty
- `Full Delivery` is for new behavior, product ambiguity, or changes that need deliberate definition across product, requirements, solution design, and delivery

Tie-breaker rule:

- if the main uncertainty is product behavior, requirements, acceptance, or cross-boundary solution design, choose `Full Delivery`
- if the main uncertainty is framework, dependency, runtime, or compatibility modernization while preserved behavior is already known, choose `Migration`
- if neither product ambiguity nor compatibility uncertainty dominates and the work stays tightly bounded with a short verification path, choose `Quick Task`

Lane Decision Matrix:

- product uncertainty -> `Full Delivery`
- compatibility uncertainty -> `Migration`
- low local uncertainty -> `Quick Task`

## Feedback Loops

### Quick Task loop

```text
Fullstack → QA Lite → (pass) → quick_done
                    → (bug)  → quick_build
                    → (design flaw or requirement gap) → full_intake
```

### Full Delivery loop

```text
Fullstack → Code Reviewer → (implementation issue) → full_implementation
                        → (solution issue)       → full_solution
                        → (product scope issue)  → full_product

QA → (bug)             → full_implementation
   → (design flaw)     → full_solution
   → (requirement gap) → full_product
   → (pass)            → full_done
```

### Migration loop

```text
Fullstack → Code Reviewer → (implementation issue) → migration_upgrade
                        → (migration parity issue) → migration_strategy

QA → (bug)             → migration_upgrade
   → (design flaw)     → migration_strategy
   → (requirement gap) → full_intake
   → (pass)            → migration_done
```

## Approval Gates

### Quick Task

- `quick_verified`

### Migration

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

### Full Delivery

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

Approval state should be recorded in the managed active work-item state before advancing stages, and the active compatibility mirror at `.opencode/workflow-state.json` should reflect that updated state.

## Document Outputs By Mode

### Quick Task

- optional lightweight task card: `docs/tasks/YYYY-MM-DD-<task>.md`
- source code changes
- bounded quick-plan/checklist state in `quick_plan`
- concise QA Lite evidence in workflow communication and state

### Migration

- baseline and strategy notes recorded in workflow communication and state
- preferred technical artifact: `docs/solution/YYYY-MM-DD-<migration>.md` as the solution package
- entering `migration_strategy` should auto-scaffold the primary solution package when it is still missing
- preserved invariants and parity expectations recorded in workflow communication and state
- optional consolidated migration report in `docs/solution/YYYY-MM-DD-<migration>-report.md`
- concise review, regression, and compatibility evidence in workflow communication and state

### Full Delivery

| Role | Produces |
| --- | --- |
| Product Lead | primary `scope package`, usually at `docs/scope/YYYY-MM-DD-<feature>.md` |
| Solution Lead | primary `solution package`, usually at `docs/solution/YYYY-MM-DD-<feature>.md` |
| Fullstack | Source code and verification evidence |
| Code Reviewer | Review findings in workflow communication and state |
| QA | `docs/qa/YYYY-MM-DD-<feature>.md` |

Stage-entry note:

- entering `full_product` should auto-scaffold the primary scope package when it is still missing
- entering `full_solution` should auto-scaffold the primary solution package when it is still missing

## Key Principles

1. **Always use feedback loops** — Never mark work complete without verification.
2. **Choose the right lane early** — Do not force small tasks through the full pipeline, and do not under-scope feature work into quick mode.
3. **Use migration for upgrades** — Framework or dependency modernization should preserve baseline evidence, compatibility reasoning, and known behavior instead of pretending it is greenfield feature delivery.
4. **Keep role boundaries explicit** — Even in a minimal repository, responsibilities stay conceptually separate.
5. **Use Master Orchestrator for routing only** — All inter-agent delegation goes through Master, but Master does not author content artifacts.
6. **Escalate honestly** — Quick mode stops when the work becomes a design or requirements problem, and migration mode stops when the work becomes a product-definition problem.
7. **Report real validation** — If tooling does not exist, document the actual verification path instead of inventing commands.
8. **Make handoffs inspectable** — Every stage boundary should leave enough recorded context that the next role can resume without hidden assumptions.

## Workflow State

The active external compatibility mirror lives in `.opencode/workflow-state.json`.

Managed per-item state lives under `.opencode/work-items/`, and the active work item is mirrored into `.opencode/workflow-state.json` for compatibility with the existing command and resume surface.

Field definitions and allowed enums live in `context/core/workflow-state-schema.md`.
