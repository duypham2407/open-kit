---
artifact_type: solution_package
version: 1
status: approval_ready
feature_id: FEATURE-950
feature_slug: keychain-mcp-secret-backend
source_scope_package: docs/scope/2026-04-27-keychain-mcp-secret-backend.md
owner: SolutionLead
approval_gate: solution_to_fullstack
handoff_rubric: pass
---

# Solution Package: Keychain MCP Secret Backend

## Chosen Approach

Add a backend-aware MCP secret manager around the existing `secrets.env` implementation, with `local_env_file` as the unchanged default and an opt-in `keychain` backend implemented through a mockable macOS `security` CLI adapter. This is enough because the current MCP control plane already centralizes secret writes, key state reporting, profile materialization, wizard flows, doctor/test, and `openkit run` env injection; the safest path is to extend those seams rather than introduce a separate credential subsystem.

The runtime precedence must be: shell/process environment > keychain > local env file. No raw value may be returned from command handlers, health/read models, generated profiles, docs, workflow evidence, or logs; raw values may exist only in selected backend storage, process memory during set/run, and child process env for launch.

## Context Evidence

- Approved Product Lead scope: `docs/scope/2026-04-27-keychain-mcp-secret-backend.md`.
- Existing local env-file secret backend: `src/global/mcp/secret-manager.js` exports `setSecretValue`, `unsetSecretValue`, `loadSecretsEnv`, `inspectSecretFile`, and `repairSecretStorePermissions`.
- Existing MCP command/service seams: `src/global/mcp/mcp-configurator.js`, `src/global/mcp/mcp-config-service.js`, `src/global/mcp/interactive-wizard.js`.
- Existing run loader: `src/global/launcher.js` currently loads `secrets.env` and preserves shell env precedence by only injecting missing env vars.
- Existing config/profile state: `src/global/mcp/mcp-config-store.js`, `src/global/mcp/profile-materializer.js`, `src/global/paths.js`.
- Existing tests: `tests/global/mcp-secret-manager.test.js`, `tests/cli/configure-mcp.test.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/runtime/capability-tools.test.js`, `tests/runtime/governance-enforcement.test.js`.
- Quality scan evidence: `tool.rule-scan` on `src/global/mcp` succeeded with 0 findings (`runtime_tooling`).

## Impacted Surfaces

- Secret backend core: `src/global/mcp/secret-manager.js`; add supporting modules under `src/global/mcp/secret-stores/`.
- Keychain adapter: new `src/global/mcp/secret-stores/keychain-adapter.js` and test fake/memory adapter.
- Config metadata: `src/global/mcp/mcp-config-store.js` and potentially `src/global/paths.js` for explicit secret backend metadata paths if needed.
- MCP service/CLI: `src/global/mcp/mcp-config-service.js`, `src/global/mcp/mcp-configurator.js`, `src/cli/commands/configure.js` only if command routing needs help text updates.
- Wizard: `src/global/mcp/interactive-wizard.js` and prompt tests.
- Health/doctor/test/read models: `src/global/mcp/health-checks.js`, `src/runtime/managers/mcp-health-manager.js`, `src/runtime/tools/capability/mcp-doctor.js`, `src/runtime/tools/capability/capability-inventory.js` if their read models duplicate MCP status shaping.
- Run loader: `src/global/launcher.js`.
- Docs/governance: `docs/operator/mcp-configuration.md`, `docs/operator/README.md`, `docs/operator/supported-surfaces.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md`, `AGENTS.md` only where command reality changes.
- Tests: `tests/global/mcp-secret-manager.test.js`, new `tests/global/mcp-keychain-adapter.test.js`, `tests/cli/configure-mcp.test.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/runtime/capability-tools.test.js`, `tests/runtime/governance-enforcement.test.js`, launcher tests where `openkit run` env is validated.

## Boundaries And Components

### Backend labels and defaults

- Canonical store labels: `local_env_file`, `keychain`.
- `local_env_file` remains default for `set-key` and `unset-key` when no `--store` is supplied. This preserves current behavior and avoids surprising deletion from keychain.
- Unsupported `--store` values fail before secret input is consumed or any backend mutation occurs.
- On non-macOS, `--store keychain` is `unavailable` and must not fall back to `local_env_file` unless the user reruns with `--store local_env_file` or omits `--store` intentionally.

### Adapter boundary

Create a small backend abstraction, not a broad dependency injection framework:

- `SecretStoreAdapter` shape:
  - `id`: `local_env_file` or `keychain`
  - `availability({ env, platform }) -> { status, reason?, remediation? }`
  - `set({ bindingRef, value, env }) -> { status, store, ref, keyState }`
  - `get({ bindingRef, env }) -> { status, value?, store, ref, reason? }`
  - `unset({ bindingRef, env }) -> { status, store, ref, removed }`
  - `inspect({ bindingRef, env }) -> { status, store, keyState, ref?, reason? }`
  - `doctor({ env }) -> { store, status, checks, warnings }`
  - `repair({ env }) -> { store, status, checks, warnings }`
- Local adapter wraps the existing env-file helpers and keeps file permission repair behavior.
- Keychain adapter shells out to macOS `/usr/bin/security` through an injectable `execFileSync`/runner option so tests never touch the real keychain.
- Tests use a fake in-memory adapter and/or fake runner; CI must not require macOS Keychain.

### Keychain service/account naming

Use deterministic item identity with no raw secret in identifiers:

- Service: `dev.openkit.mcp.<scope>` where scope is `openkit` or `global`; for custom MCPs scope still follows the selected profile scope.
- Account: `<kind>:<mcpId>:<envVar>` where `kind` is `bundled` or `custom`.
- Include `OPENCODE_HOME` isolation by storing metadata in OpenKit config, not by putting absolute paths in account names. If collisions across OpenCode homes are a concern during implementation, add a stable short workspace/home hash suffix to service (`dev.openkit.mcp.<scope>.<hash>`) and document it. Do not include raw path strings in command output unless already safe and necessary.
- Metadata stored in `mcp-config.json` may include `store`, `envVar`, `service`, `account`, `updatedAt`, and `source`, but never the raw secret.

### macOS `security` command design

- Set: `security add-generic-password -a <account> -s <service> -w <value> -U`.
- Get: `security find-generic-password -a <account> -s <service> -w`.
- Delete: `security delete-generic-password -a <account> -s <service>`.
- Availability: platform must be `darwin`, `security` must be command-available or executable at `/usr/bin/security`, and a lightweight command check must be sanitized.
- Non-macOS: return `unavailable` with remediation; never execute shell commands.
- Permission/access/locked keychain errors: return sanitized `unavailable`/`failed` states; redact any known input secret and do not include raw command payloads.

## Interfaces And Data Contracts

### Config schema extension

Evolve `openkit/mcp-config@1` additively; do not require a migration that rewrites existing local configs.

Recommended shape:

```json
{
  "secretBindings": {
    "context7": {
      "envVars": ["CONTEXT7_API_KEY"],
      "stores": {
        "CONTEXT7_API_KEY": {
          "local_env_file": { "configured": true, "updatedAt": "..." },
          "keychain": {
            "configured": true,
            "service": "dev.openkit.mcp.openkit",
            "account": "bundled:context7:CONTEXT7_API_KEY",
            "updatedAt": "..."
          }
        }
      },
      "updatedAt": "..."
    }
  }
}
```

Existing `secretBindings[mcpId].envVars` remains valid. If no `stores` entry exists, treat local env-file state as discoverable through `secrets.env` and report `local_env_file` when present.

### CLI grammar

Extend the existing command family:

- `openkit configure mcp set-key <mcp-id> [--env-var <ENV>] [--scope openkit|global|both] [--store local_env_file|keychain] --stdin [--json]`
- `openkit configure mcp unset-key <mcp-id> [--env-var <ENV>] [--scope openkit|global|both] [--store local_env_file|keychain] [--all-stores] [--json]`
- `openkit configure mcp list-key <mcp-id> [--env-var <ENV>] [--scope openkit|global|both] [--json]`
- `openkit configure mcp list|doctor|test ...` include backend-aware redacted state.
- `openkit configure mcp repair [--store local_env_file|keychain] [--scope openkit|global|both] [--json]` may repair local env-file permissions and report keychain as not repairable/unavailable unless a safe non-mutating keychain check exists.
- Explicit copy/migration command: `openkit configure mcp copy-key <mcp-id> --from local_env_file --to keychain [--env-var <ENV>] [--scope ...] [--remove-source-confirm <token>] [--json]`.

Migration/copy is included only as explicit non-destructive copy by default. Source cleanup is optional and must be a separate explicit confirmation path; if this is too large during implementation, defer destructive cleanup but still implement `copy-key` without cleanup.

### Behavior matrix

- `set-key`: validates MCP/custom id, validates declared env binding, validates store label and platform before writing; writes only to selected store; records redacted metadata; auto-enables target MCP as current behavior does.
- `unset-key`: defaults to `local_env_file`; with `--store`, removes only that store; with `--all-stores`, removes both after explicit flag; never disables MCP silently.
- `list-key`/`list`/`report`: show MCP id, env var, stores present/missing, effective store, warnings, and redacted key state. No raw values.
- `doctor`: reports store availability, secret-file permissions, keychain platform/command availability, declared binding status, multi-store presence, effective store, direct OpenCode caveat, and sanitized remediation.
- `test`: uses effective resolved secret state but must not call providers with raw values beyond existing dependency-only behavior; report `not_configured`, `unavailable`, `degraded`, or `pass` redacted.
- `repair`: local env-file keeps existing permission repair; keychain repair is limited to availability checks and sanitized remediation, not GUI/keychain mutation.
- `openkit run`: resolves each MCP/custom declared binding from current env, keychain, then local env-file. It injects only missing env names and never logs values.

## Redaction And No-Raw-Output Design

- Reuse and extend `src/global/mcp/redaction.js` for command errors, adapter errors, JSON payloads, and test snapshots.
- Result objects from backend APIs must not contain `value` except in explicitly internal resolution functions; CLI/service methods return redacted status only.
- Sentinel tests must assert raw sentinel absence from stdout, stderr, JSON output, generated profile config, MCP config metadata, doctor/list/test payloads, workflow/runtime summaries, and docs examples. Backend fixture storage may contain the sentinel only in the selected fake/local backend under direct test control.
- Do not print child env maps or `security` command arguments containing values. If adapter errors include command text, sanitize before returning.

## Implementation Slices

### Slice 1: backend abstraction and local adapter preservation

- **Files**: `src/global/mcp/secret-manager.js`, new `src/global/mcp/secret-stores/local-env-file-adapter.js`, new `src/global/mcp/secret-stores/index.js`, `tests/global/mcp-secret-manager.test.js`.
- **Goal**: Introduce store labels and adapter calls while keeping current local env-file behavior byte-for-behavior compatible for default `set-key`, `unset-key`, `loadSecretsEnv`, permission inspection, and repair.
- **Validation Command**: `node --test tests/global/mcp-secret-manager.test.js`.
- **Details**: Existing exports should remain or be wrapped to avoid broad downstream churn. Add `resolveSecretBinding` internal API only after local fallback tests prove unchanged behavior.

### Slice 2: macOS keychain adapter with fakeable runner

- **Files**: new `src/global/mcp/secret-stores/keychain-adapter.js`, new `tests/global/mcp-keychain-adapter.test.js`, `src/global/mcp/redaction.js` if error sanitization needs expansion.
- **Goal**: Implement macOS-only `security` adapter, deterministic service/account refs, sanitized availability/failure handling, and fake runner tests for success, missing, delete, denied, and non-macOS unavailable.
- **Validation Command**: `node --test tests/global/mcp-keychain-adapter.test.js`.
- **Details**: Tests must inject platform and runner; no test may require actual `/usr/bin/security` or a login keychain.

### Slice 3: config metadata and MCP service operations

- **Files**: `src/global/mcp/mcp-config-store.js`, `src/global/mcp/mcp-config-service.js`, `src/global/mcp/health-checks.js`, `tests/global/mcp-secret-manager.test.js`, `tests/global/custom-mcp-store.test.js` if custom binding metadata is affected.
- **Goal**: Record backend metadata, support bundled/custom bindings through the same flow, add backend-aware set/unset/list-key/copy/doctor/test service methods, and preserve generated profile placeholders.
- **Validation Command**: `node --test tests/global/mcp-secret-manager.test.js tests/global/custom-mcp-store.test.js`.
- **Details**: Preserve old config shape through additive reads. Unknown/corrupt backend metadata must be ignored safely and reported as configuration warning.

### Slice 4: CLI grammar, JSON/human rendering, and non-TTY rules

- **Files**: `src/global/mcp/mcp-configurator.js`, `tests/cli/configure-mcp.test.js`, `tests/cli/configure-mcp-custom.test.js`.
- **Goal**: Add `--store`, `list-key`, `copy-key`, backend-aware `repair`, JSON parity, unsupported-store failure, non-TTY `--stdin` enforcement, and no mutation on invalid store/platform.
- **Validation Command**: `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-custom.test.js`.
- **Details**: `set-key` must validate store/platform before reading stdin when possible. If stdin has already been supplied by the process, never echo it in errors.

### Slice 5: run loader precedence and health read models

- **Files**: `src/global/launcher.js`, `src/global/mcp/health-checks.js`, `src/runtime/managers/mcp-health-manager.js`, `src/runtime/tools/capability/mcp-doctor.js`, `src/runtime/tools/capability/capability-inventory.js`, relevant runtime tests.
- **Goal**: Resolve shell env > keychain > local env file for declared bindings and surface effective-store metadata without raw values.
- **Validation Command**: `node --test tests/runtime/capability-tools.test.js tests/runtime/runtime-platform.test.js` plus targeted launcher test if present/added.
- **Details**: Shell env must remain highest priority by retaining the current “inject only missing env vars” behavior. Keychain resolution should not block unrelated MCPs if one key is unavailable; report per-binding warning and fall back to local env file when present.

### Slice 6: interactive wizard

- **Files**: `src/global/mcp/interactive-wizard.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/cli/configure-mcp-interactive.test.js`.
- **Goal**: Let TTY users choose `local_env_file` or `keychain`, show keychain unavailable status where relevant, keep local setup available, and preserve non-echoing secret input.
- **Validation Command**: `node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js`.
- **Details**: Non-TTY wizard remains fail-fast with no mutation and suggests `--stdin --store ...` commands.

### Slice 7: documentation, governance assertions, and full regression

- **Files**: `docs/operator/mcp-configuration.md`, `docs/operator/README.md`, `docs/operator/supported-surfaces.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md`, `AGENTS.md`, `tests/runtime/governance-enforcement.test.js`.
- **Goal**: Document stores, macOS-only keychain, Linux/Windows unavailable stubs, precedence, direct OpenCode caveat, migration/copy, CI mocks, and no raw secret persistence.
- **Validation Command**: `npm run verify:governance && npm run verify:all`.
- **Details**: `npm run verify:all` is OpenKit repo validation, not `target_project_app` validation.

## Dependency Graph

- Sequential critical path: `Slice 1 -> Slice 2 -> Slice 3 -> Slice 4 -> Slice 5 -> Slice 6 -> Slice 7`.
- Slice 2 can be developed alongside Slice 1 only if it does not touch current local env-file exports; integration still waits for Slice 1 adapter shape.
- Slice 7 docs can start after CLI grammar is stable in Slice 4, but final docs/governance assertions must wait for Slice 5/6 behavior decisions.
- Critical path: adapter contract and config metadata before CLI/run/wizard integration.

## Parallelization Assessment

- parallel_mode: `limited`
- why: Adapter tests/docs can be split, but service/config/run/wizard share MCP metadata and redaction surfaces and need sequential integration.
- safe_parallel_zones:
  - `src/global/mcp/secret-stores/`
  - `tests/global/mcp-keychain-adapter.test.js`
  - `docs/operator/`
- sequential_constraints:
  - `TASK-LOCAL-ADAPTER -> TASK-KEYCHAIN-ADAPTER -> TASK-SERVICE-CONFIG -> TASK-CLI -> TASK-RUN-LOADER -> TASK-WIZARD -> TASK-DOCS-GOVERNANCE`
- integration_checkpoint: after Slice 5, run CLI + runtime tests together and inspect generated config/profile fixtures for sentinel leakage before wizard/docs finalization.
- max_active_execution_tracks: 2

## Validation Matrix

| Acceptance target | Validation path | Surface |
| --- | --- | --- |
| Local env-file remains default/fallback | `node --test tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js` | `global_cli`, `runtime_tooling` |
| Keychain macOS success/failure without real keychain | `node --test tests/global/mcp-keychain-adapter.test.js` with fake runner/platform | `runtime_tooling` |
| Non-macOS keychain unavailable/no mutation | keychain adapter + CLI tests with injected platform/fake service | `global_cli`, `runtime_tooling` |
| Precedence shell > keychain > local env file | launcher/service tests with fake keychain and temp `secrets.env` | `global_cli` |
| Bundled and custom MCP binding compatibility | `tests/global/mcp-secret-manager.test.js`, `tests/cli/configure-mcp-custom.test.js`, `tests/runtime/capability-tools.test.js` | `global_cli`, `runtime_tooling` |
| Redaction/no raw output | sentinel assertions across CLI stdout/stderr, JSON, config/profile files, runtime summaries, docs examples | all OpenKit surfaces except selected backend/process memory |
| Wizard backend choice and non-TTY fail closed | `node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js` | `global_cli` |
| Documentation/governance | `npm run verify:governance` | `documentation` |
| Full repo regression | `npm run verify:all` | OpenKit repo validation |
| Target project app validation | Explicitly unavailable; do not claim | `target_project_app` |

## Risks And Rollback

- Keychain identity collisions: mitigate with explicit service/account naming and tests for bundled/custom/env-var combinations; rollback by disabling `keychain` store path while retaining local env-file behavior.
- OS `security` behavior may be interactive/permission-sensitive: adapter must fail closed and tests must mock it; rollback by reporting keychain `unavailable` without affecting local env-file.
- Precedence confusion with duplicate values: list/doctor/report must show effective store and multi-store presence redacted; rollback by leaving local env-file values untouched.
- Redaction regressions: sentinel tests are mandatory before approval; rollback any output/read-model expansion that cannot prove no leakage.
- Config schema drift: read old config shape additively; rollback by ignoring `stores` metadata and continuing `local_env_file` discovery.
- Direct OpenCode misunderstanding: docs and global-scope output must retain caveat that only `openkit run` loads OpenKit-managed keychain secrets.

## Reviewer Focus Points

- No raw secret in output, JSON, errors, logs, generated profiles, config metadata, workflow evidence, test snapshots, or docs.
- `local_env_file` remains default and current tests still pass.
- `keychain` never silently writes to local env file on unsupported platform/failure.
- All keychain behavior is behind a mockable adapter; CI uses fake runner/adapters only.
- `openkit run` precedence exactly matches shell env > keychain > local env file.
- Custom MCP and bundled MCP secret bindings use the same backend model without raw secret-bearing profile entries.
- Migration/copy is explicit and non-destructive by default.

## Handoff Decision

- **Pass / ready for Fullstack approval**: approach, boundaries, interfaces, slice order, validations, risks, and no-raw-secret constraints are explicit and trace to the approved Product Lead scope.
