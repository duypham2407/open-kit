---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-950
feature_slug: keychain-mcp-secret-backend
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - FEATURE-941 MCP + Skills Capability Pack
  - FEATURE-945 Interactive MCP Setup Wizard
  - FEATURE-948 Custom MCP Add And Import
  - openkit configure mcp secret handling
---

# Scope Package: Keychain MCP Secret Backend

OpenKit should add an optional secure MCP secret backend, starting with macOS Keychain, so operators can store MCP credentials outside the local `secrets.env` file while preserving the existing local file behavior as the default/fallback path and ensuring CLI, runtime, docs, logs, evidence, profiles, and reports never persist or display raw secret values.

## Goal

- Add a selectable MCP secret-store backend model with `local_env_file` and `keychain` stores.
- Keep existing local `secrets.env` behavior working and default unless the operator explicitly chooses another backend.
- Support macOS Keychain as the first secure backend for MCP secrets.
- Let operators set, unset, list, doctor, report, and run MCPs with backend-aware secret state and no raw secret disclosure.
- Let `openkit run` resolve MCP secrets from shell environment, keychain, and local env file using explicit precedence.
- Keep CI and automated tests independent of real OS keychain access through mockable adapters.

## Non-Goals

- Do not remove, replace, or weaken the existing `secrets.env` fallback/default behavior.
- Do not require real macOS Keychain, GUI prompts, user login keychains, or OS credential-store access in CI.
- Do not add Linux Secret Service, Windows Credential Manager, browser password manager, cloud secret manager, 1Password, Bitwarden, or team/shared secret support in this feature beyond future-facing documentation or unavailable/stubbed status.
- Do not migrate raw secrets automatically from `secrets.env` to keychain without an explicit user action.
- Do not make direct OpenCode launches read OpenKit keychain-backed secrets unless the user separately exports/provides the required environment for direct OpenCode.
- Do not add target-project application build, lint, test, smoke, or regression validation.

## Target Users

- **Security-conscious OpenKit operator:** wants MCP API keys stored in the OS keychain rather than a project-local or OpenKit-local env file.
- **Existing OpenKit operator:** already uses `secrets.env` and needs the current behavior to continue without reconfiguration.
- **Custom MCP operator:** wants bundled and custom MCP secret bindings to use the same backend-aware secret workflow.
- **Maintainer/reviewer:** needs inspectable proof that raw secrets are never persisted outside the selected backend or leaked through command output, docs, logs, workflow evidence, generated profiles, or reports.
- **CI maintainer:** needs reliable validation through mocks without requiring a real OS credential store.

## Problem Statement

OpenKit currently supports MCP secret configuration through local secret-file behavior, which is simple and portable but not ideal for users who prefer OS-level secret storage. As MCP configuration expands through the interactive wizard and custom MCP support, users need a backend-aware secret model that can store secrets in macOS Keychain when explicitly requested, keep local `secrets.env` as the default/fallback, make runtime precedence predictable, and preserve strict redaction across every OpenKit surface.

## In Scope

- Add backend-aware MCP secret operations under the existing `openkit configure mcp` command family.
- Support a command equivalent to `openkit configure mcp set-key <mcp> <ENV_NAME> --store keychain`, with exact grammar owned by Solution Lead.
- Support storing MCP secrets in macOS Keychain when the backend is explicitly selected and available.
- Preserve existing set/unset/list/doctor/report behavior for local `secrets.env`, adding backend labels where relevant.
- Add backend-aware list/report/doctor output that identifies the store backend and configured/missing state without revealing raw values.
- Add `openkit run` secret resolution across shell environment, keychain, and local env file using the precedence rules in this scope.
- Support explicit key unset/removal behavior for keychain and local env file stores.
- Support explicit migration/copy behavior from local env file to keychain only when the user requests it and confirms any destructive cleanup separately.
- Update interactive wizard flows so users can choose or inspect supported secret-store backends without requiring keychain in non-TTY or CI contexts.
- Update operator, maintainer, and validation documentation with backend semantics, platform availability, direct OpenCode caveats, precedence, redaction, and testing expectations.

## Out Of Scope

- Removing `secrets.env`, changing it from the default fallback, or treating local env file support as deprecated.
- Persisting raw secrets in generated OpenCode/OpenKit profiles, MCP config JSON, custom MCP definitions, workflow state, docs, logs, reports, command output, or evidence artifacts.
- Reading shell history, terminal scrollback, provider payloads, or global OpenCode config to discover secrets.
- Automatic cross-backend migration or silent deletion from one backend after writing another.
- Linux/Windows secure-store implementations beyond explicit unavailable/stubbed capability reporting and future-facing docs.
- Support for multiple named keychains, shared/team keychains, remote vaults, key rotation policies, sync conflict resolution, or enterprise secret governance.
- Direct OpenCode runtime integration that bypasses `openkit run` and magically loads OpenKit-managed keychain secrets.

## Users And User Journeys

1. **As an OpenKit operator on macOS, I want to set an MCP key into Keychain, so that the raw secret is not stored in `secrets.env`.**
2. **As an existing OpenKit operator, I want my current `secrets.env` setup to keep working, so that upgrading OpenKit does not break MCP launches.**
3. **As an operator, I want `openkit run` to load secrets from shell env, keychain, and local env file in a documented order, so that I can predict which value an MCP receives.**
4. **As an operator, I want list/doctor/report to show which backend is configured for each key without printing the key, so that I can audit setup safely.**
5. **As an operator in automation or non-TTY contexts, I want commands to fail closed or require stdin/non-echoing input, so that scripts do not prompt unpredictably or leak secrets.**
6. **As a maintainer, I want tests to mock the keychain adapter, so that CI verifies behavior without depending on a real OS keychain.**

## Business Rules

### Store Backends

- Supported store labels for this feature are:
  - `local_env_file`: the existing local OpenKit `secrets.env` backend.
  - `keychain`: the optional secure backend, implemented first for macOS Keychain.
- `local_env_file` remains the default write backend when no explicit store is provided.
- `keychain` is opt-in; no existing secret is moved into keychain without explicit user action.
- Backend labels must be visible in list/doctor/report/help output, JSON output where supported, and documentation.
- Unsupported store labels must fail with supported values and no mutation.
- Unsupported platforms for `keychain` must report `unavailable` or an equivalent documented capability status with remediation and no mutation.

### macOS Keychain Availability

- macOS Keychain is the only required secure-store implementation for this feature.
- On macOS, keychain commands must detect adapter availability before writing.
- On non-macOS platforms, keychain-backed writes must fail closed with a sanitized unavailable-platform message and must not fall back to writing raw secrets into `secrets.env` unless the user explicitly reruns or confirms a local-env-file write.
- Keychain item naming, service/account mapping, and namespacing are Solution Lead-owned, but the mapping must prevent bundled/custom MCP key collisions and support deterministic set/get/unset/list semantics.
- Keychain permission/access failures must be reported as unavailable or failed with sanitized cause and no raw secret output.

### Precedence And Runtime Loading

- `openkit run` must resolve MCP secret values using this precedence, highest to lowest:
  1. Shell/process environment value already present for the required env name.
  2. Explicitly configured keychain backend value for the MCP/env binding.
  3. Existing local `secrets.env` value.
- Shell environment precedence preserves operator overrides and direct automation behavior.
- Keychain precedence over local env file applies only when the MCP/env binding has a keychain-backed value or explicit keychain binding configured.
- Local env file fallback must continue to satisfy existing MCPs when no shell env or keychain value is available.
- `openkit run` must not log resolved raw values, generated child env dumps, keychain item payloads, or `secrets.env` contents.
- If multiple stores contain values for the same MCP/env key, list/doctor/report should show redacted multi-store presence and the effective store by precedence without printing values.

### Set, Unset, List-Key, And Migration Semantics

- `set-key` without an explicit backend keeps existing local env file behavior.
- `set-key --store keychain` or equivalent writes the provided secret only to the keychain backend and records only redacted metadata/config needed to resolve it later.
- Secret input must use an existing safe path such as `--stdin`, non-echoing prompt, or equivalent; command-line positional raw secret values must remain unsupported or visibly unsafe if existing behavior already forbids them.
- `unset-key` must support removing a key from a selected backend; if no backend is selected, Solution Lead must preserve current local env file semantics and document any new default.
- Backend-specific unset must not remove the same key from other stores unless the user explicitly requests all-store cleanup.
- List/list-key/report output must show MCP id, env name, backend, configured/missing state, effective store when resolvable, and warnings; raw values must never be shown.
- Migration from `local_env_file` to `keychain` must be explicit, redacted, and non-destructive by default: copy/write to keychain may be supported, but deleting the local env file value must require a separate explicit cleanup action or confirmation.
- Repeated set/unset/list operations must be idempotent and must not duplicate metadata, corrupt `secrets.env`, or leave contradictory effective-store reporting.

### Fallback And Compatibility

- Existing bundled MCP secret setup and `secrets.env` fallback must remain backward compatible.
- Custom MCP secret bindings must be eligible for the same backend model when they use the existing MCP secret-binding conventions.
- Generated profiles and custom MCP definitions must continue to contain placeholders or redacted bindings only, not raw secrets.
- Existing `openkit configure mcp --interactive` behavior must remain usable without keychain; keychain selection is an enhancement, not a requirement.
- Existing non-interactive setup flows must remain automation-friendly and must not introduce mandatory TTY prompts.

### Direct OpenCode Caveat

- Keychain-backed MCP secrets are loaded by OpenKit-controlled launch/runtime paths such as `openkit run`.
- Direct OpenCode launches outside `openkit run` must not be documented as automatically reading OpenKit keychain secrets.
- For global-scope or direct OpenCode scenarios, docs and command output must explain that the user must provide required env vars through their direct OpenCode environment unless a separate supported integration exists.

### Non-Interactive Behavior

- Non-interactive commands must never prompt indefinitely for keychain access or secret input.
- In non-TTY contexts, secret-setting commands must require `--stdin` or another explicit non-interactive input mechanism.
- If keychain access would require interactive OS approval in a non-interactive context, the command must fail closed with sanitized remediation and no local env fallback mutation.
- JSON output, if supported, must contain the same backend, status, warning, and redaction information as human output.

### Redaction And No Raw Secret Persistence

- Raw MCP secrets may exist only in the selected backend storage, process memory, and child process environment needed to launch MCPs.
- Raw MCP secrets must never be written to package artifacts, repository files, generated profiles, MCP config files, docs, logs, runtime summaries, workflow state, evidence records, test snapshots, crash reports, or command output.
- Redaction must apply to human output, JSON output, errors, exceptions, doctor/report results, wizard output, tests, and fixtures.
- Synthetic sentinel-secret tests must prove that raw secret strings are absent from all non-backend artifacts inspected by validation.

### Testing And Mocking

- Keychain operations must go through an adapter boundary that can be mocked in unit/integration tests.
- CI validation must use fake/mock keychain adapters and must not depend on real macOS Keychain availability.
- Tests must cover macOS-available, non-macOS-unavailable, keychain permission failure, keychain missing item, malformed backend metadata, and precedence behavior.
- Tests must verify that local env file fallback remains available when keychain is absent or not configured.

## Acceptance Criteria Matrix

### Backend Selection And Defaults

- **Given** an existing MCP uses local `secrets.env`, **when** OpenKit is upgraded with this feature, **then** the MCP continues to resolve secrets from the local env file without requiring keychain setup.
- **Given** the operator runs `set-key` without a store flag, **when** they provide a secret through the approved input path, **then** OpenKit uses the existing local env file backend and reports `local_env_file` without printing the value.
- **Given** the operator runs `set-key` with `--store keychain` on supported macOS, **when** they provide a secret through the approved input path, **then** OpenKit stores the value in the keychain backend and writes no raw value to `secrets.env`, profiles, config, logs, docs, or evidence.
- **Given** the operator requests an unsupported store label, **when** the command runs, **then** it fails with supported store values and performs no mutation.

### macOS And Unsupported Platform Behavior

- **Given** the operator uses `--store keychain` on macOS with the keychain adapter available, **when** set/list/doctor/run execute, **then** the backend reports available/configured state and resolves the key through keychain without exposing the raw value.
- **Given** the operator uses `--store keychain` on a non-macOS platform, **when** the command runs, **then** it reports keychain as unavailable for that platform, performs no keychain mutation, and does not silently write the secret to `secrets.env`.
- **Given** keychain access is denied, locked, missing, or otherwise unavailable, **when** set/run/doctor executes, **then** OpenKit reports a sanitized failure/unavailable status and preserves local env file fallback when a local env value exists.

### Runtime Precedence

- **Given** shell env, keychain, and local env file all contain a value for the same MCP/env key, **when** `openkit run` launches, **then** the shell env value is used and output shows only redacted effective-store metadata.
- **Given** no shell env value exists but keychain and local env file both contain values, **when** `openkit run` launches, **then** the keychain value is used and local env file remains as fallback.
- **Given** no shell env or keychain value exists but local env file contains a value, **when** `openkit run` launches, **then** the existing local env file value is used.
- **Given** no configured value exists in any store, **when** doctor or run checks the MCP, **then** OpenKit reports missing/not_configured state without attempting to use placeholders as secrets.

### Set, Unset, List, Report, And Migration

- **Given** a keychain-backed key exists, **when** list-key/list/report/doctor runs, **then** output shows MCP id, env name, backend `keychain`, configured state, and effective-store information without raw values.
- **Given** the same key exists in multiple stores, **when** list/report/doctor runs, **then** output reports redacted multi-store presence and the effective store by precedence.
- **Given** a key exists only in keychain, **when** unset-key targets `--store keychain`, **then** the keychain item is removed or marked absent and local env file values are untouched.
- **Given** a key exists in local env file and keychain, **when** unset-key targets one backend, **then** only that backend is changed and effective-store reporting updates according to precedence.
- **Given** a local env file secret exists and the operator explicitly migrates/copies it to keychain, **when** migration completes, **then** keychain has the redacted configured state, the local env file value remains unless separately cleaned up, and no raw value is printed or persisted elsewhere.

### Interactive Wizard And Non-Interactive Commands

- **Given** the operator uses the interactive MCP wizard on macOS, **when** configuring a key, **then** the wizard can present local env file and keychain backend choices while preserving non-echoing input and redacted status.
- **Given** the operator uses the wizard where keychain is unavailable, **when** keychain choices are shown or requested, **then** the wizard reports unavailable status and keeps local env file setup available.
- **Given** a non-TTY command attempts to set a secret without stdin or an equivalent safe input path, **when** it runs, **then** it fails with remediation and no mutation.
- **Given** a non-TTY command would require interactive keychain approval, **when** it runs, **then** it fails closed without falling back to local env file writes.

### Redaction And Non-Leakage

- **Given** a synthetic sentinel secret is entered through local env file and keychain paths, **when** commands, generated profiles, config files, docs examples, logs, workflow evidence, runtime summaries, test snapshots, and reports are inspected, **then** the raw sentinel appears only in the selected backend fixture/storage or process-only test harness and nowhere else.
- **Given** keychain operations fail with an error that includes sensitive context, **when** OpenKit reports the error, **then** output is sanitized and contains no raw secret, keychain payload, child env dump, or local env file content.
- **Given** JSON output is requested for list/doctor/report, **when** results are emitted, **then** JSON uses backend/status/redaction fields equivalent to human output and never includes raw secret values.

### Testing And CI

- **Given** tests run in CI without macOS Keychain access, **when** keychain behavior is tested, **then** tests use mock/fake adapters and pass without OS credential-store dependencies.
- **Given** the fake adapter simulates success, missing item, denied access, unsupported platform, and deletion, **when** tests run, **then** command behavior, runtime precedence, fallback, and redaction are validated for each case.
- **Given** existing local env file tests run, **when** the keychain feature is present, **then** existing local `secrets.env` behavior remains covered and passing.

## Edge Cases And Risks

- Keychain item namespacing could collide across bundled MCPs, custom MCPs, scopes, workspaces, or env names unless the identifier model is explicit.
- Keychain APIs can trigger user prompts, locked-keychain errors, permission denials, or GUI behavior that is unsuitable for CI and non-TTY contexts.
- Multiple stores can contain different values for the same key; effective-store reporting must be clear without revealing values.
- An operator may assume direct OpenCode launches load keychain-backed OpenKit secrets; docs and command output must preserve the caveat.
- Migration from local env file to keychain can create duplicate configured values; precedence and cleanup semantics must be explicit.
- Shell env precedence can hide keychain/local values during debugging; doctor/report should surface redacted effective-store reasoning.
- Test fixtures using sentinel secrets can accidentally leak through snapshots, assertion messages, or failure logs if redaction tests are incomplete.
- Non-macOS users may interpret keychain as supported; unavailable/stubbed status and future-facing docs must be clear.
- Keychain dependency choice may introduce packaging or install risk; Solution Lead must keep CI path mockable and optional where platform support is absent.

## Error And Failure Cases

- Unknown MCP id or env name: fail with sanitized guidance and no mutation.
- Unsupported backend label: fail with supported values and no mutation.
- Keychain unavailable platform: fail closed for keychain write, preserve local fallback, and avoid silent local write.
- Keychain adapter unavailable or dependency missing: report unavailable/degraded status and no raw secret output.
- Keychain access denied/locked: report sanitized failure; preserve existing local env file value if present.
- Missing keychain item during run: fall back to local env file if present; otherwise report missing/not_configured.
- Corrupt backend metadata: ignore unsafe metadata, report configuration error, and avoid raw secret output.
- Partial migration/copy failure: report per-key result, preserve source local env value, and avoid cleanup unless separately confirmed.
- Interrupted set/unset operation: leave backend state inspectable and retry-safe without duplicate metadata.
- Non-interactive missing stdin: fail with remediation and no mutation.

## Open Questions And Assumptions

- Assumption: exact CLI grammar remains Solution Lead-owned as long as it supports `set-key <mcp> <ENV_NAME> --store keychain` or a clearly equivalent command.
- Assumption: `local_env_file` is the canonical label for existing `secrets.env` behavior in user-facing backend reports; Solution Lead may choose a shorter label if docs map it unambiguously.
- Assumption: shell environment has highest runtime precedence to preserve operator overrides and automation.
- Assumption: keychain support should apply to bundled MCPs and OpenKit-managed custom MCPs through shared secret-binding semantics.
- Open question for Solution Lead: define keychain service/account naming, workspace namespacing, and whether scope is part of the keychain item identity.
- Open question for Solution Lead: define whether list/report can detect keychain item presence without reading raw secret payloads, or whether it must read through adapter and discard values in memory.
- Open question for Solution Lead: define whether `unset-key` defaults remain local-env-file only or require explicit backend when multiple stores contain the key.
- Open question for Solution Lead: define whether migration/copy is a first-class command or an option on `set-key`, provided it remains explicit and non-destructive by default.

## Success Signal

- A macOS operator can opt into keychain-backed MCP secrets, `openkit run` resolves secrets from shell env, keychain, and local env file in documented order, existing `secrets.env` setups keep working unchanged, CI validates behavior through mocks, and raw secrets appear only in the selected backend/process path and never in OpenKit artifacts, profiles, docs, logs, evidence, or reports.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate `openkit configure mcp` set/unset/list-key/list/report/doctor/help/wizard behavior for backend selection, `local_env_file` default, `keychain` opt-in, macOS availability, unsupported-platform failure, non-TTY input requirements, explicit migration/copy semantics, direct OpenCode caveats, JSON/human output parity, and no raw secret output. Validate `openkit run` precedence across shell env, keychain, and local env file using mocks where needed. |
| `runtime_tooling` | Validate MCP secret resolution helpers, keychain adapter abstraction, mock adapter behavior, runtime summaries, MCP doctor/read models, redacted backend statuses, effective-store reporting, and sentinel-secret non-leakage through runtime logs/read models. |
| `documentation` | Validate operator docs, maintainer docs, help text, examples, runbooks, and validation notes describe supported backends, macOS-only keychain availability, unsupported Linux/Windows status, `secrets.env` fallback/default, precedence, set/unset/list/migration semantics, direct OpenCode caveat, CI mocking, and no raw secret persistence using placeholders only. |
| `compatibility_runtime` | Validate workflow-state/evidence/readiness records and runtime summaries label evidence with correct validation surfaces and contain no raw secrets; use compatibility checks only for OpenKit workflow/runtime integrity, not target-project application behavior. |
| `target_project_app` | Unavailable for this feature unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit CLI/runtime/MCP/keychain checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve existing MCP configure behavior, interactive wizard behavior, custom MCP support, status vocabulary, direct OpenCode caveat, and local `secrets.env` fallback/default semantics.
- Design a backend-aware secret model that is explicit in data shape and output but never persists raw secrets outside the selected backend.
- Define the exact CLI grammar for backend selection, backend-specific unset/list/report, explicit migration/copy, non-interactive input, and JSON output while keeping the mental model under `openkit configure mcp`.
- Define keychain adapter boundaries, macOS capability detection, service/account namespacing, unsupported-platform behavior, and mock/fake implementations before implementation.
- Plan tests around sentinel secrets, mocked keychain success/failure cases, precedence behavior, local env fallback preservation, non-TTY fail-closed behavior, direct OpenCode caveat visibility, and JSON/human redaction parity.
- Keep validation evidence separated by `global_cli`, `runtime_tooling`, `documentation`, and `compatibility_runtime`; keep `target_project_app` explicitly unavailable unless real target app commands exist.
- Ensure Code Review and QA focus on no-secret-leakage, backward compatibility for `secrets.env`, keychain opt-in only, platform availability, failure-mode safety, migration non-destructiveness, and CI mockability.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, users, goals/non-goals, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, risks, assumptions/open questions, and Solution Lead handoff notes for `product_to_solution` review.
