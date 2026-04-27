# MCP Configuration

This guide explains the current operator-facing MCP capability pack and the `openkit configure mcp` command surface.

Keep two rules in mind:

- **Use placeholders in docs, examples, generated profiles, and diagnostics. Never write raw API keys into repository files, workflow artifacts, generated OpenKit/OpenCode profiles, logs, or screenshots.**
- **OpenKit validation and MCP health checks prove OpenKit capability readiness. They do not prove target-project application build, lint, test, smoke, or regression behavior.**

## Current State At A Glance

- Default scope for `openkit configure mcp` is `openkit`.
- `openkit configure mcp --interactive` starts the guided setup wizard for TTY sessions and wraps the same bundled catalog/control plane as the non-interactive commands.
- `openkit configure mcp list` and `doctor` are safe discovery commands and show redacted key state only.
- `openkit configure mcp custom ...` manages OpenKit-managed custom MCP definitions in a separate custom registry, with explicit ownership/origin labels and placeholder-only auth metadata.
- `set-key` stores raw secrets in the selected backend: `local_env_file` by default, or macOS `keychain` when explicitly requested with `--store keychain`.
- `set-key` automatically enables the selected MCP for the requested scope while keeping generated profiles placeholder-only and redacted.
- `disable` keeps any stored key; `unset-key` removes a key but does not silently disable the MCP.
- `openkit run` resolves secrets with precedence `shell environment > keychain > local_env_file`. Direct OpenCode launches do **not** use that loader.

## Default Bundled MCP Catalog

Run this to inspect the live catalog on your machine:

```sh
openkit configure mcp list
```

The bundled catalog currently includes:

| MCP id | Default OpenKit scope | Default global scope | Current state | Purpose | Key requirement |
| --- | --- | --- | --- | --- | --- |
| `openkit` | enabled | disabled | `available` | OpenKit workflow, runtime, graph, audit, and capability tools | none |
| `chrome-devtools` | enabled | disabled | `degraded` until local browser/tooling support is usable | browser inspection, debugging, performance, and Lighthouse-oriented checks | none |
| `playwright` | enabled | disabled | `degraded` until local browser dependencies are usable | browser automation and UI smoke-verification support | none |
| `context7` | disabled | disabled | `not_configured` until enabled and keyed | library documentation and framework/API examples | `CONTEXT7_API_KEY` |
| `grep_app` | disabled | disabled | `not_configured` until enabled and keyed | public GitHub code-search examples | `GREP_APP_API_KEY` |
| `websearch` | disabled | disabled | `not_configured` until enabled and keyed | current-information web research | `WEBSEARCH_API_KEY` |
| `sequential-thinking` | enabled | disabled | `preview` | structured multi-step reasoning support | none |
| `git` | disabled | disabled | `preview` / policy-gated | source-control capability that preserves OpenKit git safety constraints | none |
| `augment_context_engine` | disabled | disabled | `unavailable` unless the optional dependency exists | optional dependency-aware code context engine | none |

Capability states use the standard OpenKit vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.

## Default Bundled Skill Catalog Overview

The skill catalog is bundled with the kit and joined with MCP availability at runtime. It includes:

- workflow skills: `using-skills`, `brainstorming`, `writing-scope`, `writing-solution`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `code-review`, `verification-before-completion`, and `find-skills`
- code-intelligence skills: codebase exploration, refactoring, Rust navigation, call graph, symbol, trait, and dependency visualization helpers
- research skills: deep research plus optional `context7`, `grep_app`, and `websearch` MCP support when configured
- frontend, UI, browser, and deployment skills: component building, web design, React/Next.js, React Native/Expo, MUI, Vercel patterns, browser automation, and Vercel deployment guidance
- Rust skills: `rust-router`, `rust-learner`, coding guidelines, unsafe/FFI review, ownership, smart pointers, mutability, generics/traits, type-driven design, error handling, concurrency, domain modeling, performance, ecosystem, lifecycle, domain-error, mental-model, and anti-pattern skills

Every bundled skill has canonical metadata in `src/capabilities/skill-catalog.js`. Skill maturity status is `stable`, `preview`, or `experimental`; runtime `capabilityState` remains separate and uses `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`. Metadata also exposes `roles`, `stages`, `tags`, structured `triggers`, `recommended_mcps`, provenance/source, support level, docs refs, packaging, and visible limitations.

Inside an OpenKit session, capability inventory, routing, health, MCP doctor, and skill/MCP binding tools report which MCP-backed skills are available, degraded, unavailable, or not configured. If a backing MCP is absent or missing a key, OpenKit should return a visible next-action reason instead of silently pretending the skill has full MCP support. `recommended_mcps` are advisory and secret-free; missing or disabled MCPs are caveats, not hidden skill activation failures.

## Session-Start Capability Guidance

`openkit run` sessions include a compact `<openkit_capability_guidance>` startup snapshot after the runtime status block. The block is advisory only: it does not load skill bodies, call the `skill` tool, execute MCP-backed tools, run provider/network health checks, mutate workflow state, or approve gates. It summarizes a bounded set of role/stage-aware routes and points agents to explicit follow-up calls such as `tool.runtime-summary`, `tool.capability-router`, `tool.skill-index`, `tool.capability-inventory`, `tool.mcp-doctor`, and `tool.capability-health`.

The startup snapshot uses standard capability states (`available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, `not_configured`) plus human caveats such as `needs-key` over `not_configured`. Custom MCPs, when relevant, are shown as `kind=custom` with origin/ownership labels and are not presented as bundled defaults. Startup output is intentionally bounded and must not print a full skill catalog, full bundled MCP catalog, or full custom MCP registry.

Capability guidance is a snapshot and can become stale after the session starts. Refresh explicitly with in-session runtime tools or, for operator MCP setup questions, `openkit configure mcp list` / `openkit configure mcp doctor`. Guidance, runtime summaries, doctor output, workflow evidence, and docs examples must keep key state redacted (`missing`, `present_redacted`, `not_configured`, or `needs-key`) and must not print raw secrets, token-like query values, auth headers, provider payloads, or command env maps. These checks validate `global_cli`, `runtime_tooling`, or `compatibility_runtime` surfaces only; they are never target-project application build/lint/test evidence.

## Command Reference

Use `openkit configure mcp --help` on your installed version for exact flag support. The current product surface is:

```text
openkit configure mcp --interactive [--scope openkit|global|both]
openkit configure mcp <list|doctor|enable|disable|set-key|unset-key|test> [options]
openkit configure mcp <list|doctor|enable|disable|set-key|unset-key|list-key|copy-key|repair|test> [options]
openkit configure mcp custom <list|add-local|add-remote|import-global|disable|remove|doctor|test> [options]
```

### Guided Interactive Setup

```sh
openkit configure mcp --interactive
openkit configure mcp --interactive --scope both
```

- Shows the bundled MCP inventory, selected scope, enablement, capability state, lifecycle/policy labels, optional labels, and key state as `missing` or `present (redacted)`.
- Lets you choose `openkit`, `global`, or `both`; default remains `openkit`.
- Supports enable, disable, set/update key, unset key, secret-store permission repair, health checks, refresh, finish, and cancel flows over existing bundled MCP ids only.
- Lists custom MCPs separately when they exist, can run custom doctor/test paths, and points custom creation/import requests to non-interactive commands such as `openkit configure mcp custom add-local`, `add-remote`, and `import-global`.
- It is not a full custom MCP creation wizard.
- Uses hidden key entry in an interactive terminal. Raw key values are not echoed, masked, logged, summarized, or written to generated profiles.
- The wizard can repair secret-store permissions, limited to the OpenKit secret-store directory/file: POSIX directory `0700` and secret file `0600`; Windows reports local-user-only limitations without printing values.
- The final summary is redacted and lists changed, skipped, failed, conflict, caveat, and next-command items by scope. `both` scope reports `openkit` and `global` results separately.
- Global or both scope repeats the Direct OpenCode Caveat because direct OpenCode launches do not load OpenKit's local secret file.
- `--interactive` cannot be combined with `--json`; use non-interactive `list`, `doctor`, or `test` when JSON output is needed.
- `--interactive` requires an interactive terminal. In non-TTY scripts or CI it fails fast with no mutation and points to safe alternatives such as `openkit configure mcp set-key <mcp-id> --scope <scope> --stdin`.

### Discover MCPs

```sh
openkit configure mcp list
openkit configure mcp list --scope both --json
```

- Lists every bundled MCP catalog entry.
- Defaults to `--scope openkit`.
- Shows enablement, lifecycle/status, and key state as `missing` or `present (redacted)`.
- Does not mutate config.

### Diagnose MCP Readiness

```sh
openkit configure mcp doctor
openkit configure mcp doctor --scope both --json
openkit doctor
```

- `openkit configure mcp doctor` checks MCP catalog/config state, profile materialization, secret-file presence and permission state, key presence, dependency readiness, disabled/not-configured status, optional dependency state, and direct OpenCode caveats.
- `openkit doctor` checks the broader global install and workspace readiness surface and includes capability readiness where available.
- Both commands must redact key values.

### Enable Or Disable An MCP

```sh
openkit configure mcp enable context7
openkit configure mcp enable context7 --scope global
openkit configure mcp disable context7
```

- `enable` turns on the selected MCP for the selected scope and materializes placeholder-only profile entries.
- Enabling a key-required MCP without a key is allowed, but the MCP remains `not_configured` until a key is stored.
- `disable` sets selected scope enablement to false and keeps any stored key in `secrets.env`.
- Neither command should write raw secrets to a profile.

### Store A Key Safely

Prefer `--stdin` so the raw value is not part of the command line:

```sh
openkit configure mcp set-key context7 --stdin
openkit configure mcp set-key context7 --store keychain --stdin
openkit configure mcp set-key grep_app --stdin
openkit configure mcp set-key websearch --scope openkit --stdin
```

When stdin is waiting, provide the secret from a secure local source. Do not paste a real value into docs, tickets, commits, transcripts, or shared commands.

Current behavior:

- `set-key` accepts only catalog-defined secret bindings unless a future approved extension adds more.
- The raw value is written only to the selected backend. `local_env_file` writes `<OPENCODE_HOME>/openkit/secrets.env`; `keychain` writes a macOS Keychain generic-password item through `/usr/bin/security`.
- `keychain` is unavailable on Linux and Windows and never silently falls back to `local_env_file`; omit `--store` or use `--store local_env_file` to choose the default backend.
- After a successful write, OpenKit records the secret binding, enables the MCP for the selected scope, and materializes placeholder-only profile entries.
- Success output shows only redacted state, for example `CONTEXT7_API_KEY: present (redacted)`.
- `--value` is a compatibility path only. It can leave a real secret in shell history or process lists, so do not use it in shared examples or normal operator runbooks.

### Remove A Key

```sh
openkit configure mcp unset-key context7
openkit configure mcp unset-key context7 --store keychain
openkit configure mcp unset-key grep_app --scope both
```

- `unset-key` removes the catalog-bound env var from `local_env_file` by default or the selected `--store` only. Use `--all-stores` only when both backends should be cleared.
- It does not print the removed value.
- It does **not** disable the MCP. If the MCP remains enabled, `list` and `doctor` report it as `not_configured` until you store a new key or explicitly disable it.
- Missing keys are treated idempotently unless the secret file itself is unsafe or unreadable.

### Inspect Or Copy A Key Between Stores

```sh
openkit configure mcp list-key context7 --json
openkit configure mcp copy-key context7 --from local_env_file --to keychain
openkit configure mcp repair --store local_env_file
openkit configure mcp repair --store keychain
```

- `list-key` reports per-store presence and the effective store without printing raw values.
- `copy-key` is explicit and non-destructive by default; it copies a redacted binding from one backend to another and does not remove the source.
- Keychain repair is availability-only and reports sanitized remediation; it does not mutate login keychain settings.

### Test A Specific MCP

```sh
openkit configure mcp test context7
openkit configure mcp test context7 --scope openkit --json
```

- `test` checks the selected MCP as far as the local environment permits.
- It reports disabled, missing key, missing dependency, provider/network, policy, or unknown-MCP conditions where OpenKit can distinguish them.
- It must sanitize stdout, stderr, and provider payloads before displaying them.
- It does not silently enable disabled MCPs.

## Custom MCP Definitions

Custom MCPs are OpenKit-managed entries stored separately from the bundled catalog:

```text
<OPENCODE_HOME>/openkit/custom-mcp-config.json
```

Every custom entry carries `kind=custom`, an `origin` (`local`, `remote`, or `imported-global`), and `ownership=openkit-managed-custom`. Custom entries are merged with bundled entries only at inventory, materialization, health, and runtime read-model boundaries. They must not shadow bundled ids, and bundled `list`, `doctor`, `enable`, `disable`, `set-key`, `unset-key`, and `test` behavior remains unchanged.

### Custom Command Reference

```sh
openkit configure mcp custom list --scope both --json
openkit configure mcp custom add-local custom-local --cmd node --arg /path/to/server.js --env CUSTOM_MCP_TOKEN='${CUSTOM_MCP_TOKEN}' --scope openkit --enable --yes
openkit configure mcp custom add-remote custom-remote --url https://mcp.example.invalid/mcp --transport streamable-http --header Authorization='${CUSTOM_MCP_AUTHORIZATION}' --yes
openkit configure mcp custom import-global legacy-mcp --as legacy-custom --scope openkit --yes
openkit configure mcp custom import-global --select legacy-one,legacy-two --scope openkit --yes --json
openkit configure mcp custom disable custom-local --scope global
openkit configure mcp custom remove custom-local --scope all --yes
openkit configure mcp custom doctor custom-local --json
openkit configure mcp custom test custom-local --yes --json
```

Use placeholders in examples and shared command text. The single quotes above prevent your shell from expanding the placeholder locally.

### Local Custom MCP Validation

Local custom MCPs use argv-array style input: `--cmd <executable>` plus repeated `--arg <arg>`. OpenKit rejects shell command strings, shell operators (`&&`, `||`, `;`, pipes, redirects, backticks, command substitution, and backgrounding), and shell launchers such as `bash -c`, `sh -c`, `zsh -c`, `cmd /c`, `powershell -Command`, or `pwsh -Command`.

Local commands can execute code on your machine. OpenKit reports this as a risk warning, checks whether the executable appears available where possible, and stores placeholder-only environment bindings such as `CUSTOM_MCP_TOKEN=${CUSTOM_MCP_TOKEN}`. Raw token-looking args, env values, labels, metadata, or command strings are rejected before mutation.

### Remote Custom MCP Validation

Remote custom MCPs accept web transports only: `http`, `sse`, and `streamable-http`. Non-localhost URLs must use `https`. localhost HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1` local-development URLs and always reports a warning.

OpenKit rejects unsupported schemes such as `file:`, `javascript:`, `data:`, and `ftp:`, embedded credentials, token-like query parameters, blocked metadata-service hosts such as `169.254.169.254` and `metadata.google.internal`, and raw header values. Headers and env values must be placeholders, for example `Authorization=${CUSTOM_MCP_AUTHORIZATION}`. Placeholder values are not treated as configured secrets; doctor/test reports missing bindings as `not_configured` until the backing env var is present in the environment or secret store.

### Import-Global Safety

`openkit configure mcp custom import-global <global-id>` reads the user's global OpenCode config at `<OPENCODE_HOME>/opencode.json` and creates an OpenKit-managed custom entry. It does not mutate the source global entry by default.

Import validation uses the same local and remote rules as direct add flows. If a source entry contains raw env/header values or token-looking fields, OpenKit does not copy the raw value. Where the field can be represented safely, it is converted to a placeholder and the outcome is reported as `needs_secret_setup`; unsupported or unsafe shapes are reported as skipped, invalid, or unsupported with redacted reasons.

### Disable, Remove, Doctor, And Test

- `custom disable` changes enablement for the selected scope and preserves the custom definition and any stored local secrets.
- `custom remove --scope all --yes` removes the OpenKit-managed custom definition and OpenKit-managed profile materialization. `custom remove --scope openkit|global|both` preserves the definition and disables the selected scope so the entry remains inspectable. Neither form deletes bundled entries, unmanaged global entries, or raw local secret values.
- `custom doctor` checks custom status with standard states such as `available`, `unavailable`, `degraded`, and `not_configured`.
- `custom test` never launches through a shell. Phase-1 testing is dependency/shape oriented; remote providers may report `degraded` / `provider_unverified` rather than pretending a full protocol handshake ran.

Global-scope custom entries follow the same Direct OpenCode Caveat as bundled entries: direct OpenCode launches must provide any needed env vars outside OpenKit.

## Scope Semantics

| Scope | Meaning | Primary config target | Secret loading behavior |
| --- | --- | --- | --- |
| `openkit` | Default. Configure the OpenKit-managed profile used by `openkit run`. | `<OPENCODE_HOME>/profiles/openkit/opencode.json` | `openkit run` loads `<OPENCODE_HOME>/openkit/secrets.env` into the session environment. |
| `global` | Configure OpenKit-managed entries in the user's global OpenCode config. | `<OPENCODE_HOME>/opencode.json` | Direct OpenCode launches must get env vars from the user's shell or OS environment; OpenKit's secret loader is not involved. |
| `both` | Apply the same requested change to `openkit` and `global` scopes. | both targets above | `openkit run` covers only the OpenKit-managed launch; direct OpenCode still needs exported env vars. |

The global scope is additive. OpenKit must preserve unrelated user config and should report unmanaged conflicts rather than overwrite a user-owned MCP entry with the same id.

## Local Secret Store And Permissions

OpenKit stores local MCP secrets here:

```text
<OPENCODE_HOME>/openkit/secrets.env
```

Default path examples:

```text
POSIX default:   ~/.config/opencode/openkit/secrets.env
Windows default: %APPDATA%\opencode\openkit\secrets.env
```

The file format is dotenv-style. Use placeholders in examples only:

```dotenv
CONTEXT7_API_KEY=<CONTEXT7_API_KEY_VALUE>
GREP_APP_API_KEY=<GREP_APP_API_KEY_VALUE>
WEBSEARCH_API_KEY=<WEBSEARCH_API_KEY_VALUE>
```

Permission expectations:

- POSIX parent directory: `0700`
- POSIX secret file: `0600`
- Windows: closest available local-user-only behavior; doctor output should report any limitation without printing values
- If permissions cannot be created or repaired safely, `set-key` should fail closed rather than write a secret to an unsafe location.

Related local state files are not secret stores:

- `<OPENCODE_HOME>/openkit/mcp-config.json` stores enablement and secret-binding metadata only.
- `<OPENCODE_HOME>/openkit/custom-mcp-config.json` stores OpenKit-managed custom MCP definitions, origin/ownership metadata, enablement, placeholders, and secret-binding metadata only.
- `<OPENCODE_HOME>/openkit/mcp-profile-state.json` stores OpenKit materialization ownership and conflict metadata only.
- Generated OpenKit/OpenCode profiles store environment placeholders such as `${CONTEXT7_API_KEY}`, never raw values.

## No Raw Secret Rule

Raw secrets are allowed only in these places:

1. process memory while `set-key` is receiving the value
2. `<OPENCODE_HOME>/openkit/secrets.env`
3. the child process environment created by `openkit run`

Raw secrets must not appear in:

- repository files or package files
- docs, tickets, scope/solution/QA artifacts, or workflow evidence
- generated OpenKit or OpenCode profile JSON
- `mcp-config.json` or `mcp-profile-state.json`
- `custom-mcp-config.json`
- command output, logs, doctor output, test output, runtime summaries, or provider error payloads

Use placeholder-only profile examples:

```json
{
  "type": "local",
  "command": ["npx", "-y", "@upstash/context7-mcp@latest"],
  "enabled": true,
  "environment": {
    "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
  }
}
```

Do not display partial prefixes, suffixes, hashes, or provider error bodies that may contain credentials.

## Direct OpenCode Caveat

`openkit run` is the preferred launch path because it prepares the managed OpenKit profile and loads local secrets into the child OpenCode process.

If you configure `--scope global` and launch OpenCode directly, OpenCode sees only placeholder-backed MCP entries. You must export the required env vars yourself through your shell or OS environment before the direct launch. If you do not, key-required MCPs such as `context7`, `grep_app`, or `websearch` can remain `not_configured` even though `secrets.env` exists.

Use `openkit configure mcp doctor --scope global` to surface this caveat before relying on direct OpenCode.

## Validation Commands And Evidence Boundaries

Useful operator checks:

```sh
openkit doctor
openkit configure mcp list --scope both
openkit configure mcp doctor --scope both
openkit configure mcp test context7 --scope openkit --json
```

Maintainer/runtime checks when working in this repository:

```sh
npm run verify:governance
npm run verify:install-bundle
node .opencode/workflow-state.js validate
node .opencode/workflow-state.js validate-work-item-board <work_item_id>
```

Validation surface boundaries:

- `openkit doctor` and `openkit configure mcp ...` validate `global_cli` and MCP/capability readiness.
- In-session capability inventory, router, health, `tool.mcp-doctor`, and skill/MCP binding tools validate `runtime_tooling`.
- Workflow-state commands validate `compatibility_runtime`.
- Governance and operator docs checks validate `documentation`.
- Target-project application validation is `target_project_app` only when the target project declares real app build, lint, test, smoke, or regression commands. If those commands are absent, record target-project app validation as unavailable rather than replacing it with OpenKit checks.

## Troubleshooting Quick Reference

| Symptom | Likely state | Next action |
| --- | --- | --- |
| MCP appears but has `keys=missing` | `not_configured` | Run `openkit configure mcp set-key <mcp-id> --stdin`. |
| MCP is enabled but direct OpenCode cannot use it | direct OpenCode caveat | Export the env var in the shell/OS environment or use `openkit run`. |
| `secrets.env` permission warning | unsafe secret store | Repair parent directory/file permissions or rerun `set-key` after correcting ownership. |
| Optional dependency is absent | `unavailable` or `degraded` | Install the optional provider only if you need that MCP; absence should not block normal OpenKit use. |
| `unset-key` leaves MCP enabled | expected semantics | Either store a new key or run `openkit configure mcp disable <mcp-id>`. |
| Target app tests are missing | unavailable `target_project_app` validation | Report the missing app-native validation path honestly; do not substitute OpenKit doctor or MCP tests. |
