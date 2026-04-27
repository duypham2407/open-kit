---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-945
feature_slug: interactive-mcp-setup-wizard
source_scope_package: docs/scope/2026-04-27-interactive-mcp-setup-wizard.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Interactive MCP Setup Wizard

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-27-interactive-mcp-setup-wizard.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-945`.
- Product gate: `product_to_solution` is approved in workflow state.
- This package is the `solution_to_fullstack` handoff artifact only. It does not implement the wizard.

## Recommended Path

Add `openkit configure mcp --interactive` as a thin, secret-safe wizard over the existing FEATURE-941 MCP control plane. Keep `src/capabilities/mcp-catalog.js`, `<OPENCODE_HOME>/openkit/mcp-config.json`, `<OPENCODE_HOME>/openkit/secrets.env`, `src/global/mcp/profile-materializer.js`, and `src/global/mcp/health-checks.js` as the source-of-truth stack. The wizard should call shared service operations that also back the existing non-interactive `list|doctor|enable|disable|set-key|unset-key|test` actions; it must not introduce a parallel config model.

This is enough because the repository already has:

- global CLI dispatch through `bin/openkit.js`, `src/cli/index.js`, and `src/cli/commands/configure.js`
- MCP catalog and status vocabulary in `src/capabilities/mcp-catalog.js` and `src/capabilities/status.js`
- local MCP state, secret storage, materialization, health, and redaction modules under `src/global/mcp/`
- runtime capability read models under `src/runtime/managers/*mcp*` and `src/runtime/tools/capability/mcp-doctor.js`
- Node test coverage for CLI, global MCP storage/materialization/secrets, runtime capability tools, and docs governance

Do **not** add the optional `openkit mcp setup` alias in this delivery. It creates a second top-level CLI path for the same behavior and would increase help/docs/test surface without improving the required operator path. The primary command remains `openkit configure mcp --interactive`.

## Dependencies

- No new npm dependency is recommended for the first pass.
- Use Node built-ins for prompts:
  - `readline/promises` for normal line prompts.
  - a small TTY-only hidden prompt helper using `readline.emitKeypressEvents()` plus `stdin.setRawMode(true)` for secrets when available.
- Hidden key entry must fail closed with `set-key --stdin` guidance if the current input stream cannot safely disable echo.
- No environment variable is required to run the wizard. Real provider keys remain operator-provided local values and must be stored only in `<OPENCODE_HOME>/openkit/secrets.env`.
- Target-project app validation remains unavailable for this feature unless a separate target project declares app-native build/lint/test commands.

## Impacted Surfaces

### Global CLI and MCP control plane

- `src/cli/commands/configure.js` — keep parent dispatcher; update help text only if needed.
- `src/global/mcp/mcp-configurator.js` — parse `--interactive`, route to wizard, and keep existing non-interactive actions stable.
- `src/global/mcp/mcp-config-service.js` (create) — shared service facade over catalog/status/enable/disable/key/test/materialize operations.
- `src/global/mcp/interactive-wizard.js` (create) — wizard orchestration and summary rendering.
- `src/global/mcp/wizard-state-machine.js` (create) — pure selection/action state transitions for unit testing.
- `src/global/mcp/interactive-prompts.js` (create) — prompt adapter, selection prompts, confirmation prompts, and hidden secret prompt.
- `src/global/mcp/secret-manager.js` — expose explicit non-mutating inspection and scoped repair helpers without changing the secret location/model.
- `src/global/mcp/redaction.js` — reuse and, if necessary, extend redaction wrappers for wizard summaries/errors.
- `src/global/mcp/health-checks.js` — reuse status/test logic; adjust only if wizard needs a sanitized aggregate helper.
- `src/global/mcp/profile-materializer.js` — reuse current OpenKit-owned materialization/conflict semantics; adjust only if per-scope result detail is insufficient for `both` summaries.

### Runtime and capability read models

- `src/runtime/managers/mcp-health-manager.js`
- `src/runtime/managers/capability-registry-manager.js`
- `src/runtime/tools/capability/mcp-doctor.js`

These should not gain wizard-specific state. They only need to continue reflecting wizard-made changes through the existing config/secret/materialization state.

### Documentation

- `docs/operator/mcp-configuration.md` — add the interactive wizard path, flow, non-TTY behavior, permission repair, and direct OpenCode caveat.
- `docs/operator/README.md` — include the wizard in MCP setup quick-start language.
- `docs/operator/supported-surfaces.md` — update the `openkit configure mcp ...` row to mention `--interactive`.
- `docs/operations/runbooks/openkit-daily-usage.md` — optional first-run guided MCP setup step after `openkit doctor` and before `openkit run` when MCP-backed capabilities are desired.
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md` — mention that interactive MCP setup is a `global_cli` wrapper over the catalog/control plane, not runtime state.
- `context/core/project-config.md` and `AGENTS.md` — update only if command-reality bullets need to name the new interactive flag.

### Tests

- `tests/cli/configure-mcp.test.js` — keep existing non-interactive assertions; add entry/help/non-TTY coverage or split into a new file.
- `tests/cli/configure-mcp-interactive.test.js` (create if clearer) — direct `runCli()` / `runConfigureMcp()` tests with mocked prompt adapters and fake TTY streams.
- `tests/global/mcp-interactive-wizard.test.js` (create) — pure wizard state-machine/service-mock tests.
- `tests/global/mcp-secret-manager.test.js` — permission inspection/repair and fail-closed key-write behavior.
- `tests/global/mcp-profile-materializer.test.js` — `both` scope, conflict, and idempotency result details if expanded.
- `tests/runtime/capability-tools.test.js` — prove runtime read models reflect wizard-produced state and stay redacted.
- `tests/runtime/governance-enforcement.test.js` — docs/help governance for the new command wording and no secret-like examples.

## Boundaries And Components

### `McpConfigService` — shared mutation/read facade

Create a small service module instead of putting wizard behavior directly into `mcp-configurator.js`.

Responsibilities:

- validate MCP ids through `getMcpCatalogEntry()` / `requireMcpCatalogEntry()`
- validate scopes through `expandMcpScope()`
- read redacted inventory through `listMcpStatuses()`
- enable/disable through `setMcpEnabled()` and `materializeMcpProfiles()`
- set/update keys through `setSecretValue()`, `recordSecretBinding()`, `setMcpEnabled()`, and `materializeMcpProfiles()`
- unset keys through `unsetSecretValue()` and `materializeMcpProfiles()` without disabling the MCP
- test readiness through `testMcpCapability()`
- return sanitized per-scope results for every mutating action

The existing non-interactive CLI actions should call this service after the refactor so the wizard and automation path cannot drift.

### `McpInteractiveWizard` — user flow coordinator

Responsibilities:

- TTY guard and startup banner.
- scope selection and direct OpenCode caveat visibility.
- status inventory display with redacted key state.
- MCP/action selection.
- explicit mutation prompts.
- permission repair prompt when local secret store state is unsafe.
- health test prompt and sanitized result rendering.
- final summary of changed, unchanged, skipped, failed, conflict, caveat, and recommended next-command items.

The wizard may commit each confirmed action immediately. It should not collect a large deferred transaction. This keeps implementation simple, matches the existing command semantics, and satisfies cancellation rules by summarizing already-completed mutations if the user exits later.

### `wizard-state-machine.js` — pure flow decisions

Keep navigation/action state transitions separate from filesystem mutation so tests can cover edge cases cheaply.

Suggested pure states:

- `inventory`
- `scope_selection`
- `mcp_selection`
- `action_selection`
- `secret_entry`
- `permission_repair`
- `health_test`
- `summary`
- `cancelled`

Suggested pure events:

- `choose_scope`
- `choose_mcp`
- `choose_action`
- `confirm`
- `decline`
- `cancel`
- `action_result`
- `test_result`

The implementation can use simpler names, but tests must prove invalid choices and cancellations do not imply mutation.

### `interactive-prompts.js` — normal and hidden prompt helpers

Prompt adapter requirements:

- Accept an injected `io.prompt` / `io.promptSecret` in tests.
- For normal CLI use, require `stdin.isTTY` and `stdout.isTTY` before interactive mode starts.
- For hidden secret input, require `stdin.setRawMode` or equivalent safe TTY support.
- Restore raw mode and listeners in `finally`, including on errors, Ctrl+C, or cancellation.
- Never echo, mask, print, log, or return a transformed representation of the key.
- Empty secret input means cancel/skip key mutation, not store an empty value.

If hidden input is unavailable, the wizard must skip key mutation and print guidance to use:

```text
openkit configure mcp set-key <mcp-id> --stdin
```

Do not recommend raw key command arguments in wizard output.

### `secret-manager.js` permission helpers

Add explicit repair functions without changing FEATURE-941's path or storage model.

Recommended API shape:

- `inspectSecretFile({ env, mutate: false })` returns `missing`, `ok`, `unsafe`, or `malformed` with redacted details and path metadata. Viewing status/inventory should not chmod as a side effect.
- `repairSecretStorePermissions({ env })` creates/repairs only `<OPENCODE_HOME>/openkit` and `<OPENCODE_HOME>/openkit/secrets.env` when present.
- POSIX repair target: directory `0700`, file `0600`.
- Windows repair: use closest local-user-only behavior available in Node; if exact ACL repair is not implemented, report `limited`/guidance without printing secrets.
- Existing `setSecretValue()`/`unsetSecretValue()` should still fail closed if secure storage cannot be ensured.

The wizard should call `repairSecretStorePermissions()` only after explicit user confirmation.

## Interfaces And Data Contracts

### Wizard context

The wizard should carry one in-memory context for the current run:

```text
scope: openkit | global | both
selectedMcpId: string | null
changes: WizardSummaryItem[]
caveats: string[]
failures: WizardSummaryItem[]
cancelled: boolean
```

This context must not store raw secret values after a key write attempt completes. Summary items must contain only MCP id, scope, action, status, redacted key state, and sanitized guidance.

### Status row

Reuse `buildMcpStatus()` output fields rather than inventing wizard-only labels:

```text
mcpId
displayName
scope
enabled
capabilityState: available | unavailable | degraded | preview | compatibility_only | not_configured
lifecycle
optional
keyState: { ENV_VAR: missing | present_redacted }
dependencies
guidance
validationSurface: runtime_tooling
```

Disabled remains an enablement field. Do not introduce a `disabled` capability state.

### Per-scope action result

Every mutation should return per-materialized-scope detail:

```text
action: enable | disable | set-key | unset-key | repair-permissions | test
mcpId
requestedScope: openkit | global | both
scopeResults: {
  openkit?: success | skipped | conflict | failed
  global?: success | skipped | conflict | failed
}
keyState?: missing | present_redacted
message: sanitized string
guidance?: sanitized string
```

For `both`, avoid a single success line unless both scopes succeed. Partial success is expected and must be visible.

## Wizard Flow Design

### Entry

1. Parse `openkit configure mcp --interactive [--scope openkit|global|both]`.
2. Reject invalid scopes before any prompt or mutation.
3. Reject `--json` with `--interactive` as a no-mutation usage error; scripted JSON output belongs to existing non-interactive commands.
4. If not interactive TTY and no injected test prompt adapter is present, exit `1` with no mutation and guidance to use non-interactive commands.
5. Default scope to `openkit` when no `--scope` is supplied.

### Initial inventory

1. Show selected scope.
2. If scope is `global` or `both`, show direct OpenCode caveat before mutation choices.
3. Show bundled MCP inventory from the catalog:
   - `openkit`
   - `chrome-devtools`
   - `playwright`
   - `context7`
   - `grep_app`
   - `websearch`
   - `sequential-thinking`
   - `git`
   - `augment_context_engine` when present in catalog
4. For each entry show: enabled by scope, capability state, lifecycle/policy/optional labels, and key state as `missing` or `present (redacted)` only.
5. Loading inventory must not mutate config, profile files, or secrets.

### Main menu

Offer compact actions:

1. change scope
2. select MCP
3. test selected/all enabled MCPs in current scope
4. repair secret-store permissions when inspection reports unsafe
5. refresh status
6. finish and show summary
7. cancel/quit

Cancellation exits cleanly. It must not hide already-completed mutations; the visible summary should say the wizard was cancelled after the listed completed/skipped/failed actions.

### MCP detail/action menu

After selecting an MCP, show redacted details and available actions:

- enable for selected scope
- disable for selected scope
- set/update key only if the catalog entry has a secret binding
- remove/unset key only if the catalog entry has a secret binding
- test health/readiness
- back

For MCPs with no catalog-defined key binding, key actions must be absent or return a clear no-mutation skip. Do not add custom key names or arbitrary MCP definitions.

### Enable/disable

- Confirm the action and selected scope before mutation.
- Apply only through `McpConfigService` and existing config/materialization helpers.
- Enabling a key-required MCP with no key may succeed, but the post-action status must remain `not_configured` with key setup guidance.
- Disabling does not remove stored keys.
- Global user-managed conflicts are preserved and reported.

### Set/update key

1. Validate that the MCP has a catalog-defined secret binding.
2. Inspect the secret store. If unsafe, offer scoped repair first.
3. If repair is declined or fails, skip key mutation and report fail-closed guidance.
4. Prompt through hidden input in TTY; do not echo any character.
5. Empty input means cancel this key action.
6. Write the raw value only through `setSecretValue()`.
7. After the secret write succeeds, record the binding, enable the MCP for the selected scope, and materialize placeholder-only profiles.
8. Print only `present (redacted)` key state.

If secret write fails, do not enable the MCP as if setup succeeded.

### Remove/unset key

- Confirm the action before mutation.
- Use existing `unsetSecretValue()` semantics.
- Do not disable the MCP.
- If the MCP remains enabled, refresh status should show `not_configured` until a new key is stored or the MCP is disabled.

### Test health/readiness

- Use `testMcpCapability()` or a service wrapper over it.
- Disabled MCPs return skipped/disabled.
- Missing required key returns missing-key/`not_configured` and does not attempt provider calls with placeholders.
- Optional MCP absence is not a wizard failure.
- Provider/dependency/browser/network/policy failures must be summarized with sanitized messages only.

### Final summary

Always end with a redacted summary containing:

- selected final scope
- changed items by MCP and scope
- unchanged/idempotent items
- skipped items and reasons
- failed items and sanitized guidance
- conflicts, especially user-managed global OpenCode entries
- caveats, including direct OpenCode env-var caveat for `global` or `both`
- recommended next commands such as `openkit configure mcp doctor --scope <scope>` and `openkit run`

No raw key, partial key prefix/suffix, hash, provider payload, environment dump, or secret file content may appear.

## Non-TTY Behavior

Recommended first delivery behavior: `--interactive` requires a TTY and does not support a mixed stdin wizard mode. Existing non-interactive commands remain the automation path.

Non-TTY requirements:

- Check interactivity before inventory prompts or mutations.
- Exit non-zero with no mutation.
- Do not wait for input or hang.
- Print safe alternatives:
  - `openkit configure mcp list --scope <scope> --json`
  - `openkit configure mcp doctor --scope <scope> --json`
  - `openkit configure mcp enable <mcp-id> --scope <scope>`
  - `openkit configure mcp disable <mcp-id> --scope <scope>`
  - `openkit configure mcp set-key <mcp-id> --scope <scope> --stdin`
  - `openkit configure mcp unset-key <mcp-id> --scope <scope>`
  - `openkit configure mcp test <mcp-id> --scope <scope> --json`
- Do not suggest passing raw keys through visible command arguments.
- Deterministic exit status: `0` only for successful interactive completion/cancel after no internal error; `1` for non-TTY guard, invalid args, unsafe unavailable key entry, or failed action when the command cannot proceed.

## Secret Safety Design

- FEATURE-941 secret model is unchanged.
- Raw secrets may exist only in process memory during entry, `<OPENCODE_HOME>/openkit/secrets.env`, and the child environment created by `openkit run`.
- Generated profiles continue to use placeholders such as `${CONTEXT7_API_KEY}`.
- Wizard output, errors, docs, test logs, runtime summaries, workflow evidence, profile manifests, `mcp-config.json`, and `mcp-profile-state.json` must show only redacted state.
- Placeholder values must not be treated as usable secrets.
- Wrap key-action errors through `redactKnownSecrets()` with the just-entered value before writing to stdout/stderr.
- Tests should use a synthetic sentinel and assert it appears only in the local secret file, not in command output, generated profiles, docs, workflow-state evidence, or runtime read models.
- Avoid storing the raw secret in long-lived wizard context. Keep it local to the key mutation block and discard references after the operation completes.

## Scope Materialization And Partial Failure Semantics

| Requested scope | Materialization target | Secret behavior | Partial failure behavior |
| --- | --- | --- | --- |
| `openkit` | `<OPENCODE_HOME>/profiles/openkit/opencode.json` | Local secret store only; `openkit run` loads it. | Report openkit success/failure. Do not touch global config. |
| `global` | `<OPENCODE_HOME>/opencode.json` for OpenKit-managed entries only | Same local secret store; direct OpenCode still needs exported env vars. | Preserve unmanaged conflicts and report `conflict`/`skipped`; do not overwrite user-owned MCP entries. |
| `both` | Apply `openkit`, then `global`, with separate result rows | For set-key, write secret once before scope enable/materialization. | Do not hide partial success. If key write fails, skip both. If one scope materializes and the other conflicts/fails, keep the successful scope and summarize the failed/conflicted scope. |

Implementation notes:

- Prefer service-level `applyPerScope()` for `both` rather than relying only on a single expanded-scope call when the wizard needs per-scope result detail.
- Materialization conflicts are not secret failures; they are scope-specific config ownership results.
- Do not auto-rollback a successfully stored key only because global profile materialization conflicted. The summary should explain what succeeded and how to resolve or unset if desired.
- Re-running the same wizard choices must be idempotent: no duplicate profile entries, no duplicate secret bindings, and no reset of unrelated user config.

## Implementation Slices

### [ ] Slice 1: CLI parser and shared MCP config service

- **Files**: `src/global/mcp/mcp-configurator.js`, `src/global/mcp/mcp-config-service.js`, `src/cli/commands/configure.js`, `tests/cli/configure-mcp.test.js`.
- **Goal**: add `--interactive` routing without changing existing non-interactive command semantics; extract shared service operations for wizard and existing actions.
- **Validation Command**: `node --test tests/cli/configure-mcp.test.js`.
- **Details**:
  - Write/extend tests first for `--interactive` help/routing, invalid scope, `--json` incompatibility, and existing command compatibility.
  - Keep default scope `openkit`.
  - Keep `--stdin` set-key path unchanged for automation.
  - Do not add `openkit mcp setup` alias.

### [ ] Slice 2: Secret inspection, explicit repair, and hidden prompt helpers

- **Files**: `src/global/mcp/secret-manager.js`, `src/global/mcp/interactive-prompts.js`, `src/global/mcp/redaction.js`, `tests/global/mcp-secret-manager.test.js`, `tests/cli/configure-mcp-interactive.test.js`.
- **Goal**: make key entry hidden in TTY sessions, fail closed when safe input is unavailable, and expose explicit scoped secret-store repair.
- **Validation Command**: `node --test tests/global/mcp-secret-manager.test.js && node --test tests/cli/configure-mcp-interactive.test.js`.
- **Details**:
  - Add tests before implementation for POSIX `0700`/`0600` repair, Windows limitation reporting where practical, hidden prompt failure, echo restoration, empty input cancellation, and sentinel redaction.
  - Inspection/status paths must be read-only; repair requires an explicit wizard action.
  - Repair targets only `<OPENCODE_HOME>/openkit` and `<OPENCODE_HOME>/openkit/secrets.env`.

### [ ] Slice 3: Wizard state machine and inventory/status flow

- **Files**: `src/global/mcp/wizard-state-machine.js`, `src/global/mcp/interactive-wizard.js`, `src/global/mcp/mcp-config-service.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/cli/configure-mcp-interactive.test.js`.
- **Goal**: implement the no-mutation startup inventory, scope selection, MCP selection, cancellation, refresh, and summary shell.
- **Validation Command**: `node --test tests/global/mcp-interactive-wizard.test.js && node --test tests/cli/configure-mcp-interactive.test.js`.
- **Details**:
  - Test pure transitions for invalid choices, scope changes, back/cancel behavior, and final summary state.
  - Inventory must show bundled MCPs, enablement, status vocabulary, lifecycle/policy labels, optional labels, and redacted key states.
  - Opening and exiting the wizard without a mutating action must leave MCP config, secret file, and profiles unchanged.

### [ ] Slice 4: Wizard mutation actions, health tests, and per-scope summaries

- **Files**: `src/global/mcp/interactive-wizard.js`, `src/global/mcp/mcp-config-service.js`, `src/global/mcp/profile-materializer.js` if per-scope detail needs refinement, `src/global/mcp/health-checks.js` if aggregate sanitized testing is needed, `tests/global/mcp-interactive-wizard.test.js`, `tests/cli/configure-mcp-interactive.test.js`, `tests/global/mcp-profile-materializer.test.js`.
- **Goal**: support enable, disable, set/update key, unset key, test health, permission repair action, and final redacted summary with correct partial-failure semantics.
- **Validation Command**: `node --test tests/global/mcp-interactive-wizard.test.js && node --test tests/cli/configure-mcp-interactive.test.js && node --test tests/global/mcp-profile-materializer.test.js`.
- **Details**:
  - Set-key writes the secret first; auto-enable only after successful secret write.
  - Both-scope actions report openkit/global results separately.
  - Global unmanaged MCP entries are preserved and summarized as conflicts/skips.
  - Health tests skip disabled MCPs and missing-key MCPs without provider calls using placeholders.

### [ ] Slice 5: Runtime read-model alignment and operator documentation

- **Files**: `src/runtime/managers/mcp-health-manager.js`, `src/runtime/managers/capability-registry-manager.js`, `src/runtime/tools/capability/mcp-doctor.js`, `docs/operator/mcp-configuration.md`, `docs/operator/README.md`, `docs/operator/supported-surfaces.md`, `docs/operations/runbooks/openkit-daily-usage.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md` if command reality needs a new bullet, `AGENTS.md` if repository-wide command facts change, `tests/runtime/capability-tools.test.js`, `tests/runtime/governance-enforcement.test.js`.
- **Goal**: ensure runtime tooling reflects wizard-made state and operator docs explain the guided path, secret safety, non-TTY alternatives, and validation boundaries.
- **Validation Command**: `node --test tests/runtime/capability-tools.test.js && node --test tests/runtime/governance-enforcement.test.js && npm run verify:governance`.
- **Details**:
  - Do not add wizard-specific runtime state.
  - Docs must use placeholders only and include the direct OpenCode caveat for global/both.
  - Governance tests should reject raw secret-like examples.

### [ ] Slice 6: Integrated regression, packaging, and security evidence

- **Files**: `package.json` only if new tests need script inclusion; otherwise no source file should be changed solely for this slice.
- **Goal**: run the relevant OpenKit CLI/runtime/docs regression set and capture security-focused evidence before review.
- **Validation Command**: `npm run verify:install-bundle && npm run verify:governance && node --test tests/global/*.test.js && node --test tests/cli/*.test.js && node --test tests/runtime/capability-tools.test.js && npm run verify:all`.
- **Details**:
  - If `npm run verify:all` fails because of unrelated environment/tooling availability, record the exact failing surface and run the narrower authoritative commands above.
  - Because this feature touches secret handling and CLI input, Code Review should run direct `tool.security-scan` when available or document direct-tool unavailability and substitute evidence according to `context/core/tool-substitution-rules.md`.
  - Do not report any OpenKit CLI/runtime result as `target_project_app` validation.

## Dependency Graph

- Critical path: `SERVICE-PARSER -> SECRET-PROMPTS -> WIZARD-FLOW -> MUTATIONS-SUMMARY -> DOCS-RUNTIME -> INTEGRATED-VALIDATION`.
- Sequential constraints:
  - `TASK-SERVICE-PARSER -> TASK-SECRET-PROMPTS -> TASK-WIZARD-FLOW -> TASK-MUTATIONS-SUMMARY -> TASK-DOCS-RUNTIME -> TASK-INTEGRATED-VALIDATION`
- Slice 5 docs may start as draft after Slice 3, but final docs/help/governance tests must wait for Slice 4 behavior to stabilize.
- Slice 6 cannot start until every prior slice has passing targeted tests or recorded blockers.

## Parallelization Assessment

- `parallel_mode`: `none`
- `why`: The feature touches shared CLI dispatch, secret input, permission repair, config materialization, docs, and redaction guarantees. Parallel code edits would increase the chance of divergent service/wizard semantics or missed secret leakage. Keep execution sequential even if a task board is created.
- `safe_parallel_zones`: []
- `sequential_constraints`: [`TASK-SERVICE-PARSER -> TASK-SECRET-PROMPTS -> TASK-WIZARD-FLOW -> TASK-MUTATIONS-SUMMARY -> TASK-DOCS-RUNTIME -> TASK-INTEGRATED-VALIDATION`]
- `integration_checkpoint`: after Slice 4, run CLI interactive, global secret/materializer, and runtime capability tests together before docs are finalized or QA starts.
- `max_active_execution_tracks`: 1

Task board recommendation: create a full-delivery task board for traceability with one task per slice above, but keep it sequential (`parallel_mode=none`). The task board should record artifact refs for the exact files in each slice and should not dispatch overlapping implementation work.

## Validation Matrix

| Acceptance / risk target | Validation path | Surface label |
| --- | --- | --- |
| `openkit configure mcp --interactive` routes correctly and existing commands keep working | `node --test tests/cli/configure-mcp.test.js`; `node --test tests/cli/configure-mcp-interactive.test.js` | `global_cli` |
| Non-TTY invocation fails fast with no mutation and safe scripted alternatives | CLI test using non-TTY stdin/stdout and before/after file assertions | `global_cli` |
| Inventory/status is read-only and redacted | CLI/wizard tests compare file state before/after no-op exit and assert no sentinel in stdout/stderr | `global_cli` |
| Hidden TTY key entry, cancellation, echo restoration, and fail-closed fallback | prompt-helper unit tests plus CLI integration with injected `promptSecret`/fake TTY streams | `global_cli` |
| Secret store permission repair is scoped and safe | `node --test tests/global/mcp-secret-manager.test.js` | `global_cli` / local secret storage |
| Set-key writes raw value only to local secret file and auto-enables after success | CLI/wizard tests plus profile/materializer assertions | `global_cli` |
| Disable keeps stored key; unset-key does not disable MCP | existing and extended `tests/cli/configure-mcp.test.js` | `global_cli` |
| `both` scope reports openkit/global success, conflict, skip, and failure separately | wizard/service tests and `tests/global/mcp-profile-materializer.test.js` | `global_cli` |
| Health tests skip disabled/missing-key MCPs and sanitize failures | wizard/service tests plus `tests/runtime/capability-tools.test.js` where runtime read models apply | `global_cli` / `runtime_tooling` |
| Runtime capability tools reflect wizard-made state without wizard-specific state | `node --test tests/runtime/capability-tools.test.js` | `runtime_tooling` |
| Docs explain wizard, direct OpenCode caveat, non-TTY alternatives, and no target-app validation claim | `node --test tests/runtime/governance-enforcement.test.js`; `npm run verify:governance` | `documentation` |
| Package includes new source/docs/tests as needed | `npm run verify:install-bundle`; optionally `npm pack --dry-run` during release prep | `global_cli` / package surface |
| No target-project application validation is claimed | Review solution/implementation/QA evidence labels; no app-native command is required for this feature | `target_project_app` unavailable |

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide evidence for:

1. `node --test tests/cli/configure-mcp.test.js`
2. `node --test tests/cli/configure-mcp-interactive.test.js`
3. `node --test tests/global/mcp-interactive-wizard.test.js`
4. `node --test tests/global/mcp-secret-manager.test.js`
5. `node --test tests/global/mcp-profile-materializer.test.js`
6. `node --test tests/runtime/capability-tools.test.js`
7. `node --test tests/runtime/governance-enforcement.test.js`
8. `npm run verify:governance`
9. `npm run verify:install-bundle`
10. `npm run verify:all` when environment/tooling allows the full gate

The evidence must label OpenKit CLI/runtime/docs surfaces honestly and must state that `target_project_app` validation is unavailable for this feature.

## Rollback Notes

- There is no schema migration requirement. New wizard code can be reverted without changing FEATURE-941 state file formats.
- If a wizard run partially configures a user's local MCP state, rollback uses existing commands:
  - `openkit configure mcp disable <mcp-id> --scope <scope>` for enablement rollback.
  - `openkit configure mcp unset-key <mcp-id> --scope <scope>` for local key removal.
- Do not auto-delete a stored key merely because global materialization conflicts; report the partial state and let the operator choose rollback.
- If permission repair produces an unexpected platform issue, revert the explicit repair helper and keep existing non-interactive `set-key --stdin` as the safe automation path.
- If hidden prompt behavior proves unreliable on a platform, key mutation should remain disabled in the wizard on that platform and point to `set-key --stdin` rather than falling back to echoed input.

## Risks And Trade-offs

- **Hidden input reliability**: terminal raw mode differs by platform. Mitigation: TTY guard, `finally` restoration, tests with injected prompt adapters, and fail-closed fallback.
- **Secret leakage through errors**: provider or filesystem errors could include sensitive text. Mitigation: redact with the entered value before output, avoid provider payload dumps, and sentinel tests.
- **Read-only status accidentally mutating permissions**: current secret helpers secure paths during some reads. Mitigation: split read-only inspection from explicit repair.
- **`both` scope user expectations**: one scope may succeed while the other conflicts. Mitigation: per-scope summaries and no all-or-nothing success wording.
- **Global OpenCode caveat confusion**: global profiles use placeholders and direct OpenCode does not load OpenKit secrets. Mitigation: show caveat before global/both mutations and in the final summary/docs.
- **Policy-gated `git` MCP**: wizard must not imply destructive git operations are enabled. Mitigation: preserve catalog policy labels and do not add special bypasses.
- **Test brittleness for TTY behavior**: spawned Node tests usually run non-TTY. Mitigation: test TTY paths through injectable prompt adapters and reserve real terminal smoke for QA/manual evidence if needed.

## Reviewer Focus Points

- The wizard is a wrapper over existing catalog/config/secret/materialization services, not a second source of truth.
- No arbitrary custom MCP add/import/edit path was introduced.
- FEATURE-941 secret location, placeholder profile model, scope vocabulary, and unset-key semantics are unchanged.
- `--interactive` non-TTY behavior fails fast and never hangs.
- Hidden key prompt never echoes and restores terminal state on cancellation/error.
- Raw secrets appear only in `<OPENCODE_HOME>/openkit/secrets.env` and process memory during entry.
- `global` and `both` preserve user-managed global OpenCode MCP entries.
- `target_project_app` validation is not claimed.

## Handoff Notes

- Fullstack must implement the slices sequentially and keep tests ahead of behavior changes for CLI/service/wizard logic.
- Code Reviewer must review scope compliance first, then secret-safety, non-TTY, permission repair, per-scope partial failure, and redaction quality.
- QA must verify the wizard as `global_cli`, runtime read-model reflection as `runtime_tooling`, workflow/evidence redaction as `compatibility_runtime` where evidence is recorded, docs as `documentation`, and must mark `target_project_app` unavailable unless a real target application is introduced.

## Solution Lead Handoff Decision

- **Pass:** this solution package defines one recommended path, explicit impacted surfaces, component boundaries, wizard flow, secret/non-TTY/scope semantics, sequential implementation slices, validation by surface, rollback notes, and reviewer/QA focus points for `solution_to_fullstack` approval.
