---
artifact_type: solution_package
version: 1
status: approval_ready
feature_id: FEATURE-951
feature_slug: release-package-readiness-mcp-secret-backends
source_scope_package: docs/scope/2026-04-27-release-package-readiness-mcp-secret-backends.md
owner: SolutionLead
approval_gate: solution_to_fullstack
handoff_rubric: pass
---

# Solution Package: Release Package Readiness For MCP Secret Backends

## Recommended Path

Add a dedicated release-readiness gate for MCP secret backend packaging and global-install behavior, backed by `npm pack --dry-run --json`, isolated global CLI tests, existing FEATURE-950 behavior tests, and packaged operator/release documentation. This is enough because FEATURE-950 already implemented the backend behavior; FEATURE-951 should prove the shipped package and installed kit include those surfaces safely rather than redesigning secret storage.

The implementation must preserve `local_env_file` as the default backend, keep `keychain` explicitly opt-in and non-mutating in CI through fake/structural checks, and keep the direct OpenCode caveat visible: direct `opencode` launches do not automatically load OpenKit-managed local or keychain secrets.

## Dependencies

- No new runtime package dependency is recommended.
- Use existing Node.js/npm tooling already present in `package.json`.
- Add one repo script if needed: `verify:mcp-secret-package-readiness`, implemented with Node built-ins and `npm pack --dry-run --json`.
- Any package/global install test state must use temporary directories for `OPENCODE_HOME`, install prefix, package output, extraction, fake keychain command, logs, runtime DBs, and workflow/evidence output.
- No real macOS Keychain access is required or allowed in CI; use an injected fake keychain adapter or fake `security` executable.

## Upstream Scope Contract

- Approved scope package: `docs/scope/2026-04-27-release-package-readiness-mcp-secret-backends.md`.
- Product boundary: release/package/install hardening for existing MCP secret backends only.
- Explicit preserves:
  - `local_env_file` remains default when no store is requested.
  - `keychain` remains opt-in and unavailable/fail-closed where unsupported.
  - `openkit run` keeps shell/process env > metadata-gated keychain > local env-file fallback.
  - Direct OpenCode launches still require externally provided env vars and must not be described as loading OpenKit-managed local/keychain secrets.
  - `target_project_app` validation remains unavailable.

## Impacted Surfaces

### Package and install readiness

- `package.json` — add/adjust scripts and package allowlist only where required by package evidence.
- `scripts/verify-install-bundle.mjs` — existing install-bundle sync gate; only change if the package/readiness gate needs shared helpers.
- `scripts/verify-mcp-secret-package-readiness.mjs` — new dedicated package-content/readiness gate, if implementation chooses a script over an inline test helper.
- `src/install/asset-manifest.js` — package/install-bundle manifest checks if install-bundle sync or packaged release guidance needs MCP-secret-specific required docs/assets.
- `assets/install-bundle/opencode/` — generated install-bundle assets; refresh only through existing sync flow when source agent/command/skill assets change.

### Existing MCP secret backend behavior to preserve

- `src/global/mcp/secret-manager.js`
- `src/global/mcp/secret-stores/keychain-adapter.js`
- `src/global/mcp/redaction.js`
- `src/global/mcp/mcp-config-store.js`
- `src/global/mcp/mcp-config-service.js`
- `src/global/mcp/mcp-configurator.js`
- `src/global/mcp/interactive-wizard.js`
- `src/global/mcp/health-checks.js`
- `src/global/mcp/profile-materializer.js`
- `src/global/mcp/custom-mcp-store.js`
- `src/global/mcp/custom-mcp-validation.js`
- `src/global/launcher.js`

These source files should only change when the new package/global checks expose a packaging or install-boundary defect. Do not use FEATURE-951 to expand keychain behavior.

### Global CLI and runtime packaging

- `bin/openkit.js`
- `bin/openkit-mcp.js`
- `src/cli/index.js`
- `src/cli/commands/configure.js`
- `src/cli/commands/run.js`
- `src/cli/commands/doctor.js`
- `src/cli/commands/install.js`
- `src/cli/commands/install-global.js`
- `src/cli/commands/upgrade.js`
- `src/global/ensure-install.js`
- `src/global/materialize.js`
- `src/global/paths.js`
- `src/runtime/managers/mcp-health-manager.js`
- `src/runtime/tools/capability/mcp-doctor.js`
- `src/runtime/tools/capability/capability-inventory.js`
- `src/capabilities/mcp-catalog.js`

### Tests and docs

- New package/readiness tests under `tests/install/` or `tests/global/`.
- Existing focused tests:
  - `tests/global/mcp-keychain-adapter.test.js`
  - `tests/global/mcp-secret-manager.test.js`
  - `tests/cli/configure-mcp.test.js`
  - `tests/cli/configure-mcp-interactive.test.js`
  - `tests/global/mcp-interactive-wizard.test.js`
  - `tests/runtime/launcher.test.js`
  - `tests/global/ensure-install.test.js`
  - `tests/cli/install.test.js`
  - `tests/install/install-state.test.js`
  - `tests/install/materialize.test.js`
  - `tests/install/skill-bundle-sync.test.js`
- Documentation:
  - `docs/operator/mcp-configuration.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/operator/README.md`
  - `docs/governance/skill-metadata.md` or a new governance release-readiness note if needed
  - `docs/operations/runbooks/` for packaged release/operator runbook guidance if the maintainer guidance must ship in npm
  - `docs/maintainer/test-matrix.md` for source-tree maintainer routing; do not treat it as installed package evidence unless `package.json` intentionally includes `docs/maintainer/`
  - `context/core/project-config.md` and `AGENTS.md` only if new commands become current repository commands

## Boundaries And Components

### Package-content gate

Implement a package gate that inspects the npm package file list using `npm pack --dry-run --json` and does not persist tarballs. The gate should fail with a `package` surface label when any required file is absent, any forbidden generated/secret artifact is present, or package metadata/docs contain raw secret-like values instead of placeholders.

Minimum required package paths to assert:

- `package.json`
- `bin/openkit.js`
- `bin/openkit-mcp.js`
- `src/global/mcp/secret-manager.js`
- `src/global/mcp/secret-stores/keychain-adapter.js`
- `src/global/mcp/redaction.js`
- `src/global/mcp/mcp-config-store.js`
- `src/global/mcp/mcp-config-service.js`
- `src/global/mcp/mcp-configurator.js`
- `src/global/mcp/interactive-wizard.js`
- `src/global/mcp/health-checks.js`
- `src/global/mcp/profile-materializer.js`
- `src/global/mcp/custom-mcp-store.js`
- `src/global/mcp/custom-mcp-validation.js`
- `src/global/launcher.js`
- `src/global/ensure-install.js`
- `src/global/materialize.js`
- `src/install/asset-manifest.js`
- `src/cli/commands/configure.js`
- `src/cli/commands/run.js`
- `src/cli/commands/doctor.js`
- `src/cli/commands/install.js`
- `src/cli/commands/install-global.js`
- `src/cli/commands/upgrade.js`
- `src/runtime/managers/mcp-health-manager.js`
- `src/runtime/tools/capability/mcp-doctor.js`
- `src/runtime/tools/capability/capability-inventory.js`
- `src/capabilities/mcp-catalog.js`
- `docs/operator/mcp-configuration.md`
- `docs/operator/supported-surfaces.md`
- `docs/operator/README.md`
- packaged release/governance/runbook docs selected for this feature
- `assets/install-bundle/opencode/README.md`
- `assets/install-bundle/opencode/commands/` entries needed for installed command guidance
- `assets/install-bundle/opencode/agents/` entries needed by installed OpenKit roles
- `registry.json`
- `.opencode/install-manifest.json`
- `.opencode/opencode.json`
- `.opencode/workflow-state.js`

Forbidden package paths or path patterns to assert absent unless an explicit sanitized template is approved:

- `**/secrets.env`
- `**/.env`
- `**/*.env` except documentation examples that are not packaged as runtime files and are reviewed as placeholder-only text
- `**/custom-mcp-config.json` when generated under a local OpenCode home
- `**/mcp-config.json` when generated under a local OpenCode home
- `**/mcp-profile-state.json` when generated under a local OpenCode home
- `**/project-graph.db`
- `**/*.sqlite`
- `**/*.sqlite3`
- generated package tarballs
- extracted package directories
- temporary OpenCode homes or workspace state
- active workflow-state data such as `.opencode/workflow-state.json`, unless implementation replaces it with a deliberate static sanitized template and reviewers approve that package need

Current `package.json` includes `.opencode/workflow-state.json`; implementation must treat that as a package-readiness risk, decide whether it is truly required, and either remove it from package inclusion or prove it is a static sanitized template. Do not ship active work-item state as release evidence.

### Secret-leakage model

- Docs, scripts, tests, logs, generated package lists, package metadata, generated profiles, and workflow evidence must use placeholders such as `${CONTEXT7_API_KEY}` or `<CONTEXT7_API_KEY_VALUE>`.
- Synthetic test sentinels may exist only in controlled test process memory or temporary stores; gates must assert they do not appear in package file lists, package contents, install-bundle assets, docs, logs, JSON output, or workflow evidence.
- The package gate should scan text files from the package list for:
  - known synthetic sentinel values created during the test run,
  - obvious private-token literals in docs/metadata,
  - raw Authorization header values rather than placeholders,
  - raw env values in generated profiles.
- Do not write package scan output containing secret values to workflow evidence. Store only counts, classifications, and redacted path summaries.

### Global install boundary

Global CLI checks must exercise installed or install-simulated behavior with isolated state:

- Use a temporary `OPENCODE_HOME`.
- Use a temporary npm/global install prefix or direct package extraction sandbox.
- If a tarball is created for a stronger install test, create it under a temporary directory and clean it up; never commit it.
- Inject a fake keychain adapter or fake `security` executable via existing adapter seams such as `OPENKIT_SECURITY_CLI` where needed.
- Do not call the real macOS Keychain in CI.
- Safe commands to check include help/list/doctor/test flows and launcher env precedence through test harnesses. Avoid provider/network calls requiring real MCP API keys.

### Behavior preservation

- `local_env_file` stays the default for `set-key`, `unset-key`, and wizard store selection.
- `keychain` is selected only through explicit store selection and remains unavailable/fail-closed where unsupported.
- Unsupported or unavailable keychain paths must not silently write to `local_env_file`.
- `openkit run` keeps shell env precedence and metadata-gated keychain lookup before local env-file fallback.
- Direct `opencode` launches must keep the caveat that OpenKit-managed local/keychain secrets are not automatically loaded.

## Interfaces And Data Contracts

### Package readiness result shape

If implemented as `scripts/verify-mcp-secret-package-readiness.mjs`, emit concise JSON only when `--json` is requested and keep normal output short and redacted.

Recommended internal result fields:

```json
{
  "surface": "package",
  "status": "pass",
  "requiredFiles": { "checked": 0, "missing": [] },
  "forbiddenFiles": { "checked": 0, "present": [] },
  "secretScan": { "checkedFiles": 0, "findings": [] },
  "packageListCommand": "npm pack --dry-run --json",
  "temporaryArtifacts": "cleaned"
}
```

Findings must include paths and rule names only; they must not include raw matched values.

### Documentation contract

Docs must separate validation surfaces exactly:

- `package`: package file list/content, npm pack readiness, install-bundle sync, forbidden artifacts, no raw secrets.
- `global_cli`: installed `openkit` behavior in isolated state.
- `runtime_tooling`: fake adapter/read model/tool behavior.
- `documentation`: operator/governance/runbook/test-matrix guidance.
- `compatibility_runtime`: workflow-state integrity and evidence labels only.
- `target_project_app`: unavailable for FEATURE-951.

## Risks And Trade-offs

- **Package allowlist drift:** `src/` is broad enough to include backend code today, but a future allowlist change can drop key files. Mitigate with explicit required-file checks from `npm pack --dry-run --json`.
- **Active runtime state accidentally packaged:** existing package inclusion includes `.opencode/workflow-state.json`; treat this as a release-readiness risk and remove or prove a sanitized template before approval.
- **False confidence from source-only tests:** source-tree FEATURE-950 tests are necessary but not sufficient. Package/global install evidence must be separate.
- **Real keychain mutation:** never use real Keychain for CI/package/global gates; fake platform/runner/adapter behavior must be enough for release readiness.
- **Docs not shipped where operators need them:** use existing package-included docs directories for installed guidance. If maintainer docs are necessary after install, add a packaged runbook rather than assuming `docs/maintainer/` ships.
- **Secret scanning false positives:** placeholders should pass; raw-looking docs/examples should fail. Keep rules narrow enough to avoid blocking on ordinary words while strict on token-like values and generated secret files.

## Implementation Slices

### Slice 1: Package readiness gate and allowlist policy

- **Files**: `package.json`, new `scripts/verify-mcp-secret-package-readiness.mjs`, optional new `tests/install/mcp-secret-package-readiness.test.js`.
- **Goal**: Add a deterministic package-content gate using `npm pack --dry-run --json` that checks required MCP secret backend files, forbidden generated/secret artifacts, placeholder-only text, and no tarball persistence.
- **Validation Command**:
  - Existing now: `npm pack --dry-run --json`
  - Existing now: `npm run verify:install-bundle`
  - New after implementation: `npm run verify:mcp-secret-package-readiness`
- **Details**:
  - Parse the dry-run JSON file list instead of scraping human npm output.
  - Keep generated file lists in memory or temporary files outside the repository.
  - Fail if `.opencode/workflow-state.json` remains packaged as active runtime state unless implementation intentionally converts it to an approved sanitized template.
  - Label evidence as `package`, not `global_cli` or `target_project_app`.

### Slice 2: Install-bundle and shipped-doc synchronization

- **Files**: `src/install/asset-manifest.js`, `scripts/verify-install-bundle.mjs`, `docs/operator/mcp-configuration.md`, `docs/operator/supported-surfaces.md`, `docs/operator/README.md`, `docs/operations/runbooks/` if a packaged release runbook is added, `docs/maintainer/test-matrix.md` for source maintainer routing, `context/core/project-config.md`, `AGENTS.md` only if new commands are added.
- **Goal**: Make release guidance explain package checks, global install checks, keychain fake/mock requirements, no-secret packaging, generated artifact cleanup, direct OpenCode caveat, and unavailable target-project app validation.
- **Validation Command**:
  - `npm run verify:install-bundle`
  - `npm run verify:governance`
- **Details**:
  - Use package-included docs for operator/release guidance that installed users need.
  - If `docs/maintainer/test-matrix.md` is updated, do not treat it as package evidence unless `package.json` intentionally ships it.
  - Run `npm run sync:install-bundle` only if source assets covered by the install bundle change; then verify with `npm run verify:install-bundle`.

### Slice 3: Isolated global CLI install checks

- **Files**: new or updated tests under `tests/global/` and `tests/cli/`, likely `tests/global/mcp-secret-global-install.test.js` or additions to `tests/global/ensure-install.test.js`, plus `tests/cli/install.test.js` if install command output needs release-readiness wording.
- **Goal**: Prove installed/global OpenKit exposes MCP secret backend surfaces using isolated state and without real keychain mutation.
- **Validation Command**:
  - Existing focused install tests: `node --test tests/global/ensure-install.test.js tests/cli/install.test.js`
  - Existing broader install tests: `node --test tests/install/install-state.test.js tests/install/materialize.test.js tests/install/skill-bundle-sync.test.js`
  - New after implementation: targeted global/package install test command for the new test file.
- **Details**:
  - Use temporary `OPENCODE_HOME` and temporary install prefix/package sandbox.
  - Validate `openkit configure mcp list --scope both --json`, `openkit configure mcp doctor --scope both --json`, and safe `openkit run` launch harness behavior without printing secret values.
  - Use fake keychain behavior through injected adapter/runner or `OPENKIT_SECURITY_CLI`; do not call a real keychain.
  - Preserve direct OpenCode caveat in global-scope output/docs.

### Slice 4: FEATURE-950 regression lock for backend behavior

- **Files**: existing FEATURE-950 source/tests only if package/global tests expose a behavior defect: `src/global/mcp/secret-manager.js`, `src/global/mcp/secret-stores/keychain-adapter.js`, `src/global/mcp/mcp-config-service.js`, `src/global/mcp/mcp-configurator.js`, `src/global/mcp/interactive-wizard.js`, `src/global/launcher.js`, and matching tests.
- **Goal**: Keep existing behavior green while adding package/install checks: default local env file, keychain opt-in, keychain fail-closed, metadata-gated precedence, redacted outputs, placeholder-only profiles.
- **Validation Command**:
  - `node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js`
  - `node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js tests/cli/configure-mcp-custom.test.js tests/global/custom-mcp-store.test.js tests/global/mcp-profile-materializer.test.js`
- **Details**:
  - Do not expand supported backends.
  - Do not reinterpret direct OpenCode launches as loading OpenKit-managed secrets.
  - Any test fixture secret must be synthetic, temporary, and asserted absent from logs/docs/package/evidence.

### Slice 5: No-secret package/global evidence and cleanup enforcement

- **Files**: package readiness script/test from Slice 1, global install tests from Slice 3, documentation from Slice 2, optional `.gitignore` only if implementation creates a justified ignored temp path under the repo.
- **Goal**: Prove no raw secrets or generated secret/runtime artifacts are packaged, logged, documented, or left committable after validation.
- **Validation Command**:
  - New after implementation: `npm run verify:mcp-secret-package-readiness`
  - Existing full gate: `npm run verify:all`
- **Details**:
  - Prefer temp directories outside the repo over adding ignore rules.
  - If any generated tarball, extracted package directory, local secret store, runtime DB, workflow-state output, or log file appears under the repo, treat it as a release blocker until removed or explicitly ignored by approved policy.
  - Evidence summaries must contain redacted counts and paths, never matched secret values.

### Slice 6: Integration evidence and workflow handoff readiness

- **Files**: workflow evidence only through `.opencode/workflow-state.js` commands when implementation records evidence; QA artifact later at `docs/qa/2026-04-27-release-package-readiness-mcp-secret-backends.md`.
- **Goal**: Bring package, global CLI, runtime tooling, documentation, and compatibility evidence together with labels and explicit `target_project_app` unavailability.
- **Validation Command**:
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js check-stage-readiness`
  - `npm run verify:all`
- **Details**:
  - Workflow-state checks are `compatibility_runtime` only.
  - `npm run verify:all` is OpenKit repository validation across mixed OpenKit surfaces, not target application validation.
  - QA must reject closure if package/global evidence is replaced by source-only FEATURE-950 tests.

## Dependency Graph

- Critical path: `Slice 1 -> Slice 3 -> Slice 4 -> Slice 5 -> Slice 6`.
- Documentation can begin after Slice 1 defines the required/forbidden package list: `Slice 1 -> Slice 2 -> Slice 5 -> Slice 6`.
- Existing FEATURE-950 regression tests in Slice 4 can run before and after package/global changes, but any source behavior change waits for package/global defect evidence.
- Integration checkpoint: after Slices 1, 3, and 4 pass together, inspect output summaries for surface labels and no raw values before docs/evidence finalization.

## Parallelization Assessment

- parallel_mode: `limited`
- why: Package gate/test work and documentation updates can proceed in parallel after the required/forbidden package list is agreed. Global install tests and any source behavior fixes share MCP/launcher surfaces and should remain sequential with package-gate integration.
- safe_parallel_zones:
  - `scripts/`
  - `tests/install/`
  - `tests/global/`
  - `tests/cli/`
  - `docs/operator/`
  - `docs/governance/`
  - `docs/operations/`
  - `docs/maintainer/`
- sequential_constraints:
  - `TASK-F951-PACKAGE-GATE -> TASK-F951-GLOBAL-INSTALL -> TASK-F951-REGRESSION -> TASK-F951-INTEGRATION`
  - `TASK-F951-PACKAGE-GATE -> TASK-F951-DOCS -> TASK-F951-INTEGRATION`
  - `TASK-F951-NO-SECRETS -> TASK-F951-INTEGRATION`
- integration_checkpoint: package readiness, isolated global CLI behavior, FEATURE-950 regression, docs/guidance, and no-secret scan evidence must pass together before code review.
- max_active_execution_tracks: 2

## Task Board Proposal

| Task ID | Title | Kind | Owner | Depends on | Artifact refs | Validation hook |
| --- | --- | --- | --- | --- | --- | --- |
| `TASK-F951-PACKAGE-GATE` | Add MCP secret backend package-content gate | implementation | FullstackAgent | none | `package.json`, `scripts/verify-mcp-secret-package-readiness.mjs`, `tests/install/mcp-secret-package-readiness.test.js` | `npm pack --dry-run --json`; new `npm run verify:mcp-secret-package-readiness`; `npm run verify:install-bundle` |
| `TASK-F951-DOCS` | Update packaged release/operator guidance | documentation | FullstackAgent | `TASK-F951-PACKAGE-GATE` for final required list | `docs/operator/`, `docs/governance/`, `docs/operations/runbooks/`, `docs/maintainer/test-matrix.md`, `context/core/project-config.md`, `AGENTS.md` if command reality changes | `npm run verify:governance`; `npm run verify:install-bundle` when install-bundle assets change |
| `TASK-F951-GLOBAL-INSTALL` | Add isolated global CLI install/package behavior checks | implementation | FullstackAgent | `TASK-F951-PACKAGE-GATE` | `tests/global/`, `tests/cli/`, `tests/install/` | `node --test tests/global/ensure-install.test.js tests/cli/install.test.js`; targeted new global install test |
| `TASK-F951-REGRESSION` | Lock existing FEATURE-950 behavior under package/global gates | implementation | FullstackAgent | `TASK-F951-GLOBAL-INSTALL` | `src/global/mcp/`, `src/global/launcher.js`, focused FEATURE-950 tests only if defects are found | focused MCP/keychain/launcher test commands listed in Slice 4 |
| `TASK-F951-NO-SECRETS` | Enforce no raw secrets and cleanup for package/global evidence | verification-support | FullstackAgent | `TASK-F951-PACKAGE-GATE`, can overlap docs after required list | package readiness script/tests, docs examples, temp artifact cleanup checks | new package readiness gate; `npm run verify:all` |
| `TASK-F951-INTEGRATION` | Run integrated validation and record surface-labeled evidence | verification | FullstackAgent | all prior tasks | workflow evidence refs, final handoff notes | `npm run verify:all`; workflow-state validation commands |

The board should use `parallel_mode = limited`; docs can overlap with package/global test implementation only within the safe zones above. Any task touching `package.json`, `src/global/mcp/`, `src/global/launcher.js`, or package allowlist behavior should be treated as shared-surface and coordinated through the integration checkpoint.

## Validation Matrix

| Acceptance target | Validation path | Surface |
| --- | --- | --- |
| Required MCP secret backend files are present in npm package | Existing `npm pack --dry-run --json`; new `npm run verify:mcp-secret-package-readiness` after implementation | `package` |
| Forbidden secret/generated artifacts are absent from package | New package readiness gate; fail on forbidden paths and raw secret-like values | `package` |
| Install-bundle assets stay synchronized | Existing `npm run verify:install-bundle` | `package` |
| Global install/setup path remains healthy in isolated state | Existing `node --test tests/global/ensure-install.test.js tests/cli/install.test.js`; new isolated package/global test | `global_cli` |
| `openkit configure mcp` surfaces remain redacted and backend-aware | Existing `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-interactive.test.js` plus new package/global assertions | `global_cli` |
| `local_env_file` remains default/fallback | Existing `node --test tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js` | `global_cli`, `runtime_tooling` |
| `keychain` remains opt-in and fake/non-mutating in CI | Existing `node --test tests/global/mcp-keychain-adapter.test.js`; new package/global fake keychain check | `runtime_tooling`, `global_cli` |
| `openkit run` precedence remains shell > keychain > local env file | Existing `node --test tests/runtime/launcher.test.js` | `global_cli` |
| Direct OpenCode caveat remains visible | Docs checks plus CLI/global doctor/list output assertions where added | `documentation`, `global_cli` |
| Operator/release docs explain package/global/runtime/docs/compatibility boundaries | Existing `npm run verify:governance`; docs review | `documentation` |
| Full OpenKit regression | Existing `npm run verify:all` | mixed OpenKit surfaces; not target app proof |
| Workflow-state integrity/readiness | Existing `node .opencode/workflow-state.js validate`; existing `node .opencode/workflow-state.js check-stage-readiness` | `compatibility_runtime` |
| Target-project application validation | Unavailable; no target project defines app-native build/lint/test/smoke/regression commands for this feature | `target_project_app` |

## Exact Existing Commands To Use Where Available

```sh
npm pack --dry-run --json
npm run verify:install-bundle
npm run verify:governance
npm run verify:runtime-foundation
npm run verify:semgrep-quality
node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js
node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js tests/cli/configure-mcp-custom.test.js tests/global/custom-mcp-store.test.js tests/global/mcp-profile-materializer.test.js
node --test tests/global/ensure-install.test.js tests/cli/install.test.js
node --test tests/install/install-state.test.js tests/install/materialize.test.js tests/install/skill-bundle-sync.test.js
npm run verify:all
node .opencode/workflow-state.js validate
node .opencode/workflow-state.js check-stage-readiness
```

`npm run verify:mcp-secret-package-readiness` is intentionally not listed as existing yet; it becomes current only if Fullstack adds it to `package.json`.

## Integration Checkpoint

Before requesting code review, Fullstack must provide a single redacted evidence summary proving:

1. Package file-list gate passed and named the package required/forbidden checks.
2. Install-bundle sync passed or was intentionally unaffected.
3. Isolated global CLI/package checks ran with temporary `OPENCODE_HOME`/install state.
4. Fake keychain validation ran without real Keychain mutation.
5. FEATURE-950 behavior tests still passed.
6. Docs explain package/global/runtime/documentation/compatibility boundaries and `target_project_app` unavailability.
7. No generated tarball, extracted package, secret store, runtime DB, workflow-state artifact, or log was left committable.
8. No raw secret values were printed in logs, docs, package metadata, evidence, or generated assets.

## Rollback Notes

- If package allowlist changes break unrelated packaging, roll back to the previous allowlist and keep the package readiness script failing on the MCP secret backend gap until a narrower package fix is approved.
- If `.opencode/workflow-state.json` removal breaks install bootstrap, replace it with a sanitized template and document why it is required; do not ship active workflow state.
- If isolated global install tests are flaky due npm/global prefix behavior, keep package list checks and use direct installed-bin simulation in temporary state as a documented substitute, but do not claim real global install evidence from source tests alone.
- If fake keychain integration becomes unstable, keep keychain validation at adapter/structural boundaries and report global keychain behavior as structurally validated, not real OS-mutated.

## Reviewer Focus Points

- Package gate uses `npm pack --dry-run --json` or an equivalent package-list mechanism and does not leave tarballs/extractions in the repo.
- Required file list includes `src/global/mcp/secret-stores/keychain-adapter.js` and the `openkit configure mcp` / `openkit run` paths.
- Package forbidden list blocks local secret stores, generated runtime DBs, active workflow state, and generated package artifacts.
- No raw values appear in docs, tests snapshots, logs, command output, workflow evidence, generated profiles, package metadata, or install-bundle assets.
- Global CLI tests use isolated state and fake keychain behavior only.
- `local_env_file` default, `keychain` opt-in, metadata-gated precedence, and direct OpenCode caveat are preserved exactly.
- Evidence is labeled by `package`, `global_cli`, `runtime_tooling`, `documentation`, `compatibility_runtime`, and unavailable `target_project_app`; OpenKit checks are never relabeled as target-project app validation.

## Handoff Notes

- **FullstackAgent must preserve** the existing FEATURE-950 backend semantics and implement only package/install/release hardening needed for scoped readiness.
- **Code Reviewer must preserve** the package/global-vs-source validation split and reject source-only evidence for package acceptance.
- **QAAgent must preserve** no-secret evidence discipline, fake keychain-only CI behavior, isolated global install state, direct OpenCode caveat, and explicit unavailable `target_project_app` reporting.
