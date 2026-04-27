---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-945
feature_slug: interactive-mcp-setup-wizard
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - FEATURE-941 MCP + Skills Capability Pack
  - openkit configure mcp control plane
---

# Scope Package: Interactive MCP Setup Wizard

OpenKit should give operators a guided, secret-safe MCP setup path after install or upgrade so they can discover bundled MCPs, choose the right scope, configure required keys, repair local secret-store permissions, test readiness, and leave with a clear redacted summary without hand-editing OpenCode profile files or weakening the FEATURE-941 secret model.

## Goal

- Add an interactive wizard for bundled/default MCP setup, with primary entry point `openkit configure mcp --interactive`.
- Optionally add `openkit mcp setup` as an alias only if it is consistent with the existing CLI hierarchy and documentation.
- Reuse the FEATURE-941 MCP catalog, scope semantics, secret store, profile ownership model, status vocabulary, and redaction rules.
- Help users complete common setup actions safely: inspect status, enable/disable MCPs, set/update/remove keys, repair secret permissions, test MCP health, and review next steps.

## Target Users

- **New OpenKit operator:** installs OpenKit and wants guided MCP setup before running an OpenKit session.
- **Existing OpenKit operator:** upgrades OpenKit and wants to review or adjust bundled MCP enablement without damaging prior preferences.
- **Security-conscious operator:** needs confidence that API keys are never printed, logged, committed, or copied into generated profiles.
- **Maintainer/reviewer:** needs testable evidence that the wizard is a safe wrapper over the existing MCP configuration model, not a parallel configuration path.

## Problem Statement

FEATURE-941 made bundled MCPs and `openkit configure mcp` available, but users still need to know which subcommands to run, which scope to select, how to enter keys safely, when direct OpenCode needs shell environment variables, and how to interpret disabled, missing-key, or degraded states. A guided wizard should reduce setup friction while preserving strict secret safety and the existing non-interactive control plane for automation.

## In Scope

- Add an interactive setup wizard reachable through `openkit configure mcp --interactive`.
- Show bundled/default MCP inventory from the existing FEATURE-941 catalog, including at least the MCPs already defined there (`openkit`, `chrome-devtools`, `playwright`, `context7`, `grep_app`, `websearch`, `sequential-thinking`, policy-gated `git`, and optional `augment_context_engine` when discoverable).
- For each listed MCP, show redacted status fields:
  - enabled/disabled state by selected scope
  - health or readiness state using existing OpenKit status vocabulary
  - key state as missing or present-redacted only
  - optional, preview, degraded, unavailable, or policy-gated labels where applicable
- Let users choose scope: `openkit`, `global`, or `both`, with `openkit` as the default when no explicit scope is provided.
- Let users enable and disable bundled MCPs for the selected scope.
- Let users set or update catalog-defined MCP keys through a non-echoing prompt in TTY sessions or a stdin-safe path that does not expose values in command output.
- Let users remove catalog-defined MCP keys while preserving existing FEATURE-941 `unset-key` behavior.
- Detect unsafe local secret-store permissions and offer a repair action for the OpenKit secret directory/file only.
- Let users test MCP health/readiness for selected MCPs or the final wizard selection, with sanitized results.
- Show a final redacted summary of changes, unchanged items, skipped items, failures, caveats, and recommended next commands.
- Update operator documentation for the wizard path, safe key-entry behavior, direct OpenCode caveats, and validation-surface boundaries.

## Out of Scope

- Adding, importing, editing, or generating arbitrary custom MCP definitions outside the bundled/default catalog.
- Building an MCP marketplace, remote registry, provider signup flow, team secret sync, or cloud key management.
- Changing the FEATURE-941 secret model, secret file location semantics, placeholder profile model, or scope vocabulary.
- Discovering secrets from shell history, password managers, browser stores, existing user configs, environment dumps, or target repositories.
- Making direct OpenCode launches load OpenKit's local secret file automatically.
- Replacing existing non-interactive `openkit configure mcp list|doctor|enable|disable|set-key|unset-key|test` commands.
- Adding target-project application build, lint, test, smoke, or regression validation.
- Creating a full-screen TUI/GUI beyond a command-line interactive wizard.

## Users And User Journeys

1. **As a new OpenKit operator, I want a guided MCP setup wizard after install, so that I can enable useful capabilities without learning every subcommand first.**
2. **As an operator configuring key-required MCPs, I want hidden or stdin-safe key entry, so that my API key is stored locally without appearing in terminal output, profiles, docs, or logs.**
3. **As an operator choosing between OpenKit and global OpenCode scopes, I want the wizard to explain the behavior and caveats, so that I do not assume direct OpenCode will load OpenKit secrets.**
4. **As an existing operator, I want the wizard to preserve prior preferences and user-managed profile entries, so that setup does not overwrite unrelated local configuration.**
5. **As a maintainer, I want wizard results to map to the existing MCP control plane and validation surfaces, so that review and QA can prove behavior without inventing a second configuration model.**

## Business Rules

### Wizard Entry And Flow

- `openkit configure mcp --interactive` is the required entry point.
- `openkit mcp setup` may be added as an alias only if Solution Lead confirms it does not conflict with current CLI conventions and all docs/help text identify it as equivalent.
- The wizard must be a guided wrapper over the existing bundled MCP catalog and configuration semantics; it must not introduce a separate configuration source of truth.
- Viewing the wizard inventory/status must not mutate configuration.
- Mutating actions must be explicit and attributable in the final summary.
- The wizard must support cancellation before final completion without printing secrets; any already-completed mutations must be summarized as completed rather than hidden.
- Re-running the wizard must be idempotent: it must not duplicate profile entries, duplicate keys, or reset unrelated user preferences.

### Secret Safety

- The FEATURE-941 secret model is unchanged: raw keys may be stored only in the local user secret file under the OpenCode home-derived OpenKit settings path.
- Generated OpenKit profiles, global OpenCode profiles, package files, repository files, docs, logs, command output, runtime summaries, workflow state, and workflow artifacts must use environment placeholders or redacted state only.
- The wizard must never print raw keys, partial key prefixes/suffixes, hashes of raw key values, raw provider payloads that may include credentials, or copied process environment dumps.
- Key status may be shown only as states such as `missing`, `present (redacted)`, or equivalent redacted labels.
- Placeholder values such as environment variable references must never be treated as usable secrets.
- Key input in an interactive TTY must not echo the value.
- A stdin-safe key path must not require placing the key in command arguments or visible shared examples.
- If safe secret entry is unavailable, the wizard must fail closed for key mutation and show a safe next action.

### Scope Semantics

- Supported scopes remain exactly `openkit`, `global`, and `both`.
- Default scope remains `openkit` when no explicit scope is supplied.
- Scope choice must be visible before mutation and repeated in the final summary.
- `openkit` scope configures OpenKit-managed profile entries used by `openkit run`.
- `global` scope configures OpenKit-managed entries in the user's global OpenCode config using placeholders only.
- `both` applies the selected action to both scopes and must report per-scope success, skip, or failure.
- The wizard must distinguish scope-specific state, including an MCP enabled in one scope and disabled in another.
- Invalid scope values must fail with supported values and no mutation.

### Enable, Disable, Set-Key, And Unset-Key Semantics

- Enabling an MCP must apply only to the selected scope and must materialize placeholder-only profile entries.
- Enabling a key-required MCP without a key may succeed, but the MCP must remain `not_configured` with key setup guidance until a key is present.
- Setting or updating a key must write the raw value only to the local secret file and must automatically enable the MCP for the selected scope after the secret write succeeds.
- If key write or secret-permission repair fails, the wizard must not auto-enable as if setup succeeded.
- Disabling an MCP must not remove its stored key.
- Removing/unsetting a key must not silently disable the MCP; if it remains enabled, list/doctor/wizard status must report `not_configured` until the user sets a new key or disables it.
- Setting, updating, or unsetting keys is allowed only for catalog-defined secret bindings in this feature.
- Attempting key setup for an MCP that has no catalog-defined key must fail or skip with a clear message and no secret mutation.

### Non-TTY And Automation Behavior

- If `--interactive` is invoked in a non-TTY environment, the wizard must not hang waiting for invisible prompts.
- Non-TTY invocation must either fail with a clear no-mutation message and safe non-interactive alternatives, or use an explicitly supported stdin-safe mode for the key-entry portion without echoing values.
- The wizard must not prompt users to pass raw keys through visible command-line arguments.
- Existing non-interactive commands remain the supported automation path.
- Scripted flows must receive deterministic exit status and redacted output.

### Secret Permission Repair

- The wizard must detect whether the local OpenKit secret directory and secret file satisfy the existing permission expectations.
- On POSIX, repair targets are the OpenKit secret parent directory (`0700`) and secret file (`0600`).
- On Windows, the wizard must use the closest available local-user-only behavior and report limitations without printing secret values.
- Repair actions must be scoped only to OpenKit's secret store path; the wizard must not recursively chmod broad user directories or target repositories.
- If permissions cannot be repaired safely, key write/test actions that depend on the secret file must fail closed with remediation guidance.

### Health Testing And Status Reporting

- The wizard must use the existing capability status vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.
- Disabled state is an enablement field, not a new capability status label.
- Testing a disabled MCP must report disabled/skipped rather than silently enabling it.
- Testing a key-required MCP with a missing key must report missing-key/not-configured rather than running a provider call with placeholders.
- Provider, dependency, browser, network, and policy failures must be summarized in sanitized form.
- Optional MCP absence must not fail the whole wizard.
- Policy-gated MCPs such as `git` must keep the existing OpenKit safety expectations; the wizard must not silently enable destructive or irreversible operations.

### Profile Ownership And Global Direct OpenCode Caveats

- The wizard may mutate only OpenKit-managed MCP entries for the selected scope.
- Existing user-managed global OpenCode entries with conflicting MCP ids must be preserved and reported as conflicts or skipped items.
- The wizard must not copy user global OpenCode config into the OpenKit package, docs, logs, or workflow artifacts.
- When `global` or `both` scope is selected, the wizard must explain that direct OpenCode launches may require the user to export needed environment variables because OpenKit's `openkit run` secret loader is not involved.
- The final summary must repeat any direct OpenCode caveat for global-scope changes.

## Acceptance Criteria Matrix

### Wizard Discovery And Inventory

- **Given** OpenKit has the FEATURE-941 MCP catalog, **when** the operator runs `openkit configure mcp --interactive` in a TTY, **then** the wizard shows bundled/default MCPs with scope, enablement, health/status, lifecycle/policy labels, and redacted key state.
- **Given** key-required bundled MCPs are not configured, **when** the wizard displays them, **then** their key state is shown as missing and their capability state is `not_configured` or equivalent existing status without printing placeholder values as secrets.
- **Given** optional MCP dependencies are absent, **when** the wizard inventory loads, **then** optional MCPs remain visible as unavailable/degraded and the wizard continues.
- **Given** a user opens the wizard only to inspect status, **when** they exit without selecting a mutating action, **then** no MCP config, secret file, or profile entry is changed.

### Scope Selection

- **Given** no explicit scope is supplied, **when** the wizard starts, **then** `openkit` is the default selected scope.
- **Given** the user chooses `global`, **when** they proceed to mutation or summary, **then** the wizard shows the direct OpenCode environment-variable caveat.
- **Given** the user chooses `both`, **when** an action is applied, **then** the wizard reports separate OpenKit-scope and global-scope results.
- **Given** an invalid scope is passed or selected, **when** the wizard validates input, **then** it rejects the scope with supported values and performs no mutation.

### Enable And Disable

- **Given** a disabled bundled MCP, **when** the user enables it for `openkit` scope, **then** only the OpenKit-managed scope is enabled and generated profile content uses environment placeholders only.
- **Given** a key-required MCP with no key, **when** the user enables it without setting a key, **then** enablement is recorded but final status shows `not_configured` with key setup guidance.
- **Given** an MCP has a stored key, **when** the user disables that MCP, **then** the selected scope is disabled and the stored key remains present-redacted.
- **Given** an MCP is enabled in one scope and disabled in another, **when** the wizard displays or summarizes it, **then** the two scope states are distinguishable.

### Key Set, Update, And Remove

- **Given** a key-required MCP and a TTY session, **when** the user sets or updates a key through the wizard, **then** the key entry is non-echoing, the raw value is stored only in the local user secret file, and output shows only present-redacted state.
- **Given** a key write succeeds, **when** the wizard applies the selected action, **then** the MCP is automatically enabled for the selected scope.
- **Given** a key write fails because the secret store is unsafe or not repairable, **when** the wizard reports the result, **then** it fails closed, does not print the attempted value, and does not report the MCP as successfully configured.
- **Given** a stored key exists, **when** the user removes/unsets it through the wizard, **then** the local secret value is removed without printing it and enablement remains unchanged.
- **Given** a key is removed while the MCP remains enabled, **when** wizard status, `list`, or `doctor` runs, **then** the MCP is shown as `not_configured` until a new key is set or the MCP is disabled.
- **Given** the user attempts to set a key for an MCP with no catalog-defined key binding, **when** the wizard validates the action, **then** it skips or rejects that key action with no secret mutation.

### Non-TTY Safety

- **Given** `openkit configure mcp --interactive` is run without an interactive terminal, **when** no explicit stdin-safe key mode is supported for the requested operation, **then** the command exits with a clear message, redacted output, and no mutation.
- **Given** the wizard provides a stdin-safe key path, **when** a key is supplied through that path, **then** the value is not echoed, not printed in errors, not stored outside the local secret file, and the final summary remains redacted.
- **Given** the user needs automation, **when** non-TTY interactive mode is unavailable, **then** output points to existing non-interactive commands such as `openkit configure mcp set-key <mcp-id> --stdin` without suggesting raw key command arguments.

### Secret Permission Repair

- **Given** the OpenKit secret directory or file has unsafe permissions, **when** the wizard detects the issue, **then** it offers a repair action limited to the OpenKit secret-store path.
- **Given** the user accepts repair on POSIX, **when** the repair succeeds, **then** the parent directory is local-user-only (`0700`) and the secret file is local-user-only (`0600`) before any key write is considered successful.
- **Given** permission repair fails, **when** the user tries to set/update a key, **then** the wizard fails closed and shows remediation guidance without writing to an unsafe file.

### Health Testing And Summary

- **Given** the user requests an MCP health test, **when** the MCP is enabled and prerequisites are present, **then** the wizard reports pass/fail/degraded status without exposing credentials or raw sensitive provider output.
- **Given** the MCP is disabled, **when** the user requests a health test, **then** the wizard reports disabled/skipped without enabling it.
- **Given** the MCP is missing a required key, **when** the user requests a health test, **then** the wizard reports missing-key/not-configured and does not attempt a provider call using placeholders.
- **Given** the wizard finishes, **when** it prints the summary, **then** the summary lists changed, unchanged, skipped, and failed items by scope and includes only redacted key state.
- **Given** `global` or `both` scope was touched, **when** the summary is shown, **then** it includes the direct OpenCode environment-variable caveat.

### Secret Non-Leakage And Profile Ownership

- **Given** a synthetic real-looking secret is entered during validation, **when** command output, generated profiles, logs, docs, workflow-state evidence, and runtime summaries are inspected, **then** the raw value appears only in the local secret file and nowhere else.
- **Given** an existing user-managed global OpenCode MCP entry conflicts with a bundled MCP id, **when** the wizard attempts to apply global or both scope, **then** the user-managed entry is not overwritten and the conflict is reported in the redacted summary.
- **Given** the wizard is re-run after a prior setup, **when** the same choices are applied, **then** it does not duplicate profile entries, duplicate secret bindings, or reset unrelated user-managed config.

## Edge Cases

- User cancels from the inventory screen, scope screen, key prompt, permission-repair prompt, or final review.
- Terminal does not support hidden input or throws while disabling echo.
- Non-TTY session invokes the interactive entry point in CI or a script.
- Secret file does not exist yet.
- Secret file exists but is malformed, read-only, contains duplicate target keys, contains unrelated variables, or has unsafe permissions.
- Secret value contains spaces, shell-sensitive characters, unicode, trailing newline, or empty input.
- User selects `both` and one scope succeeds while the other fails.
- User-managed global OpenCode config has an MCP entry with the same id and no OpenKit ownership record.
- Key-required MCP is enabled but missing a key.
- Stored key exists for a disabled MCP.
- User removes a key while the MCP remains enabled.
- Optional dependency is absent, partially installed, version-incompatible, or temporarily unavailable.
- Provider/network health test times out or returns an error payload that may include sensitive data.
- Existing OpenCode/OpenKit session may need restart to reflect newly materialized MCP profile changes.
- Windows permission enforcement cannot exactly match POSIX mode expectations.

## Error And Failure Cases

- Unknown MCP id: show a clear unknown bundled MCP message, include safe suggestions if available, and perform no mutation.
- Invalid scope: show supported scopes and perform no mutation.
- Unsafe or unrepairable secret store: fail key writes closed and do not auto-enable as successful setup.
- Hidden prompt failure: abort key entry, restore terminal echo where possible, and print no raw value.
- Interrupted process during mutation: preserve already-committed safe state, avoid partial secret leakage, and summarize the interruption on next visible output.
- Partial `both` failure: report per-scope result and do not hide partial success/failure behind a single success line.
- Profile ownership conflict: preserve user-managed entry and report conflict/remediation without overwriting.
- Provider health failure: sanitize the failure, distinguish missing key/dependency/network/provider/policy causes where possible, and avoid dumping raw provider payloads.
- Stale active session after profile changes: report restart/openkit-run guidance rather than claiming the already-running session has refreshed.

## Open Questions And Assumptions

- Assumption: `openkit configure mcp --interactive` is the required command; alias `openkit mcp setup` is optional and subject to Solution Lead CLI consistency review.
- Assumption: the wizard uses the existing FEATURE-941 local secret store, profile materialization, and scope state rather than creating new config files.
- Assumption: unset-key behavior remains unchanged from FEATURE-941: removing a key does not disable the MCP.
- Open question for Solution Lead: choose the exact prompt library or CLI interaction mechanism that can reliably restore terminal echo after failures.
- Open question for Solution Lead: decide whether the final mutation sequence should apply changes immediately per action or collect a review plan before applying, while still satisfying explicit mutation summaries and safe cancellation behavior.

## Success Signal

- A user can run `openkit configure mcp --interactive`, select `openkit`, `global`, or `both`, safely enable bundled MCPs, enter or update required keys without raw key exposure, repair local secret permissions, test readiness, and receive a redacted summary that matches existing `openkit configure mcp list|doctor|test` state.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate `openkit configure mcp --interactive` TTY flow, no-mutation inventory exit, scope selection, enable/disable, set/update key with hidden or stdin-safe input, unset-key, permission repair, health test, cancellation, non-TTY behavior, alias behavior if added, idempotency, redacted summary, and no raw secret output. |
| `runtime_tooling` | Validate existing runtime capability inventory, health, and MCP doctor/read models reflect wizard-made state with standard status labels and redacted key presence; validate newly materialized config may require a fresh OpenKit/OpenCode session when applicable. |
| `compatibility_runtime` | Validate workflow-state/evidence/readiness records and runtime summaries do not contain raw secrets; record evidence with correct surface labels and do not treat OpenKit wizard checks as target-project app validation. |
| `documentation` | Validate operator docs, help text, and runbooks describe the wizard entry point, optional alias if added, scope semantics, secret safety, permission repair, direct OpenCode caveat, non-TTY safe alternatives, and validation-surface boundaries using placeholders only. |
| `target_project_app` | Unavailable for this feature unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit CLI/runtime checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve FEATURE-941 as the source of truth for MCP catalog, secret model, scope semantics, profile ownership, and existing non-interactive command behavior.
- Treat the wizard as a user-experience layer over existing MCP configuration capabilities; avoid parallel state or divergent command semantics.
- Explicitly design mutation ordering, cancellation behavior, partial-failure reporting for `both`, and terminal echo restoration around the secret-safety requirements.
- Include a redaction validation strategy that uses synthetic sentinel values and verifies command output, generated profiles, docs, workflow evidence, runtime summaries, and log-like output do not contain the sentinel outside the local secret file.
- Plan validation separately by `global_cli`, `runtime_tooling`, `compatibility_runtime`, and `documentation`; keep `target_project_app` unavailable unless real app-native commands exist.
- Decide whether to include the optional `openkit mcp setup` alias; if included, keep help text and docs aligned with the primary command.
- Ensure Code Review and QA focus on no-secret-leakage, non-TTY fail-closed behavior, permission repair safety, scope-specific idempotency, profile ownership conflicts, and direct OpenCode caveat visibility.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, open questions, and Solution Lead handoff notes for `product_to_solution` review.
