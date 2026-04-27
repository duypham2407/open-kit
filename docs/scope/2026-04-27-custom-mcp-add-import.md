---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-948
feature_slug: custom-mcp-add-import
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - FEATURE-941 MCP + Skills Capability Pack
  - FEATURE-945 Interactive MCP Setup Wizard
  - openkit configure mcp control plane
---

# Scope Package: Custom MCP Add And Import

OpenKit should let operators safely add, import, inspect, test, disable, and remove custom MCP definitions in the OpenKit-managed MCP configuration without weakening bundled MCP behavior, overwriting user-owned global config, or copying raw secrets into config, profiles, docs, logs, workflow state, or command output.

## Goal

- Add phase-1 custom MCP management to the existing `openkit configure mcp` product surface.
- Support custom MCP lifecycle capabilities for:
  - add local MCP definition
  - add remote MCP definition
  - import one or more existing global OpenCode MCP definitions into OpenKit-managed custom MCP configuration
  - list custom MCPs
  - disable custom MCPs
  - remove custom MCPs
  - doctor/test custom MCPs
- Preserve FEATURE-941/FEATURE-945 scope semantics, secret safety, status vocabulary, redaction rules, and profile ownership boundaries.
- Make local command, remote URL, secret placeholder, ownership, conflict, and risk-warning behavior explicit enough for review and QA.

## Non-Goals

- Do not build a full MCP marketplace, remote registry, provider onboarding flow, team sharing system, or cloud secret manager.
- Do not replace or weaken bundled MCP catalog behavior, default enablement, existing `set-key`/`unset-key` semantics, or the FEATURE-945 wizard.
- Do not add arbitrary raw secret header values, raw env values, raw bearer tokens, or copied global config secrets to custom MCP definitions in phase 1.
- Do not discover, scrape, migrate, or copy real secrets from global OpenCode config, shell history, password managers, target repositories, environment dumps, provider responses, or logs.
- Do not require a full custom MCP creation wizard in phase 1; the interactive wizard may list, inspect, doctor, and test custom MCPs, and simple custom creation is optional only if Solution Lead can keep it safe and small.
- Do not add target-project application build, lint, test, smoke, or regression validation.

## Target Users

- **OpenKit operator with a local MCP server:** wants to add a local command-based MCP to the OpenKit-managed session without hand-editing profile JSON.
- **OpenKit operator with a remote MCP server:** wants to add a URL-based MCP while keeping auth placeholders and risk warnings visible.
- **Existing OpenCode user:** already has global OpenCode MCP entries and wants to import selected entries for `openkit run` without copying raw keys or overwriting global config.
- **Security-conscious operator:** needs proof that custom MCP config uses placeholders/redaction only and keeps raw secrets in the existing secret-store path where supported.
- **Maintainer/reviewer:** needs clear ownership, conflict, validation, and warning rules to verify that custom MCP support is additive over bundled MCPs.

## Problem Statement

OpenKit currently helps users configure bundled MCPs through the catalog, non-interactive commands, and the FEATURE-945 interactive wizard, but users with their own local or remote MCP servers still need to hand-edit OpenCode/OpenKit configuration. Manual edits increase the risk of raw secrets in profiles, unsafe local commands, unsafe remote URLs, overwritten user-managed global entries, and inconsistent doctor/test output. OpenKit needs a bounded custom MCP add/import path that gives users flexibility while preserving the existing secret model and ownership guarantees.

## In Scope

- Add a custom MCP command surface under the existing `openkit configure mcp` family; exact CLI grammar is Solution Lead-owned, but it must expose the phase-1 capabilities named in this scope.
- Add local custom MCP definitions with explicit id, display/name metadata where supported, local executable/arguments, optional non-secret metadata, selected scope, enablement state, and risk warnings.
- Add remote custom MCP definitions with explicit id, URL, supported transport metadata where needed, optional placeholder-only headers/env bindings, selected scope, enablement state, and risk warnings.
- Import selected global OpenCode MCP definitions into OpenKit-managed custom MCP configuration without mutating the source global entry by default.
- List custom MCPs separately or visibly distinguish them from bundled catalog entries.
- Disable a custom MCP for a selected scope without deleting the custom definition or stored local secret values.
- Remove an OpenKit-managed custom MCP definition and its OpenKit-managed profile materialization without removing bundled MCPs or unmanaged global entries.
- Doctor/test custom MCPs with sanitized output, standard status labels, and clear causes such as disabled, invalid definition, missing placeholder-backed key, unsafe command, unsafe URL, dependency failure, provider/network failure, or conflict.
- Let the FEATURE-945 interactive wizard discover, list, inspect, doctor, and test custom MCPs when present; full custom creation in the wizard is optional and not required for approval.
- Update operator/maintainer docs, help text, and validation guidance for custom MCP lifecycle behavior.

## Out Of Scope

- Importing or copying raw secrets from global OpenCode config into OpenKit secrets, custom config, generated profiles, docs, command output, workflow state, or logs.
- Supporting arbitrary raw secret-bearing request headers, URL query tokens, inline env values, or auth values in custom MCP definitions.
- Allowing custom MCP definitions to override, shadow, edit, remove, or change bundled MCP ids or bundled MCP defaults.
- Bulk import that silently accepts every global MCP entry without per-entry validation and conflict reporting.
- Automatically trusting local commands or remote URLs merely because they already exist in user global config.
- Running unsafe local commands as part of validation without explicit test intent and risk visibility.
- Adding unrestricted shell parsing, shell scripts, command chains, marketplace install flows, package trust scoring, or automatic dependency installation.
- Changing direct OpenCode launch behavior or making direct OpenCode load OpenKit's local secret file.

## Users And User Journeys

1. **As an OpenKit operator, I want to add a local custom MCP with a validated executable and arguments, so that `openkit run` can use my local MCP without manual profile edits.**
2. **As an OpenKit operator, I want to add a remote custom MCP with a validated URL and placeholder-only auth fields, so that I can connect to a remote MCP without storing raw credentials in config.**
3. **As an existing OpenCode user, I want to import selected global MCP definitions into OpenKit-managed custom config, so that I can reuse known entries in OpenKit sessions without copying raw keys.**
4. **As a security-conscious operator, I want list/doctor/test output to show redacted state and risk warnings, so that I can understand custom MCP readiness without leaking secrets.**
5. **As an operator maintaining custom entries, I want to disable or remove a custom MCP with clear semantics, so that I can stop using it without accidentally deleting unrelated config or secrets.**
6. **As a maintainer, I want bundled and custom MCPs to remain clearly separated, so that custom support does not regress existing catalog behavior.**

## Business Rules

### Custom MCP Ownership

- Custom MCP definitions created or imported through OpenKit are OpenKit-managed custom entries, not bundled catalog entries.
- Every custom entry must have an explicit custom id, origin metadata (`local`, `remote`, or `imported-global`), selected scope state, and ownership marker sufficient to distinguish OpenKit-managed custom entries from bundled entries and unmanaged global entries.
- Custom MCP ids must not collide with bundled MCP ids. A custom command that targets a bundled id must fail with no mutation and guidance to use bundled MCP commands instead.
- Custom MCP ids must not collide with an existing OpenKit-managed custom id unless the user explicitly chooses an update/replace/import-as flow supported by the final design.
- OpenKit may mutate only OpenKit-managed custom entries and OpenKit-managed profile materialization for the selected scope.
- Unmanaged global OpenCode MCP entries must be preserved. Conflicts with unmanaged global entries must be reported as conflicts or skipped items rather than overwritten.
- Bundled MCP list/doctor/enable/disable/set-key/unset-key/test behavior remains unchanged by custom MCP support.

### Local Custom MCP Validation

- Local custom MCP definitions must provide a non-empty id and a non-empty executable/command component.
- Local custom MCP definitions must represent command and arguments in a way that avoids accidental shell command chaining; raw shell command strings with shell operators, redirection, command substitution, backgrounding, or multi-command chaining must be rejected or require a narrower explicitly safe representation chosen by Solution Lead.
- Local definitions must reject inline raw secret values in env fields, args, command strings, labels, descriptions, or metadata when they look like credentials or are declared as secret-bearing fields.
- Secret-bearing local env values must be represented as placeholders or secret-binding references only, then populated through the existing secret store/set-key model where supported.
- Local command validation must detect and report high-risk patterns before mutation when possible, including shell launchers used to execute arbitrary strings, write/delete/system-control commands that are not clearly MCP servers, and executable paths that are missing or not runnable in the current environment.
- Risk warnings must make clear that enabling/testing a local custom MCP can execute local code on the user's machine.
- Adding a local custom MCP may store the definition in a disabled or not-configured state when validation cannot prove it is runnable, but the state and next action must be explicit.

### Remote Custom MCP URL Validation

- Remote custom MCP definitions must provide a non-empty id and a syntactically valid URL.
- Supported URL schemes for phase 1 must be limited to web-based MCP transports selected by Solution Lead; unsupported schemes such as `file:`, `javascript:`, `data:`, and shell-like pseudo-schemes must be rejected.
- Remote URLs must not contain embedded credentials, raw tokens in userinfo, or raw secret query parameters.
- Remote auth or header configuration in phase 1 must be placeholder-only or secret-binding based. Raw `Authorization`, bearer token, API key, cookie, or arbitrary secret header values must be rejected.
- `https` should be required for non-localhost remote MCPs unless Solution Lead defines a safe local-development exception. Any `http` local-development exception must be visibly warned and must not be documented as the normal shared path.
- Known unsafe network targets such as metadata service addresses, malformed hosts, and unsupported local file paths must be rejected or blocked before mutation.
- Private-network, localhost, self-signed, or otherwise unusual remote targets must produce visible risk warnings or degraded/not_configured status where applicable.
- Doctor/test output for remote MCPs must sanitize provider/network failures and must not print raw response payloads that may include credentials.

### Secret Placeholders And Key Handling

- Raw secrets are allowed only in the existing local OpenKit secret file and process memory/child environment paths already allowed by FEATURE-941.
- Custom MCP definitions, OpenKit custom config, generated OpenKit/global profiles, docs, command output, doctor/test output, runtime summaries, workflow evidence, and logs must use placeholders or redacted key state only.
- Placeholder values such as `${CUSTOM_MCP_TOKEN}` are not usable secrets and must not be reported as configured keys.
- If a custom MCP declares secret bindings, the binding names must be explicit, redacted in output, and compatible with the existing secret-store/set-key model where supported.
- Phase 1 must not copy raw key values from global config during `import-global`; raw values must be skipped, converted to missing placeholder-backed bindings, or rejected with remediation guidance.
- If `set-key` support is extended to custom MCPs, it must preserve existing safe entry behavior (`--stdin` or equivalent non-echoing path), secret-store permissions, redacted output, and auto-enable semantics only where explicitly defined by Solution Lead.
- Removing a custom MCP must not print, copy, or export associated secret values. By default, raw local secret values should not be deleted silently; any secret cleanup path must be explicit and redacted.

### Scope Semantics

- Supported scopes remain `openkit`, `global`, and `both`; default remains `openkit` when no scope is supplied.
- `openkit` scope materializes custom MCP entries for the OpenKit-managed profile used by `openkit run`.
- `global` scope may materialize OpenKit-managed custom entries into global OpenCode config using placeholders only and must preserve unrelated/unmanaged global config.
- `both` applies the requested action to both scopes and must report per-scope success, skip, conflict, or failure.
- Scope-specific enablement must be inspectable for custom MCPs, including entries enabled in one scope and disabled or conflicted in another.
- Direct OpenCode caveats from FEATURE-941/FEATURE-945 still apply: global-scope placeholder-backed custom MCPs require the user's direct OpenCode environment to provide needed env vars.
- Invalid scope values must fail with supported values and no mutation.

### Import-Global Safety

- `import-global` reads selected existing global OpenCode MCP definitions and creates OpenKit-managed custom entries only after validation.
- Importing from global config must not mutate the source global entry by default.
- Importing from global config must not copy raw env values, raw headers, raw URL credentials, raw provider tokens, comments containing secrets, or provider payloads.
- If a global entry contains raw secret values, import must preserve only non-secret structural fields and convert secret-bearing fields to placeholders/missing-key guidance, or reject the entry with a redacted reason.
- Imported entries must receive `imported-global` origin metadata and must be distinguishable from entries created directly through add-local/add-remote.
- Import must validate imported local commands and remote URLs using the same safety rules as direct custom add flows.
- Import must report per-entry outcomes: imported, skipped, conflict, invalid, unsupported, or needs secret setup.
- Import must fail or skip on bundled id conflicts unless the user chooses a safe new custom id/import-as flow.
- Bulk import, if included, must require explicit selection or confirmation and must not silently import invalid/conflicted entries.

### Disable And Remove Semantics

- Disabling a custom MCP changes enablement for the selected scope only and preserves the custom definition and any stored local secret values.
- Disabling a custom MCP must keep it visible in custom list/doctor output as disabled.
- Removing a custom MCP removes the OpenKit-managed custom definition and OpenKit-managed profile materialization for the selected scope or entry, as defined by Solution Lead.
- Removing a custom MCP must not remove bundled MCP entries and must not overwrite or delete unmanaged global OpenCode entries.
- Removing a custom MCP with associated secret bindings must report redacted orphan/cleanup guidance; raw secret deletion must be separate or explicitly confirmed if supported.
- Repeated disable/remove operations must be idempotent and must not corrupt custom config, bundled config, global config, or secret files.

### Conflict Handling And Risk Warnings

- All mutating custom operations must detect and report conflicts before writing when practical.
- Conflicts include bundled id collisions, duplicate custom ids, unmanaged global entries with the same id, invalid or unsupported definition shape, selected-scope ownership mismatch, and unsafe secret-bearing fields.
- Default conflict behavior is fail/skip with no mutation for the conflicted entry; forced replacement, if supported, must be explicit, scoped to OpenKit-managed custom entries, and documented.
- Command output must distinguish warnings from failures: warnings may allow a user-approved mutation; failures block mutation.
- Local command risk warnings must appear before first enable/test of a new local custom MCP.
- Remote MCP risk warnings must appear for non-default network risk, non-HTTPS local-development exceptions, private network targets, unavailable dependencies, and placeholder-missing auth.
- JSON output, if supported for custom commands, must carry equivalent redacted statuses and warnings without raw secrets.

### Interactive Wizard Relationship

- The FEATURE-945 wizard may show custom MCPs in inventory/status views once custom support exists.
- The wizard should be able to doctor/test custom MCPs or route users to the non-interactive custom commands.
- A full custom creation wizard is not required in phase 1.
- If Solution Lead includes simple custom creation in the wizard, it must satisfy the same validation, placeholder, warning, and no-raw-secret rules as the non-interactive commands.
- The wizard must not create a second custom MCP source of truth.

## Acceptance Criteria Matrix

### Custom Inventory And Separation

- **Given** bundled MCPs and custom MCPs both exist, **when** the operator lists MCPs or custom MCPs, **then** custom entries are visible as custom/origin-labeled entries and bundled entries retain their existing catalog labels and behavior.
- **Given** no custom MCPs exist, **when** the operator lists custom MCPs, **then** output reports an empty custom set with no config mutation.
- **Given** a custom MCP is disabled in `global` scope but enabled in `openkit` scope, **when** list/doctor runs with `both`, **then** output distinguishes the per-scope states.

### Add Local Custom MCP

- **Given** the operator provides a valid custom id, local executable, and structured arguments, **when** they add a local custom MCP for `openkit` scope, **then** OpenKit stores an OpenKit-managed custom definition, materializes placeholder-only profile content for the selected scope, and reports the local execution risk warning.
- **Given** the local command is empty, malformed, unsupported, or contains shell chaining/redirection/command substitution in an unsafe form, **when** the operator attempts to add it, **then** the command fails with a sanitized validation reason and no custom MCP mutation.
- **Given** a local custom MCP includes secret-bearing env needs, **when** it is added, **then** config/profile output stores placeholders or secret-binding metadata only and reports missing-key/not_configured until the key is set through the approved secret path.
- **Given** a local executable cannot be found or is not runnable, **when** doctor/test runs, **then** the custom MCP reports unavailable/degraded/not_configured with remediation guidance and does not pretend the MCP is ready.

### Add Remote Custom MCP

- **Given** the operator provides a valid custom id and safe supported remote URL, **when** they add a remote custom MCP, **then** OpenKit stores an OpenKit-managed custom definition and materializes placeholder-only profile content for the selected scope.
- **Given** the remote URL uses an unsupported scheme, embedded credentials, malformed host, raw secret query token, or blocked unsafe target, **when** the operator attempts to add it, **then** the command fails with a sanitized validation reason and no mutation.
- **Given** the remote MCP requires auth, **when** auth/header fields are configured in phase 1, **then** only placeholders or secret-binding references are accepted and raw header/token values are rejected.
- **Given** the remote URL uses a local-development exception such as localhost HTTP, **when** the definition is accepted, **then** output includes a visible risk warning and doctor/test preserves that caveat.

### Import Global MCPs

- **Given** the user has an existing global OpenCode MCP entry with no raw secrets and a valid definition, **when** they import it into OpenKit-managed custom config, **then** OpenKit creates a custom entry with `imported-global` origin metadata and does not mutate the source global entry.
- **Given** a global OpenCode MCP entry contains raw env values, raw headers, embedded URL credentials, or token-like query values, **when** import runs, **then** raw values are not copied; the entry is imported with placeholder/missing-key guidance or skipped/rejected with a redacted reason.
- **Given** an imported global MCP id collides with a bundled MCP id, **when** import runs without a safe new custom id, **then** the entry is skipped or fails with no bundled MCP mutation.
- **Given** multiple global entries are imported, **when** some entries are invalid or conflicted, **then** the result reports per-entry imported/skipped/conflict/invalid outcomes without hiding partial success.

### Disable And Remove Custom MCPs

- **Given** an enabled custom MCP, **when** the operator disables it for `openkit` scope, **then** only that scope is disabled, the custom definition remains, stored secrets remain redacted/preserved, and list/doctor shows the disabled state.
- **Given** an OpenKit-managed custom MCP exists, **when** the operator removes it, **then** OpenKit removes only the OpenKit-managed custom definition/profile materialization described by the command and preserves bundled MCPs and unmanaged global entries.
- **Given** a removed custom MCP has associated secret bindings, **when** removal completes, **then** output gives redacted secret cleanup guidance and does not print or copy the secret value.
- **Given** disable/remove is repeated, **when** the same command is run again, **then** the operation is idempotent and reports already-disabled/already-absent state without corrupting config.

### Doctor And Test Custom MCPs

- **Given** a valid enabled custom MCP, **when** doctor/test runs, **then** OpenKit reports readiness using existing status vocabulary and redacted details.
- **Given** a custom MCP is disabled, **when** test runs, **then** OpenKit reports disabled/skipped and does not silently enable it.
- **Given** a custom MCP is missing placeholder-backed secrets, **when** doctor/test runs, **then** OpenKit reports missing-key/not_configured and does not call a provider using placeholders as real secrets.
- **Given** local command execution or remote provider/network failure returns sensitive output, **when** doctor/test reports the result, **then** output is sanitized and does not include raw secrets, request headers, provider payloads, or env dumps.

### Conflict And Secret Non-Leakage

- **Given** a synthetic real-looking secret is present in a global config fixture or entered through a secret path, **when** add/import/list/doctor/test/disable/remove commands, generated profiles, docs examples, workflow evidence, runtime summaries, and logs are inspected, **then** the raw value appears only in the approved local secret file/process path and nowhere else.
- **Given** a custom id conflicts with a bundled id, existing custom id, or unmanaged global id, **when** a mutating command runs, **then** default behavior is no mutation for the conflicted entry and a clear redacted conflict report.
- **Given** global scope is used for a custom MCP, **when** summary/help/doctor output is shown, **then** the direct OpenCode environment-variable caveat appears.

### Interactive Wizard Visibility

- **Given** custom MCP support is present and custom entries exist, **when** the operator opens the FEATURE-945 wizard, **then** the wizard can show custom MCP entries or provide a clear custom MCP status entry point without mixing them into bundled catalog ownership.
- **Given** the wizard tests or doctors a custom MCP, **when** it reports results, **then** it follows the same redaction, status, and warning rules as non-interactive custom commands.
- **Given** the wizard does not implement full custom creation, **when** a user wants to create a custom MCP, **then** it points to the non-interactive custom add/import commands rather than implying unsupported wizard creation.

## Edge Cases And Risks

- A local MCP command is valid JSON/config shape but executes arbitrary local code; risk warning and explicit test intent are required.
- A user tries to add a shell command string that works manually but is unsafe for structured config.
- A local executable path contains spaces, unicode, symlinks, relative segments, or points to a missing file.
- A local MCP needs env vars, cwd, or PATH behavior that differs between the current shell and `openkit run`.
- A remote MCP URL uses localhost, private network, self-signed TLS, HTTP for local development, redirects, or unusual ports.
- A remote provider returns an error payload containing echoed headers or credentials.
- A global OpenCode config contains raw secrets, comments with secrets, unsupported MCP shapes, duplicate ids, or user-managed entries that conflict with the desired custom id.
- Importing the same global entry multiple times could create duplicates unless idempotency and import-as behavior are explicit.
- A custom MCP id later becomes a bundled MCP id in a future OpenKit release; Solution Lead must define upgrade conflict handling.
- Removing a custom MCP may leave orphaned local secret values unless cleanup is explicit.
- Global-scope custom entries may not work in direct OpenCode until the user exports needed environment variables outside OpenKit.
- Existing running OpenKit/OpenCode sessions may require restart before profile changes take effect.
- JSON and human output must stay semantically aligned so automation does not miss warnings or conflicts.

## Error And Failure Cases

- Unknown custom MCP id: show a clear unknown-custom entry message and perform no mutation.
- Bundled id used with custom add/import/remove: reject with guidance to bundled MCP commands and perform no custom mutation.
- Invalid scope: show supported scopes `openkit`, `global`, and `both`, then perform no mutation.
- Invalid local command: reject or mark invalid before profile materialization, with sanitized reason and no secret leakage.
- Invalid remote URL/header/auth: reject or mark invalid before profile materialization, with sanitized reason and no secret leakage.
- Unsafe or unreadable global config during import: fail/skip with redacted reason and do not copy raw values.
- Partial `both` failure: report per-scope result and keep successful OpenKit-managed changes inspectable without hiding failed/conflicted scope state.
- Profile ownership conflict: preserve unmanaged entry, report conflict/remediation, and avoid overwrite.
- Secret-store permission failure: custom secret-binding setup fails closed using existing secret safety expectations.
- Interrupted mutation: preserve already-committed safe state, avoid duplicate profile entries on retry, and print no raw secrets.

## Open Questions And Assumptions

- Assumption: the command family remains under `openkit configure mcp`; exact subcommand grammar is Solution Lead-owned as long as phase-1 capabilities are present and documented.
- Assumption: custom MCP definitions use the same scope vocabulary, redaction model, profile materialization ownership, and status vocabulary as bundled MCPs.
- Assumption: `import-global` defaults to importing selected entries for OpenKit-managed use and does not mutate the source global config unless a separate explicit global-scope materialization command safely applies.
- Assumption: full custom creation in the interactive wizard is optional; non-interactive add/import is sufficient for phase 1.
- Open question for Solution Lead: define exact accepted local command representation and validation strictness so legitimate MCP launchers work without enabling shell injection.
- Open question for Solution Lead: define exact supported remote MCP transports and URL validation policy, including whether localhost HTTP is allowed with warning.
- Open question for Solution Lead: define whether custom MCP secret bindings extend existing `set-key` syntax or use a new explicit custom secret-binding flow.
- Open question for Solution Lead: define upgrade behavior if a future bundled MCP id conflicts with an existing custom id.

## Success Signal

- A user can add a local custom MCP, add a remote custom MCP, import a selected global MCP, list custom entries, disable/remove a custom entry, and doctor/test custom entries through OpenKit-managed surfaces while bundled MCP behavior remains unchanged and raw secrets never appear outside the approved secret-store/process paths.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate custom add-local, add-remote, import-global, list-custom, disable-custom, remove-custom, doctor-custom, and test-custom behavior; validate scope handling, per-scope partial failures, idempotency, conflict reporting, direct OpenCode caveats, local command validation, remote URL/header validation, import redaction, risk warnings, and no raw secret output. |
| `runtime_tooling` | Validate runtime capability inventory, MCP doctor/read models, session materialization, and custom MCP status reporting distinguish bundled vs custom entries, show origin/ownership/scope state, preserve standard status labels, and redact secret state. |
| `documentation` | Validate operator docs, supported-surface docs, help text, runbooks, and examples describe custom MCP lifecycle commands, phase-1 limitations, local/remote validation rules, import-global safety, secret placeholders, remove/disable semantics, conflict behavior, risk warnings, and target-project validation boundaries using placeholders only. |
| `compatibility_runtime` | Validate workflow-state/evidence/readiness records and runtime summaries label evidence with correct surfaces and do not contain raw secrets; use compatibility checks only for OpenKit workflow/runtime integrity, not target-project application behavior. |
| `target_project_app` | Unavailable for this feature unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit CLI/runtime/MCP checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve FEATURE-941 bundled MCP catalog behavior, FEATURE-945 wizard behavior, existing scope semantics, status vocabulary, secret-store model, direct OpenCode caveat, and redaction rules.
- Design the exact CLI grammar for custom phase-1 capabilities while keeping it under the existing `openkit configure mcp` mental model.
- Make bundled/custom/unmanaged-global ownership explicit in data model, command output, profile materialization, doctor/test output, and docs.
- Treat local command validation and remote URL/header validation as first-class safety gates, with clear separation between blocking failures and user-visible warnings.
- Define safe import-global behavior around raw secret fields, unsupported shapes, id conflicts, and per-entry results before implementation.
- Plan sentinel-secret validation that proves raw values from global config fixtures, stdin secret entry, local env placeholders, headers, generated profiles, command output, workflow evidence, and docs do not leak outside allowed paths.
- Keep validation evidence separated by `global_cli`, `runtime_tooling`, `documentation`, and `compatibility_runtime`; keep `target_project_app` explicitly unavailable unless real target app commands exist.
- Ensure Code Review and QA focus on no-secret-leakage, bundled behavior preservation, ownership/conflict safety, local/remote validation, import-global raw-secret avoidance, idempotent remove/disable, and warning visibility.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, users, goals/non-goals, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, risks, assumptions/open questions, and Solution Lead handoff notes for `product_to_solution` review.
