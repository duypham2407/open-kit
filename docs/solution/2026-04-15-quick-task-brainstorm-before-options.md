---
artifact_type: solution_package
version: 1
status: draft
feature_id: FEATURE-936
feature_slug: quick-task-brainstorm-before-options
source_scope_package: docs/scope/2026-04-15-quick-task-brainstorm-before-options.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Quick Task Brainstorm Before Options

## Chosen Approach

- Treat this as a **quick-lane contract realignment** across canonical workflow docs, Quick Agent stage instructions, entry-command guidance, runtime summary surfaces, and the derived install bundle.
- Keep the runtime model unchanged: **no stage rename, no new quick approval gate, no lane-selection change, no escalation-policy change, no quick task board, and no workflow-state schema/controller expansion** for this feature.
- Put the two new user checkpoints **inside the existing stages**:
  - `quick_brainstorm` = clarify + align + explicit user confirmation of understanding
  - `quick_plan` = solution analysis + default 3 options + option selection + execution plan + separate plan confirmation
- Add targeted contract tests so the repository cannot drift back to “options in brainstorm” or “implementation before plan confirmation” language across source and bundled surfaces.

This is the simplest adequate path because the accepted scope is a behavior-contract change in an instruction-driven quick lane, not a stage-model redesign.

## Impacted Surfaces

### Canonical workflow and role contract
- `context/core/workflow.md`
- `docs/maintainer/2026-03-26-role-operating-policy.md`

### Quick-lane execution surfaces
- `agents/quick-agent.md`
- `commands/quick-task.md`
- `commands/task.md`

### Runtime guidance and summary surfaces
- `src/runtime/instruction-contracts.js`
- `.opencode/lib/runtime-guidance.js`

### Verification surfaces
- `.opencode/tests/workflow-contract-consistency.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/quick-lane-contract.test.js` (new targeted contract test)

### Derived global-install bundle surfaces
- `assets/install-bundle/opencode/agents/QuickAgent.md`
- `assets/install-bundle/opencode/commands/quick-task.md`
- `assets/install-bundle/opencode/commands/task.md`

## Boundaries And Components

### What must change
- The meaning of `quick_brainstorm` in human-facing and runtime-facing guidance.
- The meaning of `quick_plan` in human-facing and runtime-facing guidance.
- Quick-lane examples and summaries that currently imply “3 options during brainstorm”.
- Quick-lane option guidance so options are framed as **holistic approaches** that protect project stability and consistency, not narrow patch choices when broader consistency is relevant.

### What must stay unchanged
- Quick stage sequence: `quick_intake -> quick_brainstorm -> quick_plan -> quick_implement -> quick_test -> quick_done`
- Quick approval gate: `quick_verified`
- Lane authority and lane-lock behavior for `/quick-task`
- Escalation policy
- Quick-mode single-owner model (`QuickAgent` owns all quick stages)
- Full-delivery and migration contracts
- Quick-mode task-board prohibition

### Files that should remain untouched unless implementation proves otherwise
- `.opencode/lib/workflow-state-rules.js`
- `.opencode/lib/workflow-state-controller.js`
- `context/core/active-contract.json`

These surfaces already encode the approved unchanged parts: stage names, owner chain, and gate model. Editing them would be scope drift unless a concrete validation gap appears.

## Interfaces And Data Contracts

### Quick-stage behavior contract

#### `quick_brainstorm`
- Allowed behaviors:
  - deep codebase reading
  - follow-up questions
  - draft understanding
  - user corrections
  - explicit request for confirmation of understanding
- Forbidden before explicit confirmation:
  - solution options
  - solution comparison
  - approach recommendation
  - execution planning

#### `quick_plan`
- Entry condition: user explicitly confirmed the agent’s understanding.
- Required flow inside the stage:
  1. analyze the solution space
  2. present **3 meaningfully different options by default**
  3. if fewer than 3 options exist, explain why 3 meaningful options do not exist
  4. ensure options are holistic enough to preserve project stability and consistency
  5. wait for user option selection
  6. produce execution plan only for the selected option
  7. wait for **separate explicit plan confirmation** before `quick_implement`

### Runtime summary contract
- `src/runtime/instruction-contracts.js` and `.opencode/lib/runtime-guidance.js` must describe the same stage semantics as the canonical docs.
- The `/task` and `/quick-task` entry surfaces must no longer promise options in `quick_brainstorm`.

### Bundle contract
- Source files remain authoritative.
- `assets/install-bundle/opencode/**` must be refreshed via the existing bundle sync flow; do **not** hand-edit bundled copies independently.

## Risks And Trade-offs

### Risk 1: Partial contract update leaves contradictory quick-lane guidance
**Probability:** High if implementation is piecemeal. **Impact:** High.

Examples of bad drift:
- `workflow.md` says brainstorm is clarify-only, but `quick-agent.md` still generates options there.
- source command docs are corrected, but bundled install assets still say the old behavior.

**Mitigation:** Treat source docs, runtime summaries, command surfaces, and bundled assets as one change set. Add a focused contract test and run install-bundle verification.

### Risk 2: Implementation overreaches into stage/gate runtime mechanics
**Probability:** Medium. **Impact:** High.

The accepted scope explicitly preserves stage names, lane selection, and escalation. Adding new stages, approvals, or state-controller rules would create unnecessary surface area and migration risk.

**Mitigation:** Keep the new confirmations as stage-internal quick-lane behavior, not new workflow-state gates.

### Risk 3: Tiny-task pressure reintroduces shortcut behavior
**Probability:** Medium. **Impact:** Medium.

The old language allowed the agent to jump into options quickly. Without explicit tiny-task wording, future edits may silently reintroduce that shortcut.

**Mitigation:** Make “applies even for tiny quick tasks” explicit in canonical docs, Quick Agent instructions, and targeted tests.

### Risk 4: Contract tests become too prose-fragile
**Probability:** Medium. **Impact:** Low.

**Mitigation:** Test for semantic anchors, not exact paragraph text. Assert presence of the critical behavioral requirements rather than full-copy equality.

## Recommended Path

- First add or extend contract tests that capture the new quick-lane behavior and the unchanged stage/gate model.
- Then update the canonical workflow and role surfaces.
- Then update Quick Agent and command/runtime summary surfaces.
- Then sync the derived install bundle and run verification.

Do **not** add new quick-state fields, new approvals, or new stage transitions unless implementation can prove an existing runtime surface cannot represent the approved behavior. Nothing in the current scope requires that heavier change.

## Implementation Slices

### Slice 1: Add quick-lane contract guardrails first
- **Files**:
  - `.opencode/tests/quick-lane-contract.test.js` (new)
  - `.opencode/tests/workflow-contract-consistency.test.js`
  - `.opencode/tests/workflow-state-controller.test.js`
- **Goal**: lock in the new quick-lane behavior while proving the old runtime stage/gate model remains unchanged.
- **Validation Command**:
  - `node --test ".opencode/tests/quick-lane-contract.test.js"`
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
- **Details**:
  - Add a focused contract test for these anchors:
    - `quick_brainstorm` requires explicit understanding confirmation before options
    - `quick_plan` owns options, option selection, execution planning, and separate plan confirmation
    - default option count is 3, with fewer only when explicitly justified
    - tiny quick tasks still require explicit understanding confirmation
  - Keep existing workflow-state tests as the regression proof that stage names, owner chain, and quick approval gates do not change.
  - Avoid brittle snapshot-style prose assertions; assert the critical policy phrases or structured guidance anchors instead.

### Slice 2: Rewrite the canonical quick-lane contract
- **Files**:
  - `context/core/workflow.md`
  - `docs/maintainer/2026-03-26-role-operating-policy.md`
- **Goal**: make the source-of-truth quick-stage responsibilities match the approved scope without changing the stage model.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
  - `node .opencode/workflow-state.js doctor`
- **Details**:
  - Update the quick-lane pipeline text so `quick_brainstorm` is alignment-first and `quick_plan` is option-and-plan-first.
  - Preserve the exact stage sequence and quick gate naming already enforced by runtime tests.
  - Update role-policy wording so Quick Agent ownership reflects the two distinct user confirmations:
    - understanding confirmation before analysis
    - plan confirmation before implementation
  - Keep quick mode explicitly task-board free.

### Slice 3: Align Quick Agent and command/runtime guidance surfaces
- **Files**:
  - `agents/quick-agent.md`
  - `commands/quick-task.md`
  - `commands/task.md`
  - `src/runtime/instruction-contracts.js`
  - `.opencode/lib/runtime-guidance.js`
- **Goal**: ensure every quick-lane execution surface gives the same operational instructions.
- **Validation Command**:
  - `node --test ".opencode/tests/quick-lane-contract.test.js"`
- **Details**:
  - In `agents/quick-agent.md`:
    - rewrite `quick_brainstorm` to clarify-and-align behavior only
    - move all option generation into `quick_plan`
    - require default 3 options in `quick_plan`, with fewer only when explicitly justified
    - require holistic options that call out broader consistency/stability impact where relevant
    - require separate user selection before plan creation and separate plan confirmation before implementation
  - In `commands/quick-task.md` and `commands/task.md`:
    - change the quick-lane expectation text and example transcript so they no longer promise “brainstorm 3 options” before alignment
  - In `src/runtime/instruction-contracts.js` and `.opencode/lib/runtime-guidance.js`:
    - update `nextAction` / stage guidance strings so resume and runtime summaries stay aligned with the new contract

### Slice 4: Refresh bundled assets and verify source-to-bundle parity
- **Files**:
  - `assets/install-bundle/opencode/agents/QuickAgent.md`
  - `assets/install-bundle/opencode/commands/quick-task.md`
  - `assets/install-bundle/opencode/commands/task.md`
  - generated through `npm run sync:install-bundle`
- **Goal**: keep the globally installed kit behavior aligned with the checked-in authoring surfaces.
- **Validation Command**:
  - `npm run sync:install-bundle`
  - `npm run verify:install-bundle`
- **Details**:
  - Do not hand-edit the bundled files separately.
  - Update source files first, then sync the derived install bundle.
  - Verify no source/bundle drift remains before implementation handoff closes.

## Dependency Graph

- Slice 1 -> Slice 2 -> Slice 3 -> Slice 4
- Critical path: tests first, canonical contract second, execution/runtime guidance third, bundled asset parity last.

## Parallelization Assessment

- parallel_mode: `none`
- why: the same quick-lane contract language is repeated across overlapping source, runtime, test, and derived bundle surfaces; parallel edits would increase contradiction risk and complicate bundle sync.
- safe_parallel_zones: []
- sequential_constraints: [
  `TASK-TEST-CONTRACT -> TASK-CANONICAL-CONTRACT -> TASK-EXECUTION-SURFACES -> TASK-BUNDLE-SYNC`
]
- integration_checkpoint: all source-of-truth, runtime-summary, and bundled quick-lane surfaces describe the same two-confirmation flow before handoff to FullstackAgent.
- max_active_execution_tracks: `1`

## Validation Matrix

| Target | Validation path |
| --- | --- |
| Quick stage names and gate model remain unchanged | `node --test ".opencode/tests/workflow-state-controller.test.js"` |
| Canonical workflow contract remains internally consistent | `node --test ".opencode/tests/workflow-contract-consistency.test.js"` |
| New quick-lane semantics are present across agent/command/runtime surfaces | `node --test ".opencode/tests/quick-lane-contract.test.js"` |
| Derived install bundle matches edited source surfaces | `npm run verify:install-bundle` |
| Governance-level regression check still passes | `npm run verify:governance` |
| Runtime-facing workflow docs still pass doctor | `node .opencode/workflow-state.js doctor` |

## Integration Checkpoint

Before `solution_to_fullstack` is treated as ready, confirm all of the following together:

1. `workflow.md`, `quick-agent.md`, `quick-task.md`, `task.md`, `instruction-contracts.js`, and `runtime-guidance.js` all say:
   - no options before explicit understanding confirmation
   - options live in `quick_plan`
   - option selection happens before execution plan
   - plan confirmation happens before `quick_implement`
2. Quick stage names, quick gate names, lane selection behavior, and escalation behavior are unchanged.
3. The derived install bundle has been synced and verified.
4. Contract tests and existing workflow-state regression tests all pass.

## Rollback Notes

- Roll back source quick-lane contract edits and bundled asset sync together; do not leave source and bundle surfaces on different semantics.
- If the new contract tests expose unexpected resume/runtime coupling, revert only the newly added contract assertions first, then reassess whether a deeper runtime-state change is actually required.
- Do not roll back by reintroducing option generation into `quick_brainstorm`; that would violate the approved scope directly.

## Reviewer Focus Points

- Reject any implementation that changes quick stage names, approval gates, lane authority, or escalation behavior.
- Reject any Quick Agent or command text that still generates or compares options inside `quick_brainstorm`.
- Reject any implementation that allows `quick_plan` to emit a final execution plan before the user selects an option.
- Reject any implementation that starts `quick_implement` without a separate plan-confirmation requirement.
- Check that the “fewer than 3 options” exception is justified only when 3 meaningful approaches truly do not exist and is not used as a convenience shortcut.
- Check that source and bundled install surfaces are both updated and consistent.
