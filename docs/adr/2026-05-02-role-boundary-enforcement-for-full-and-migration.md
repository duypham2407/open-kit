---
artifact_type: adr
version: 1
status: proposed
decision_id: ADR-001
decision_slug: role-boundary-enforcement-for-full-and-migration
owner: SolutionLead
---

# ADR: Enforce role boundaries in full and migration orchestration

## Context

OpenKit's canonical workflow contract says `Master Orchestrator` is procedural only: it routes work, records state, controls gates, and escalates, but it must not author scope, solution, code, review output, or QA judgment. That contract is explicit in `context/core/workflow.md`, `agents/master-orchestrator.md`, and `docs/maintainer/2026-03-26-role-operating-policy.md`.

The current implementation honors stage progression and owner labels in workflow state, but it does not yet enforce execution ownership for planning roles in the full and migration lanes. In practice this creates a recurring failure mode:

- `/delivery` and `/migrate` correctly initialize the lane and stage state, but `Master Orchestrator` can still continue producing scope, solution, or implementation content itself.
- workflow state records stage owners such as `ProductLead` and `SolutionLead`, but no runtime mechanism proves those roles were actually invoked before downstream work proceeds.
- approval gates require stage artifacts, but they do not validate that the recorded approver matches the canonical approval authority for the gate.
- prompt contracts assume the global-kit compatibility path `.opencode/openkit/...`, while the checked-in authoring repository still keeps canonical docs at repo-root paths like `AGENTS.md`, `context/...`, and `.opencode/workflow-state.json`.

This mismatch explains the reported symptom that full-lane and migration subagents are "not working correctly": the system changes state as if a handoff happened, but the runtime does not yet enforce that the correct role produced the next artifact.

### Observed evidence

1. Stage ownership today is only a state mapping.
   - `.opencode/lib/workflow-state-rules.js` maps `full_product -> ProductLead`, `full_solution -> SolutionLead`, `migration_strategy -> SolutionLead`, and intake/done stages to `MasterOrchestrator`.
   - `.opencode/lib/workflow-state-controller.js#advanceStage` advances to the next stage and sets `state.current_owner = STAGE_OWNERS[targetStage]`, but it does not dispatch or require a role-specific execution record before downstream progress.

2. Approval gates validate artifacts but not approval authority.
   - `.opencode/lib/workflow-state-controller.js#setApproval` checks gate validity and some artifact/task-board readiness.
   - It does not verify that `approvedBy` matches the canonical authority from `context/core/approval-gates.md`.
   - Existing tests permit approvals by `user` or other non-canonical actors for full-lane stage gates, which weakens the boundary between routing and owned work.

3. Delegation runtime currently focuses on execution-task dispatch, not planning-role dispatch.
   - `src/runtime/managers/delegation-supervisor.js` dispatches task-board execution and QA-ready work for `FullstackAgent` or `QAAgent`.
   - No equivalent runtime handoff exists for `ProductLead` at `full_product` or `SolutionLead` at `full_solution` and `migration_strategy`.

4. Prompt path assumptions are inconsistent between global mode and authoring mode.
   - `commands/delivery.md`, `commands/migrate.md`, and several agent files instruct the runtime to read `.opencode/openkit/...` paths.
   - In the checked-in repository, canonical docs actually live at `AGENTS.md`, `context/...`, and `.opencode/workflow-state.json`.
   - When the runtime executes in authoring mode, this can leave the orchestrator without the intended canonical context and increase the chance of improvised behavior.

5. Current tests mostly validate state shape and advisory guidance, not enforced behavioral isolation.
   - `tests/runtime/capability-tools.test.js` verifies guardrail language such as "do not implement".
   - `.opencode/tests/workflow-state-controller.test.js` verifies stage advancement and owner labels.
   - There is not yet an integration test proving that `MasterOrchestrator` cannot satisfy `ProductLead` or `SolutionLead` responsibilities by itself.

### Impact

- Full-delivery planning order can be bypassed in behavior even when it appears correct in workflow state.
- Migration baseline and strategy work can be silently collapsed back into orchestrator-authored output.
- Approval history can look valid while being attributed to the wrong actor.
- Resume and command behavior can depend on whether the runtime happens to be using global-kit layout or checked-in authoring layout.

## Decision

OpenKit will treat role boundaries in `full` and `migration` as enforceable runtime rules rather than advisory prompt guidance only.

The implementation direction is:

1. Add approval-authority enforcement.
   - `setApproval()` must reject approvals where `approvedBy` does not match the canonical authority for the gate, unless an explicit, separately modeled override mechanism exists.
   - The enforcement source should derive from the same workflow-rule source as the canonical gate mapping to avoid doc/runtime drift.

2. Add stage-role execution evidence for planning stages.
   - `full_product` must require inspectable evidence that `ProductLead` performed the scope-authoring handoff before `product_to_solution` can be approved.
   - `full_solution` and `migration_strategy` must require inspectable evidence that `SolutionLead` produced the relevant solution artifact before their downstream gates can be approved.
   - At minimum, this evidence can be a structured role-authorship or delegated-handoff record; longer term it should be backed by runtime invocation or handoff logs rather than free-form text alone.

3. Keep `MasterOrchestrator` procedural in runtime, not just in prose.
   - Runtime transitions for `full_product`, `full_solution`, and `migration_strategy` must not be considered satisfied solely because `current_owner` changed.
   - The orchestrator may initialize intake, update state, report blockers, and route work, but it must not become the effective content owner of scope or solution artifacts.

4. Separate global-kit pathing from authoring-repository pathing.
   - Command and agent prompts must read canonical docs from repo-root paths when running against the checked-in authoring repository.
   - `.opencode/openkit/...` should be used only when the runtime is actually operating in the global-kit compatibility layout.
   - Runtime path resolution should prefer environment-aware canonical resolution over hardcoded one-layout assumptions.

5. Expand tests from state conformance to boundary enforcement.
   - Add tests that fail when non-canonical actors approve stage gates.
   - Add tests that fail when downstream full/migration transitions proceed without the required planning-role evidence.
   - Add path-mode tests for both checked-in authoring layout and global-kit compatibility layout.

## Consequences

### Positive

- Full and migration workflows become inspectable in the same way they are documented.
- The system can no longer present a fake handoff where stage labels changed but the owning role never actually acted.
- Approval history becomes auditable and useful for debugging orchestration defects.
- Prompt-layer and runtime-layer behavior become more consistent across authoring and globally installed environments.

### Negative

- Short-term implementation complexity increases because workflow state, prompt contracts, and delegation/runtime logging all need updates.
- Some existing tests and example states that use permissive `approvedBy` values will need to be rewritten.
- The first enforcement pass may surface additional latent defects in resume and artifact scaffolding flows.

### Risks and constraints

- Enforcement must not invent hidden background execution if the runtime cannot yet prove it happened.
- Any temporary compatibility escape hatch must be explicit, traceable, and visibly caveated rather than silently permissive.
- Path-resolution fixes must preserve the current global-kit compatibility story while restoring correct behavior in the authoring repository.

## Alternatives Considered

### 1. Keep role boundaries as documentation-only guidance

Rejected.

This is the current de facto behavior, and it is the direct source of the reported failure. State labels and prompt guardrails alone are not enough when the runtime can still advance without verifying the correct role acted.

### 2. Enforce only approval authority, but not planning-role execution evidence

Rejected.

This would improve gate integrity, but `MasterOrchestrator` could still effectively author scope or solution content and then arrange for a nominally correct approver to bless it. The main defect is role substitution, not only wrong gate attribution.

### 3. Skip runtime enforcement and rely on stronger prompt engineering for `MasterOrchestrator`

Rejected.

Prompt improvements help but do not solve the structural issue. The orchestrator already has clear written boundaries in multiple canonical docs. The missing layer is runtime enforcement and test coverage.

### 4. Implement full subagent dispatch first and defer gate enforcement

Partially rejected.

Planning-role dispatch should be added, but approval-authority enforcement is smaller, lower risk, and immediately valuable. Gate enforcement should land early even if richer delegated-handoff telemetry arrives in a second slice.
