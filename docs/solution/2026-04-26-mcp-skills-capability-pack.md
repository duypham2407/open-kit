---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-941
feature_slug: mcp-skills-capability-pack
source_scope_package: docs/scope/2026-04-26-mcp-skills-capability-pack.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: MCP + Skills Capability Pack

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-26-mcp-skills-capability-pack.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-941`.
- Product gate: `product_to_solution` is approved. This package is the `solution_to_fullstack` handoff artifact only.
- Role boundary: this package defines technical direction, slices, contracts, and validation. It does not implement the capability pack.

## Chosen Approach

Add a shared OpenKit-owned capability catalog layer, then build the `openkit configure mcp` control plane, secret-safe profile materialization, `openkit run` secret loading, and runtime inventory/router/health tools on top of that single catalog source.

This is enough because the repository already has the correct foundation seams:

- global CLI dispatch through `src/cli/index.js` and `bin/openkit.js`
- global path model through `src/global/paths.js`, `src/global/materialize.js`, `src/global/launcher.js`, and `src/global/doctor.js`
- OpenKit-managed profile generation through `src/global/materialize.js`
- runtime bootstrap and summaries through `src/runtime/index.js`, `src/runtime/create-runtime-interface.js`, and `src/runtime/capability-registry.js`
- MCP runtime foundation through `src/runtime/mcp/`, `src/runtime/tools/mcp/mcp-dispatch.js`, and `src/mcp-server/tool-schemas.js`
- skill discovery through `src/runtime/skills/` and existing `skills/` package assets
- repo-native Node test and verification commands in `package.json`

The feature should not introduce a marketplace, secret discovery, hosted account provisioning, or target-project app validation. All raw secrets remain local-only under the OpenCode home-derived OpenKit settings directory.

## Architecture Overview

```text
Bundled catalogs
  src/capabilities/mcp-catalog.js
  src/capabilities/skill-catalog.js
        |
        v
Global control plane                              Runtime control plane
  openkit configure mcp ...                         bootstrapRuntimeFoundation(...)
  src/global/mcp/*                                  src/runtime/managers/*
        |                                           src/runtime/tools/capability/*
        |                                                   |
        v                                                   v
Local user state, not package state                 In-session inventory/router/health
  <OPENCODE_HOME>/openkit/mcp-config.json           tool.capability-inventory
  <OPENCODE_HOME>/openkit/mcp-profile-state.json    tool.capability-router
  <OPENCODE_HOME>/openkit/secrets.env               tool.capability-health
        |                                           tool.skill-index
        v                                           tool.skill-mcp-bindings
Profile materialization
  OpenKit-managed profile only for --scope openkit
  User global OpenCode config only for --scope global
  Both when --scope both
        |
        v
openkit run
  loads secrets.env into child process env
  launches OpenCode with OpenKit-managed config dir
  no raw secret value in profile JSON, logs, doctor, runtime summary, or artifacts
```

Key design decisions:

- **Single catalog source**: MCP and skill metadata should live in package-owned modules that both global CLI code and runtime code can import. Avoid duplicate hard-coded MCP lists in CLI, profile materialization, runtime summaries, and docs.
- **State is local and additive**: user enablement choices and secret presence state live under the OpenCode home-derived OpenKit settings root, not in the repository, package, generated docs, or target project.
- **Profiles contain placeholders only**: materialized MCP entries may reference environment variable names, but never raw values.
- **Global config is preserved**: global/both scope gives OpenKit permission to write OpenKit-managed MCP entries into global OpenCode config. It does not permit destructive overwrite of user-managed entries.
- **Runtime status is computed**: catalog default status, enablement state, key presence, dependency probes, policy gates, and scope produce `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured` labels at report time.

## Dependencies

- No new npm package dependency is required for the first implementation pass. Existing Node.js `>=18`, `@modelcontextprotocol/sdk`, and current runtime dependencies are sufficient.
- External MCP commands may use package catalog commands such as `npx -y ...`; these are runtime provider dependencies, not OpenKit package dependencies.
- No real API key, token, or credential may be added to repository files, package files, tests fixtures checked into git, generated profiles, logs, docs, or workflow artifacts.
- Target-project app validation remains unavailable unless a target project defines app-native build/lint/test commands.

## Impacted Surfaces

### Global CLI and configuration control plane

- `src/cli/index.js`
- `src/cli/commands/help.js`
- `src/cli/commands/configure.js` (create parent dispatcher for `openkit configure ...`)
- `src/cli/commands/configure-mcp.js` (create)
- `src/global/paths.js`
- `src/global/materialize.js`
- `src/global/ensure-install.js`
- `src/global/doctor.js`
- `src/global/config-merge.js`
- `src/install/merge-policy.js` if global profile merge ownership needs shared helpers
- `src/global/mcp/catalog-loader.js` (create)
- `src/global/mcp/mcp-config-store.js` (create)
- `src/global/mcp/mcp-configurator.js` (create)
- `src/global/mcp/profile-materializer.js` (create)
- `src/global/mcp/secret-manager.js` (create)
- `src/global/mcp/redaction.js` (create)
- `src/global/mcp/health-checks.js` (create)

### Shared catalog and status contracts

- `src/capabilities/mcp-catalog.js` (create)
- `src/capabilities/skill-catalog.js` (create)
- `src/capabilities/status.js` (create)
- `src/capabilities/schema.js` (create lightweight validators; no external schema dependency required)
- `registry.json`
- `package.json` `files` array only if a newly created top-level catalog directory is not already included by `src/`

### Runtime foundation, MCP platform, and in-session tools

- `src/runtime/capability-registry.js`
- `src/runtime/create-managers.js`
- `src/runtime/create-runtime-interface.js`
- `src/runtime/create-tools.js`
- `src/runtime/mcp/index.js`
- `src/runtime/mcp/builtin-mcps.js`
- `src/runtime/mcp/mcp-config-loader.js`
- `src/runtime/doctor/mcp-doctor.js`
- `src/runtime/managers/skill-mcp-manager.js`
- `src/runtime/managers/capability-registry-manager.js` (create)
- `src/runtime/managers/mcp-health-manager.js` (create)
- `src/runtime/tools/capability/capability-inventory.js` (create)
- `src/runtime/tools/capability/capability-router.js` (create)
- `src/runtime/tools/capability/capability-health.js` (create)
- `src/runtime/tools/capability/skill-index.js` (create)
- `src/runtime/tools/capability/skill-mcp-bindings.js` (create)
- `src/runtime/tools/capability/mcp-doctor.js` (create if the capability doctor needs an in-session tool separate from global doctor)
- `src/mcp-server/tool-schemas.js`

### Bundled skills and docs

- Existing skill directories under `skills/` remain package-owned.
- Add missing package-owned skill directories only from approved OpenKit-owned sources; do **not** harvest or copy a user's global OpenCode config or machine-local secrets into the package.
- Likely skill directory additions or catalog entries:
  - `skills/building-components/`
  - `skills/context7-mcp/`
  - `skills/deploy-to-vercel/`
  - `skills/mui/`
  - `skills/nextjs/`, `skills/next-best-practices/`, `skills/next-cache-components/`, `skills/next-upgrade/`
  - Rust suite: `skills/rust-router/`, `skills/rust-learner/`, `skills/coding-guidelines/`, `skills/unsafe-checker/`, `skills/m01-ownership/`, `skills/m02-resource/`, `skills/m03-mutability/`, `skills/m04-zero-cost/`, `skills/m05-type-driven/`, `skills/m06-error-handling/`, `skills/m07-concurrency/`, `skills/m09-domain/`, `skills/m10-performance/`, `skills/m11-ecosystem/`, `skills/m12-lifecycle/`, `skills/m13-domain-error/`, `skills/m14-mental-model/`, `skills/m15-anti-pattern/`
  - Code intelligence/navigation suite where bundled: `skills/rust-code-navigator/`, `skills/rust-refactor-helper/`, `skills/rust-call-graph/`, `skills/rust-symbol-analyzer/`, `skills/rust-trait-explorer/`, `skills/rust-deps-visualizer/`
- `README.md`
- `AGENTS.md` only if current command/tool facts change
- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`
- `docs/operator/README.md`
- `docs/operator/supported-surfaces.md`
- `docs/operator/mcp-configuration.md` (create)
- `docs/maintainer/test-matrix.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `docs/operations/runbooks/openkit-daily-usage.md`

### Tests

- `tests/cli/configure-mcp.test.js` (create)
- `tests/cli/openkit-cli.test.js`
- `tests/global/mcp-config-store.test.js` (create)
- `tests/global/mcp-secret-manager.test.js` (create)
- `tests/global/mcp-profile-materializer.test.js` (create)
- `tests/global/doctor.test.js`
- `tests/install/materialize.test.js`
- `tests/runtime/capability-registry.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/runtime/doctor.test.js`
- `tests/runtime/mcp-dispatch.test.js`
- `tests/runtime/capability-tools.test.js` (create)
- `tests/runtime/skill-catalog.test.js` (create if catalog validation is non-trivial)
- `tests/mcp-server/mcp-server.test.js`
- `tests/runtime/registry-metadata.test.js`
- `.opencode/tests/workflow-contract-consistency.test.js` only if workflow/docs contracts are touched

## Boundaries And Components

### InstalledCapabilityScanner

Implement as catalog + probe helpers rather than a broad filesystem scanner. It should:

- read bundled MCP and skill catalogs from package-owned modules
- inspect OpenKit user overrides and scope materialization sidecars under `<OPENCODE_HOME>/openkit/`
- run bounded dependency checks for local command availability, optional package availability, browser/tooling readiness, and key presence
- avoid searching shell history, browser stores, password managers, existing user configs for secrets, or environment dumps

### CapabilityClassifier

Computes status from:

1. catalog metadata (`defaultStatus`, `preview`, `policyGated`, `optional`)
2. scope enablement (`enabled`, `disabled`, absent/default)
3. required key presence (`present`/`missing`, redacted)
4. dependency probes (`available`, `missing`, `version-incompatible`, `not_checked`)
5. policy gates (`git` safety, preview labels, direct OpenCode caveats)

It must use only the approved vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`. Disabled state is represented as a separate enablement field, not as a new capability status label.

### CapabilityRegistryManager

Add a runtime manager that joins catalog metadata, user config, secret-presence metadata, health checks, and current runtime tool/skill availability. It feeds runtime summaries and in-session tools.

### McpConfigurator

The global CLI orchestrator for list/doctor/enable/disable/set-key/unset-key/test. It owns parsing, mutation ordering, idempotency, and output redaction.

### ProfileMaterializer

Writes OpenKit-managed MCP profile entries for selected scopes. It never writes raw secrets and never overwrites user-managed global OpenCode entries without OpenKit ownership metadata.

### SecretManager

Reads, writes, removes, and permission-checks `<OPENCODE_HOME>/openkit/secrets.env`. It is the only module allowed to handle raw secret values.

### HealthChecker

Runs bounded checks for command availability, optional dependency presence, key presence, scope materialization, and safe test probes. Provider responses and errors must be sanitized before display.

### SkillMcpRouter

Extends the current `SkillMcpManager` into an actual router/read model that maps skill triggers and task intent to enabled/available MCPs, with visible unavailable/not_configured/degraded reasons when no usable route exists.

## Interfaces And Data Contracts

### MCP catalog entry

Create `src/capabilities/mcp-catalog.js` with a stable exported catalog and validator.

```js
{
  schema: 'openkit/mcp-catalog-entry@1',
  id: 'context7',
  displayName: 'Context7',
  description: 'Library documentation and code examples.',
  category: 'research',
  status: 'not_configured', // default/catalog state before local checks
  lifecycle: 'stable' | 'preview' | 'experimental' | 'policy_gated' | 'optional',
  defaultEnabled: {
    openkit: false,
    global: false
  },
  scopes: ['openkit', 'global'],
  transport: 'stdio' | 'http' | 'builtin',
  profileEntry: {
    type: 'local',
    command: ['npx', '-y', '@upstream-or-provider/context7-mcp'],
    args: [],
    environment: {
      CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}'
    }
  },
  secretBindings: [
    {
      id: 'context7-api-key',
      envVar: 'CONTEXT7_API_KEY',
      required: true,
      label: 'Context7 API key',
      configureCommand: 'openkit configure mcp set-key context7 --stdin',
      placeholder: '${CONTEXT7_API_KEY}'
    }
  ],
  dependencyChecks: [
    {
      id: 'node-npx',
      kind: 'command',
      command: 'npx',
      required: true
    }
  ],
  policy: {
    destructiveOperations: 'blocked',
    requiresExplicitEnable: false,
    directOpenCodeCaveat: true
  },
  skillRefs: ['skill.context7-mcp', 'skill.deep-research'],
  test: {
    kind: 'command-smoke' | 'runtime-dispatch' | 'dependency-only',
    timeoutMs: 10000,
    sanitizedErrorMode: 'summary-only'
  },
  docs: {
    setup: 'docs/operator/mcp-configuration.md#context7',
    limitations: ['Requires local API key configuration.']
  }
}
```

Notes:

- `profileEntry.environment` values are placeholders. They are not secret values and must not be treated as usable secrets.
- Catalog defaults are only defaults. User overrides win after first configuration or upgrade.
- The catalog may include a `builtin` transport for OpenKit-owned runtime tools that are not external MCP subprocesses.

### Skill catalog entry

Create `src/capabilities/skill-catalog.js` as the package-owned inventory for bundled skills.

```js
{
  schema: 'openkit/skill-catalog-entry@1',
  id: 'skill.vercel-react-best-practices',
  name: 'vercel-react-best-practices',
  path: 'skills/vercel-react-best-practices/SKILL.md',
  category: 'frontend',
  status: 'available' | 'preview' | 'unavailable',
  lifecycle: 'stable' | 'preview' | 'experimental',
  bundled: true,
  triggerHints: ['React', 'Next.js', 'performance'],
  roleHints: ['SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent'],
  modeHints: ['quick', 'migration', 'full'],
  mcpRefs: ['chrome-devtools', 'playwright'],
  optionalMcpRefs: ['context7', 'websearch'],
  limitations: [],
  docs: {
    source: 'skills/vercel-react-best-practices/SKILL.md'
  }
}
```

Skill status rules:

- `available`: package contains the skill file and any required backing capability is either available or not required.
- `preview`: package contains the skill but the behavior is intentionally early/partial, or required backing tools are optional/degraded.
- `unavailable`: catalog entry exists but the package does not contain the skill file or a hard required backing capability is absent.

### User MCP override/config store

Create a local user file at `<OPENCODE_HOME>/openkit/mcp-config.json`.

```js
{
  schema: 'openkit/mcp-config@1',
  version: 1,
  updatedAt: 'ISO-8601',
  catalogVersion: 1,
  scopes: {
    openkit: {
      context7: {
        enabled: true,
        source: 'user',
        updatedAt: 'ISO-8601'
      }
    },
    global: {
      context7: {
        enabled: false,
        source: 'user',
        updatedAt: 'ISO-8601'
      }
    }
  },
  secretBindings: {
    context7: {
      envVars: ['CONTEXT7_API_KEY'],
      updatedAt: 'ISO-8601'
    }
  }
}
```

Rules:

- `source: 'default'` may be used for first materialization, but once a user runs enable/disable/set-key/unset-key, write `source: 'user'`.
- Upgrade must add new catalog entries without resetting existing `source: 'user'` preferences.
- This file contains env var names and presence metadata only. It must not contain secret values.

### Profile ownership sidecar

Create `<OPENCODE_HOME>/openkit/mcp-profile-state.json`.

```js
{
  schema: 'openkit/mcp-profile-state@1',
  version: 1,
  updatedAt: 'ISO-8601',
  profiles: {
    openkit: {
      configPath: '<OPENCODE_HOME>/profiles/openkit/opencode.json',
      managedEntries: {
        context7: {
          entryHash: 'sha256-of-redacted-entry',
          lastMaterializedAt: 'ISO-8601'
        }
      }
    },
    global: {
      configPath: '<OPENCODE_HOME>/opencode.json',
      managedEntries: {
        context7: {
          entryHash: 'sha256-of-redacted-entry',
          lastMaterializedAt: 'ISO-8601'
        }
      },
      conflicts: {
        git: {
          reason: 'existing-unmanaged-entry',
          detectedAt: 'ISO-8601'
        }
      }
    }
  }
}
```

Rules:

- OpenKit-managed profile entries may be refreshed idempotently.
- A global OpenCode MCP entry with the same id but no OpenKit ownership record is user-managed. Do not overwrite it; report a conflict and remediation.
- Do not copy user global OpenCode config into the OpenKit package or managed kit bundle.

### Secret file and secret bindings

Secret file path:

```text
<OPENCODE_HOME>/openkit/secrets.env
# default POSIX expansion: ~/.config/opencode/openkit/secrets.env
```

Format:

```dotenv
CONTEXT7_API_KEY=<local-user-secret-value>
WEBSEARCH_API_KEY=<local-user-secret-value>
```

Rules:

- The parent directory must be `0700` on POSIX platforms.
- The file must be `0600` on POSIX platforms.
- On Windows, enforce the closest available local-user-only behavior and report any limitation in doctor output without printing values.
- Write atomically: create temp file in the same directory with `0600`, write, flush, close, rename over `secrets.env`, then re-check final mode.
- If the parent directory or file mode cannot be created or repaired, `set-key` fails closed and does not write the secret.
- Preserve unrelated env vars and comments when safely parseable. For malformed files, avoid destructive rewrite; report a clear failure or degraded doctor result.
- Collapse duplicate target env vars when writing the target key; warn about duplicate unrelated keys without printing values.
- Env var names must come from catalog `secretBindings` or pass a strict allowlist validation if an explicit catalog-supported alternate is added later.

### Materialized profile entry

OpenKit-managed and global OpenCode config entries use placeholder-based values only:

```js
{
  type: 'local',
  command: ['npx', '-y', '@provider/context7-mcp'],
  enabled: true,
  environment: {
    CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}'
  }
}
```

Rules:

- The raw value from `secrets.env` is never copied into `environment`.
- If OpenCode profile environment interpolation differs from this placeholder shape, implementation may adapt the placeholder format to OpenCode's supported schema, but it must still be an env reference and never a raw value.
- `openkit run` loads `secrets.env` into the child process environment so placeholder-backed MCPs work in OpenKit-managed sessions.
- For direct OpenCode launches using global scope, doctor must warn that the user may need to export the env var in their shell because OpenKit's launcher is not involved.

### Redacted command output/read model

All command, doctor, test, runtime summary, and tool outputs must use redacted state:

```js
{
  mcpId: 'context7',
  scope: 'openkit',
  enabled: true,
  capabilityState: 'not_configured',
  keyState: {
    CONTEXT7_API_KEY: 'missing' | 'present_redacted'
  },
  secretSource: 'secrets.env' | 'process.env' | 'missing',
  guidance: 'Run openkit configure mcp set-key context7 --stdin'
}
```

No partial prefixes, suffixes, hashes of raw secrets, or provider error bodies that may contain credentials should be displayed.

## CLI Behavior: `openkit configure mcp`

Add a nested CLI command:

```text
openkit configure mcp <list|doctor|enable|disable|set-key|unset-key|test> [options]
```

Add `src/cli/commands/configure.js` as a parent dispatcher and keep existing top-level compatibility commands such as `configure-embedding` and `configure-agent-models` unchanged.

### Shared parsing

- Supported scopes: `openkit`, `global`, `both`.
- Default scope: `openkit`.
- Unknown scope: fail with supported values and no mutation.
- Unknown MCP id: fail with a catalog-based suggestion when possible and no mutation.
- `--json` may be supported for list/doctor/test; if supported, JSON output must be redacted.

### `list`

```text
openkit configure mcp list [--scope openkit|global|both] [--json]
```

Behavior:

- Lists every bundled MCP catalog entry, including disabled, optional, preview, policy-gated, unavailable, degraded, and not_configured entries.
- Shows scope-specific enablement state and OpenKit/global materialization state.
- Shows key state as `missing` or `present (redacted)` only.
- Does not mutate config.

### `doctor`

```text
openkit configure mcp doctor [--scope openkit|global|both] [--json]
```

Behavior:

- Runs catalog, scope, profile, secret file permission, key presence, dependency, optional dependency, and policy checks.
- Reports direct OpenCode caveats for `--scope global` or `both`.
- Reports unmanaged global config conflicts without overwriting them.
- Reports unsafe `secrets.env` permissions with remediation guidance and no raw values.
- Returns non-zero only for conditions that make the requested scope materially unusable or unsafe; optional absent MCPs should be `unavailable`/`degraded` but not fail the entire doctor command.

### `enable`

```text
openkit configure mcp enable <mcp-id> [--scope openkit|global|both]
```

Behavior:

- Sets selected scope enablement to `true`.
- Materializes selected scope profile entries with placeholders only.
- For key-required MCPs with no key, enablement still succeeds but status reports `not_configured` with set-key guidance.
- Idempotent: repeated enable does not duplicate profile entries.
- For global scope, if an unmanaged entry already exists for the same id, do not overwrite; report conflict and leave state unchanged for that entry.

### `disable`

```text
openkit configure mcp disable <mcp-id> [--scope openkit|global|both]
```

Behavior:

- Sets selected scope enablement to `false`.
- Keeps any configured key in `secrets.env`.
- Leaves the MCP discoverable in list/doctor as disabled.
- May either materialize an entry with `enabled: false` or remove only OpenKit-owned enabled entries if OpenCode profile semantics require removal. The read model must still report disabled state from `mcp-config.json`.
- Does not mutate unselected scopes.

### `set-key`

```text
openkit configure mcp set-key <mcp-id> [--scope openkit|global|both] [--env-var <ENV_VAR>] [--stdin | --prompt | --value <value>]
```

Behavior:

- Default scope: `openkit`.
- Preferred input modes:
  1. `--stdin` for scripts.
  2. non-echoing `--prompt` when TTY is available.
  3. `--value` only as a compatibility path; warn to stderr that shell history may retain inline arguments, but never echo the value.
- Reject `set-key` for an MCP with no catalog `secretBindings` unless a future approved extension explicitly supports optional env bindings.
- Store raw value only in `<OPENCODE_HOME>/openkit/secrets.env`.
- Enforce parent `0700` and file `0600` before writing; fail closed if not possible.
- Automatically enables the MCP for the selected scope after the secret write succeeds.
- Materializes selected scope entries with placeholders only.
- Prints only redacted success, for example `CONTEXT7_API_KEY: present (redacted)`.

### `unset-key`

```text
openkit configure mcp unset-key <mcp-id> [--scope openkit|global|both] [--env-var <ENV_VAR>]
```

Behavior:

- Removes the selected catalog-bound env var from `secrets.env`.
- Does not print the removed value.
- Does **not** silently disable the MCP. If it remains enabled, list/doctor reports `not_configured` until a key is restored or the user explicitly disables it.
- Refreshes selected scope profile entries if needed, still with placeholders only.
- Missing key is idempotent: report already missing and return success unless the secret file itself is unsafe/unreadable.

### `test`

```text
openkit configure mcp test <mcp-id> [--scope openkit|global|both] [--timeout-ms <n>] [--json]
```

Behavior:

- Verifies the selected MCP as far as possible without leaking credentials.
- Checks enablement, key presence, dependency presence, profile materialization, and safe provider smoke probes where available.
- For disabled MCPs, returns a clear disabled/skipped result rather than silently enabling or testing.
- Sanitizes stdout/stderr/provider payloads before output.
- Distinguishes missing key, disabled state, missing dependency, network/provider failure, policy-gated blocked action, and unknown MCP where possible.

## Secret Safety And Redaction Design

Non-negotiable safety rules:

- Raw secrets only exist in process memory during `set-key`, in `<OPENCODE_HOME>/openkit/secrets.env`, and in the child process environment for `openkit run`.
- Raw secrets must not be written to:
  - repository files
  - package files
  - generated OpenKit or OpenCode profiles
  - `mcp-config.json` or profile sidecars
  - logs
  - doctor/configure output
  - runtime summaries
  - workflow-state records
  - docs artifacts
  - MCP test provider payloads
- Add a shared redaction helper in `src/global/mcp/redaction.js` and reuse it in CLI, doctor, test, launcher notices, runtime summaries, and runtime tools.
- Redaction must operate on known raw values in memory during the command plus known secret env var names from catalog. Provider errors should be summarized when there is any risk the raw payload contains credentials.
- Do not serialize `process.env`, `launcherEnv`, or raw secret maps into `OPENKIT_RUNTIME_CONFIG_CONTENT`, runtime summaries, invocation logs, or evidence records.
- Test fixtures may use synthetic in-memory sentinel values, but assertions must verify the sentinel never appears outside the temporary `secrets.env` file.

## `openkit run` Secret Loading

Update `src/global/launcher.js` and related tests so `openkit run`:

1. resolves `<OPENCODE_HOME>/openkit/secrets.env` through `getGlobalPaths()`
2. validates safe permissions with `SecretManager`
3. parses env entries without logging values
4. merges secrets into the launcher child process environment before spawning `opencode`
5. preserves explicit caller environment precedence when the same env var is already set by the shell
6. passes no raw secret values into `OPENKIT_RUNTIME_CONFIG_CONTENT`
7. reports unreadable/unsafe secret file as a redacted warning unless an enabled key-required MCP depends on it and doctor/test determines the scope is unusable

Suggested precedence:

```text
explicit process env passed to openkit run > secrets.env > inherited defaults absent
```

Doctor should report only source labels (`process.env`, `secrets.env`, `missing`) and redacted presence.

## Runtime Capability Registry, Router, And Health Tools

Add runtime support without changing lane semantics or approval gates.

### Runtime manager/read model

`CapabilityRegistryManager` should expose:

```js
{
  listCapabilities({ scope, includeSkills, includeMcps }),
  getCapability(id, { scope }),
  routeCapability({ intent, skillName, mcpId, mode, role }),
  health({ scope, mcpId }),
  listSkillMcpBindings()
}
```

`McpHealthManager` should run bounded local checks and return redacted status objects.

### Runtime interface additions

Extend `createRuntimeInterface()` with redacted fields only:

```js
capabilityPack: {
  catalogVersion: 1,
  mcpSummary: {
    total,
    enabledOpenKit,
    enabledGlobal,
    states: { available, unavailable, degraded, preview, compatibility_only, not_configured }
  },
  skillSummary: {
    total,
    states: { available, unavailable, degraded, preview, compatibility_only, not_configured }
  },
  keySummary: {
    required,
    presentRedacted,
    missing
  }
}
```

Do not include env var values. Keep runtime surface label `runtime_tooling`.

### Runtime tools

Add MCP-exposed in-session tools, with schemas in `src/mcp-server/tool-schemas.js`:

- `tool.capability-inventory`: list MCPs/skills with scope, state, key presence, dependency status, preview/policy labels.
- `tool.capability-router`: route a requested skill/MCP-backed intent to an available capability or return why none is usable.
- `tool.capability-health`: run health checks for one MCP or the capability pack.
- `tool.mcp-doctor`: in-session doctor-style report aligned with global `openkit configure mcp doctor` but read-only.
- `tool.skill-index`: list bundled skills with status, triggers, limitations, and backing MCP refs.
- `tool.skill-mcp-bindings`: list skill-to-MCP bindings from `SkillMcpManager`.

Tool outputs must include `validationSurface: 'runtime_tooling'` and standard status labels.

## Default MCP Catalog Plan

Initial catalog entries:

| MCP id | Default scope state | Status/lifecycle | Key requirement | Dependency/policy notes |
| --- | --- | --- | --- | --- |
| `openkit` | enabled for `openkit`; not written to global unless requested | `available` | none | Existing OpenKit MCP server. Keep `OPENKIT_PROJECT_ROOT: {cwd}` behavior. |
| `chrome-devtools` | enabled for `openkit` if dependency checks pass or current default requires it | `available` or `degraded` | none | Existing npx command; browser/runtime dependency checks can degrade. |
| `playwright` | enabled for `openkit` if safe dependency path exists; otherwise discoverable disabled/degraded | `available`/`degraded`/`unavailable` | none | Browser install/version checks determine readiness. |
| `context7` | disabled until enabled or `set-key`; `set-key` auto-enables selected scope | `not_configured` until key present | required env var from catalog | No raw key in profile; docs/setup guidance. |
| `grep_app` | disabled or `not_configured` depending provider requirement | `not_configured` or `available` | catalog-defined if provider needs key | Use as code search/deep research MCP; sanitize provider errors. |
| `websearch` | disabled until enabled/keyed | `not_configured` until key present | required if provider-backed | Network/provider failures are degraded/unavailable, not startup blockers. |
| `sequential-thinking` | enabled for `openkit` when command is available | `available`/`preview` | none | Label as reasoning aid; no secret requirement. |
| `git` | disabled by default or enabled only as policy-gated safe subset | `preview` + `policy_gated` | none | Preserve OpenKit git safety: no destructive/irreversible git ops silently allowed. |
| `augment_context_engine` | optional, disabled unless dependency present | `unavailable`/`degraded`/`available` | none unless provider config requires | Must not block install, doctor, or run when absent. |

Catalog defaults should be conservative for key-required and policy-gated MCPs. `set-key` is the primary enablement path for key-required entries.

## Default Skill Catalog Plan

The skill catalog should cover at least:

- **Core workflow**: `using-skills`, `brainstorming`, `writing-scope`, `writing-solution`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `code-review`, `verification-before-completion`.
- **Codebase exploration and safe editing**: `codebase-exploration`, `deep-research`, `refactoring`, graph/navigation/call/dependency/symbol analysis skills where bundled.
- **Frontend/UI/browser/deployment**: `building-components`, `frontend-ui-ux`, `web-design-guidelines`, `dev-browser`, `browser-automation`, `deploy-to-vercel`, `mui`.
- **React/Next/React Native**: `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-native-skills`, `nextjs`, `next-best-practices`, `next-cache-components`, `next-upgrade`.
- **Rust suite**: `rust-router`, `rust-learner`, `coding-guidelines`, `unsafe-checker`, `m01-ownership`, `m02-resource`, `m03-mutability`, `m04-zero-cost`, `m05-type-driven`, `m06-error-handling`, `m07-concurrency`, `m09-domain`, `m10-performance`, `m11-ecosystem`, `m12-lifecycle`, `m13-domain-error`, `m14-mental-model`, `m15-anti-pattern`, plus Rust navigation/refactoring/dependency visualization skills where bundled.

Rules:

- If a skill file is present in the package, report it as `available` or `preview` according to catalog lifecycle and backing tools.
- If scope requires a skill but the file is not yet bundled, Fullstack must either add the package-owned skill asset or mark the catalog entry `unavailable` with an explicit limitation. Do not silently claim it is bundled because it exists in the developer's personal OpenCode home.
- Experimental or partial skills must be visibly `preview` in list, runtime summary, and docs.

## Recommended Path

Execute sequentially with test-first implementation for every CLI/runtime behavior change.

Reasoning:

- The feature touches shared global config, profile materialization, secret handling, runtime summaries, MCP routing, docs, and package metadata.
- Secret safety is cross-cutting; parallel edits could easily produce one surface that redacts and another that leaks.
- Current task-board runtime reports no active board for `feature-941`; if a board is created, keep `parallel_mode: none` and use this package as the source of dependencies/artifact ownership.

## Implementation Slices

### [ ] Slice 1: Shared capability catalogs and status model

- **Executable task id**: `TASK-F941-CATALOGS`
- **Files**:
  - `src/capabilities/mcp-catalog.js` (create)
  - `src/capabilities/skill-catalog.js` (create)
  - `src/capabilities/status.js` (create)
  - `src/capabilities/schema.js` (create)
  - `src/runtime/capability-registry.js`
  - `src/runtime/mcp/builtin-mcps.js`
  - `src/runtime/skills/skill-registry.js`
  - `registry.json`
  - `tests/runtime/capability-registry.test.js`
  - `tests/runtime/skill-catalog.test.js` (create if useful)
  - `tests/runtime/registry-metadata.test.js`
- **Goal**: establish one package-owned MCP and skill catalog source with standard status vocabulary and no raw secret fields.
- **Dependencies**: none.
- **Validation Command**:
  - `node --test "tests/runtime/capability-registry.test.js"`
  - `node --test "tests/runtime/registry-metadata.test.js"`
  - `node --test "tests/runtime/skill-catalog.test.js"` if created
  - `npm run verify:runtime-foundation`
- **Details**:
  - Write tests first for required catalog ids, required fields, status vocabulary, placeholder-only key-required entries, preview/policy labels, and optional `augment_context_engine` behavior.
  - Add missing package-owned skill assets only from approved sources; do not copy user-specific global config.
  - Keep legacy runtime capability entries compatible while adding the new capability-pack summary.

### [ ] Slice 2: Secret manager and redaction foundation

- **Executable task id**: `TASK-F941-SECRETS`
- **Files**:
  - `src/global/paths.js`
  - `src/global/mcp/secret-manager.js` (create)
  - `src/global/mcp/redaction.js` (create)
  - `src/global/mcp/mcp-config-store.js` (create minimal secret-presence support if not in Slice 3)
  - `tests/global/mcp-secret-manager.test.js` (create)
  - `tests/cli/configure-mcp.test.js` (secret input/redaction cases may start here)
- **Goal**: make local-only secret storage safe, permission-checked, atomic, and redacted before any CLI/profile/runtime surface uses it.
- **Dependencies**: `TASK-F941-CATALOGS`.
- **Validation Command**:
  - `node --test "tests/global/mcp-secret-manager.test.js"`
  - `node --test "tests/cli/configure-mcp.test.js"` for redaction/input cases once created
- **Details**:
  - Tests must cover missing file, unsafe dir/file permissions, atomic update, duplicate target key, unrelated variables preserved, malformed file fail-closed behavior, unset missing key, and synthetic sentinel non-leakage.
  - On POSIX, assert `0700` parent and `0600` file in tests where filesystem mode supports it.
  - Provide one redaction helper used by all later slices.

### [ ] Slice 3: Scope-aware config store and profile materializer

- **Executable task id**: `TASK-F941-PROFILES`
- **Files**:
  - `src/global/mcp/mcp-config-store.js`
  - `src/global/mcp/profile-materializer.js` (create)
  - `src/global/mcp/catalog-loader.js` (create)
  - `src/global/materialize.js`
  - `src/global/ensure-install.js`
  - `src/install/merge-policy.js` if shared ownership merge helpers are needed
  - `tests/global/mcp-config-store.test.js` (create)
  - `tests/global/mcp-profile-materializer.test.js` (create)
  - `tests/install/materialize.test.js`
- **Goal**: persist user enablement choices and materialize placeholder-only MCP entries into selected scopes while preserving user-managed global config.
- **Dependencies**: `TASK-F941-SECRETS`.
- **Validation Command**:
  - `node --test "tests/global/mcp-config-store.test.js"`
  - `node --test "tests/global/mcp-profile-materializer.test.js"`
  - `node --test "tests/install/materialize.test.js"`
  - `npm run verify:install-bundle`
- **Details**:
  - Tests must prove openkit/global/both scope targeting, idempotency, no duplicate entries, unmanaged global conflict protection, disabled entries remain discoverable, upgrade adds new defaults without resetting user overrides, and generated profiles contain placeholders only.
  - For `--scope both`, partial failure must be visible and redacted.

### [ ] Slice 4: `openkit configure mcp` CLI control plane

- **Executable task id**: `TASK-F941-CONFIGURE-CLI`
- **Files**:
  - `src/cli/index.js`
  - `src/cli/commands/help.js`
  - `src/cli/commands/configure.js` (create)
  - `src/cli/commands/configure-mcp.js` (create)
  - `src/global/mcp/mcp-configurator.js` (create)
  - `src/global/mcp/health-checks.js` (create)
  - `tests/cli/configure-mcp.test.js`
  - `tests/cli/openkit-cli.test.js`
- **Goal**: implement list/doctor/enable/disable/set-key/unset-key/test with the approved scope semantics and redacted output.
- **Dependencies**: `TASK-F941-PROFILES`.
- **Validation Command**:
  - `node --test "tests/cli/configure-mcp.test.js"`
  - `node --test "tests/cli/openkit-cli.test.js"`
- **Details**:
  - Tests must cover default `--scope openkit`, explicit `global` and `both`, unknown MCP, invalid scope, idempotent enable/disable, set-key auto-enable, disable keeps key, unset-key does not disable, set-key for no-key MCP failure, disabled test behavior, and provider-error redaction.
  - CLI help should document safe input modes and direct OpenCode caveat for global scope.

### [ ] Slice 5: `openkit run` secret loading and global doctor integration

- **Executable task id**: `TASK-F941-RUN-LOADER`
- **Files**:
  - `src/global/launcher.js`
  - `src/global/doctor.js`
  - `src/global/paths.js`
  - `src/global/mcp/secret-manager.js`
  - `src/global/mcp/redaction.js`
  - `tests/cli/openkit-cli.test.js`
  - `tests/global/doctor.test.js`
- **Goal**: load `secrets.env` into OpenKit-managed sessions and surface secret/profile readiness in global doctor without leaking values.
- **Dependencies**: `TASK-F941-CONFIGURE-CLI`.
- **Validation Command**:
  - `node --test "tests/cli/openkit-cli.test.js"`
  - `node --test "tests/global/doctor.test.js"`
- **Details**:
  - Tests must prove `openkit run` passes configured env vars to the mocked `opencode` process without printing values, respects explicit process env precedence, avoids serializing secrets into runtime config content, and warns redacted on unsafe/unreadable secret file.
  - Doctor must report capability/key summaries and global direct-OpenCode caveats with redacted state.

### [ ] Slice 6: Runtime capability registry, router, health tools, and MCP exposure

- **Executable task id**: `TASK-F941-RUNTIME-TOOLS`
- **Files**:
  - `src/runtime/managers/capability-registry-manager.js` (create)
  - `src/runtime/managers/mcp-health-manager.js` (create)
  - `src/runtime/managers/skill-mcp-manager.js`
  - `src/runtime/create-managers.js`
  - `src/runtime/create-runtime-interface.js`
  - `src/runtime/create-tools.js`
  - `src/runtime/mcp/index.js`
  - `src/runtime/mcp/mcp-config-loader.js`
  - `src/runtime/doctor/mcp-doctor.js`
  - `src/runtime/tools/capability/capability-inventory.js` (create)
  - `src/runtime/tools/capability/capability-router.js` (create)
  - `src/runtime/tools/capability/capability-health.js` (create)
  - `src/runtime/tools/capability/skill-index.js` (create)
  - `src/runtime/tools/capability/skill-mcp-bindings.js` (create)
  - `src/mcp-server/tool-schemas.js`
  - `tests/runtime/capability-tools.test.js` (create)
  - `tests/runtime/runtime-bootstrap.test.js`
  - `tests/runtime/doctor.test.js`
  - `tests/runtime/mcp-dispatch.test.js`
  - `tests/mcp-server/mcp-server.test.js`
- **Goal**: expose in-session discovery, routing, and health without leaking secrets or inventing unavailable capabilities.
- **Dependencies**: `TASK-F941-RUN-LOADER`.
- **Validation Command**:
  - `node --test "tests/runtime/capability-tools.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/runtime/doctor.test.js"`
  - `node --test "tests/runtime/mcp-dispatch.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `npm run verify:runtime-foundation`
- **Details**:
  - Tests must prove tool schemas expose the new tools, runtime summaries include only redacted presence, router returns next-action guidance when no usable capability exists, and optional/preview/policy-gated entries are clearly labeled.
  - `git` capability tests must verify destructive operations are not silently enabled by bundling.

### [ ] Slice 7: Documentation, package governance, and final validation

- **Executable task id**: `TASK-F941-DOCS-VALIDATION`
- **Files**:
  - `README.md`
  - `AGENTS.md` only if command/tool current-state facts change
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `docs/operator/README.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/operator/mcp-configuration.md` (create)
  - `docs/maintainer/test-matrix.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `docs/operations/runbooks/openkit-daily-usage.md`
  - `package.json` only if scripts/files genuinely change
  - `registry.json`
  - `.opencode/install-manifest.json` only if metadata needs catalog/package visibility
  - `.opencode/tests/workflow-contract-consistency.test.js` if docs governance expectations change
  - `tests/runtime/governance-enforcement.test.js`
- **Goal**: document operator usage, maintainer validation, scope semantics, secret safety, default catalogs, direct OpenCode caveats, and validation boundaries.
- **Dependencies**: `TASK-F941-RUNTIME-TOOLS`.
- **Validation Command**:
  - `npm run verify:governance`
  - `npm run verify:install-bundle`
  - `npm run verify:runtime-foundation`
  - `npm run verify:all`
  - `node .opencode/workflow-state.js validate`
- **Details**:
  - Docs must not include real keys or copy user-specific config.
  - Docs must show placeholder examples only.
  - Final evidence must state target-project app validation is unavailable unless the target project defines app-native commands.

## Dependency Graph

Sequential chain:

```text
TASK-F941-CATALOGS
  -> TASK-F941-SECRETS
  -> TASK-F941-PROFILES
  -> TASK-F941-CONFIGURE-CLI
  -> TASK-F941-RUN-LOADER
  -> TASK-F941-RUNTIME-TOOLS
  -> TASK-F941-DOCS-VALIDATION
```

Critical path: catalog contract → secret safety → scope/profile materialization → CLI control plane → run loader → runtime tools → docs/final evidence.

## Parallelization Assessment

- parallel_mode: `none`
- why: the feature is secret-sensitive and crosses shared catalog, profile, launcher, runtime summary, and docs surfaces. Parallel edits risk inconsistent redaction or scope semantics.
- safe_parallel_zones: []
- sequential_constraints:
  - `TASK-F941-CATALOGS -> TASK-F941-SECRETS -> TASK-F941-PROFILES -> TASK-F941-CONFIGURE-CLI -> TASK-F941-RUN-LOADER -> TASK-F941-RUNTIME-TOOLS -> TASK-F941-DOCS-VALIDATION`
- integration_checkpoint: after `TASK-F941-DOCS-VALIDATION`, run targeted CLI/global/runtime tests, `npm run verify:runtime-foundation`, `npm run verify:governance`, `npm run verify:install-bundle`, `npm run verify:all`, workflow-state validation, and a manual redaction audit of generated profiles/log-like outputs before Code Reviewer.
- max_active_execution_tracks: `1`

No implementation task should run in parallel unless this solution package is revised and a narrower safe parallel zone is approved.

## Task Board Recommendation

Create a full-delivery task board for `feature-941` before implementation if the active runtime requires board-backed full-delivery execution. Keep it sequential with `parallel_mode: none`.

Recommended tasks:

| Task ID | Title | Kind | Depends On | Primary validation |
| --- | --- | --- | --- | --- |
| `TASK-F941-CATALOGS` | Define bundled MCP and skill catalogs | `implementation` | none | catalog/runtime metadata tests |
| `TASK-F941-SECRETS` | Implement local secret manager and redaction foundation | `implementation` | `TASK-F941-CATALOGS` | secret manager/redaction tests |
| `TASK-F941-PROFILES` | Materialize scope-aware placeholder-only MCP profiles | `implementation` | `TASK-F941-SECRETS` | profile/config-store tests |
| `TASK-F941-CONFIGURE-CLI` | Add `openkit configure mcp` commands | `implementation` | `TASK-F941-PROFILES` | configure CLI tests |
| `TASK-F941-RUN-LOADER` | Load `secrets.env` during `openkit run` and doctor readiness | `implementation` | `TASK-F941-CONFIGURE-CLI` | openkit run/global doctor tests |
| `TASK-F941-RUNTIME-TOOLS` | Expose runtime capability inventory/router/health tools | `implementation` | `TASK-F941-RUN-LOADER` | runtime/MCP server tests |
| `TASK-F941-DOCS-VALIDATION` | Update docs/package metadata and run final validation | `verification` | `TASK-F941-RUNTIME-TOOLS` | governance/install-bundle/verify:all |

Recommended workflow-state CLI commands if the orchestrator/operator chooses to initialize the board after solution approval:

```text
node .opencode/workflow-state.js set-parallelization none "FEATURE-941 is secret-sensitive and crosses shared catalog/profile/launcher/runtime/doc surfaces; execute sequentially." "After TASK-F941-DOCS-VALIDATION, run targeted CLI/global/runtime tests, verify:runtime-foundation, verify:governance, verify:install-bundle, verify:all, workflow-state validation, and redaction audit." 1
node .opencode/workflow-state.js create-task feature-941 TASK-F941-CATALOGS "Define bundled MCP and skill catalogs" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-SECRETS "Implement local secret manager and redaction foundation" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-PROFILES "Materialize scope-aware placeholder-only MCP profiles" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-CONFIGURE-CLI "Add openkit configure mcp commands" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-RUN-LOADER "Load secrets env during openkit run and doctor readiness" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-RUNTIME-TOOLS "Expose runtime capability inventory router health tools" implementation
node .opencode/workflow-state.js create-task feature-941 TASK-F941-DOCS-VALIDATION "Update docs package metadata and run final validation" verification
node .opencode/workflow-state.js validate-task-allocation feature-941
```

Current `create-task` CLI support is minimal and does not encode every dependency or artifact ref above. With `parallel_mode: none`, runtime coordination must keep only one active task at a time, and this solution package remains the authoritative dependency and artifact plan unless a richer task-board mutation path is used.

## Validation Matrix

| Acceptance target | Implementation proof | Validation path |
| --- | --- | --- |
| Bundled MCP catalog discoverable | Catalog includes required MCP ids with default scope, status, key, dependency, and policy metadata | `node --test "tests/runtime/capability-registry.test.js"`; `node --test "tests/runtime/registry-metadata.test.js"` |
| Bundled skill catalog discoverable | Skill catalog includes required workflow/codebase/frontend/React/Rust categories and reports missing backing files honestly | `node --test "tests/runtime/skill-catalog.test.js"`; `npm run verify:governance` |
| Key-required entries show placeholders and `not_configured` before key setup | Catalog/profile/list/doctor output uses placeholders and redacted key state | `node --test "tests/cli/configure-mcp.test.js"`; `node --test "tests/global/mcp-profile-materializer.test.js"` |
| Optional absent dependencies do not fail install/run | Optional MCPs report `unavailable`/`degraded` and whole command remains usable | `node --test "tests/global/doctor.test.js"`; `node --test "tests/runtime/doctor.test.js"` |
| Configure list/doctor/enable/disable/set-key/unset-key/test behave by scope | CLI tests cover `openkit`, `global`, `both`, idempotency, and failure cases | `node --test "tests/cli/configure-mcp.test.js"`; `node --test "tests/cli/openkit-cli.test.js"` |
| Secret file safety | Secret manager enforces location, permissions, atomic writes, unset behavior, and malformed-file safety | `node --test "tests/global/mcp-secret-manager.test.js"` |
| No raw secrets in generated profiles | Profile materializer writes only env placeholders and ownership sidecar hashes of redacted entries | `node --test "tests/global/mcp-profile-materializer.test.js"`; redaction audit in final evidence |
| `openkit run` loads `secrets.env` | Mocked `opencode` receives env var while command output/runtime config does not print or serialize value | `node --test "tests/cli/openkit-cli.test.js"` |
| Runtime capability tools route and report honestly | Runtime tools expose inventory/router/health/skill index with standard states and redacted key presence | `node --test "tests/runtime/capability-tools.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"` |
| Policy-gated git remains safe | Git entry is preview/policy-gated and does not enable destructive operations | `node --test "tests/runtime/capability-tools.test.js"`; Code Reviewer safety check |
| Docs explain operator and maintainer behavior | Operator docs cover configure commands, scopes, secrets path/perms, direct OpenCode caveat, status labels, and validation boundaries | `npm run verify:governance`; `node --test ".opencode/tests/workflow-contract-consistency.test.js"` if touched |
| Target-project app validation remains separate | Reports say app-native validation is unavailable unless target app commands exist | `npm run verify:governance`; QA report surface labeling |

## Validation Plan

### Targeted Node tests

- `node --test "tests/cli/configure-mcp.test.js"`
- `node --test "tests/cli/openkit-cli.test.js"`
- `node --test "tests/global/mcp-secret-manager.test.js"`
- `node --test "tests/global/mcp-config-store.test.js"`
- `node --test "tests/global/mcp-profile-materializer.test.js"`
- `node --test "tests/global/doctor.test.js"`
- `node --test "tests/install/materialize.test.js"`
- `node --test "tests/runtime/capability-registry.test.js"`
- `node --test "tests/runtime/runtime-bootstrap.test.js"`
- `node --test "tests/runtime/doctor.test.js"`
- `node --test "tests/runtime/mcp-dispatch.test.js"`
- `node --test "tests/runtime/capability-tools.test.js"`
- `node --test "tests/runtime/skill-catalog.test.js"` if created
- `node --test "tests/mcp-server/mcp-server.test.js"`
- `node --test "tests/runtime/registry-metadata.test.js"`

### Existing package/runtime/governance checks

- `npm run verify:runtime-foundation`
- `npm run verify:governance`
- `npm run verify:install-bundle`
- `npm run verify:all`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js doctor --short`

### Secret redaction checks

Fullstack, Code Reviewer, and QA must explicitly inspect or test that a synthetic secret value does not appear in:

- configure command stdout/stderr
- `openkit doctor` output
- `openkit configure mcp doctor/list/test` output
- generated OpenKit profile JSON
- generated global OpenCode config entries
- `mcp-config.json`
- `mcp-profile-state.json`
- runtime interface summaries
- MCP tool outputs
- workflow-state evidence/artifacts
- docs examples

Only the temporary local `secrets.env` fixture may contain the synthetic raw value.

### Target-project app validation

`target_project_app` validation is unavailable for this feature unless a target project independently defines app-native build, lint, or test commands. OpenKit CLI/runtime/package/governance checks must not be reported as target-project application validation.

## Integration Checkpoint

Before requesting Code Reviewer:

1. Catalogs contain all required MCP ids and skill categories, with preview/policy/optional labels visible.
2. `openkit configure mcp` commands pass targeted tests for default and explicit scopes.
3. `set-key` writes only `secrets.env`, enforces permissions, auto-enables selected scope, and never echoes values.
4. `disable` preserves keys; `unset-key` preserves enablement and causes key-required enabled MCPs to report `not_configured`.
5. Generated OpenKit/global profile entries contain placeholders only.
6. Global config preservation is tested with unmanaged same-id conflicts.
7. `openkit run` loads `secrets.env` into a mocked managed session without serializing values into runtime config output.
8. Runtime tools list, route, and health-check capabilities with standard states and redacted key presence.
9. `git` remains policy-gated; `augment_context_engine` remains optional and non-blocking.
10. Docs and package metadata are aligned with command reality and secret safety.
11. Targeted tests plus `npm run verify:runtime-foundation`, `npm run verify:governance`, `npm run verify:install-bundle`, `npm run verify:all`, and workflow-state validation have either passed or have exact environmental blockers recorded.

## Risks And Trade-offs

- **Secret leakage through one forgotten surface**: mitigated by a shared redaction helper, synthetic sentinel tests, and explicit QA inspection of profiles/log-like outputs/runtime summaries.
- **Global OpenCode config overwrite**: mitigated by ownership sidecar and conflict reporting for unmanaged same-id entries.
- **Placeholder format mismatch with OpenCode**: implementation must verify the supported env-reference format. If OpenCode does not interpolate placeholders, rely on inherited env for OpenKit-run sessions and keep global direct-launch caveat visible.
- **Key-required MCP appears enabled but unusable**: this is intentional; enabled + missing key reports `not_configured` with guidance until set-key or disable.
- **Optional external MCP dependency absent**: optional entries must not block install, doctor, or run. They should report unavailable/degraded with remediation.
- **Bundling skills from a developer machine**: do not copy user global config or secrets. Add only package-owned skill assets or mark entries unavailable/preview with limitations.
- **Policy-gated git confusion**: keep `git` preview/policy-gated and preserve existing OpenKit git safety expectations.
- **Doctor exit code ambiguity**: distinguish unsafe secret storage and requested-scope unusability from optional MCP absence. Optional absence should not fail the whole doctor command.
- **Run-time env precedence surprise**: use documented precedence and report only redacted source labels.

## Rollout Notes

- Ship catalog and configure CLI as additive behavior. Existing OpenKit install/run behavior should continue without requiring keys.
- On upgrade, materialize default OpenKit-managed entries only where safe and preserve user overrides.
- Do not auto-enable key-required provider MCPs unless `set-key` is run or the user explicitly enables them.
- Consider a release note section warning that direct OpenCode global config does not load OpenKit `secrets.env`; users must use `openkit run` or export env vars themselves.
- Keep `openkit install`/`install-global` compatibility surfaces documented as manual/compatibility paths; preferred lifecycle remains `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall`.

## Reviewer Focus Points

- Verify no raw secrets are written outside `<OPENCODE_HOME>/openkit/secrets.env`.
- Verify generated profiles and global config contain env placeholders only.
- Verify `set-key` auto-enables selected scope, `disable` keeps key, and `unset-key` does not silently disable.
- Verify default scope is `openkit` for `set-key` and other materializing operations.
- Verify global/both scope preserves unmanaged user config and reports conflicts.
- Verify disabled MCPs remain discoverable.
- Verify runtime summaries/tool outputs use standard status vocabulary and validation-surface labels.
- Verify preview, optional, and policy-gated entries are labeled honestly.
- Verify no target-project app validation is claimed.

## QA Focus Points

- Exercise each `openkit configure mcp` subcommand using a temporary `OPENCODE_HOME`.
- Confirm secret file permissions and atomic update behavior on the supported test platform.
- Confirm synthetic secret non-leakage across CLI output, generated config, runtime summaries, workflow evidence, and docs.
- Confirm `openkit run` loads secrets into a mocked managed OpenCode process.
- Confirm direct OpenCode/global caveat appears for global/both scope.
- Confirm optional `augment_context_engine` absence and missing browser dependencies do not fail the whole command.
- Confirm in-session capability tools report available/not_configured/degraded/unavailable/preview states with next-action guidance.

## Fullstack Handoff

- Implement in the task order above.
- Use tests first for every CLI, profile, secret, runtime, and doctor behavior change.
- Do not add real keys, copy user global config into the package, or serialize secrets into runtime summaries.
- Preserve role boundaries and do not change workflow lanes/stages/gates.
- Record implementation evidence with validation-surface labels before requesting Code Reviewer.
- Do not create commits unless explicitly requested by the user.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: this package gives one recommended technical path, explicit boundaries, data contracts, file/module targets, sequential implementation slices, task-board guidance, validation commands that exist or are clearly new targeted tests to create, risk controls, and review/QA focus points for the approved scope.
