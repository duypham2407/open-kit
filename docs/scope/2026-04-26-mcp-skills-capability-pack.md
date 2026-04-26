---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-941
feature_slug: mcp-skills-capability-pack
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: MCP + Skills Capability Pack

OpenKit should ship with a default bundled MCP and skills capability pack so users get useful workflow, browser, research, codebase, and domain-specialist capabilities after install or upgrade, while keeping all real user secrets outside the repository, package, generated profiles, logs, runtime summaries, doctor output, and workflow artifacts.

## Goal

- Provide a discoverable default MCP + skills capability pack with safe enablement, health reporting, and user-controlled key configuration.
- Add `openkit configure mcp` as the product CLI surface for MCP inventory, health checks, enablement, key management, and connection testing.
- Preserve OpenKit's path model: product configuration through the global OpenKit install path, OpenKit session functionality through `openkit run`, and compatibility/runtime evidence labeled by surface.

## Target Users

- **New OpenKit operator:** installs OpenKit and expects useful MCPs and skills without hand-writing config files.
- **Existing OpenKit operator:** upgrades OpenKit and wants bundled capabilities to appear without overwriting local choices or exposing secrets.
- **OpenKit in-session user:** relies on agents and runtime tools to route to available skills/MCPs and report unavailable or key-required capabilities honestly.
- **Security-conscious maintainer:** needs assurance that API keys are never packaged, committed, logged, or surfaced in generated artifacts.

## Problem Statement

OpenKit currently requires too much manual discovery and setup for rich MCP and skill usage, and ad hoc setup increases the chance that users place API keys in repository files, package files, profiles, logs, or workflow artifacts. Users need a bundled capability inventory with safe defaults, explicit configuration commands, reliable health checks, and a local-only secret storage path that OpenKit sessions can load without leaking values.

## In Scope

- Bundle a default MCP catalog with safe metadata, default enablement preferences, key requirements, dependency requirements, and status labels.
- Bundle a default skill catalog covering the core OpenKit workflow, codebase exploration/deep research/refactoring, frontend and UI work, browser/deployment work, React/Next/React Native, and Rust-focused development.
- Add `openkit configure mcp` capability with these sub-capabilities:
  - `list`
  - `doctor`
  - `enable`
  - `disable`
  - `set-key`
  - `unset-key`
  - `test`
- Support scope selection for MCP materialization:
  - default `--scope openkit`
  - optional `--scope global`
  - optional `--scope both`
- Materialize MCP configuration according to the selected scope without writing raw secrets into profiles.
- Store raw secret values only in the local user secret file: `~/.config/opencode/openkit/secrets.env`, or the equivalent path derived from `OPENCODE_HOME`.
- Ensure the secret file is outside the OpenKit package and outside target repositories; its parent directory must be `0700` and the file must be `0600`.
- Load the local secret file into the `openkit run` process environment so enabled MCPs can function during OpenKit-managed sessions.
- Redact secrets everywhere outside the local secret file, including generated config, logs, doctor output, runtime summaries, workflow artifacts, and docs examples.
- Report key-required capabilities with placeholders and user action guidance instead of silently failing or embedding real keys.

## Out of Scope

- Shipping, copying, or discovering real user API keys from the developer machine, shell history, existing OpenCode configs, browser stores, password managers, or environment dumps.
- Syncing secrets across machines, cloud storage, teams, or repositories.
- Building a marketplace, remote registry, paid-provider onboarding flow, or account provisioning flow for third-party MCP providers.
- Changing upstream OpenCode behavior for direct OpenCode launches outside OpenKit-managed process loading.
- Adding target-project application build, lint, or test commands; OpenKit validation does not become target application validation.
- Implementing broad UI/TUI configuration experiences beyond the CLI capability described here.
- Defining low-level file formats, parser internals, process spawning details, or module boundaries beyond the product constraints and vocabulary captured for handoff.

## Users And User Journeys

1. **As a new OpenKit operator, I want bundled MCPs and skills to be discoverable after install, so that I can start using rich capabilities without manual config research.**
2. **As an OpenKit operator, I want to list and doctor MCPs, so that I can see which capabilities are available, preview, degraded, unavailable, or missing keys.**
3. **As an OpenKit operator, I want to enable or disable MCPs per scope, so that OpenKit and direct OpenCode usage can be configured intentionally.**
4. **As an OpenKit operator, I want to set and unset MCP API keys safely, so that key-required MCPs work without placing secrets in repo or package files.**
5. **As an in-session OpenKit user, I want agents and tools to route through available skills/MCPs and report capability status, so that sessions use the right capability without hiding setup gaps.**
6. **As a maintainer, I want doctor/runtime/documentation surfaces to prove secret redaction and scope behavior, so that delivery can be reviewed without exposing user data.**

## Product And Business Rules

### Secret Safety

- Real user keys and secret values must never be copied into:
  - the OpenKit repository
  - the published OpenKit package
  - generated OpenKit or OpenCode profiles
  - logs
  - `openkit doctor` or configure command output
  - runtime summaries
  - in-session tool output
  - workflow-state records
  - workflow artifacts under `docs/`
- MCP/skill entries that require keys must use environment-variable placeholders, not embedded values.
- Placeholder values must never be treated as usable secrets.
- Missing required keys must produce `not_configured` status and actionable guidance such as which configure command or environment variable is needed.
- `set-key` may store the raw value only in the local user secret file at `~/.config/opencode/openkit/secrets.env`, or an `OPENCODE_HOME`-derived equivalent.
- The secret file's parent directory must be created or corrected to `0700`; the secret file must be created or corrected to `0600`.
- Secret storage must be outside the repo, outside any target project, and outside the shipped package bundle.
- `set-key` must automatically enable the MCP for the selected scope. Users who want the MCP off after setting a key can run `disable` later.
- `unset-key` must remove the local secret value and must not print the removed value. Assumption for downstream design: `unset-key` removes only the key; explicit enablement preference remains unchanged, so key-required MCPs report `not_configured` until a key is restored or the MCP is disabled.
- Commands may report key presence only as redacted state, for example `present (redacted)` or `missing`; no partial key prefixes or suffixes are required.
- If an inline secret entry path is supported, command output must not echo the value and must warn that shell history may retain inline arguments. A non-echoing interactive or stdin-based path is preferred but left to Solution Lead design.

### Scope Semantics

- When no scope is provided, MCP configuration uses `--scope openkit`.
- `--scope openkit` materializes MCP config into the OpenKit-managed profile only; configured MCPs are expected to work through `openkit run` because OpenKit loads the local secret file into the launched process environment.
- `--scope global` materializes MCP config into the global OpenCode config only; generated config must reference environment placeholders rather than raw secrets.
- For `--scope global`, doctor output must warn that direct OpenCode launches may require the user to export needed environment variables in their shell if they are not launching through OpenKit's loader.
- `--scope both` materializes MCP config into both the OpenKit-managed profile and the global OpenCode config while preserving the same redaction and placeholder rules.
- Scope-specific enablement and disablement must be inspectable so users can tell whether an MCP is enabled for OpenKit, global OpenCode, or both.
- Re-running configure commands must be idempotent: repeated enable, disable, set-key, unset-key, list, doctor, or test operations must not duplicate entries or corrupt existing config.
- Existing user-managed config must not be destructively overwritten without an explicit command intent.

### Capability Status And Reporting

- Use the existing status vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.
- `list` must show catalog membership, configured scope state, key requirement state, and high-level capability status without exposing secrets.
- `doctor` must identify missing keys, missing dependencies, disabled MCPs, optional MCPs, preview/experimental skills, and direct OpenCode caveats for global scope.
- `test` must verify a selected MCP as far as possible without leaking request credentials, response credentials, or raw provider error payloads that include sensitive data.
- Disabled MCPs must remain discoverable in list/doctor output as disabled, not silently disappear.
- Optional MCPs whose dependency is absent must report `unavailable` or `degraded` with guidance, not fail OpenKit startup.
- Preview or experimental skills/capabilities must be visibly labeled as `preview` or experimental in inventory and docs.

### Default MCP Catalog

- The default bundled catalog must include candidates for:
  - `openkit`
  - `chrome-devtools`
  - `playwright`
  - `context7`
  - `grep_app`
  - `websearch`
  - `sequential-thinking`
  - policy-gated `git`
  - optional `augment_context_engine` when its dependency is present
- Key-required or provider-dependent MCPs must ship with placeholders and setup guidance only.
- Browser/tooling MCPs that depend on local binaries, browsers, or external services must report `available`, `degraded`, or `unavailable` based on real capability checks.
- The policy-gated `git` MCP/capability must preserve existing OpenKit git safety expectations: no destructive or irreversible git operations should become silently allowed by bundling.
- `augment_context_engine` must be optional and must not block install, doctor, or run when unavailable.

### Default Skill Catalog

- The default skill catalog must include core OpenKit workflow skills for brainstorming, scope writing, solution writing, subagent-driven development, TDD, systematic debugging, code review, and verification-before-completion.
- The catalog must include codebase exploration, deep research, navigation, refactoring, dependency/call/symbol analysis, and safer-editing skills where available.
- The catalog must include frontend and UI skills for component building, web design, React/Next.js, React Native/Expo, MUI, Vercel patterns, deployment, and browser verification where available.
- The catalog must include the Rust skill suite, including router, learner, ownership, mutability, generics/traits, error handling, concurrency, unsafe/FFI, performance, ecosystem, lifecycle, domain modeling, and anti-pattern guidance.
- Skill entries must expose status and limitations clearly; experimental or partial skills must not be presented as stable.
- Skill/MCP routing should prefer a relevant available capability and return a visible unavailable/not_configured/degraded reason when no usable match exists.

## Acceptance Criteria Matrix

### Bundled Capability Inventory

- **Given** OpenKit is installed or upgraded, **when** the operator runs the supported capability inventory path, **then** the default MCP and skill catalogs are discoverable without requiring manual file edits.
- **Given** the catalog includes key-required entries, **when** those entries are listed or doctored before keys are configured, **then** output shows placeholders, missing-key guidance, and `not_configured` status without showing any raw key.
- **Given** optional dependencies such as `augment_context_engine` are absent, **when** inventory or doctor runs, **then** OpenKit reports the capability as optional and unavailable/degraded without failing the whole command.
- **Given** a capability is preview or experimental, **when** it appears in list, runtime summary, or docs, **then** that status is visible to the user.

### `openkit configure mcp` Commands

- **Given** the operator runs `openkit configure mcp list`, **when** no scope is supplied, **then** the command lists OpenKit-scope MCP catalog/config state by default.
- **Given** the operator runs `openkit configure mcp doctor`, **when** MCPs have missing keys, disabled state, missing dependencies, or direct OpenCode caveats, **then** the command reports those conditions with redacted and actionable output.
- **Given** the operator runs `enable` for an MCP, **when** the selected scope is `openkit`, `global`, or `both`, **then** only the selected scope's config is materialized and no raw secret is written to a profile.
- **Given** the operator runs `disable` for an MCP, **when** the selected scope is applied, **then** the MCP is disabled for that scope and remains visible as disabled in list/doctor output.
- **Given** the operator runs `set-key` for a key-required MCP, **when** a valid secret value is provided, **then** the value is stored only in the local user secret file, the file permissions are `0600`, the parent directory permissions are `0700`, and the MCP is enabled for the selected scope.
- **Given** the operator runs `unset-key`, **when** the key exists, **then** the key is removed from the local user secret file and command output does not reveal the previous value.
- **Given** the operator runs `test` for an MCP, **when** prerequisites are present, **then** the command reports pass/fail/degraded status for that MCP without exposing credentials or raw sensitive provider payloads.
- **Given** any configure command is run repeatedly, **when** the same inputs are used, **then** config entries are not duplicated and existing unrelated user config is preserved.

### Scope Behavior

- **Given** no scope flag is supplied, **when** a configure command materializes MCP config, **then** `openkit` scope is used.
- **Given** `--scope openkit`, **when** an MCP is enabled or configured, **then** it is materialized only into the OpenKit-managed profile and functions through `openkit run` when dependencies and keys are present.
- **Given** `--scope global`, **when** an MCP is enabled or configured, **then** it is materialized only into global OpenCode config using environment placeholders, and doctor warns that direct OpenCode may need shell env export outside the OpenKit loader.
- **Given** `--scope both`, **when** an MCP is enabled or configured, **then** both OpenKit and global OpenCode config receive placeholder-based entries and no raw secret values.
- **Given** an MCP is enabled in one scope only, **when** list/doctor runs, **then** the output distinguishes OpenKit-scope state from global-scope state.

### Runtime Secret Loading

- **Given** a secret has been stored with `set-key`, **when** the operator launches `openkit run`, **then** the local secret file is loaded into the OpenKit process environment for the session.
- **Given** the secret file is missing, unreadable, or has unsafe permissions, **when** `openkit run` or doctor checks MCP readiness, **then** OpenKit reports the issue with remediation guidance and does not print secret values.
- **Given** global OpenCode config references an env placeholder, **when** the user launches direct OpenCode outside OpenKit without exporting the env var, **then** OpenKit doctor can report the likely missing shell env condition without claiming direct OpenCode will work.

### In-Session Skills And MCP Routing

- **Given** OpenKit starts through `openkit run`, **when** a session requests a skill or MCP-backed capability, **then** routing prefers enabled and available configured capabilities.
- **Given** no matching capability is available, **when** routing is attempted, **then** the runtime reports unavailable/not_configured/degraded status with next-action guidance instead of silently falling back to an unrelated capability.
- **Given** an MCP requires a key, **when** the key is missing, **then** in-session summaries and tools show only redacted missing/present state and do not expose placeholder values as secrets.

### Secret Non-Leakage

- **Given** a real-looking secret is configured locally for test purposes, **when** configure commands, doctor, runtime summaries, generated profiles, logs, workflow-state summaries, and workflow artifacts are inspected, **then** the raw value does not appear outside the local secret file.
- **Given** a command or MCP provider returns an error that may include sensitive data, **when** OpenKit reports the error, **then** output is sanitized or summarized without raw secret disclosure.

## Edge Cases

- Secret file does not exist yet.
- Secret file exists with unsafe parent directory or file permissions.
- Secret file is read-only, malformed, contains duplicate keys, or contains unrelated user variables.
- The same MCP is enabled in `openkit` scope and disabled in `global` scope, or the reverse.
- User runs `set-key` for an MCP that does not require a key.
- User runs `enable` for a key-required MCP without setting a key.
- User runs `unset-key` for a missing key.
- User runs `test` for a disabled MCP.
- Optional MCP dependency is absent, partially installed, or version-incompatible.
- Direct OpenCode global config is present but the OpenKit loader is not used.
- Existing global OpenCode config has user-managed entries for the same MCP.
- Upgrade introduces new default catalog entries while a user has prior enable/disable preferences.
- A preview skill exists in the package but lacks all optional backing tools in the current environment.
- MCP names, env var names, or provider errors contain unusual characters that must not corrupt generated config or summaries.

## Error And Failure Cases

- If a requested MCP name is unknown, configure commands must fail with a clear unknown-capability message and no config mutation.
- If a scope value is invalid, configure commands must fail with the supported values: `openkit`, `global`, and `both`.
- If secure secret-file permissions cannot be created or repaired, `set-key` must fail closed and must not write the secret to an unsafe file.
- If profile materialization fails for one scope in `--scope both`, the result must make partial success/failure visible and must not leak secrets in rollback or error output.
- If `openkit run` cannot load the secret file, the session may still start only if the failure is non-fatal for enabled capabilities; key-required MCPs must be reported as not configured or unavailable.
- If doctor/test cannot reach an MCP provider, it must distinguish missing key, missing dependency, network/provider failure, and disabled state where possible.
- If generated profiles or runtime summaries would include env values, they must be redacted before output or persistence.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate `openkit configure mcp list`, `doctor`, `enable`, `disable`, `set-key`, `unset-key`, and `test`; validate `openkit doctor` reports capability and secret status safely; validate `openkit run` loads the local secret file into the process env without logging values. |
| `in_session` | Validate OpenKit sessions can discover bundled skills/MCPs, route to available capabilities, and report unavailable/not_configured/degraded capability states without leaking secrets. |
| `compatibility_runtime` | Validate workflow-state, runtime summary, and evidence/readiness outputs do not contain raw secrets and label capability evidence with the correct validation surface. |
| `runtime_tooling` | Validate runtime capability inventory, router, health, doctor, skill index, and skill-MCP binding tools report correct status labels, optional dependency states, and redacted key presence. |
| `documentation` | Validate operator/maintainer docs explain default catalogs, `openkit configure mcp`, scope semantics, secret storage location, permission expectations, direct OpenCode caveat, and target-project validation boundaries. |
| `target_project_app` | Unavailable unless a target project defines app-native build/lint/test commands; OpenKit CLI/runtime checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve the architecture vocabulary from brainstorming for downstream design consideration: `InstalledCapabilityScanner`, `CapabilityClassifier`, `CapabilityRegistryManager`, `McpConfigurator`, `ProfileMaterializer`, `SecretManager`, `HealthChecker`, `SkillMcpRouter`, and runtime tools for capability inventory, routing, health, doctor, skill index, and skill-MCP bindings.
- Treat that vocabulary as intended product/domain language to preserve where practical, not as permission for Product Lead scope to dictate implementation internals.
- Solution design must keep secret safety as a non-negotiable requirement: raw secrets only in the local user secret file, redacted everywhere else, and fail-closed behavior for unsafe secret storage.
- Solution design must explicitly cover idempotent profile materialization, scope-specific state, upgrade behavior with existing user preferences, and direct OpenCode caveats for global scope.
- Solution design must plan validation by the surface labels above and must keep `target_project_app` unavailable unless real target-project commands are defined.
- Code review and QA should use this scope as the source of truth for acceptance, especially around no-secret-leakage, scope semantics, and status-label honesty.

## Open Questions And Assumptions

- Assumption: `unset-key` removes only the secret value and does not automatically disable the MCP; missing keys then surface as `not_configured` until the user disables the MCP or sets the key again.
- Assumption: existing user-managed config should be preserved unless the specific configure command explicitly targets an OpenKit-managed entry.
- Open question for Solution Lead: define the safest user input method for `set-key` while satisfying the product requirement that raw values are persisted only in the local secret file and never echoed in output.

## Success Signal

- A user can install or upgrade OpenKit, discover the bundled MCP and skills capability pack, configure key-required MCPs through `openkit configure mcp`, launch `openkit run`, and use enabled capabilities in-session while all real secrets remain local-only and redacted from every package, repo, profile, diagnostic, runtime, and workflow surface.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, and Solution Lead handoff notes for `product_to_solution` review.
