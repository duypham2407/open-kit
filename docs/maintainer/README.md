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
- Read `context/navigation.md` next for context discovery across live docs and retained artifact surfaces
- Read `context/core/project-config.md` when you need the maintained workflow-state command inventory
- Read `docs/maintainer/command-matrix.md` when you need a fast mapping from intent to command surface

## Maintainer Routes

- Workflow semantics: `context/core/workflow.md`
- Approval rules: `context/core/approval-gates.md`
- Issue routing: `context/core/issue-routing.md`
- Session resume: `context/core/session-resume.md`
- Workflow-state schema: `context/core/workflow-state-schema.md`
- Runtime surface contract: `context/core/runtime-surfaces.md`
- Role operating policy: `docs/maintainer/2026-03-26-role-operating-policy.md`
- AI surface map: `docs/maintainer/2026-03-26-ai-surface-map.md`
- Command matrix: `docs/maintainer/command-matrix.md`
- Conditional parallel execution boundary: `docs/maintainer/conditional-parallel-execution-note.md`
- Parallel execution matrix: `docs/maintainer/parallel-execution-matrix.md`
- Test matrix: `docs/maintainer/test-matrix.md`
- Role and skill matrix: `docs/maintainer/role-skill-matrix.md`
- Architecture overview: `docs/maintainer/architecture-overview.md`
- Policy traceability: `docs/maintainer/policy-execution-traceability.md`
- Governance policy: `docs/governance/README.md`
- Operations and diagnostics: `docs/operations/README.md`
- Release workflow smoke tests: `docs/operations/runbooks/release-workflow-smoke-tests.md`
- Artifact guidance: `docs/briefs/README.md`, `docs/scope/README.md`, `docs/architecture/README.md`, `docs/solution/README.md`, `docs/qa/README.md`, `docs/adr/README.md`, `docs/templates/README.md`

## Repository Internals To Keep Honest

- `.opencode/opencode.json` remains the checked-in repository-local OpenCode config even though the preferred end-user install path is now global
- `.opencode/workflow-state.json` remains the active compatibility mirror for the active work item
- `.opencode/work-items/` remains the per-item backing store for managed runtime state
- `registry.json` and `.opencode/install-manifest.json` remain additive local metadata, not destructive install machinery

## Global Install Notes

- The preferred end-user onboarding path is `npm install -g @duypham93/openkit` followed by `openkit run`.
- The first `openkit run` materializes the managed kit into the OpenCode home directory automatically.
- `openkit doctor` is a non-mutating check for the global install and current workspace readiness state.
- `openkit install-global`, `openkit install`, and `openkit init` remain available as manual or compatibility commands.
- The package intentionally avoids npm `postinstall` side effects; setup happens inside the OpenKit CLI where failures and recovery steps are easier to explain.

## Tool Delivery Boundary

- OpenKit currently has one first-class tool adapter: OpenCode.
- The canonical workflow, lane semantics, and runtime state remain tool-agnostic concepts, but delivery is currently implemented only for the OpenCode path.
- Adapter-friendly groundwork now exists in the codebase so future tool support can wrap the same workflow model without flattening OpenKit's lane-based architecture.

## Validation Story

- OpenKit validates its own runtime, CLI, install, and launch behavior through `tests/` and `.opencode/tests/`
- This repository still does not define repo-native build, lint, or test commands for arbitrary generated application code
- Keep those stories separate in docs, prompts, and reports so operators do not confuse kit health with target-project app validation

## One-Command Verification

- Run `npm run verify:all` for the current maintainer quality gate
- This command runs bundle drift checks, governance/enforcement checks, runtime CLI tests, install tests, global tests, and CLI tests
- Use `npm run verify:governance` when you only changed prompt contracts, metadata, or anti-hallucination docs
- Use `npm run verify:install-bundle` after prompt or bundle-source changes to ensure the derived install bundle is still aligned

## Release Process

- Historical release notes live in `RELEASES.md`.
- New release notes should start from `release-notes/TEMPLATE.md`.
- Fastest maintainer path:
  1. `openkit release prepare <version> --summary "<short summary>"`
  2. Fill in `release-notes/<version>.md`
  3. `openkit release verify`
  4. `openkit release publish`
- `openkit release publish` tags, pushes, publishes to npm, and creates a GitHub release automatically when `gh` is installed.
- If `gh` is unavailable, the publish step still completes npm release work and points maintainers at the generated release notes file for manual GitHub release drafting.

## Historical And Roadmap Notes

- Most historical planning and archive docs were intentionally pruned from the working tree during cleanup.
- Use git history when you need older rationale that is no longer kept as checked-in documentation.
- If older guidance conflicts with checked-in runtime state, update docs to match reality rather than inventing missing infrastructure.
