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

# OpenKit Evolution Direction Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use `skills/subagent-driven-development/SKILL.md` when subagents are available. Steps use checkbox syntax for tracking.

**Goal:** Complete the remaining FEATURE-002 phases by adding registry/profile-driven installation concepts, versioned install manifests, richer runtime observability, and explicit extension/distribution mechanics without changing the live two-lane contract.

**Architecture:** Build this as a thin productization layer on top of the existing runtime utility. Add a machine-readable registry, a checked-in install manifest, additive CLI commands for profile/install management, richer status/doctor output, and the docs/tests that make those surfaces trustworthy.

**Tech Stack:** JSON manifests, Node.js runtime utilities, Node test runner, Markdown docs

---

## Goal

Extend OpenKit from a stronger workflow/runtime kit into a more installable and inspectable operating kit while keeping the current `Quick Task` + `Full Delivery` contract live.

## Dependencies

- Source brief: `docs/briefs/2026-03-21-openkit-evolution-direction.md`
- Source spec: `docs/specs/2026-03-21-openkit-improvement-analysis.md`
- Source architecture: `docs/architecture/2026-03-21-openkit-evolution-direction.md`
- Existing implementation plan: `docs/plans/2026-03-21-openkit-evolution-direction.md`
- Current runtime utilities: `.opencode/workflow-state.js`, `.opencode/lib/workflow-state-controller.js`, `hooks/session-start`
- Current validation path: `node --test ".opencode/tests/*.test.js"`

## Tasks

### [ ] Task 6: Add registry and profile metadata
- Files: `registry.json`, `.opencode/opencode.json`, `.opencode/install-manifest.json`, `README.md`, `docs/governance/naming-conventions.md`
- Goal: define a machine-readable component registry and a checked-in install manifest that describe what OpenKit contains and which profile is active in this repository
- Validation: verify JSON structure manually and through CLI/tests added in later tasks
- Notes: keep this as an additive metadata layer; do not imply remote installation or external fetching yet

- [ ] **Step 1: Define the component categories and profiles that match the repository as it exists today**
- [ ] **Step 2: Create `registry.json` with component metadata, profile definitions, and versioned registry schema fields**
- [ ] **Step 3: Add `.opencode/install-manifest.json` describing the installed profile/components for this repo**
- [ ] **Step 4: Update `.opencode/opencode.json` only if explicit registry/install-manifest paths improve discoverability**
- [ ] **Step 5: Document the new metadata surfaces in the most relevant top-level docs**

### [ ] Task 7: Add profile/install/version commands to the runtime utility
- Files: `.opencode/lib/workflow-state-controller.js`, `.opencode/workflow-state.js`, `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/session-start-hook.test.js`
- Goal: expose profile-aware runtime commands so maintainers can inspect profiles, install or sync a local install manifest, and see profile/install-manifest info in runtime status
- Validation: follow TDD with focused CLI tests, then run `node --test ".opencode/tests/*.test.js"`
- Notes: keep commands additive; avoid building a network installer or pretending the repo can self-update remotely

- [ ] **Step 1: Write failing tests for profile listing, profile details, install-manifest creation/sync, and richer status/doctor output**
- [ ] **Step 2: Implement minimal controller helpers for registry/install-manifest loading and validation**
- [ ] **Step 3: Implement CLI commands such as `profiles`, `show-profile`, `version`, and `sync-install-manifest`**
- [ ] **Step 4: Extend `status`, `doctor`, and session-start output with profile/install-manifest visibility where useful**
- [ ] **Step 5: Re-run the full runtime test suite and keep output clean**

### [ ] Task 8: Refine observability and extension mechanics
- Files: `hooks/session-start`, `README.md`, `docs/operations/README.md`, `docs/operations/runbooks/workflow-state-smoke-tests.md`, `docs/operations/internal-records/decision-log.md`, `docs/operations/internal-records/review-history.md`, `docs/governance/adr-policy.md`
- Goal: make the new productization layer operationally understandable, including how to inspect install state and how to extend the kit safely
- Validation: docs review against the real command surface and runtime behavior; run runtime tests after any hook changes
- Notes: prefer explicit operational guidance over speculative roadmap prose

- [ ] **Step 1: Document the new profile/install-manifest workflow in README and operations docs**
- [ ] **Step 2: Update smoke-test guidance with profile/install-manifest commands and expected outputs**
- [ ] **Step 3: Clarify when profile/runtime changes need ADRs versus lighter decision logs**
- [ ] **Step 4: Add concise extension guidance for registering new agents, skills, commands, or docs in the registry**
- [ ] **Step 5: Re-check docs for honesty about current capabilities and limits**

### [ ] Task 9: Add final coverage and integration review for the productization layer
- Files: `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/session-start-hook.test.js`, optional shared test helpers if warranted
- Goal: ensure the new registry/install/profile layer is covered by realistic runtime tests and does not drift from docs
- Validation: run `node --test ".opencode/tests/*.test.js"` and perform a final cross-surface review
- Notes: only extract shared test helpers if duplication meaningfully hurts readability

- [ ] **Step 1: Add any missing negative-path tests for registry/install-manifest diagnostics**
- [ ] **Step 2: Add coverage for session-start output when profile/install-manifest data exists**
- [ ] **Step 3: Run the full runtime suite and inspect failures before making further changes**
- [ ] **Step 4: Perform a final consistency pass across docs, runtime, and tests**
- [ ] **Step 5: Record any non-blocking future follow-ups discovered during this pass**

## Risks

- The repository could overstate “installation” if profile support is described as more than local manifest/profile management.
- Registry and install-manifest concepts could drift from the actual checked-in repo structure if they are not tested and documented together.
- Runtime command growth could make `workflow-state.js` feel too broad unless output stays clear and well-scoped.

## Rollback Notes

- Revert registry/install-manifest metadata together with the CLI/docs changes if the new productization layer becomes inconsistent.
- If profile/install-manifest commands destabilize the runtime suite, revert those command additions and restore the prior passing test baseline before retrying.
