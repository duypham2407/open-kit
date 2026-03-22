---
artifact_type: implementation_plan
version: 1
status: draft
feature_id: FEATURE-004
feature_slug: absorb-reference-repos-and-delete-them
source_architecture: docs/architecture/2026-03-21-openkit-evolution-direction.md
owner: TechLeadAgent
approval_gate: tech_lead_to_fullstack
---

# Absorb Reference Repos And Delete Them Implementation Plan

> **For agentic workers:** REQUIRED: Use `skills/subagent-driven-development/SKILL.md` when subagents are available. Steps use checkbox syntax for tracking.

**Goal:** Absorb the highest-value remaining concepts from `OpenAgentsControl/` and `superpowers/` into OpenKit-native skills/docs/tests, then remove both reference folders from the repository.

**Architecture:** Preserve value by rewriting it into OpenKit-native surfaces rather than copying upstream raw plugin/install files. Improve local skills and operational docs first, then delete the reference corpora and verify the repository still passes its runtime test suite.

**Tech Stack:** Markdown skills/docs, Node.js workflow-runtime tests, git worktree-based implementation workflow

---

## Tasks

### [ ] Task 1: Add verification-before-completion as an OpenKit-native skill
- Files: `skills/verification-before-completion/SKILL.md`, `registry.json`, relevant docs if needed
- Goal: preserve the strongest remaining enforcement discipline from `superpowers/`
- Validation: skill content exists, is registered if appropriate, and is referenced honestly in docs if surfaced there

### [ ] Task 2: Upgrade existing debugging and subagent-development skills
- Files: `skills/systematic-debugging/SKILL.md`, `skills/subagent-driven-development/SKILL.md`
- Goal: absorb the best remaining execution/debugging discipline from `superpowers/` without turning OpenKit into a raw mirror
- Validation: doc review and consistency with OpenKit workflow terminology

### [ ] Task 3: Capture remaining OAC reference value in OpenKit-native docs
- Files: one new OpenKit-native doc under `docs/operations/` or `docs/architecture/`, plus `docs/operations/README.md` if needed
- Goal: preserve context-discovery/setup/eval ideas from `OpenAgentsControl/` as design guidance for future features
- Validation: new doc is concise, OpenKit-native, and does not imply unsupported runtime exists today

### [ ] Task 4: Preserve useful behavior-test ideas in current OpenKit docs/tests
- Files: `docs/operations/runbooks/workflow-state-smoke-tests.md`, `.opencode/tests/*.test.js` only if a high-value behavior check is added
- Goal: absorb useful test/eval ideas from upstream references into current OpenKit practice
- Validation: if tests are added, run `node --test ".opencode/tests/*.test.js"`

### [ ] Task 5: Delete `OpenAgentsControl/` and `superpowers/`, then run final verification
- Files: delete `OpenAgentsControl/`, delete `superpowers/`, update any docs that still present them as local reference folders if necessary
- Goal: make OpenKit self-contained and remove the in-repo upstream reference corpora
- Validation: `node --test ".opencode/tests/*.test.js"` and final git review
