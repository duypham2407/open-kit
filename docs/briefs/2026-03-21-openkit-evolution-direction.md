---
artifact_type: product_brief
version: 1
status: draft
feature_id: FEATURE-002
feature_slug: openkit-evolution-direction
source_request: "Convert the repository analysis into a formal ADR and spec, and evolve the quick lane into Quick Task+ while keeping Full Delivery for heavier work."
owner: PMAgent
approval_gate: pm_to_ba
---

# Product Brief: OpenKit Evolution Direction

## Goal

Define the next product direction for OpenKit so the repository can evolve from a strong workflow concept into a more complete operating kit for OpenCode.

## Target Users

- OpenKit maintainer
- Contributors extending agents, skills, commands, and runtime behavior
- Teams adopting OpenKit as a reusable software-delivery kit

## Problem Statement

OpenKit already has a credible workflow architecture, but it is still comparatively weaker as a runtime product. The repository needs a clear direction for how to improve installability, runtime enforcement, workflow verification, and quick-lane usefulness without losing the current hard split between quick and full delivery.

## High-Level Features
- [x] Capture repository analysis as durable artifacts
- [x] Compare OpenKit against `OpenAgentsControl` and `superpowers`
- [x] Define `Quick Task+` as the proposed evolution of the quick lane
- [x] Preserve `Full Delivery` for heavy, ambiguous, or architecture-relevant work
- [x] Establish a roadmap for runtime productization and workflow hardening

## Priorities
- P0: Record the strategic direction in repo-native artifacts
- P1: Clarify the proposed future role of `Quick Task+`
- P1: Identify runtime and workflow gaps that should shape follow-on architecture work
- P2: Improve onboarding and productization after core lane and runtime decisions are clarified

## Success Metrics

- Maintainers can use the brief, ADR, and spec as inputs for architecture and planning work.
- The proposed direction clearly separates current repository reality from future intended changes.
- `Quick Task+` is framed as a practical upgrade path without introducing a third lane.

## Out of Scope

- Implementing runtime productization changes
- Updating workflow state, commands, hooks, or tests in this artifact alone
- Replacing the hard-split model with a single adaptive workflow

## Open Questions

- Should `Quick Task+` remain a semantic evolution of the existing quick lane or also become a user-facing rename?
- Which runtime surfaces should be considered mandatory in the first hardening phase?
