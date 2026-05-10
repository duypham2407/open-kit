# Lane Bootstrap & Brainstorm Redesign

**Date:** 2026-05-09
**Status:** Design — pending implementation plan

## Problem

When OpenKit is installed globally and a user opens a fresh project, the first slash command they run (`/brainstorm`, `/delivery`, `/migrate`, etc.) fails with "no workflow" errors across multiple surfaces (MCP resources, MCP tools, session-start banner). This happens because:

1. `workflow-kernel.js` reads `<projectRoot>/.opencode/workflow-state.json`. If absent, every `showState()` call returns `null`.
2. `workspace-shim.js` only creates `src/openkit-runtime/openkit/workflow-state.json` if a workspace state already exists upstream — chicken-and-egg for fresh projects.
3. None of the user-facing commands except `/task` actually create workflow state. `/brainstorm`, `/delivery`, `/migrate` assume state already exists.
4. Agents and command docs reference `src/openkit-runtime/openkit/workflow-state.json` (the shim path) which does not exist on a fresh install.

The deeper issue is that the kit's command surface drifted away from the intended mental model: the kit is meant to act as a development team where the user picks a lane and a Master Orchestrator (MO) runs the workflow. The current surface has too many overlapping entry points (`/task`, `/brainstorm`) and unclear ownership of brainstorm work.

## Mental model

The kit is a software development team:

- **User** is the stakeholder. They pick the lane by choosing the right command.
- **Master Orchestrator (MO)** is the conductor — purely procedural: bootstrap workflow state, dispatch to specialist agents, route between stages, handle escalations and rollbacks. MO runs on a light model (Sonnet/Haiku tier) because it does no domain reasoning.
- **Specialist agents** (Product Lead, Solution Lead, Quick Agent, Fullstack, Code Reviewer, QA) handle domain work. They run on heavy models (Opus/GPT-5 tier) because brainstorm, scope, design, code review, and QA all require deep reasoning.

This separation is both ergonomic (clear roles) and economic (heavy models are spent only where they matter).

## Principles

1. **3 commands, 3 lanes.** No catch-all entry point. The user picks the lane explicitly.
2. **MO is the single dispatch point.** Every command goes through MO first — MO bootstraps state, then dispatches the specialist agent.
3. **Brainstorm is stage 0 of every lane**, owned by the lane's first specialist agent (not MO). There is no standalone brainstorm command.
4. **Workflow-state.json is created on first command**, not lazily. This kills the "no workflow" error class permanently.
5. **Lane misclassification is corrected via user confirmation.** If the specialist agent realizes during brainstorm that the lane is wrong, MO asks the user before switching.
6. **Scope/migration plan is the single source of truth for downstream agents.** Brainstorm is preserved as appendix, not as a separate artifact downstream agents must read.

## Command surface

| Command | MO does (light model) | First specialist agent (heavy model) does |
|---|---|---|
| `/quick-task <description>` | Create state with `lane=quick`, `current_stage=quick_intake`. Record raw description. Generate slug/feature_id. Dispatch. Advance to `quick_plan`. | **Quick Agent**: short brainstorm (2-3 questions, ~50-100 word summary), inline into state, then build plan. |
| `/delivery <description>` | Create state with `lane=full`, `current_stage=full_intake`. Record raw description. Generate slug/feature_id. Dispatch. Advance to `full_product`. | **Product Lead**: deep brainstorm dialogue with user, then write scope package file with brainstorm captured as appendix. Gate: user confirms scope. |
| `/migrate <description>` | Create state with `lane=migration`, `current_stage=migration_intake`. Record raw description. Generate slug/feature_id. Dispatch. Advance to `migration_strategy`. | **Solution Lead** (kit has no separate Migration Lead — Solution Lead handles migration): brainstorm preserved behavior + baseline + risks, then write migration plan file with brainstorm captured as appendix. Gate: user confirms plan. |

**Removed:**
- `/task` — replaced by lane-specific commands. User picks the lane.
- `/brainstorm` — folded into stage 0 of each lane. Not a standalone command anymore.

## State machine

```
quick:     quick_intake (MO)     → quick_plan (Quick Agent)         → quick_execute → quick_review → quick_done
full:      full_intake (MO)      → full_product (Product Lead)      → full_solution → full_fullstack → full_code_review → full_qa → full_done
migration: migration_intake (MO) → migration_strategy (Solution Lead) → migration_slices → migration_review → migration_done
```

`*_intake` stages are MO-only and ephemeral: they exist solely to record the original user input, generate identifiers, and dispatch the first specialist. MO calls `tool.advance-stage` immediately after dispatch — these stages never block waiting for user input.

If existing FSM has `*_brainstorm` stages, they are removed. Brainstorm work happens inside the first specialist stage (`quick_plan`, `full_product`, `migration_strategy`).

## Bootstrap behavior

When any of the 3 commands runs:

**On a fresh project (no `src/openkit-runtime/workflow-state.json`):**
1. Workspace-shim ensures `src/openkit-runtime/`, `src/openkit-runtime/openkit/`, and `src/openkit-runtime/work-items/` exist.
2. MO calls a new `tool.bootstrap-workflow` (or extends existing controller `createFreshState` path) to write `workflow-state.json` with the chosen lane and `current_stage = <lane>_intake`.
3. Workspace-shim is re-run to materialize `src/openkit-runtime/openkit/workflow-state.json` symlink/copy.
4. MO records the user's raw description in state and advances to the first specialist stage.

**On a project with an active workflow (state exists, status not `done`):**
1. MO inspects current state.
2. MO presents: "Workflow `<feature_id>` is active in stage `<current_stage>` owned by `<current_owner>`. Choose: (a) continue this workflow, (b) close it and start a new `<lane>` workflow."
3. User picks. If (a), MO resumes by dispatching the current owner. If (b), MO archives current state (move to `src/openkit-runtime/work-items/<id>/archived-state.json`) and starts fresh.

**On a project with a completed workflow (status: `done`):**
1. MO archives the previous state automatically and starts fresh — no prompt needed.

## Brainstorm storage

### Quick lane (inline in `workflow-state.json`)

```json
"brainstorm": {
  "mode": "quick",
  "summary": "<1 paragraph, 50-100 words>",
  "completed_at": "<iso>"
}
```

Inline because the payload is small and the quick lane has no separate scope file.

### Full and migration lanes (in scope/migration plan file, NOT inline in state)

State stores only a pointer:

```json
"artifacts": {
  "scope_package": "docs/scope/2026-05-09-<slug>.md"
}
```

The scope/migration plan file structure:

```markdown
# Scope: <feature title>

## Problem statement
## Success criteria
## Constraints
## Acceptance criteria
## Out of scope
## Open questions

---

## Appendix A: Discovery notes
<raw or summarized brainstorm dialogue, curated by Product Lead / Solution Lead>

## Appendix B: Decisions made during discovery
<rationale for non-obvious decisions, so downstream agents do not re-litigate>
```

**Curation rules for the specialist agent at gate time:**
- All insights from brainstorm that affect downstream work MUST be distilled into the main sections.
- Any decision that could plausibly be re-litigated (e.g., "we chose X over Y because timeline") MUST be in Appendix B.
- Appendix A may be raw or summarized — agent's choice based on dialogue length.

**Downstream agents** (Solution Lead, Fullstack, Code Reviewer, QA):
- Read the main sections by default.
- Read Appendix B when making non-obvious decisions or running into ambiguity.
- Read Appendix A only when Appendix B is insufficient — escape hatch, not default.

This keeps downstream prompts focused and avoids token waste, while preserving the discovery context for cases that need it.

## Lane re-check during brainstorm

The first specialist agent monitors during brainstorm whether the chosen lane is still appropriate:

- Quick Agent realizes scope is cross-boundary or behavior is unclear → escalate to MO.
- Product Lead realizes the work is purely a stack/library swap with preserved behavior → escalate to MO.
- Solution Lead realizes the work needs significant new product behavior, not just migration → escalate to MO.

When escalation triggers:

1. Agent emits a lane-switch suggestion via MO.
2. MO asks user: "This looks more like `<other lane>`. Switch? (y/n)"
3. If user confirms, MO archives current state, creates a new state with the new lane, copies the original user description and brainstorm-so-far into the new state's brainstorm appendix, and dispatches the new lane's first specialist.
4. If user declines, agent continues in the original lane.

## Brainstorm-to-next-stage gate

All 3 lanes use the "Mode C" gate (agent + user):

1. **Agent completeness check.** Agent verifies the brainstorm output meets minimum bar:
   - Quick: `summary` is non-empty.
   - Full: `problem_statement`, `success_criteria`, `acceptance_criteria` are non-empty in the scope file.
   - Migration: scope file plus `preserved_behavior` and `baseline_evidence` sections are non-empty.
2. **Agent presents summary** to user (the scope file's main sections, or for quick the inline summary).
3. **User decides:**
   - "Confirm" / "ok" → record approval `<lane>_brainstorm_to_<next>` with `approved_by: "user"`. Agent calls `tool.advance-stage`.
   - "Continue brainstorming" / specific feedback → agent loops back to dialogue.

The approval is recorded in `state.approvals` with the standard structure. Existing gate machinery in `tool.set-approval` is used.

## Multi-workflow / archive behavior

Active workflows are archived to `src/openkit-runtime/work-items/<feature_id>/archived-state.json` when:
- User chooses "close and start new" on the multi-workflow prompt.
- A lane switch happens during brainstorm.

Completed workflows (status: done) are auto-archived on next command. The current `workflow-state.json` always reflects the active workflow.

`src/openkit-runtime/work-items/<feature_id>/` already exists in the kit's structure — this design uses it as the archive destination.

## Files affected

### Create
- `src/commands/quick-task.md` — rewrite to dispatch MO → Quick Agent flow with brainstorm responsibility.
- (Spec doc only — implementation files determined in plan stage.)

### Modify
- `src/runtime/workflow-kernel.js` — ensure `defaultStatePath` resolves to a writable path even when state doesn't exist yet, so MO bootstrap writes succeed.
- `src/runtime/tools/workflow/advance-stage.js` — bootstrap path: if no state exists and the current call is from MO with a lane intent, allow creation instead of returning "no workflow".
- `src/global/workspace-shim.js` — relax the `if (fs.existsSync(paths.workflowStatePath))` guards so the shim creates the link even before state exists, OR re-run shim after MO bootstrap.
- `src/commands/quick-task.md`, `src/commands/delivery.md`, `src/commands/migrate.md` — re-spec to: (1) dispatch MO first, (2) MO bootstraps state, (3) MO advances to first specialist stage, (4) specialist runs brainstorm.
- `src/agents/master-orchestrator.md` — add bootstrap responsibility, multi-workflow handling, lane-switch handling. Remove any `/task` classification language.
- `src/agents/quick-agent.md` — add brainstorm-rút-gọn responsibility, inline summary writing.
- `src/agents/product-lead-agent.md` — add brainstorm responsibility, scope file appendix curation rules.
- `src/agents/solution-lead-agent.md` — add migration brainstorm + appendix responsibility for migration lane.
- `src/openkit-runtime/lib/workflow-state-controller.js` — confirm `createFreshState` / `createWorkItem` is callable from MO bootstrap path; possibly add new entry that takes lane + raw description.
- FSM definitions (transition engine, gate registry) — remove `*_brainstorm` stages if present, add `<lane>_brainstorm_to_<next>` gates.
- AGENTS.md, README.md, docs referencing `/task` or `/brainstorm` — purge those references.

### Delete
- `src/commands/task.md`
- `src/commands/brainstorm.md`
- Any agent prompt sections that classify lanes (lane classification is no longer a kit responsibility).

### Untouched
- All downstream stages (full_solution, full_fullstack, full_code_review, full_qa, etc.).
- All MCP tool APIs (`tool.advance-stage`, `tool.workflow-state`, `tool.set-approval`, `tool.action-gateway`, `tool.runtime-summary`, etc.).
- Install bundle, install-global flow, profile materializer.
- Test infrastructure for state v2 (Phase 1-3 from v0.5.0 release stays intact).

## Test surface

- `src/commands/quick-task.md` on fresh project → state created at `quick_intake` then `quick_plan`, brainstorm summary inline, no "no workflow" error.
- `/delivery` on fresh project → state created at `full_intake` then `full_product`, scope file created with appendices, gate triggers user confirm.
- `/migrate` on fresh project → state created at `migration_intake` then `migration_strategy`, migration plan file created with appendices.
- `/delivery` on project with active quick workflow → multi-workflow prompt appears.
- Lane switch during `/quick-task` brainstorm when scope grows → user prompt → state re-init at `full` lane with brainstorm preserved.
- Workspace-shim creates `src/openkit-runtime/openkit/workflow-state.json` link after MO bootstrap on fresh project.
- All v0.5.0 state v2 tests continue to pass.
- New test: bootstrapping from each command writes valid state schema v2.0.0.

## Out of scope

- Lane classification heuristics (the `/task` Master Orchestrator routing logic) — removed entirely. User picks lane.
- Changing model assignments (which model runs MO vs specialists) — handled separately via `agent-models.json` config.
- Adding new lanes — current 3 lanes are the surface.
- Reworking downstream stages or gates beyond the brainstorm-to-next gate.
- Migration of existing in-flight workflows from previous schema — v0.5.0 already handles schema migration; this design only changes the bootstrap and brainstorm front-end.
