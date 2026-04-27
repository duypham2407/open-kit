---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-948
feature_slug: custom-mcp-add-import
source_scope_package: docs/scope/2026-04-27-custom-mcp-add-import.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Custom MCP Add And Import

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-27-custom-mcp-add-import.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-948` / `feature-948`.
- Product gate: `product_to_solution` is approved in workflow state.
- This package is the `solution_to_fullstack` handoff artifact only. It does not implement custom MCP support.

## Recommended Path

Add a separate OpenKit-managed **custom MCP registry/store** beside the bundled catalog, then merge bundled and custom entries only at read/materialization boundaries. Keep bundled MCP behavior intact by leaving `src/capabilities/mcp-catalog.js` and bundled `enable|disable|set-key|unset-key|test` semantics as the bundled source of truth, while adding custom-only service operations under the existing `openkit configure mcp` command family.

This is enough for phase 1 because the repository already has a working MCP control plane:

- CLI dispatch through `bin/openkit.js`, `src/cli/index.js`, and `src/cli/commands/configure.js`.
- Bundled MCP parser/service path in `src/global/mcp/mcp-configurator.js` and `src/global/mcp/mcp-config-service.js`.
- Bundled MCP state in `<OPENCODE_HOME>/openkit/mcp-config.json` through `src/global/mcp/mcp-config-store.js`.
- Profile ownership and global conflict tracking in `src/global/mcp/profile-materializer.js`.
- Secret storage/redaction helpers in `src/global/mcp/secret-manager.js` and `src/global/mcp/redaction.js`.
- Health/status paths in `src/global/mcp/health-checks.js`, runtime read models in `src/runtime/managers/mcp-health-manager.js`, and the FEATURE-945 wizard in `src/global/mcp/interactive-wizard.js`.

Do **not** create a second top-level CLI family. Do **not** add full custom creation to the interactive wizard in phase 1. The wizard should only discover/list/test custom MCPs and route creation/import to non-interactive custom commands.

## Dependencies

- No new npm dependency is recommended for phase 1.
- Use Node built-ins for validation and path/URL handling: `node:fs`, `node:path`, `node:os`, `node:url`, `node:net`, and `node:child_process` only where existing tests already spawn the CLI.
- Remote custom MCP phase 1 should validate and materialize URL definitions, but doctor/test should stay dependency-light and must not dump provider payloads. If a true transport handshake is not safely supported by existing OpenCode/OpenKit APIs, report URL definitions as structurally valid / not_configured / provider-unverified rather than pretending a full protocol test ran.
- Existing secret-store support remains `<OPENCODE_HOME>/openkit/secrets.env`. Custom secret values may be written only through a safe `set-key --stdin` path if custom bindings are added to the existing secret manager; all config/profile/docs/output use placeholders only.
- Target-project app validation is unavailable for this feature. OpenKit CLI/runtime/docs checks are not target application build/lint/test evidence.

## Impacted Surfaces

### Custom registry, inventory, and validation

- `src/global/mcp/custom-mcp-store.js` (create) — persistent custom registry separate from bundled config.
- `src/global/mcp/custom-mcp-validation.js` (create) — id, local command, remote URL, header/env placeholder, import, conflict, and risk-warning validation.
- `src/global/mcp/mcp-inventory.js` or equivalent small helper (create if useful) — merged read model over bundled catalog plus custom entries.
- `src/global/mcp/mcp-config-service.js` — add custom lifecycle methods while preserving bundled methods.
- `src/global/mcp/mcp-configurator.js` — parse custom subcommands and render redacted JSON/human output.
- `src/global/mcp/health-checks.js` — build/test status for custom entries without provider payload leakage.
- `src/global/mcp/profile-materializer.js` — materialize bundled and custom entries with ownership flags and conflict preservation.

### Existing bundled MCP and FEATURE-945 wizard

- `src/capabilities/mcp-catalog.js` — read only for bundled id conflict checks; do not convert custom entries into bundled catalog entries.
- `src/global/mcp/mcp-config-store.js` — may receive minor compatibility helpers only; avoid mixing custom definitions into bundled `scopes` defaults.
- `src/global/mcp/interactive-wizard.js` — add custom inventory visibility/test routes, not a full custom creation wizard.
- `src/global/mcp/wizard-state-machine.js` — allow custom selection/test states if needed without weakening bundled selection behavior.

### Runtime capability read models

- `src/runtime/managers/mcp-health-manager.js` — include custom entries with origin/ownership/source fields where MCP health is listed.
- `src/runtime/managers/capability-registry-manager.js` — route/list custom entries as MCP capabilities only when enabled and safe, without changing bundled skill/MCP references.
- `src/runtime/tools/capability/mcp-doctor.js` — include custom issues/statuses with standard capability states and custom ownership metadata.
- `src/runtime/capability-registry.js` — update only if runtime capability inventory should list custom MCP capabilities; keep bundled capability list separate.

### Documentation and tests

- `docs/operator/mcp-configuration.md` — command reference, custom registry location, secret model, validation rules, import-global safety, disable/remove semantics, risk warnings, direct OpenCode caveat.
- `docs/operator/supported-surfaces.md`, `docs/operator/README.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md`, and `AGENTS.md` — update command-reality/current-state bullets only where new commands become real.
- `tests/cli/configure-mcp.test.js`, `tests/cli/configure-mcp-interactive.test.js`, `tests/global/mcp-config-store.test.js`, `tests/global/mcp-profile-materializer.test.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/runtime/capability-tools.test.js`, `tests/runtime/mcp-catalog.test.js`, `tests/runtime/governance-enforcement.test.js`.
- New focused tests are expected: `tests/global/custom-mcp-store.test.js`, `tests/global/custom-mcp-validation.test.js`, and optionally `tests/cli/configure-mcp-custom.test.js` if splitting the CLI suite keeps fixtures readable.

## Boundaries And Components

### Custom MCP store — separate source of truth

Create a custom-only store at `<OPENCODE_HOME>/openkit/custom-mcp-config.json` instead of extending the bundled catalog or placing custom definitions inside bundled default config.

Recommended schema shape:

```json
{
  "schema": "openkit/custom-mcp-config@1",
  "version": 1,
  "updatedAt": "<iso timestamp>",
  "entries": {
    "my-custom": {
      "id": "my-custom",
      "displayName": "My Custom MCP",
      "origin": "local | remote | imported-global",
      "ownership": "openkit-managed-custom",
      "enabled": { "openkit": true, "global": false },
      "definition": {},
      "secretBindings": [],
      "riskWarnings": [],
      "createdAt": "<iso timestamp>",
      "updatedAt": "<iso timestamp>"
    }
  },
  "imports": {
    "my-custom": {
      "source": "global-opencode",
      "sourceId": "original-global-id",
      "importedAt": "<iso timestamp>"
    }
  }
}
```

Store rules:

- No raw secret values in any field.
- No bundled MCP entries in this file.
- No unmanaged global entries in this file unless explicitly imported and converted to OpenKit-managed custom entries.
- Read/list commands must not create the file. Mutating commands create it with `0700` parent permissions via existing path helpers where practical.
- Repeated add/import/disable/remove must be idempotent and must not duplicate profile entries.

### Custom definition contracts

Use a normalized internal shape before writing or materializing.

Local custom definition:

```json
{
  "type": "local",
  "command": ["executable", "arg1", "arg2"],
  "cwd": null,
  "environment": {
    "CUSTOM_TOKEN": "${CUSTOM_TOKEN}"
  }
}
```

Remote custom definition:

```json
{
  "type": "remote",
  "transport": "http | sse | streamable-http",
  "url": "https://example.invalid/mcp",
  "headers": {
    "Authorization": "${CUSTOM_MCP_AUTHORIZATION}"
  },
  "environment": {}
}
```

Implementation must verify the exact OpenCode profile shape currently expected for remote MCPs before materialization. If OpenCode requires a different key than `url` or `headers`, use the verified OpenCode shape in profiles but keep the internal custom definition explicit and placeholder-only. Do not guess by copying examples from docs without tests around generated profile output.

### Merged inventory read model

Add a helper that returns bundled and custom inventories without changing bundled catalog functions:

```text
listMcpInventory({ scope, includeBundled = true, includeCustom = true }) -> InventoryStatus[]
```

Each row should include:

```text
mcpId
displayName
kind: bundled | custom
origin: bundled | local | remote | imported-global
ownership: openkit-bundled | openkit-managed-custom | unmanaged-global-conflict
scope
enabled
capabilityState
keyState
dependencies
riskWarnings
conflicts
validationSurface: runtime_tooling
```

Bundled-only commands should continue to use catalog helpers unless intentionally listing all. Custom-only commands should use custom helpers and reject bundled ids with guidance.

### Profile ownership and conflict model

Extend `src/global/mcp/profile-materializer.js` to materialize two managed namespaces into the same profile `mcp` object while preserving ownership metadata in `mcp-profile-state.json`.

Recommended profile-state addition:

```json
{
  "profiles": {
    "openkit": {
      "managedEntries": {
        "context7": { "kind": "bundled", "entryHash": "..." },
        "my-custom": { "kind": "custom", "ownership": "openkit-managed-custom", "entryHash": "..." }
      }
    },
    "global": {
      "managedEntries": {},
      "conflicts": {}
    }
  }
}
```

Conflict rules:

- Custom id collides with bundled id: fail with no mutation.
- Custom id collides with existing custom id: fail by default; allow only explicit `--replace` for OpenKit-managed custom entries if implemented and tested. Do not add replacement as a hidden default.
- Global profile contains the same id and it is not recorded as OpenKit-managed: skip/fail that scope and preserve the user entry.
- `both` scope reports separate `openkit` and `global` outcomes.
- A future bundled catalog id colliding with an existing custom id should be reported by doctor as `conflict` with guidance to rename/remove the custom MCP. Do not let the custom entry shadow the bundled catalog entry.

### Secret model

Custom secret bindings are metadata, not values:

```json
{
  "id": "custom-auth-token",
  "envVar": "CUSTOM_MCP_AUTH_TOKEN",
  "label": "Custom MCP auth token",
  "required": true,
  "placeholder": "${CUSTOM_MCP_AUTH_TOKEN}",
  "source": "custom"
}
```

Rules:

- Add/import accepts only placeholder values such as `${CUSTOM_MCP_AUTH_TOKEN}` or explicit binding names that can be rendered to placeholders.
- Reject raw env values, raw headers, `Authorization: Bearer real-token`, cookies, embedded URL credentials, token-like query params, comments containing secrets, and metadata fields that look like credentials.
- `import-global` must never copy raw values from global OpenCode config. It should either convert known secret-bearing fields to missing placeholder-backed bindings or skip/reject with a redacted reason.
- Extend `openkit configure mcp set-key` only if the service can resolve custom `secretBindings` safely. Recommended syntax: `openkit configure mcp set-key <custom-id> --env-var <CUSTOM_ENV_VAR> --scope <scope> --stdin`. It must work for bundled ids exactly as today and for custom ids only when the custom entry declares that env var binding.
- Do not support arbitrary raw secret header values in phase 1. Header entries must reference placeholders whose values are supplied by environment/secret store at runtime, not stored in config.
- Removing a custom MCP should not silently delete raw secrets. Print redacted cleanup guidance; if a cleanup command is later added, it must require explicit key unset semantics.

## CLI Command Design

Keep commands under `openkit configure mcp` and make custom ownership visible in names. The following grammar is the recommended phase-1 surface:

```text
openkit configure mcp custom list [--scope openkit|global|both] [--json]
openkit configure mcp custom add-local <custom-id> --cmd <executable> [--arg <arg> ...] [--env <ENV_VAR=${ENV_VAR}> ...] [--name <display-name>] [--scope openkit|global|both] [--enable|--disabled] [--yes] [--json]
openkit configure mcp custom add-remote <custom-id> --url <url> [--transport http|sse|streamable-http] [--header <Header=${ENV_VAR}> ...] [--env <ENV_VAR=${ENV_VAR}> ...] [--name <display-name>] [--scope openkit|global|both] [--enable|--disabled] [--yes] [--json]
openkit configure mcp custom import-global <global-id> [--as <custom-id>] [--scope openkit|global|both] [--enable|--disabled] [--yes] [--json]
openkit configure mcp custom import-global --select <id1,id2,...> [--scope openkit|global|both] [--json]
openkit configure mcp custom disable <custom-id> [--scope openkit|global|both] [--json]
openkit configure mcp custom remove <custom-id> [--scope openkit|global|both|all] [--yes] [--json]
openkit configure mcp custom doctor [<custom-id>] [--scope openkit|global|both] [--json]
openkit configure mcp custom test <custom-id> [--scope openkit|global|both] [--yes] [--json]
```

Parser notes:

- `custom` is the namespace separator, so existing bundled commands remain `openkit configure mcp list|doctor|enable|disable|set-key|unset-key|test`.
- `list` and `doctor` without `custom` should continue to show bundled inventory by default. If implementation adds `--include-custom`, it must be additive and documented, but the custom-only list remains `custom list`.
- Use `--cmd` plus repeated `--arg` for local commands; do not accept a single shell command string such as `--command "npx foo && rm -rf"`.
- If compatibility requires accepting one string from imported global config, parse only JSON-array-like or existing OpenCode array shapes into argv arrays. Reject shell operator strings instead of shell-splitting.
- Mutating add/import/remove commands with risk warnings should require `--yes` in non-interactive contexts before enabling/testing local code. Without `--yes`, they may store disabled/not_configured definitions only if this behavior is documented in output.
- Human and JSON output must carry the same statuses, warnings, conflicts, and redacted key states.
- `remove --scope all` means remove the custom definition and all OpenKit-managed materialization for both scopes. `remove --scope openkit|global|both` disables/removes materialization for selected scopes but should remove the definition only when no scopes remain enabled/materialized, or should require `--all` to delete the definition. Pick one behavior in implementation docs/tests and keep output explicit.

## Validation Design

### Custom id validation

- Required: non-empty id.
- Recommended pattern: `^[a-z][a-z0-9_-]{1,62}$`.
- Reject path separators, whitespace, leading dots, uppercase ambiguity if the repo chooses lowercase-only, `.`/`..`, shell metacharacters, and ids matching bundled catalog ids.
- Reject ids that collide with existing OpenKit-managed custom entries unless explicit `--replace` is implemented for custom-only entries.

### Local command validation

Local definitions must use argv arrays.

Accept:

```text
--cmd node --arg /path/to/server.js
--cmd npx --arg -y --arg some-mcp-package@1.2.3
--cmd /absolute/path/to/mcp-server --arg --stdio
```

Reject before mutation:

- Empty executable.
- Any argument containing shell operators intended for chaining/redirection: `&&`, `||`, `;`, `|`, `>`, `<`, backticks, `$(`, background `&`, newline command chaining.
- Shell launchers (`sh`, `bash`, `zsh`, `cmd`, `powershell`, `pwsh`) when used with `-c`, `/c`, or command-string execution.
- Inline env assignments carrying values that look like secrets.
- Command/args/env/metadata containing token-like raw secrets.

Warn but allow disabled or explicit-user-confirmed storage where appropriate:

- Executable not found on current `PATH` or path not runnable.
- Relative executable/path, symlinked path, spaces/unicode in path, custom `cwd`, package runner such as `npx`, or command that will execute local code.
- Local custom MCP execution risk: enabling/testing can run code on the user's machine.

Doctor/test behavior:

- `doctor` may check command availability and env binding state without launching the MCP.
- `test` must require explicit test intent and should not launch through a shell. If a spawn probe is implemented, use `spawn(command[0], command.slice(1), { shell: false, env: placeholder-resolved-env, ... })`, sanitize stdout/stderr, enforce timeout, and avoid printing provider output. If a safe protocol handshake is not implemented, report dependency/shape status only.

### Remote URL and header validation

Supported phase-1 schemes/transports:

- Require `https:` for non-localhost remote URLs.
- Allow `http:` only for localhost/loopback local-development targets (`localhost`, `127.0.0.1`, `::1`) with visible warnings.
- Reject `file:`, `javascript:`, `data:`, `ftp:`, custom shell-like schemes, malformed hosts, embedded userinfo credentials, and token-like query parameters.
- Reject metadata-service and unsafe network targets such as `169.254.169.254`, `metadata.google.internal`, and obvious link-local metadata host aliases. Treat private-network targets as warnings unless implementation chooses to block them; either way, doctor output must show the caveat.

Header/env rules:

- Header values must be placeholders only, e.g. `Authorization=${CUSTOM_MCP_AUTHORIZATION}` or `X-API-Key=${CUSTOM_MCP_API_KEY}`.
- Raw bearer tokens, API keys, cookies, session headers, and arbitrary secret-looking header values are blocking failures.
- Placeholder names must be explicit env var names and should be uppercase with underscores.
- Placeholder values are not configured keys. Doctor/test must report `not_configured` until the backing env var is present in process env or OpenKit secret store.

Remote doctor/test behavior:

- `doctor` checks structural validity, placeholder-backed key presence, local-development/private-network warnings, and unsupported transport states.
- `test` may perform only a minimal sanitized reachability/protocol check if existing safe runtime support exists. Otherwise return `degraded`/`provider-unverified` with guidance instead of leaking response bodies.
- Never print raw response payloads, request headers, redirected URLs containing credentials, or env dumps.

### Import-global validation

Import reads the user's global OpenCode config at `<OPENCODE_HOME>/opencode.json` and creates OpenKit-managed custom entries only after per-entry validation.

Rules:

- Do not mutate the source global entry by default.
- Require explicit entry ids (`<global-id>` or `--select id1,id2`) rather than silent all-entry import. If bulk all is added later, require confirmation and per-entry reporting.
- Default custom id should be the global id only if it does not collide with bundled/custom ids; otherwise require `--as <custom-id>`.
- If source shape is local command array, validate it with local command rules.
- If source shape is remote URL/header config, validate it with remote URL/header rules.
- If source contains raw env/header values, embedded credentials, or token-like query params, do not copy them. Convert recognized secret-bearing fields to placeholder-backed missing bindings when safe; otherwise skip/reject with redacted `needs-secret-setup` or `unsupported-secret-shape`.
- Per-entry outcomes: `imported`, `skipped`, `conflict`, `invalid`, `unsupported`, `needs_secret_setup`.

## Scope/Profile Materialization

Scope vocabulary remains `openkit`, `global`, and `both`; default remains `openkit`.

| Scope | Materialization target | Custom behavior |
| --- | --- | --- |
| `openkit` | `<OPENCODE_HOME>/profiles/openkit/opencode.json` | Write OpenKit-managed custom profile entries for `openkit run`; placeholder-only env/header content. |
| `global` | `<OPENCODE_HOME>/opencode.json` | Write OpenKit-managed custom entries only when no unmanaged same-id global entry exists; direct OpenCode env caveat applies. |
| `both` | Both targets | Apply per scope and report `success`, `skipped`, `conflict`, or `failed` separately. |

Materialization rules:

- Materialize disabled custom entries as disabled when the entry exists and the selected scope is explicitly disabled, so list/doctor remains discoverable.
- Keep profile placeholders such as `${CUSTOM_MCP_TOKEN}`; never render raw secret values into profiles.
- Track `kind: custom` and `ownership: openkit-managed-custom` in `mcp-profile-state.json` for managed custom entries.
- Preserve unmanaged global config on conflict.
- Removing a custom entry removes only OpenKit-managed custom profile entries and profile-state ownership records. It must not remove bundled entries or unmanaged global entries.

## Interactive Wizard Integration

FEATURE-945 wizard remains a bundled setup wizard with additive custom visibility.

Required phase-1 wizard behavior:

- Inventory shows bundled MCPs as bundled and custom MCPs as custom/origin-labeled when custom entries exist.
- The main menu may include a `custom` or `custom-status` path for custom list/doctor/test.
- Selecting a custom MCP allows `test`, `doctor/status`, and `back`. If `disable` is included, it must call the same custom service path and respect scope semantics.
- If a user asks to create/import custom MCPs, print non-interactive command guidance such as `openkit configure mcp custom add-local ...`, `add-remote ...`, or `import-global ...`.
- No full custom creation wizard in phase 1. Avoid extra prompt complexity around local command safety, remote URL auth, and placeholder secret binding.
- Non-TTY wizard behavior from FEATURE-945 remains fail-closed with no mutation.

## Implementation Slices

### [ ] Slice 1: Custom registry/store and merged inventory contract

- **Files**: `src/global/mcp/custom-mcp-store.js`, `src/global/mcp/mcp-inventory.js` if created, `src/global/mcp/mcp-config-service.js`, `tests/global/custom-mcp-store.test.js`, `tests/global/mcp-config-store.test.js` if compatibility assertions are needed.
- **Goal**: introduce a custom-only persistent store and read model that can list bundled and custom entries without blending sources of truth.
- **Validation Command**: `node --test tests/global/custom-mcp-store.test.js tests/global/mcp-config-store.test.js`.
- **Details**:
  - Write tests first for empty read/no file creation, add/read custom definitions without raw secrets, idempotent writes, custom/bundled id collision rejection, scope enablement fields, and source/origin/ownership metadata.
  - Keep `src/capabilities/mcp-catalog.js` unchanged except for tests that prove custom entries are not inserted there.
  - Merged inventory must expose `kind`, `origin`, and `ownership` flags for downstream CLI/wizard/runtime use.

### [ ] Slice 2: Validation engine for local, remote, import, conflicts, and redaction

- **Files**: `src/global/mcp/custom-mcp-validation.js`, `src/global/mcp/redaction.js`, `src/global/mcp/mcp-config-service.js`, `tests/global/custom-mcp-validation.test.js`.
- **Goal**: centralize safety decisions before any CLI mutation can write custom config or profiles.
- **Validation Command**: `node --test tests/global/custom-mcp-validation.test.js`.
- **Details**:
  - Cover argv-array local commands, rejection of shell operators/shell launchers, executable warnings, secret-looking args/env/metadata rejection, remote scheme/credential/query/metadata-host rejection, localhost HTTP warning, placeholder-only header/env acceptance, raw header/env rejection, bundled/custom/global conflicts, and import-global raw-secret conversion/skip outcomes.
  - Return structured `{ status, errors, warnings, normalizedDefinition, secretBindings }` rather than throwing strings from deep helpers; CLI can render sanitized messages.
  - Ensure validation never expands placeholders into raw values.

### [ ] Slice 3: CLI custom command parser and service lifecycle operations

- **Files**: `src/global/mcp/mcp-configurator.js`, `src/global/mcp/mcp-config-service.js`, `src/global/mcp/custom-mcp-store.js`, `tests/cli/configure-mcp.test.js`, `tests/cli/configure-mcp-custom.test.js` if created.
- **Goal**: implement `custom list`, `custom add-local`, `custom add-remote`, `custom import-global`, `custom disable`, `custom remove`, `custom doctor`, and `custom test` under the existing parser without regressing bundled commands.
- **Validation Command**: `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-custom.test.js`.
- **Details**:
  - Existing bundled command tests must continue to pass unchanged.
  - Add CLI tests for help text, invalid scope/no mutation, custom empty list/no mutation, add-local success/warnings, add-remote success/warnings, invalid command/URL/header failures/no mutation, import selected global entry, bundled id rejection, duplicate id rejection, per-scope `both` output, JSON output parity, idempotent disable/remove, and no sentinel leakage.
  - Parse repeated `--arg`, `--env`, and `--header` flags deterministically; reject missing flag values.
  - For local code execution risk, `custom test` and enable-on-add should require visible warning and explicit `--yes` or store disabled by default.

### [ ] Slice 4: Profile materialization, custom secret bindings, and health/test status

- **Files**: `src/global/mcp/profile-materializer.js`, `src/global/mcp/health-checks.js`, `src/global/mcp/secret-manager.js` if custom binding support needs a helper, `src/global/mcp/mcp-config-service.js`, `tests/global/mcp-profile-materializer.test.js`, `tests/global/mcp-secret-manager.test.js`, `tests/cli/configure-mcp-custom.test.js`.
- **Goal**: materialize custom profile entries safely, report custom health with standard status labels, and integrate placeholder-backed custom env vars with existing `set-key --stdin` when supported.
- **Validation Command**: `node --test tests/global/mcp-profile-materializer.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp-custom.test.js`.
- **Details**:
  - Tests must assert generated OpenKit/global profiles contain placeholders only and no raw sentinel secrets.
  - `mcp-profile-state.json` must distinguish bundled and custom ownership.
  - Global unmanaged conflicts must preserve the user entry and report conflict.
  - Custom `set-key` support, if implemented, must require declared env var binding and must preserve bundled `set-key` behavior. If not implemented, docs/doctor must clearly route users to external env setup and mark missing keys as `not_configured`.
  - `doctor` must not execute local code; `test` must not use `shell: true` and must sanitize stdout/stderr if a spawn probe is implemented.

### [ ] Slice 5: Runtime read models and FEATURE-945 wizard visibility

- **Files**: `src/runtime/managers/mcp-health-manager.js`, `src/runtime/managers/capability-registry-manager.js`, `src/runtime/tools/capability/mcp-doctor.js`, `src/runtime/capability-registry.js` if needed, `src/global/mcp/interactive-wizard.js`, `src/global/mcp/wizard-state-machine.js`, `tests/runtime/capability-tools.test.js`, `tests/runtime/mcp-catalog.test.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/cli/configure-mcp-interactive.test.js`.
- **Goal**: make custom MCPs visible/testable in runtime and wizard status without creating a second source of truth or full custom creation wizard.
- **Validation Command**: `node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js`.
- **Details**:
  - Runtime MCP doctor should include custom entries with `kind`, `origin`, `ownership`, `riskWarnings`, and standard capability states.
  - Existing bundled skill-to-MCP routing must not start depending on arbitrary custom MCPs unless a future approved feature defines skill bindings.
  - Wizard tests must prove bundled FEATURE-945 flows still work, custom entries are labeled separately, custom tests use the same service result, and unsupported custom creation is routed to non-interactive guidance.

### [ ] Slice 6: Operator docs, help text, and governance/security evidence

- **Files**: `docs/operator/mcp-configuration.md`, `docs/operator/supported-surfaces.md`, `docs/operator/README.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md`, `AGENTS.md`, `tests/runtime/governance-enforcement.test.js`, `package.json` only if a new test script is needed.
- **Goal**: document custom MCP lifecycle commands, phase-1 limitations, validation behavior, risk warnings, secret placeholder model, import-global safety, conflict behavior, and validation surface boundaries.
- **Validation Command**: `node --test tests/runtime/governance-enforcement.test.js && npm run verify:governance`.
- **Details**:
  - Docs examples must use placeholders only and no real-looking raw tokens outside explicit sentinel tests.
  - State that target-project application validation is unavailable.
  - Keep command-reality docs aligned only after commands exist.

### [ ] Slice 7: Integrated regression and no-secret-leakage proof

- **Files**: no source file should be changed solely for this slice unless the integrated tests reveal a defect.
- **Goal**: run the focused CLI/global/runtime/docs regression set and capture evidence for Code Review and QA.
- **Validation Command**: `node --test tests/cli/*.test.js && node --test tests/global/*.test.js && node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/runtime/governance-enforcement.test.js && npm run verify:install-bundle && npm run verify:governance && npm run verify:all`.
- **Details**:
  - If `npm run verify:all` fails due to environment/tooling availability, record the exact failing surface and provide narrower passing commands above.
  - Include sentinel-secret assertions covering global config fixtures, custom store, generated profiles, command output, doctor/test output, runtime read models, docs examples, and workflow evidence if evidence is recorded.
  - Code Review should run `tool.security-scan` when available or document direct-tool unavailability and substitute/manual evidence per `context/core/tool-substitution-rules.md`.
  - Do not label any OpenKit CLI/runtime/docs result as `target_project_app` validation.

## Dependency Graph

- Critical path: `CUSTOM-STORE -> VALIDATION -> CLI-SERVICE -> MATERIALIZATION-HEALTH -> RUNTIME-WIZARD -> DOCS -> INTEGRATED-VALIDATION`.
- Sequential constraints:
  - `TASK-CUSTOM-STORE -> TASK-VALIDATION -> TASK-CLI-SERVICE -> TASK-MATERIALIZATION-HEALTH -> TASK-RUNTIME-WIZARD -> TASK-DOCS -> TASK-INTEGRATED-VALIDATION`
- Slice 6 docs may start as a draft after Slice 3, but final docs/help/governance assertions must wait for Slice 5 behavior to stabilize.
- Slice 7 cannot start until prior targeted validations pass or blockers are recorded.

## Parallelization Assessment

- `parallel_mode`: `none`
- `why`: The feature touches shared CLI parsing, secret safety, custom/bundled ownership, profile materialization, global conflict behavior, runtime read models, and FEATURE-945 wizard behavior. Parallel implementation would create high shared-surface risk and could miss secret leakage or bundled behavior regressions. Keep implementation sequential even if a full-delivery task board is created.
- `safe_parallel_zones`: []
- `sequential_constraints`: [`TASK-CUSTOM-STORE -> TASK-VALIDATION -> TASK-CLI-SERVICE -> TASK-MATERIALIZATION-HEALTH -> TASK-RUNTIME-WIZARD -> TASK-DOCS -> TASK-INTEGRATED-VALIDATION`]
- `integration_checkpoint`: after Slice 5, run CLI custom tests, profile materializer tests, wizard tests, and runtime capability tests together before documentation is finalized and before Code Review starts.
- `max_active_execution_tracks`: 1

Task board recommendation: create a full-delivery task board for traceability with one task per slice above, but set `parallel_mode=none`. The board should record artifact refs for each slice and should not dispatch overlapping implementation work.

## Validation Matrix

| Acceptance / risk target | Validation path | Surface label |
| --- | --- | --- |
| Custom store is separate from bundled catalog/config and carries origin/ownership flags | `node --test tests/global/custom-mcp-store.test.js`; assertions that `src/capabilities/mcp-catalog.js` remains bundled-only | `global_cli` / storage behavior |
| Bundled commands and FEATURE-941 behavior remain unchanged | Existing `node --test tests/cli/configure-mcp.test.js tests/global/mcp-config-store.test.js tests/global/mcp-profile-materializer.test.js` | `global_cli` |
| CLI exposes coherent custom add/import/list/disable/remove/doctor/test commands | `node --test tests/cli/configure-mcp-custom.test.js`; help output assertions | `global_cli` |
| Local command validation blocks shell strings/operators and prefers argv arrays | `node --test tests/global/custom-mcp-validation.test.js`; CLI invalid-shape no-mutation tests | `global_cli` |
| Remote URL/header validation blocks unsafe schemes, credentials, metadata hosts, raw headers, and token query params | `node --test tests/global/custom-mcp-validation.test.js`; CLI invalid remote no-mutation tests | `global_cli` |
| Import-global never mutates source global entry and never copies raw secrets | CLI/global fixture tests with sentinel raw values and before/after global config assertions | `global_cli` |
| Scope materialization writes placeholder-only entries and preserves unmanaged global conflicts | `node --test tests/global/mcp-profile-materializer.test.js tests/cli/configure-mcp-custom.test.js` | `global_cli` |
| Custom secret bindings use placeholder-only config and safe `set-key --stdin` if supported | Secret-manager and CLI tests with sentinel value; raw value appears only in `secrets.env` | `global_cli` |
| Doctor/test custom output uses standard states and sanitized reasons | CLI custom doctor/test tests and runtime capability tests | `global_cli` / `runtime_tooling` |
| Wizard lists/tests custom MCPs without full creation wizard and without bundled flow regression | `node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js` | `global_cli` |
| Runtime MCP doctor/read models distinguish bundled vs custom entries | `node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js` | `runtime_tooling` |
| Docs/help explain phase-1 limitations, risk warnings, secret placeholder model, and no target app validation claim | `node --test tests/runtime/governance-enforcement.test.js`; `npm run verify:governance` | `documentation` |
| Install/package includes new source/docs/tests | `npm run verify:install-bundle`; optionally `npm pack --dry-run` during release prep | `global_cli` / package surface |
| Target-project app validation is not claimed | Review implementation/QA evidence labels; no app-native command required | `target_project_app` unavailable |

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide evidence for:

1. `node --test tests/global/custom-mcp-store.test.js`
2. `node --test tests/global/custom-mcp-validation.test.js`
3. `node --test tests/cli/configure-mcp.test.js`
4. `node --test tests/cli/configure-mcp-custom.test.js` if created, otherwise the custom cases inside `tests/cli/configure-mcp.test.js`
5. `node --test tests/global/mcp-config-store.test.js`
6. `node --test tests/global/mcp-profile-materializer.test.js`
7. `node --test tests/global/mcp-secret-manager.test.js`
8. `node --test tests/global/mcp-interactive-wizard.test.js`
9. `node --test tests/cli/configure-mcp-interactive.test.js`
10. `node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/runtime/governance-enforcement.test.js`
11. `npm run verify:governance`
12. `npm run verify:install-bundle`
13. `npm run verify:all` when environment/tooling allows the full gate

Evidence must label surfaces as `global_cli`, `runtime_tooling`, `documentation`, or `compatibility_runtime` as applicable. State explicitly that `target_project_app` validation is unavailable for this feature.

## Rollback Notes

- No bundled catalog migration is required; custom config is additive and stored separately.
- If custom support must be rolled back, remove/ignore the custom command parser/service/store/materializer paths while leaving bundled `mcp-config.json`, bundled profiles, and existing FEATURE-945 wizard behavior intact.
- Operator rollback for a specific custom MCP should use custom disable/remove commands once implemented:
  - `openkit configure mcp custom disable <custom-id> --scope <scope>`
  - `openkit configure mcp custom remove <custom-id> --scope all --yes`
- Removing a custom MCP must not delete bundled MCP entries, unmanaged global OpenCode entries, or raw secret values silently. Secret cleanup remains explicit/redacted.
- If remote profile shape support proves incompatible with OpenCode during implementation, keep validated remote definitions stored as disabled/not_configured and block materialization until the profile shape is verified; do not ship guessed remote profile keys.
- If local test spawning proves unsafe or too broad, keep doctor structural/dependency-only and make `custom test` return a clear unsupported/degraded status rather than executing through a shell.

## Risks And Trade-offs

- **Secret leakage through import or test output**: global configs and provider errors may contain raw keys. Mitigation: validation strips/rejects raw values, redaction wraps output, sentinel tests cover config/profiles/output/runtime/docs.
- **Shell injection / arbitrary local execution**: local MCPs are commands. Mitigation: argv arrays only, reject shell command strings/operators, no `shell: true`, warnings before enable/test, explicit test intent.
- **Remote SSRF / unsafe URL targets**: remote URLs can target local/private/metadata services. Mitigation: strict scheme/credential/query validation, block known metadata hosts, warn or block private network targets, sanitized test behavior.
- **Bundled/custom ownership confusion**: custom ids could shadow catalog entries. Mitigation: bundled id collisions fail, profile-state ownership flags, custom list labels, future bundled-id conflict doctor warnings.
- **Global config overwrite risk**: global OpenCode may already contain user-managed entries. Mitigation: profile materializer preserves unmanaged entries and reports per-scope conflicts.
- **Wizard scope creep**: custom creation prompts would be high-risk. Mitigation: phase 1 wizard lists/tests only and routes creation/import to non-interactive commands.
- **Remote MCP profile shape uncertainty**: OpenCode remote MCP config shape must be verified. Mitigation: internal normalized contract plus tests for generated profile shape; block materialization if shape is unverified.
- **Both-scope partial success**: openkit may succeed while global conflicts. Mitigation: per-scope result rows and no all-or-nothing success wording.

## Reviewer Focus Points

- Scope compliance: phase 1 add/import/list/disable/remove/doctor/test only; no marketplace, full wizard creation, arbitrary secret header values, or bundled behavior weakening.
- Data model: custom store is separate from bundled catalog/config and merged only for inventory/materialization/status.
- CLI grammar: custom subcommands are coherent under `openkit configure mcp custom ...`; existing bundled parser behavior remains stable.
- Local validation: command/args are argv arrays, shell operators and shell launchers are rejected, no shell-string execution.
- Remote validation: unsafe schemes, embedded credentials, token query params, metadata hosts, and raw headers are rejected; localhost HTTP/private targets warn clearly.
- Import-global: source global config is not mutated and raw secrets are not copied.
- Secret safety: raw values appear only in approved secret-store/process paths; placeholders are not treated as configured keys.
- Materialization: generated profiles are placeholder-only and preserve unmanaged global entries.
- Wizard: custom visibility/test is additive and does not regress FEATURE-945 bundled setup flow.
- Validation labels: no OpenKit CLI/runtime/docs evidence is reported as target-project app validation.

## Handoff Notes

- Fullstack must implement slices sequentially and keep tests ahead of behavior changes for custom store, validation, CLI lifecycle, materialization, runtime read models, wizard visibility, and docs.
- Code Reviewer must review scope compliance first, then no-secret-leakage, shell/URL validation, import-global safety, bundled behavior preservation, profile ownership/conflict behavior, and warning visibility.
- QA must verify custom lifecycle behavior on `global_cli`, runtime read-model reflection on `runtime_tooling`, workflow/evidence redaction on `compatibility_runtime` if evidence is recorded, documentation on `documentation`, and must mark `target_project_app` unavailable unless a separate real target application is introduced.

## Solution Lead Handoff Decision

- **Pass:** this solution package defines one recommended path, explicit affected surfaces, custom registry/store separation, command grammar, validation and secret model, scope/profile materialization, wizard integration, sequential task slices, validation plan, rollback notes, risks, and reviewer/QA focus points for `solution_to_fullstack` approval.
