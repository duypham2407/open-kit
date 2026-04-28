---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-951
feature_slug: release-package-readiness-mcp-secret-backends
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - FEATURE-941 MCP + Skills Capability Pack
  - FEATURE-945 Interactive MCP Setup Wizard
  - FEATURE-948 Custom MCP Add And Import
  - FEATURE-949 Capability Router Session-Start Integration
  - FEATURE-950 Keychain MCP Secret Backend
---

# Scope Package: Release Package Readiness For MCP Secret Backends

OpenKit needs release hardening that proves the MCP secret-backend work delivered through the recent capability pack, custom MCP, session guidance, and keychain series is present and safe after packaging and global installation, not just when running from repository source. This scope keeps the behavior from FEATURE-950 intact while adding package/install readiness expectations around included files, validation gates, operator docs, and no-secret packaging guarantees.

## Goal

- Ensure packaged and globally installed OpenKit includes the MCP secret backend code, keychain adapter, docs, runtime pieces, and validation guidance needed by installed operators.
- Define release/package/install validation expectations for MCP secret backend surfaces, including `npm pack` or equivalent package-content checks and global CLI install/use boundary checks.
- Preserve the existing `local_env_file` default and opt-in `keychain` behavior from FEATURE-950.
- Keep release confidence evidence separated by `package`, `global_cli`, `runtime_tooling`, `documentation`, `compatibility_runtime`, and unavailable `target_project_app` surfaces.

## Non-Goals

- Do not add a new MCP secret backend or expand the keychain feature beyond release/package readiness.
- Do not change FEATURE-950 operator behavior, precedence, command grammar, or default store semantics except to document/validate them at packaging and install boundaries.
- Do not require real macOS Keychain mutation, GUI prompts, login-keychain access, or OS credential-store writes in CI.
- Do not add target-project application build, lint, test, smoke, or regression validation.
- Do not commit generated runtime state, real package tarballs, local secret stores, workflow runtime artifacts, or raw secret fixtures.

## Target Users

- **OpenKit release maintainer:** needs proof that the npm package and global install path include MCP secret backend runtime/docs, not only source-tree files.
- **Installed OpenKit operator:** expects `openkit configure mcp` and `openkit run` to preserve local env-file defaults and optional keychain semantics after `npm install -g @duypham93/openkit` or upgrade.
- **Security reviewer:** needs evidence that package/install checks cannot expose raw MCP secrets or secret-bearing generated files.
- **CI maintainer:** needs deterministic release gates that can run without mutating a real macOS Keychain.

## Problem Statement

FEATURE-950 validated MCP secret backends in the repository runtime and CLI, but release readiness also depends on what is packed, installed globally, materialized into the managed kit, documented for operators, and checked by release gates. Without explicit package/install validation, OpenKit could ship with missing keychain adapter files, stale operator docs, incomplete install-bundle metadata, or misleading validation evidence while source-tree tests still pass.

## In Scope

- Define and, during solution/implementation, add package-content validation for files needed by MCP secret backends after `npm pack` or an equivalent package-manifest/package-list inspection.
- Confirm package inclusion for at least:
  - MCP secret manager and backend adapter source, including the keychain adapter.
  - CLI/runtime pieces used by `openkit configure mcp`, `openkit run`, MCP health/read models, and package/global install materialization.
  - Operator, maintainer, governance, template, and runtime-surface docs that installed OpenKit needs for MCP secret backend guidance.
  - Existing install-bundle assets where the installed profile depends on them.
- Define release gates that distinguish source tests from package/global install behavior.
- Add or update operator/maintainer docs so release validation explains package contents, global install checks, keychain mock/fake requirements, redaction checks, and unavailable target-project app validation.
- Add test/gate expectations for no raw secret values in package contents, generated install bundle assets, docs examples, workflow evidence, logs, and package metadata.
- Ensure package/global checks preserve existing `local_env_file` default behavior and `keychain` opt-in behavior without requiring real Keychain access.
- Ensure generated artifacts used only for verification, such as pack tarballs, extracted package directories, temporary OpenCode homes, mock secret stores, runtime databases, or workflow-state outputs, are temporary or ignored and not committed.

## Out Of Scope

- Implementing Linux Secret Service, Windows Credential Manager, cloud vaults, password-manager integrations, rotation, or enterprise secret governance.
- Changing `openkit configure mcp set-key`, `unset-key`, `list-key`, `copy-key`, `repair`, `doctor`, `test`, interactive wizard, or `openkit run` semantics beyond validation/docs needed for release readiness.
- Replacing the existing npm package layout or global install strategy unless Solution Lead finds a packaging defect that blocks the scoped readiness goals.
- Adding real provider/network MCP tests that require live API keys.
- Adding or claiming target-project application validation.
- Publishing a release, changing package version, creating release notes, or committing package tarballs as part of this feature unless separately requested.

## User Stories

1. **As a release maintainer, I want package-content checks for MCP secret backend files, so that shipped OpenKit contains the same backend/runtime/docs surfaces validated in source.**
2. **As an installed OpenKit operator, I want global CLI checks to cover MCP secret backend behavior, so that install and upgrade paths do not silently lose keychain or local-env fallback support.**
3. **As a security reviewer, I want release gates to prove raw secrets are absent from packaged files and generated install assets, so that packaging does not leak credentials.**
4. **As a CI maintainer, I want keychain-related package/global checks to use fake adapters or structural validation, so that CI never mutates a real macOS Keychain.**

## Business Rules

### Release Hardening Boundary

- This feature is release hardening for existing MCP secret backend behavior, not a new user-facing secret backend expansion.
- Acceptance must be satisfied by package/install/readiness checks, docs, and tests that make shipped behavior inspectable.
- If Solution Lead discovers a missing package inclusion or install behavior defect, fixing that defect is in scope only when it is required for the existing MCP secret backend surfaces to ship correctly.

### Package Content Expectations

- Package validation must verify the npm package includes the source/runtime/docs files needed by installed OpenKit for MCP secret backends.
- The validation must include the keychain adapter path and any related secret-store adapter files needed for `keychain` opt-in behavior.
- Package validation must include the global CLI/runtime paths needed for `openkit configure mcp` and `openkit run` to access the MCP secret backend code after global install.
- Package validation must include relevant operator docs and maintained validation guidance needed by installed operators or maintainers.
- Package validation must detect missing required files, stale install-bundle assets, or docs/runtime drift where the installed package would behave differently from repository source.
- Package checks must not require storing package tarballs, extracted packages, or generated file lists in the repository.

### Secret Safety

- Raw secrets must never be committed, packaged, generated into install-bundle assets, printed in package/global install checks, or recorded in workflow evidence.
- Validation may use synthetic sentinel strings only when tests guarantee those strings are absent from packaged files, docs examples, generated profiles, logs, command output, and workflow artifacts outside controlled fake backend/process memory.
- Package scans must treat `secrets.env`, keychain payloads, local OpenCode home secret files, real `.env` files, runtime databases, and generated workflow/runtime state as forbidden package contents.
- Docs and tests must use placeholders such as `${CONTEXT7_API_KEY}` or `<CONTEXT7_API_KEY_VALUE>`, not raw-looking API keys or real tokens.

### Existing Behavior Preservation

- `local_env_file` remains the default MCP secret store when no store is explicitly requested.
- `keychain` remains opt-in and macOS-only/unavailable elsewhere unless a future approved feature changes that behavior.
- `openkit run` keeps FEATURE-950 precedence: shell/process environment, then metadata-gated keychain value, then local env file fallback.
- Unsupported or unavailable keychain paths must fail closed and must not silently write to `local_env_file`.
- Package/global checks must not reinterpret direct OpenCode launches as automatically loading OpenKit-managed local or keychain secrets.

### CI And Install Validation

- CI/package/global checks must not mutate a real macOS Keychain.
- Keychain package/global readiness may be validated through fake adapters, injected platform/runner behavior, structural package checks, mocked temporary OpenCode homes, or non-mutating availability checks.
- Global install validation must use temporary install/workspace homes or otherwise isolated state so release tests do not depend on or mutate the maintainer's real OpenCode home.
- If a package/global check cannot safely run in CI, the solution must define a non-mutating substitute gate and document the limitation.

### Validation Surface Labels

- `package` evidence proves package contents, install-bundle/source synchronization, and npm pack/package-list readiness.
- `global_cli` evidence proves installed/global CLI behavior such as `openkit configure mcp`, `openkit doctor`, and `openkit run` boundaries.
- `runtime_tooling` evidence proves OpenKit runtime tools/read models and fake adapter behavior.
- `documentation` evidence proves operator/maintainer/runbook guidance.
- `compatibility_runtime` evidence proves workflow-state/readiness/evidence integrity only.
- `target_project_app` validation remains unavailable unless a separate target project defines real app-native build/lint/test/smoke commands.

## Acceptance Criteria Matrix

### Package Contents

- **Given** a release maintainer runs the package-content gate, **when** the package file list is inspected, **then** required MCP secret backend source files, including the keychain adapter and related secret-store modules, are present in the package.
- **Given** a release maintainer runs the package-content gate, **when** global CLI/runtime files are inspected, **then** the package includes the files needed for `openkit configure mcp`, MCP health/read models, `openkit run`, and global install materialization to use the existing MCP secret backend behavior.
- **Given** docs and install-bundle assets are part of the installed operator experience, **when** package validation runs, **then** required MCP secret backend docs and install-bundle assets are present or the gate fails with a missing/stale package-surface error.
- **Given** a required backend/runtime/docs file is removed from package inclusion, **when** the package-content gate runs, **then** it fails before release readiness can be claimed.

### Global Install And CLI Boundaries

- **Given** OpenKit is installed or simulated through the package/global install path in isolated state, **when** `openkit configure mcp` help/list/doctor or equivalent safe commands are checked, **then** MCP secret backend surfaces remain visible with redacted key state and no raw secret output.
- **Given** package/global checks exercise MCP secret backend behavior, **when** no store is explicitly selected, **then** the checks preserve `local_env_file` as the default/fallback path.
- **Given** package/global checks exercise keychain behavior, **when** keychain is selected in CI or a non-keychain environment, **then** tests use fake/structural checks or report sanitized unavailable state without real Keychain mutation.
- **Given** `openkit run` package/global behavior is checked with fake or temporary secret state, **when** shell env, keychain metadata, and local env file values are represented, **then** evidence confirms the documented precedence without printing resolved values.

### No Raw Secret Leakage

- **Given** package-content validation scans package files and generated install assets, **when** sentinel or token-like values are searched for through approved test mechanisms, **then** raw secrets are absent outside controlled fake backend/process-only test paths.
- **Given** docs examples, help text, package metadata, generated profiles, workflow evidence, and test snapshots are inspected, **when** they mention MCP keys, **then** they use placeholders/redacted state only and never raw credentials.
- **Given** temporary package/global install checks create tarballs, extracted package directories, temporary OpenCode homes, mock secret files, logs, or runtime databases, **when** validation completes, **then** those artifacts are not committed and are either cleaned up or ignored.

### Release Gate Documentation

- **Given** an operator or maintainer reads release/package readiness guidance, **when** MCP secret backends are involved, **then** the guidance explains which package, global CLI, runtime, documentation, and compatibility checks apply.
- **Given** target-project app-native commands are absent, **when** release evidence is reported, **then** target-project app validation is explicitly classified as unavailable and not replaced with OpenKit CLI/runtime/package checks.
- **Given** the release gate depends on package checks, **when** the maintainer follows the documented validation path, **then** commands or steps distinguish `npm pack`/package-content evidence from source-tree tests and install-bundle sync evidence.

### Existing Behavior Regression Safety

- **Given** existing FEATURE-950 tests for local env-file and keychain behavior still exist, **when** the release readiness validation set runs, **then** those behavior checks remain included or are covered by an equivalent documented gate.
- **Given** unsupported platform/keychain-unavailable behavior is validated, **when** package/global checks run, **then** there is no silent fallback write to `local_env_file` and no real keychain mutation.
- **Given** direct OpenCode launch guidance is packaged, **when** docs/help are inspected, **then** they continue to state that direct OpenCode launches do not automatically load OpenKit-managed local/keychain secrets.

## Edge Cases And Risks

- `package.json` may include broad directories while install-bundle materialization uses a narrower asset manifest; both surfaces can pass different checks unless evidence names the surface precisely.
- Keychain adapter files may exist in source but be absent from the packed npm artifact if package inclusion rules change.
- Docs may be updated in source but absent or stale in install-bundled assets used by installed operators.
- Package-content checks that create tarballs can accidentally leave generated tarballs or extraction directories in the repo.
- Sentinel-secret tests can create false confidence if they scan only source files and not package output, generated profiles, logs, or install assets.
- Global install tests can mutate a developer's real OpenCode home unless isolated state is mandatory.
- CI may run on non-macOS, so keychain behavior must be validated through fake/structural checks rather than real OS prompts.
- Target-project app validation can be mislabeled if OpenKit runtime/package checks are reported without surface labels.

## Error And Failure Cases

- Required package file missing: gate fails with the missing path(s) and `package` surface label.
- Stale install-bundle asset: gate fails and instructs maintainers to refresh or intentionally exclude the asset.
- Raw secret or token-like value detected in package output/docs/generated assets: gate fails and blocks release readiness until removed or proven placeholder-only.
- Package/global validation attempts real keychain mutation in CI: gate fails or is rejected as invalid evidence.
- Temporary global install state cannot be isolated: report blocker or use a documented non-mutating substitute; do not mutate real user config.
- `npm pack` or equivalent package-list inspection is unavailable in the environment: report the unavailable package gate and define the substitute evidence explicitly; do not claim package readiness from source tests alone.
- Generated tarballs, extracted packages, runtime DBs, local secret files, or workflow artifacts appear as untracked/committable artifacts: treat as cleanup/release-blocking until removed or ignored by an approved policy.

## Open Questions And Assumptions

- Assumption: the current npm package `files` allowlist remains the intended package inclusion mechanism unless Solution Lead finds a defect.
- Assumption: existing `npm run verify:install-bundle`, install tests, global tests, and FEATURE-950 MCP tests are available OpenKit validation surfaces, but they may need targeted package/global assertions for this release-readiness scope.
- Assumption: package-content validation can be implemented with `npm pack --dry-run --json`, `npm pack` into a temporary directory, or another equivalent non-committed package-list mechanism selected by Solution Lead.
- Open question for Solution Lead: decide whether to add a dedicated script for MCP secret backend package readiness or fold the assertions into existing package/install gates.
- Open question for Solution Lead: decide the exact required-file list for package validation, including whether install-bundle assets need new MCP-specific entries beyond current source/docs packaging.
- Open question for Solution Lead: decide how to isolate global install checks so they prove installed behavior without mutating the maintainer's real OpenCode home.

## Success Signal

- A maintainer can run documented release/package readiness checks that prove the npm package and global install path include MCP secret backend runtime/docs, preserve FEATURE-950 defaults and keychain opt-in behavior, use fake/non-mutating keychain validation, expose no raw secrets, avoid committed generated artifacts, and report target-project app validation as unavailable.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `package` | Validate npm package contents or equivalent package file list for MCP secret backend source/runtime/docs, keychain adapter inclusion, forbidden secret/runtime artifacts, no raw sentinel values, and install-bundle/source synchronization where relevant. |
| `global_cli` | Validate installed or install-simulated `openkit configure mcp`, `openkit doctor`, and `openkit run` boundaries in isolated state, preserving `local_env_file` default, `keychain` opt-in/unavailable behavior, redacted output, direct OpenCode caveat, and no real keychain mutation. |
| `runtime_tooling` | Validate fake/mock keychain adapter behavior, MCP health/read models, redaction, and any runtime package-readiness helpers without raw values. |
| `documentation` | Validate operator, maintainer, supported-surface, test-matrix, and release/readiness docs describe package/global checks, keychain CI mocking, no-secret packaging, generated-artifact cleanup, and validation surface boundaries. |
| `compatibility_runtime` | Validate workflow-state/evidence/readiness records only for OpenKit workflow integrity and surface labeling; do not treat them as package or target app proof unless they reference real package/global evidence. |
| `target_project_app` | Unavailable unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit package, global CLI, runtime, MCP, governance, or workflow checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Keep the solution focused on release/package/install hardening for the existing MCP secret backend surfaces; do not reopen FEATURE-950 product behavior unless a packaging defect requires a narrow fix.
- Define the package required-file list explicitly, including keychain adapter and MCP secret backend runtime/docs needed by installed OpenKit.
- Decide the safest package-content inspection mechanism and ensure generated tarballs/extractions are temporary, ignored, or cleaned up.
- Plan global CLI/install checks with isolated OpenCode home/workspace state and fake/non-mutating keychain paths.
- Preserve `local_env_file` default, `keychain` opt-in, shell env > keychain > local env precedence, and direct OpenCode caveats.
- Include no-raw-secret assertions across package output, docs, generated profiles/assets, logs, workflow evidence, and test snapshots.
- Label every validation item by real surface and keep `target_project_app` explicitly unavailable.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the release-hardening problem, users, goals/non-goals, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/open questions, and Solution Lead handoff notes for `product_to_solution` review.
