# Releases

## Latest

- [`0.3.15`](release-notes/0.3.15.md) - harden codemod boundaries, audit failure handling, and managed-kit runtime parity
- npm latest: `@duypham93/openkit@0.3.15`
- git tag: `v0.3.15`

## History

Historical release notes tracked in-repo:

- [`0.3.15`](release-notes/0.3.15.md) - harden codemod boundaries, audit failure handling, and managed-kit runtime parity
- [`0.3.14`](release-notes/0.3.14.md) - add managed AST, syntax, audit, codemod, and profile-switch runtime capabilities
- [`0.3.12`](release-notes/0.3.12.md) - teach global doctor to flag missing migration templates as stale-kit drift
- [`0.3.11`](release-notes/0.3.11.md) - harden Master Orchestrator as a routing-only boss role that never codes
- [`0.3.10`](release-notes/0.3.10.md) - lock Product Lead -> Solution Lead sequencing and add explicit OpenCode permission defaults
- [`0.3.9`](release-notes/0.3.9.md) - clarify managed path boundaries across runtime, docs, and governance checks
- [`0.3.8`](release-notes/0.3.8.md) - harden global workflow-state shims and clarify canonical work-item paths
- [`0.3.7`](release-notes/0.3.7.md) - complete the hybrid runtime roadmap and publish the richer runtime/tooling surface
- [`0.3.6`](release-notes/0.3.6.md) - bundle default React and skill-discovery skills
- [`0.3.5`](release-notes/0.3.5.md) - package-first workflow cleanup and auto-scaffold visibility
- [`0.3.4`](release-notes/0.3.4.md) - complete AI-first surface cleanup and strict scope/solution vocabulary
- [`0.3.3`](release-notes/0.3.3.md) - complete package-first workflow hardening and governance alignment
- [`0.3.2`](release-notes/0.3.2.md) - refactor workflow ownership around Product Lead, Solution Lead, and explicit review gates
- [`0.3.1`](release-notes/0.3.1.md) - preserve per-agent model overrides during `openkit upgrade`
- [`0.3.0`](release-notes/0.3.0.md) - harden runtime governance and add release workflow
- [`0.2.15`](release-notes/0.2.15.md) - conditional parallel execution for full and migration
- [`0.2.14`](release-notes/0.2.14.md) - OpenSpec-inspired UX and runtime guidance uplift
- [`0.2.13`](release-notes/0.2.13.md) - trim published package contents
- [`0.2.12`](release-notes/0.2.12.md) - soft fallback for interactive model discovery when verbose metadata is unavailable
- [`0.2.11`](release-notes/0.2.11.md) - dynamic model variant discovery from `opencode models --verbose`
- [`0.2.10`](release-notes/0.2.10.md) - interactive per-agent model setup and persisted overrides
- [`0.2.9`](release-notes/0.2.9.md) - runtime hardening, non-mutating doctor checks, and wrapper warning fixes
- [`0.2.8`](release-notes/0.2.8.md) - historical baseline summary for the early global-kit operator flow

## Workflow

Recommended workflow for future releases:

1. Copy `release-notes/TEMPLATE.md` to `release-notes/<version>.md`.
2. Fill in the release-specific changes, validation notes, and npm package version.
3. Commit the release notes file before or alongside the related tag/release work.
