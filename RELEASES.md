# Releases

## Latest

- [`0.3.35`](release-notes/0.3.35.md) - fix switch profiles shim
- npm latest: `@duypham93/openkit@0.3.35`
- git tag: `v0.3.35`

## Previous

- [`0.3.28`](release-notes/0.3.28.md) - add explicit retained worktree launch controls and fix verify/runtime status handling
- npm latest: `@duypham93/openkit@0.3.28`
- git tag: `v0.3.28`

## History

Historical release notes tracked in-repo:

- [`0.3.35`](release-notes/0.3.35.md) - fix switch profiles shim
- [`0.3.34`](release-notes/0.3.34.md) - fix managed kit module boundary
- [`0.3.33`](release-notes/0.3.33.md) - add agent model profiles
- [`0.3.32`](release-notes/0.3.32.md) - fix strict OpenCode config permissions
- [`0.3.31`](release-notes/0.3.31.md) - add default command permission policy
- [`0.3.30`](release-notes/0.3.30.md) - harden capability platform readiness surfaces
- [`0.3.29`](release-notes/0.3.29.md) - add OpenClaw supervisor dialogue and structured scan evidence gates
- [`0.3.28`](release-notes/0.3.28.md) - add explicit retained worktree launch controls and fix verify/runtime status handling
- [`0.3.27`](release-notes/0.3.27.md) - require quick-task alignment before option analysis and plan confirmation
- [`0.3.26`](release-notes/0.3.26.md) - fix global MCP bridge startup and publish plugin runtime surfaces
- [`0.3.25`](release-notes/0.3.25.md) - fix openkit MCP project install and harden doctor/runtime path checks
- [`0.3.24`](release-notes/0.3.24.md) - enable default Chrome DevTools MCP and harden artifact scaffold template fallback for managed/global runtime paths
- [`0.3.23`](release-notes/0.3.23.md) - enforce hard runtime blocking for default tools and OS command shortcuts; require kit tools
- [`0.3.22`](release-notes/0.3.22.md) - add MCP server bridge to expose kit tools to OpenCode agents
- [`0.3.21`](release-notes/0.3.21.md) - harden tooling-first prompt enforcement and runtime guardrails
- [`0.3.20`](release-notes/0.3.20.md) - complete code-intelligence gap remediation phases 1-6
- [`0.3.19`](release-notes/0.3.19.md) - add configure-embedding CLI command and end-to-end semantic embedding search
- [`0.3.18`](release-notes/0.3.18.md) - migrate the checked-in .opencode runtime, CLI, and tests to native ESM
- [`0.3.17`](release-notes/0.3.17.md) - roll forward the published OpenKit package version metadata for the next npm release
- [`0.3.16`](release-notes/0.3.16.md) - normalize runtime error responses across profile switching, syntax indexing, and launchers
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
