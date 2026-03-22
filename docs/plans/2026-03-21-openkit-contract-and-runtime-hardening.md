---
artifact_type: implementation_plan
version: 1
status: draft
feature_id: FEATURE-003
feature_slug: openkit-contract-and-runtime-hardening
source_architecture: docs/architecture/2026-03-21-openkit-evolution-direction.md
owner: TechLeadAgent
approval_gate: tech_lead_to_fullstack
---

# OpenKit Contract and Runtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use `skills/subagent-driven-development/SKILL.md` when subagents are available. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant contract surfaces and close the highest-value runtime, verification, and adoption gaps so OpenKit behaves more like an enforceable operating kit than a docs-only workflow kit.

**Architecture:** Treat this as a repo-hardening pass in six layers: canonical workflow contract, thinner agent and command docs, automated drift detection, workflow behavior tests, lightweight artifact scaffolding, and clearer operator guidance. Keep the two-lane model intact, keep current command names intact, and only add runtime behavior that the repository can actually test and document.

**Tech Stack:** Markdown docs, JSON manifests, Node.js workflow utilities, Node test runner, shell hook scripts

**Traceability note:** This FEATURE-003 plan is the bounded implementation slice that turns the approved FEATURE-002 direction artifacts into concrete repository hardening work. It does not replace FEATURE-002; it operationalizes the highest-value contract, runtime, and verification follow-ons.

---

## Dependencies

- Current source-of-truth policy: `AGENTS.md`
- Live workflow contract: `context/core/workflow.md`
- Runtime manifest and state utility: `.opencode/opencode.json`, `.opencode/workflow-state.js`, `.opencode/lib/workflow-state-controller.js`, `.opencode/lib/workflow-state-rules.js`
- Startup bootstrap: `hooks/session-start`, `hooks/hooks.json`
- Existing tests: `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/session-start-hook.test.js`
- Existing artifacts and templates: `docs/templates/`, `docs/examples/`, `docs/operations/`, `docs/governance/`
- Available automated validation today: `node --test ".opencode/tests/*.test.js"`

## Planned File Map

- **Canonical workflow layer**
  - Modify: `AGENTS.md`, `README.md`, `context/navigation.md`, `context/core/workflow.md`, `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, `context/core/workflow-state-schema.md`
- **Role and command layer**
  - Modify: `agents/master-orchestrator.md`, `agents/fullstack-agent.md`, `agents/qa-agent.md`, `commands/task.md`, `commands/quick-task.md`, `commands/delivery.md`, `commands/write-plan.md`
- **Runtime enforcement layer**
  - Modify: `.opencode/workflow-state.js`, `.opencode/lib/workflow-state-controller.js`
  - Create: `.opencode/lib/contract-consistency.js`
- **Verification layer**
  - Modify: `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/session-start-hook.test.js`, `.opencode/tests/workflow-state-controller.test.js`
  - Create: `.opencode/tests/workflow-contract-consistency.test.js`
- **Artifact scaffolding layer**
  - Modify: `docs/templates/implementation-plan-template.md`, `docs/templates/quick-task-template.md`, `.opencode/workflow-state.js`, `.opencode/lib/workflow-state-controller.js`
  - Create: `.opencode/lib/artifact-scaffolder.js`, `.opencode/tests/artifact-scaffolder.test.js`
- **Operator guidance layer**
  - Modify: `docs/operations/README.md`, `docs/operations/runbooks/workflow-state-smoke-tests.md`, `docs/examples/README.md`, `docs/governance/README.md`, `docs/governance/adr-policy.md`
  - Create: `docs/examples/maintainer/2026-03-21-runtime-hardening-walkthrough.md`

## Execution Rules

- Do not introduce a third operating lane.
- Do not rename `/quick-task`, `/delivery`, or the `quick` / `full` mode enums in this plan.
- Do not claim build, lint, or app-test commands that the repository still does not define.
- Prefer additive runtime checks over broad rewrites.
- Keep docs, runtime behavior, and tests in the same task whenever a contract changes.
- Do not create git commits during execution unless the user explicitly asks for them.

## Tasks

### Task 1: Canonicalize the workflow contract and remove contradictory prose

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `context/navigation.md`
- Modify: `context/core/workflow.md`
- Modify: `context/core/approval-gates.md`
- Modify: `context/core/issue-routing.md`
- Modify: `context/core/session-resume.md`
- Modify: `context/core/project-config.md`
- Modify: `context/core/workflow-state-schema.md`

- [ ] **Step 1: Build a contradiction checklist before editing docs**

Review and note disagreements across `AGENTS.md`, `README.md`, `context/core/workflow.md`, `context/core/approval-gates.md`, `context/core/issue-routing.md`, and `context/core/session-resume.md` for:
- whether `Quick Task+` is future-only or already live
- whether `quick_plan` is mandatory or optional
- whether current source-of-truth language points to current-state docs or roadmap docs

Expected output: a short working checklist in the scratchpad or task notes; no repo file required yet.

- [ ] **Step 2: Explicitly resolve the `Quick Task+` status decision for this slice**

Before broad doc edits, decide and record one of these outcomes based on the actual repository reality:
- `Quick Task+` is live successor semantics now and all contract surfaces must say so consistently
- `Quick Task+` remains future-only and all contract surfaces must say so consistently

Apply the same decision everywhere touched in this plan. Do not leave mixed wording behind.

- [ ] **Step 3: Make `context/core/workflow.md` the canonical workflow-semantics document under `AGENTS.md` authority**

Edit `context/core/workflow.md` so it alone defines:
- live lane names
- stage sequences
- lane selection rules
- escalation rules
- approval gates
- quick-lane artifact expectations

Keep companion docs focused on their specialties instead of re-explaining lane law.
Keep `AGENTS.md` as the repository-wide authority that delegates detailed workflow semantics to `context/core/workflow.md`.

- [ ] **Step 4: Rewrite top-level docs to reference the canonical workflow doc instead of re-stating it**

Update `AGENTS.md`, `README.md`, and `context/navigation.md` to:
- state current reality once
- point readers to `context/core/workflow.md` for lane behavior
- separate current state from future direction using the same wording everywhere

- [ ] **Step 5: Trim companion workflow docs and schema docs down to their local concerns**

Update `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` so each file only covers its own domain and references `context/core/workflow.md` for shared workflow semantics.

- [ ] **Step 6: Verify the doc/schema set is contradiction-free**

Manual validation:
- read the touched docs end-to-end in one pass
- confirm there is exactly one definition for each of these topics: lane count, quick-lane semantics, mode enums, command names, escalation direction
- confirm `context/core/workflow.md`, `context/core/workflow-state-schema.md`, and `.opencode/lib/workflow-state-rules.js` agree on stage names, stage order, artifact slots, and approval keys
- confirm roadmap files are described as roadmap files, not live contract files

Validation command: none beyond manual review; this repo does not yet have a docs-lint command.

### Task 2: Thin agent and command contracts so they stop duplicating workflow law

**Files:**
- Modify: `agents/master-orchestrator.md`
- Modify: `agents/fullstack-agent.md`
- Modify: `agents/qa-agent.md`
- Modify: `commands/task.md`
- Modify: `commands/quick-task.md`
- Modify: `commands/delivery.md`
- Modify: `commands/write-plan.md`

- [ ] **Step 1: Mark each rule as either canonical workflow law or role-local behavior**

For each target file, label existing content into two buckets before editing:
- keep here because it is unique to the role or command
- move to reference because it duplicates `context/core/workflow.md`

- [ ] **Step 2: Rewrite `agents/master-orchestrator.md` as a routing contract, not a second workflow spec**

Keep only behavior unique to `MasterOrchestrator`:
- lane selection responsibility
- state update responsibility
- escalation ownership
- issue routing ownership

Replace repeated lane diagrams and repeated guardrails with short references to `context/core/workflow.md`.

- [ ] **Step 3: Rewrite `agents/fullstack-agent.md` and `agents/qa-agent.md` around execution and verification deltas**

Keep:
- what inputs each agent expects
- what outputs each agent produces
- what causes them to stop and escalate
- what verification evidence they must produce

Remove duplicated restatements of lane definitions and command surface where those already exist elsewhere.

- [ ] **Step 4: Rewrite command docs as thin entrypoint contracts**

Update `commands/task.md`, `commands/quick-task.md`, `commands/delivery.md`, and `commands/write-plan.md` so each command doc only states:
- when to use the command
- required preconditions
- which canonical docs to load
- what state transition or artifact action should happen
- what happens on rejection or escalation

- [ ] **Step 5: Perform a cross-file consistency pass**

Manual validation:
- confirm no command or agent doc invents a stage or rule not present in `context/core/workflow.md`
- confirm no file describes `Quick Task+` as a third lane
- confirm command docs and agent docs reference the same state transitions

### Task 3: Harden startup bootstrap and add automated drift detection to the runtime utility

**Files:**
- Modify: `hooks/session-start`
- Modify: `hooks/hooks.json` if bootstrap wiring changes are needed
- Create: `.opencode/lib/contract-consistency.js`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Modify: `.opencode/workflow-state.js`
- Modify: `.opencode/tests/workflow-state-cli.test.js`
- Create: `.opencode/tests/workflow-contract-consistency.test.js`
- Modify: `.opencode/tests/session-start-hook.test.js`
- Modify: `docs/operations/runbooks/workflow-state-smoke-tests.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests for bootstrap hardening and contract-consistency checks**

Create `.opencode/tests/workflow-contract-consistency.test.js` with cases for:
- missing referenced files in manifest or docs anchors
- active profile or runtime files missing from expected paths
- invariant mismatches across canonical docs and command docs for lane count, allowed mode enums, canonical stage names, preserved command names, and explicit `Quick Task+` non-third-lane markers
- commands or agents listed in `.opencode/opencode.json` but missing on disk
- schema/runtime parity mismatches across `context/core/workflow-state-schema.md` and `.opencode/lib/workflow-state-rules.js`

Extend `.opencode/tests/session-start-hook.test.js` with cases for:
- stronger runtime-status hints remaining visible at startup
- clearer resume guidance still pointing to the right canonical docs
- bootstrap output staying aligned with actual command names and stage names

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: FAIL because the new checker and CLI integration do not exist yet.

- [ ] **Step 2: Implement the smallest useful bootstrap hardening in `hooks/session-start`**

Update `hooks/session-start` and `hooks/hooks.json` only if needed so startup output becomes more enforceable and operator-friendly by:
- keeping runtime status and doctor hints explicit
- pointing resume guidance at the canonical workflow docs and current state file
- avoiding new behavior the repository cannot test

Keep this additive. Do not turn bootstrap into a hidden workflow engine.

- [ ] **Step 3: Implement a small contract-consistency helper**

Create `.opencode/lib/contract-consistency.js` that exposes focused checks for:
- file existence for runtime-manifest references
- file existence for command, agent, and hook surfaces
- stable contract invariants only: lane count, allowed mode enums, canonical quick/full stage names, command names, and explicit `Quick Task+` terminology guardrails
- schema/runtime parity for stage sequences, approval keys, and artifact slots

Keep the checker string-based and narrow. Do not build a general Markdown parser or generic wording-police logic. Prefer explicit file-existence checks and a tiny set of machine-checked literals from clearly named canonical files.

- [ ] **Step 4: Surface these checks through the existing runtime CLI**

Extend `.opencode/lib/workflow-state-controller.js` and `.opencode/workflow-state.js` so `doctor` includes contract-consistency results. Prefer expanding `doctor` over inventing a separate command unless the output becomes unreadable.

- [ ] **Step 5: Update CLI, bootstrap, and consistency tests until they pass**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS for the CLI, bootstrap, and consistency cases added in this task.

- [ ] **Step 6: Document the new bootstrap and drift-detection behavior**

Update `README.md` and `docs/operations/runbooks/workflow-state-smoke-tests.md` so maintainers know:
- startup output is intentionally aligned with the canonical workflow surfaces
- `doctor` now checks contract drift, not only file presence

### Task 4: Expand workflow behavior tests beyond utility coverage

**Files:**
- Modify: `.opencode/tests/workflow-state-controller.test.js`
- Modify: `.opencode/tests/session-start-hook.test.js`
- Modify: `.opencode/tests/workflow-state-cli.test.js`
- Create: `.opencode/tests/workflow-behavior.test.js`
- Modify: `.opencode/lib/workflow-state-controller.js` if new failing tests reveal missing behavior support

- [ ] **Step 1: Write failing tests for the highest-risk workflow behaviors**

Add `.opencode/tests/workflow-behavior.test.js` coverage for:
- quick-mode start enters `quick_intake`
- quick-mode stage flow requires `quick_plan` before `quick_build`
- `design_flaw` and `requirement_gap` escalate from quick to full
- quick mode cannot silently absorb cross-boundary scope expansion
- full mode cannot downgrade back to quick
- session-start resume hints stay aligned with real stage names

- [ ] **Step 2: Run the suite and inspect the first failing behavior**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: FAIL with a concrete behavior mismatch. Fix one mismatch at a time.

- [ ] **Step 3: Implement the smallest runtime change required per failing behavior**

Update `.opencode/lib/workflow-state-controller.js` only where the failing tests prove the current runtime does not support the documented behavior.

- [ ] **Step 4: Re-run targeted tests, then the full suite**

Run targeted test files first, then:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

- [ ] **Step 5: Tighten test readability after behavior is stable**

Extract shared temp-project setup only if duplication makes the test files harder to understand. Do not refactor test helpers preemptively.

### Task 5: Add lightweight artifact scaffolding and auto-linking

**Files:**
- Create: `.opencode/lib/artifact-scaffolder.js`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Modify: `.opencode/workflow-state.js`
- Modify: `docs/templates/implementation-plan-template.md`
- Modify: `docs/templates/quick-task-template.md`
- Create: `.opencode/tests/artifact-scaffolder.test.js`
- Modify: `README.md`
- Modify: `context/core/project-config.md`

- [ ] **Step 1: Define the intentionally supported artifact kinds and state-slot mapping**

Before implementing code, write down the initial supported scope and keep it narrow:
- `task_card` -> `docs/templates/quick-task-template.md`
- `plan` -> `docs/templates/implementation-plan-template.md`

Document which workflow-state slot each scaffolded artifact links to, which kinds remain out of scope for this pass, and what happens when a slot is already populated.

Required rule for this pass:
- unsupported kinds must fail without mutating state
- populated slots must fail with a clear error unless an explicit future overwrite flag is added in a separate task

- [ ] **Step 2: Write failing tests for scaffold-and-link behavior**

Create `.opencode/tests/artifact-scaffolder.test.js` with cases for:
- creating a quick-task card from `docs/templates/quick-task-template.md`
- creating an implementation plan from `docs/templates/implementation-plan-template.md`
- auto-linking the created artifact path into workflow state
- refusing unsupported artifact kinds with a clear error
- refusing to overwrite an already populated artifact slot
- confirming unsupported or rejected scaffolds do not mutate state

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: FAIL because scaffold support does not exist yet.

- [ ] **Step 3: Implement a minimal artifact scaffolder**

Create `.opencode/lib/artifact-scaffolder.js` that:
- loads a supported template
- fills basic placeholders such as date, slug, and feature fields
- writes the artifact only when the parent directory exists
- returns the created path for state linking

Keep scope tight. Do not generate every artifact type in the first pass if quick-task card and implementation plan cover the immediate gap.

- [ ] **Step 4: Add CLI support for artifact creation and linking**

Extend `.opencode/workflow-state.js` and `.opencode/lib/workflow-state-controller.js` with a narrow command such as:
```bash
node .opencode/workflow-state.js scaffold-artifact <kind> <slug>
```

Behavior:
- create the artifact from the mapped template
- link it into workflow state when the kind maps to a known artifact slot
- print the created path

- [ ] **Step 5: Update templates so the scaffold output is useful, not placeholder-heavy**

Refresh `docs/templates/implementation-plan-template.md` and `docs/templates/quick-task-template.md` so the first generated draft already contains the minimum fields an agent needs.

- [ ] **Step 6: Re-run scaffold tests and the full runtime suite**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

### Task 6: Deepen operator guidance, adoption flow, and known limits

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/README.md`
- Modify: `docs/operations/runbooks/workflow-state-smoke-tests.md`
- Modify: `docs/examples/README.md`
- Modify: `docs/governance/README.md`
- Modify: `docs/governance/adr-policy.md`
- Create: `docs/examples/maintainer/2026-03-21-runtime-hardening-walkthrough.md`

- [ ] **Step 1: Add a maintainer-first startup path to `README.md`**

Document the smallest honest workflow for a new adopter:
- inspect runtime status
- run `doctor`
- inspect current workflow state
- scaffold a task artifact if needed
- understand the repo's current validation limits

- [ ] **Step 2: Turn operations docs into runnable checklists**

Update `docs/operations/README.md` and `docs/operations/runbooks/workflow-state-smoke-tests.md` so they describe concrete checks with exact commands:
```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
node .opencode/workflow-state.js show
node --test ".opencode/tests/*.test.js"
```

- [ ] **Step 3: Add guidance for avoiding future drift**

Update `docs/governance/README.md` and `docs/governance/adr-policy.md` with rules for when changes require:
- canonical workflow doc updates
- runtime test updates
- `doctor` consistency-check updates
- ADRs versus smaller doc-only changes

- [ ] **Step 4: Add one realistic walkthrough example**

Create `docs/examples/maintainer/2026-03-21-runtime-hardening-walkthrough.md` showing one full maintenance flow from status check to doctor to artifact scaffold to verification.

- [ ] **Step 5: Review all operator docs for honesty and scope control**

Manual validation:
- confirm no doc promises package installation, remote sync, CI, or multi-task concurrency that the repo still does not implement
- confirm current limitations are explicit, especially the single-work-item state model and missing app-level build/lint/test commands

### Task 7: Final integration pass and release-readiness audit

**Files:**
- Modify: any touched file that still fails the final audit

- [ ] **Step 1: Run the full runtime verification suite**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

- [ ] **Step 2: Run the runtime inspection commands as a human-facing smoke test**

Run:
```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
node .opencode/workflow-state.js show
```
Expected:
- commands exit successfully when the repo is healthy
- output shows the active profile, workflow state, and contract checks clearly

- [ ] **Step 3: Perform a final contradiction sweep across the key docs**

Read `AGENTS.md`, `README.md`, `context/navigation.md`, `context/core/workflow.md`, `agents/master-orchestrator.md`, `commands/quick-task.md`, and `commands/delivery.md` together and confirm they tell the same story.

- [ ] **Step 4: Record what changed and what still remains out of scope in the final delivery summary**

Prepare a concise implementation summary that states:
- what redundancy was intentionally removed
- which missing capabilities were added
- which gaps remain deferred, such as multi-task concurrency or broader installer mechanics

Only update `docs/operations/internal-records/decision-log.md` or `docs/operations/internal-records/review-history.md` if an existing governance or operations rule explicitly requires it for the changes actually made.

- [ ] **Step 5: Prepare execution handoff notes**

Document:
- any follow-on tasks that should become separate features
- any runtime checks that still rely on manual review
- whether the repository is ready for a later PR or branch-finishing flow
- confirm the final docs do not claim installer, setup, CI, remote sync, or broader productization capabilities beyond the existing Node-based runtime utilities

## Risks

- Over-correcting duplication could strip too much context from agent docs and make them less usable in isolation.
- Drift-detection checks could become brittle if they try to parse too much natural-language documentation.
- Artifact scaffolding could over-expand the runtime utility if too many artifact kinds are added at once.
- The repository may still look more complete than it is if docs are updated faster than runtime checks and tests.

## Rollback Notes

- Revert canonical doc changes together if the new wording creates ambiguity about current versus future behavior.
- Revert consistency-check changes together with their tests if `doctor` becomes noisy or unreliable.
- Revert artifact scaffolding separately if template automation proves too broad for the first pass.
- Restore the last passing `node --test ".opencode/tests/*.test.js"` baseline before retrying any failed hardening slice.
