# Maintainer Guide

This directory is the maintainer-facing index layer for phase 1 information architecture.

Use it to find canonical repository docs and upkeep surfaces quickly. Do not treat it as a canonical replacement for the docs it points to.

## Phase-1 Authority Rule

- this directory is an index, not a relocated source-of-truth layer
- `AGENTS.md` remains the repository-wide rules and current-state guide
- `context/core/workflow.md` remains the canonical live workflow-semantics document
- companion operational details remain canonical in `context/core/`
- governance, operations, and artifact docs remain canonical in their existing directories

## Start Here

- Read `AGENTS.md` first for repository rules, tooling caveats, and authority order
- Read `context/navigation.md` next for context discovery across live and historical docs
- Read `context/core/project-config.md` when you need the maintained workflow-state command inventory

## Maintainer Routes

- Workflow semantics: `context/core/workflow.md`
- Approval rules: `context/core/approval-gates.md`
- Issue routing: `context/core/issue-routing.md`
- Session resume: `context/core/session-resume.md`
- Workflow-state schema: `context/core/workflow-state-schema.md`
- Governance policy: `docs/governance/README.md`
- Operations and diagnostics: `docs/operations/README.md`
- Artifact guidance: `docs/briefs/README.md`, `docs/specs/README.md`, `docs/architecture/README.md`, `docs/plans/README.md`, `docs/qa/README.md`, `docs/adr/README.md`, `docs/templates/README.md`

## Repository Internals To Keep Honest

- `.opencode/opencode.json` is still the live checked-in runtime manifest until a real root `opencode.json` exists
- `.opencode/workflow-state.json` remains the active compatibility mirror for the active work item
- `.opencode/work-items/` remains the per-item backing store for managed runtime state
- `registry.json` and `.opencode/install-manifest.json` remain additive local metadata, not destructive install machinery

## Historical And Roadmap References

- Use `docs/briefs/2026-03-21-openkit-evolution-direction.md`, `docs/specs/2026-03-21-openkit-improvement-analysis.md`, `docs/architecture/2026-03-21-openkit-evolution-direction.md`, and `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md` for maintainer rationale only
- Use `docs/archive/` for historical background only
- If historical guidance conflicts with checked-in runtime state, update docs to match reality rather than inventing missing infrastructure
