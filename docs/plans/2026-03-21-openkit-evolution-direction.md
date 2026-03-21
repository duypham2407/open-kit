---
artifact_type: implementation_plan
version: 1
status: draft
feature_id: FEATURE-002
feature_slug: openkit-evolution-direction
source_architecture: docs/architecture/2026-03-21-openkit-evolution-direction.md
owner: TechLeadAgent
approval_gate: tech_lead_to_fullstack
---

# OpenKit Evolution Direction Implementation Plan

> **For agentic workers:** REQUIRED: Use `skills/subagent-driven-development/SKILL.md` when subagents are available. Steps use checkbox syntax for tracking.

**Goal:** Evolve OpenKit toward stronger runtime enforcement and a more capable `Quick Task+` lane while preserving the current hard-split model and repository honesty about existing tooling.

**Architecture:** Implement this as a sequence of small repository-level changes that first tighten artifact and workflow contracts, then harden runtime/bootstrap behavior, then expand tests and docs. Keep `Quick Task+` as the successor semantics of the existing quick lane rather than introducing a third mode.

**Tech Stack:** Markdown artifacts, OpenCode config and hooks, Node.js workflow-state utilities, Node test runner

---

## Goal

Translate the approved brief, spec, and ADR into an executable sequence of repository changes that can be implemented incrementally and reviewed safely.

## Dependencies

- Source brief: `docs/briefs/2026-03-21-openkit-evolution-direction.md`
- Source spec: `docs/specs/2026-03-21-openkit-improvement-analysis.md`
- Source architecture: `docs/architecture/2026-03-21-openkit-evolution-direction.md`
- ADR reference: `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md`
- Current authoritative workflow: `context/core/workflow.md`
- Current runtime manifest and state utilities: `.opencode/opencode.json`, `.opencode/workflow-state.js`, `.opencode/lib/`
- Validation path available today: `node --test ".opencode/tests/*.test.js"`

## Tasks

### [ ] Task 1: Align artifact and workflow contracts with the approved direction
- Files: `README.md`, `AGENTS.md`, `context/core/workflow.md`, `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/workflow-state-schema.md`, `context/navigation.md`, `docs/examples/README.md`
- Goal: update the repository's authoritative narrative so the future `Quick Task+` direction and runtime-hardening roadmap are recorded consistently without overstating current implementation status
- Validation: review changed docs for consistency with `docs/briefs/2026-03-21-openkit-evolution-direction.md`, `docs/specs/2026-03-21-openkit-improvement-analysis.md`, and `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md`
- Notes: preserve present-vs-future wording; do not claim `Quick Task+` is already live until supporting runtime changes land

- [ ] **Step 1: Review the approved brief, spec, architecture, and ADR**
- [ ] **Step 2: Review companion workflow-contract docs and explicitly identify which ones change in this phase versus remain unchanged**
- [ ] **Step 3: Update `context/core/workflow.md` and any affected companion workflow docs to describe the proposed successor semantics and implementation boundaries clearly**
- [ ] **Step 4: Confirm the terminology guardrail: `Quick Task+` is successor semantics for the existing quick lane, not a third mode, and current mode enums or command names stay stable unless a separate explicit change is approved**
- [ ] **Step 5: Update `README.md`, `AGENTS.md`, `context/navigation.md`, and `docs/examples/README.md` so framing and wayfinding match the new direction without overstating current runtime reality**
- [ ] **Step 6: Review the diff to confirm current-vs-future language stays explicit across all touched contract docs**

### [ ] Task 2: Strengthen quick-lane contracts in agents and commands
- Files: `agents/master-orchestrator.md`, `agents/fullstack-agent.md`, `agents/qa-agent.md`, `commands/task.md`, `commands/quick-task.md`, `commands/delivery.md`
- Goal: encode `Quick Task+` behavior as an explicit contract for routing, bounded planning, verification, and escalation while preserving the hard split with `Full Delivery`
- Validation: read updated agent and command files end-to-end; verify they agree on scope, escalation triggers, and expected quick-lane artifacts
- Notes: avoid introducing a third lane or conflicting command surface

- [ ] **Step 1: Define the exact quick-lane contract changes needed in `MasterOrchestrator`**
- [ ] **Step 2: Update `FullstackAgent` quick-mode instructions to support mini-plan or stronger verification semantics where appropriate**
- [ ] **Step 3: Update `QAAgent` QA Lite expectations to match the strengthened quick lane**
- [ ] **Step 4: Update `/task`, `/quick-task`, and `/delivery` command docs so entry behavior matches the revised lane model**
- [ ] **Step 5: Review all updated files together for contradiction-free routing rules**

### [ ] Task 3: Harden runtime bootstrap and operational discoverability
- Files: `hooks/session-start`, `hooks/hooks.json`, `.opencode/opencode.json`, `.opencode/workflow-state.js`, `.opencode/lib/` files as needed
- Goal: improve runtime trust by making startup guidance, state awareness, and operational inspection stronger and easier to use
- Validation: run `node --test ".opencode/tests/*.test.js"` and add/update tests for any changed runtime behavior
- Notes: keep runtime changes additive and explicit; do not invent unsupported infrastructure

- [ ] **Step 1: Inspect current hook and workflow-state code to identify the smallest useful runtime-hardening changes**
- [ ] **Step 2: Update bootstrap behavior so startup guidance better exposes state, context expectations, and skill/runtime hygiene**
- [ ] **Step 3: Define whether this phase adds runtime utility commands only, user-facing operational command docs, or both, and update the relevant surfaces together**
- [ ] **Step 4: Add or refine operational command support in existing runtime utilities if status or diagnostics behavior is introduced**
- [ ] **Step 5: Add or update tests that directly cover the changed bootstrap or state behavior**
- [ ] **Step 6: Run `node --test ".opencode/tests/*.test.js"` and confirm all tests pass**

### [ ] Task 4: Expand workflow-level verification coverage
- Files: `.opencode/tests/session-start-hook.test.js`, `.opencode/tests/workflow-state-controller.test.js`, additional `.opencode/tests/*.test.js` files as needed, plus any runtime or command-surface files required to satisfy newly added tests
- Goal: move beyond utility coverage toward behavior coverage for lane selection, escalation, approvals, and quick-lane semantics
- Validation: run `node --test ".opencode/tests/*.test.js"` after each new or changed test group
- Notes: prefer tests that validate observable repository behavior instead of implementation trivia

- [ ] **Step 1: Identify the highest-risk behavior gaps not currently covered by tests**
- [ ] **Step 2: Add failing tests for one behavior gap at a time**
- [ ] **Step 3: Implement the minimal code or doc-supported runtime change needed to satisfy each new test**
- [ ] **Step 4: Re-run the affected tests, then the full `.opencode/tests` suite**
- [ ] **Step 5: Review tests for readability and future maintainability**

### [ ] Task 5: Deepen productization and operational documentation
- Files: `docs/governance/README.md`, `docs/operations/README.md`, `README.md`, `docs/examples/`, and any new supporting docs required by the runtime changes
- Goal: make OpenKit easier for new maintainers and adopters to understand as a reusable operating kit
- Validation: review docs against the actual repository runtime surface and verify they do not claim unsupported capabilities
- Notes: prioritize operational clarity over marketing language

- [ ] **Step 1: Expand governance and operations docs beyond placeholder summaries**
- [ ] **Step 2: Document any new runtime commands, diagnostics, or bootstrap behavior introduced by earlier tasks**
- [ ] **Step 3: Refresh examples or wayfinding docs if the quick-lane narrative changes materially**
- [ ] **Step 4: Cross-check `README.md`, `AGENTS.md`, and supporting docs for consistency**
- [ ] **Step 5: Perform a final documentation pass focused on repository honesty and operator usability**

## Risks

- The repository may blur the line between implemented behavior and intended direction if docs and runtime do not evolve together.
- `Quick Task+` may become too broad unless escalation boundaries remain explicit in commands, agents, docs, and tests.
- Runtime hardening may drift into speculative infrastructure if tasks are not kept tightly scoped.

## Rollback Notes

- Revert the affected artifact and contract files together if the new direction causes contradiction or ambiguity.
- If runtime changes destabilize tests, revert the runtime change set and restore the previously passing `.opencode/tests` baseline before retrying.
