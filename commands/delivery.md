---
description: "Starts the Full Delivery lane. Master Orchestrator bootstraps workflow state, then dispatches Product Lead for discovery brainstorm and scope."
---

# Command: `/delivery`

Use `/delivery` for feature work where product behavior, requirements, or cross-boundary design needs deep discovery and explicit scoping.

## What this command does

1. Dispatches **Master Orchestrator** with `lane=full` and the user's request as `description`.
2. MO calls `tool.bootstrap-workflow` to write `workflow-state.json` (or handles archive/conflict).
3. MO calls `tool.advance-stage` to move from `full_intake` to `full_product`.
4. **Product Lead** receives control in `full_product` and runs the brainstorm dialogue + scope package authorship.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.

## Preconditions

- The request is feature-shaped: product behavior, requirements, or cross-boundary solution design needs explicit discovery.
- If brainstorm reveals the work is purely a stack/library swap, Product Lead escalates to MO who asks the user before switching to `/migrate`.

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
full_intake (MO) → full_product (Product Lead: brainstorm + scope) → full_solution → full_implementation → full_code_review → full_qa → full_done
```

`full_intake` is MO-only and ephemeral.

## Scope package responsibility

Product Lead writes the scope at `docs/scope/YYYY-MM-DD-<slug>.md` with main sections (problem, success criteria, constraints, acceptance criteria, out of scope, open questions) plus Appendix A (discovery notes) and Appendix B (decisions). Downstream agents read main sections by default; they read Appendix B for non-obvious decisions and Appendix A only when needed.

## Lane authority

User picked `/delivery`. Lane is locked unless brainstorm reveals migration shape, in which case Product Lead escalates to MO for user confirmation.

## Validation guidance

- Real app build/test/lint commands per `context/core/project-config.md`.
- `node .opencode/openkit/workflow-state.js show` to inspect state when resuming.

## Example transcript

```text
User: /delivery add an enterprise approval workflow for billing
MO: Bootstrapping full workflow. Dispatching Product Lead.
ProductLead: To scope this, let me ask: who triggers the approval today?
User: Sales reps when discount > 20%.
ProductLead: And who approves?
User: VP Sales for <$50k, CFO above.
... (more discovery)
ProductLead: Scope package written to docs/scope/2026-05-09-enterprise-approval.md. Confirm to proceed?
User: Confirmed.
MO: Advancing to full_solution. Dispatching Solution Lead.
```
