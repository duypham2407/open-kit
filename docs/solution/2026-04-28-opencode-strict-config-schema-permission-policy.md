---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-952
feature_slug: opencode-strict-config-schema-permission-policy
work_item_id: feature-952
owner: SolutionLead
approval_gate: strategy_to_upgrade
lane: migration
mode: migration
stage: migration_strategy
parallel_mode: none
---

# Solution Package: OpenCode Strict Config Schema Permission Policy

## Baseline Summary

- Migration lane: compatibility remediation for OpenCode v1.14.28 strict config validation.
- Current failure: OpenCode rejects OpenKit-managed `opencode.json` when unknown OpenKit-only keys such as `commandPermissionPolicy` are present in the OpenCode-validated config.
- Baseline behavior to preserve: routine non-dangerous commands should continue to be allowed without confirmation wherever OpenCode honors the `permission` projection; dangerous/delete commands must still ask.
- User invariant: “fix lỗi nhưng không làm mất tính năng mặc định các command không nguy hiểm sẽ được chạy mà không cần xác nhận.”
- Solution Lead verification status: no tests have been run by Solution Lead; this artifact only defines the migration strategy.

## Target Outcome

- Every OpenCode-validated `opencode.json` generated or checked in by OpenKit contains only OpenCode schema-valid keys.
- `permission` remains the only OpenCode config projection for allow/ask behavior.
- OpenKit policy metadata lives in, or is derived from, OpenKit-owned files such as `assets/default-command-permission-policy.json` or a dedicated sidecar file; it must never be embedded as an unknown top-level key in OpenCode-validated `opencode.json`.
- Existing global/profile/local materialization, doctor, drift detection, packaging, and docs agree on the same canonical policy source and strict-schema-safe config output.

## Preserved Invariants

- OpenCode-validated config contains only OpenCode schema-valid keys.
- `permission` remains the sole OpenCode-facing allow/ask projection.
- Routine commands remain `allow`: `npm`, `task`, `bash`, `edit`, `read`, `write`, `glob`, `grep`, `list`, `skill`, `lsp`, `todoread`, `todowrite`, `webfetch`, `websearch`, `codesearch`, `external_directory`, `doom_loop`, `git status`, `git log`, `git diff`.
- Delete/removal commands remain `ask`: `rm`, `rmdir`, `unlink`.
- Destructive git actions remain confirmation-required by OpenKit policy and the existing git safety protocol, regardless of any broad command allow entries.
- No prompt broker, pseudo-terminal auto-confirm layer, hidden prompt interceptor, new workflow lane, or weakened safety protocol is introduced.

## Allowed Behavior Changes

- Remove `commandPermissionPolicy` and any other OpenKit-only top-level metadata from all OpenCode-validated `opencode.json` projections.
- Strip legacy invalid OpenKit metadata during materialization/merge when writing OpenKit-managed configs.
- Make doctor/drift logic derive policy health from the canonical OpenKit policy plus the projected `permission` map, rather than from inline metadata inside `opencode.json`.
- Add validation that fails if OpenKit reintroduces schema-invalid OpenCode config keys.

## Compatibility Hotspots

- `.opencode/opencode.json`
- `assets/opencode.json.template`
- `assets/default-command-permission-policy.json`
- `src/permissions/command-permission-policy.js`
- `src/global/materialize.js`
- `src/global/mcp/profile-materializer.js`
- `src/install/materialize.js`
- `src/install/merge-policy.js`
- `src/runtime/doctor.js`
- `src/global/doctor.js`
- Related tests under `tests/global/`, `tests/install/`, and `tests/runtime/`
- Related docs/package checks under `context/core/`, `docs/operator/`, `docs/maintainer/`, `docs/kit-internals/`, `assets/install-bundle/`, and `package.json` only where existing docs/scripts require sync.

## Migration Blockers And Seams

- Blocker: OpenCode v1.14.28 strict schema treats OpenKit policy metadata in `opencode.json` as invalid, so policy intent cannot ride inside that file.
- Seam: keep policy loading/projection in `src/permissions/command-permission-policy.js`, with `buildOpenCodePermissionConfig()` or equivalent returning only OpenCode-supported config fields for `opencode.json`.
- Seam: global/profile/local materializers should call the shared projection helper instead of carrying separate permission maps or metadata shapes.
- Seam: doctor should inspect canonical policy + generated config projection and report missing/drifted permissions without requiring inline metadata.

## Implementation Slices

### [ ] Slice 1: Separate OpenCode permission projection from OpenKit metadata

- **Files**: `assets/default-command-permission-policy.json`, `src/permissions/command-permission-policy.js`, `.opencode/opencode.json`, `assets/opencode.json.template`, `tests/global/command-permission-policy.test.js`.
- **Goal**: ensure the canonical policy remains OpenKit-owned while the OpenCode-facing projection emits only the schema-valid `permission` field.
- **Preserve**: all routine `allow` entries and destructive/delete `ask` entries listed in the preserved invariants.
- **Validation**: `node --test tests/global/command-permission-policy.test.js`.
- **Checkpoint**: compare the generated permission map before and after metadata removal; only metadata placement should change.

### [ ] Slice 2: Sanitize generated OpenCode configs and strip legacy invalid keys

- **Files**: `src/global/materialize.js`, `src/global/mcp/profile-materializer.js`, `src/install/materialize.js`, `src/install/merge-policy.js`, `.opencode/opencode.json`, `assets/opencode.json.template`, `tests/global/config-validation.test.js`, `tests/global/ensure-install.test.js`, `tests/global/mcp-profile-materializer.test.js`, `tests/install/materialize.test.js`, `tests/install/merge-policy.test.js`.
- **Goal**: all repo-local, global kit, and profile `opencode.json` outputs are strict-schema-safe and do not contain `commandPermissionPolicy` or other OpenKit-only top-level metadata.
- **Preserve**: materializers continue to write the policy-derived `permission` map and preserve unrelated user/OpenCode-managed config fields according to existing merge rules.
- **Validation**: `node --test tests/global/config-validation.test.js tests/global/ensure-install.test.js tests/global/mcp-profile-materializer.test.js tests/install/materialize.test.js tests/install/merge-policy.test.js`.
- **Checkpoint**: generated configs should pass strict key validation and still include the required allow/ask permission entries.

### [ ] Slice 3: Update doctor and drift logic

- **Files**: `src/runtime/doctor.js`, `src/global/doctor.js`, `tests/runtime/doctor.test.js`, `tests/global/doctor.test.js`, plus policy tests from Slice 1 if expectations move into the shared helper.
- **Goal**: doctor reports policy/config health from `assets/default-command-permission-policy.json` and the OpenCode `permission` projection, not from inline OpenKit metadata.
- **Preserve**: doctor still detects missing dangerous `ask` entries, missing routine `allow` entries, global/profile drift, malformed policy, and degraded/unsupported OpenCode permission semantics.
- **Validation**: `node --test tests/global/doctor.test.js tests/runtime/doctor.test.js tests/global/command-permission-policy.test.js`.
- **Checkpoint**: doctor output should recommend repair/upgrade for drift or legacy invalid keys, while treating strict-schema-safe configs with correct permissions as healthy or honestly degraded based on upstream semantics.

### [ ] Slice 4: Add strict OpenCode config validation regression coverage

- **Files**: `tests/global/config-validation.test.js`, optional dedicated script under `scripts/` if implementation adds one, and `package.json` only if a new script is intentionally exposed.
- **Goal**: prevent regression by validating OpenKit-managed OpenCode config projections against a strict allowlist/schema model for the OpenCode-facing file.
- **Preserve**: OpenKit metadata remains testable through canonical policy/sidecar files, not by embedding it in `opencode.json`.
- **Validation**: `node --test tests/global/config-validation.test.js`; if a strict validation script is added, run its checked-in command as part of the final gate.
- **Checkpoint**: tests must fail on a fixture or generated config containing `commandPermissionPolicy` as an unknown top-level key.

### [ ] Slice 5: Sync docs and package checks

- **Files**: `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `docs/operator/supported-surfaces.md`, `docs/operator/surface-contract.md`, `docs/maintainer/test-matrix.md`, relevant `docs/kit-internals/*`, `AGENTS.md` only if current-state guidance changes, `assets/install-bundle/` only if bundled docs/prompts are affected, and `package.json` only if scripts/files change.
- **Goal**: document strict OpenCode config boundaries, canonical policy ownership, validation-surface labels, and unchanged safety protocol.
- **Preserve**: docs must not claim target-project application validation or guaranteed prompt-free behavior beyond what OpenCode supports; OpenKit checks validate `global_cli`, `runtime_tooling`, `documentation`, and `package` surfaces.
- **Validation**: `npm pack --dry-run --json`, `npm run verify:install-bundle`, `npm run verify:governance`, `npm run verify:all`.
- **Checkpoint**: package dry-run includes the canonical policy and any new strict validation script; install-bundle and governance checks remain synchronized.

## Dependency Graph And Parallelization

- `parallel_mode`: `none`.
- Reason: all slices touch shared policy/config projection and doctor semantics; parallel edits risk reintroducing drift or invalid config keys.
- Sequential constraints: `Slice 1 -> Slice 2 -> Slice 3 -> Slice 4 -> Slice 5`.
- Critical path: define canonical projection first, then sanitize writers, then update readers/doctors, then lock with regression tests and docs/package checks.
- Integration checkpoint before code review: materialized config fixtures and checked-in `.opencode/opencode.json` contain no OpenKit-only top-level metadata and still preserve all required allow/ask entries.

## Rollback And Checkpoints

- Rollback is file-level revert only; no data migration is required.
- If Slice 1 breaks permission projection, revert helper/policy changes and keep the existing permission map until projection parity is proven.
- If Slice 2 breaks materialization, revert writer/merge changes and re-run focused materialization tests before retrying with a narrower sanitizer.
- If Slice 3 causes doctor false positives, keep config sanitization and temporarily narrow doctor drift checks to direct permission-map comparison.
- If Slice 4 strict validation blocks valid OpenCode keys, adjust the allowlist/schema fixture from OpenCode v1.14.28 behavior before shipping.
- Final rollback checkpoint: before `npm run verify:all`, confirm diff is limited to policy/config/doctor/tests/docs/package surfaces named above.

## Validation Plan

Run focused checks as slices complete, then the full package/runtime gates:

1. `node --test tests/global/command-permission-policy.test.js`
2. `node --test tests/global/config-validation.test.js tests/global/ensure-install.test.js tests/global/mcp-profile-materializer.test.js tests/install/materialize.test.js tests/install/merge-policy.test.js`
3. `node --test tests/global/doctor.test.js tests/runtime/doctor.test.js tests/global/command-permission-policy.test.js`
4. Strict OpenCode config validation script, if Slice 4 adds one.
5. `npm pack --dry-run --json`
6. `npm run verify:install-bundle`
7. `npm run verify:governance`
8. `npm run verify:all`

Target-project application build/lint/test validation is unavailable and not required for this OpenKit compatibility remediation.

## Review Focus Points

- Scope compliance: implementation only remediates strict OpenCode config compatibility and must not add prompt brokering or new permission behavior outside the approved projection.
- Config validity: no OpenKit-only top-level metadata remains in any OpenCode-validated `opencode.json`.
- Permission parity: all required routine `allow` and dangerous/delete `ask` entries remain present after sanitization.
- Policy ownership: canonical metadata lives in `assets/default-command-permission-policy.json` or another OpenKit-owned sidecar, never in OpenCode-validated config.
- Safety: destructive git and release/deploy actions remain governed by existing explicit-user-intent and confirmation protocols.
- Validation honesty: doctor/docs distinguish OpenKit package/runtime checks from target-project app validation and report degraded OpenCode semantics when needed.

## QA Focus Points

- Reproduce the original compatibility condition with strict OpenCode config validation against generated and checked-in config projections.
- Verify global kit/profile materialization and repo-local template output contain no `commandPermissionPolicy` key.
- Verify non-dangerous default allow intent remains represented through `permission` allow entries.
- Verify delete/removal commands remain `ask` and destructive git remains confirmation-required by policy/safety protocol.
- Verify doctor reports healthy/drifted/degraded states from canonical policy + config projection and does not depend on inline metadata.
- Verify package/install-bundle/governance checks pass and record validation surfaces accurately.

## Handoff Readiness

- `approach`: pass — strict-schema-safe OpenCode config projection with OpenKit-owned policy metadata outside `opencode.json`.
- `boundaries`: pass — exact config, policy, materialization, doctor, tests, docs, and package surfaces are named.
- `execution`: pass — five sequential slices avoid shared-surface drift and preserve permission parity.
- `validation`: pass — focused Node tests, strict config regression, package dry-run, install-bundle, governance, and full verification gates are specified.
- `risk`: pass — rollback checkpoints and review/QA focus target the main compatibility and permission-preservation risks.
