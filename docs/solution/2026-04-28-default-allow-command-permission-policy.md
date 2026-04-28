---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-960
feature_slug: default-allow-command-permission-policy
source_scope_package: docs/scope/2026-04-28-default-allow-command-permission-policy.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Default-Allow Command Permission Policy

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-28-default-allow-command-permission-policy.md`.
- Current delivery lane: `full` for `FEATURE-960` / `default-allow-command-permission-policy`.
- Product gate: approved by direct user instruction to proceed from scope to solution to implementation to code review to QA without per-stage confirmation.
- This package is the `solution_to_fullstack` handoff artifact only. It does not implement the policy.
- Scope boundaries to preserve: no prompt broker, no pseudo-terminal auto-confirm layer, no hidden OpenCode prompt interception, no new workflow lane/gate/mode, and no weakening of OpenKit git/release safety rules.

## Recommended Path

Add one versioned, machine-readable OpenKit command permission policy and make all OpenKit-owned config/materialization/doctor checks project from that policy. The implementation should keep the OpenCode config output simple: generate the current supported `permission` map from the policy, apply it to global OpenKit-managed profile/config materialization, keep repo-local `.opencode/opencode.json` aligned as an authoring/compatibility surface, and make `openkit doctor` / targeted verification report whether the intended default-allow semantics are fully supported, degraded, or unsupported by the current OpenCode permission model.

This is enough because existing implementation already has the necessary seams:

- Global materialization writes both `<OPENCODE_HOME>/kits/openkit/opencode.json` and `<OPENCODE_HOME>/profiles/openkit/opencode.json` in `src/global/materialize.js`.
- `openkit run` launches OpenCode with `OPENCODE_CONFIG_DIR` pointing at the managed kit/profile path through `src/global/launcher.js`.
- `openkit doctor` already reads global install/profile state in `src/global/doctor.js` and renders operator-visible issues.
- Repository-local install/materialization has an existing template/merge/doctor path through `assets/opencode.json.template`, `src/install/materialize.js`, `src/install/merge-policy.js`, and `src/runtime/doctor.js`.
- Existing tests cover install, global materialization, global doctor, CLI, package/bundle sync, and governance docs.

Do **not** design or implement a prompt broker, auto-confirm pseudo-terminal, or any layer that answers unknown OpenCode prompts. If OpenCode upstream cannot honor true `defaultAction: allow` plus confirm-required exceptions, OpenKit must report the limitation in doctor/verify and in docs instead of claiming routine commands are guaranteed prompt-free.

## Dependencies

- No new npm dependency is recommended.
- Use Node built-ins only for policy loading/validation/projection: `node:fs`, `node:path`, and optionally `node:crypto` for policy/config hashes.
- Target-project application validation remains unavailable. OpenKit CLI/runtime/package/docs checks are not target-project app build/lint/test evidence.

## Impacted Surfaces

### Canonical policy source and projection helpers

- `assets/default-command-permission-policy.json` (create) — canonical machine-readable policy source shipped with the package and copied into global installs.
- `src/permissions/command-permission-policy.js` (create) — shared loader, validator, OpenCode projection, and inspection helpers.
- `src/global/materialize.js` — generate global kit/profile `permission` config from the policy instead of hardcoding the list in `createOpenCodeConfig()`.
- `src/global/paths.js` — add policy path helpers only if useful for doctor/materializer clarity.
- `src/install/materialize.js` and `assets/opencode.json.template` — keep repository-local/manual install config aligned with policy projection.
- `.opencode/opencode.json` — mirror the policy projection for checked-in authoring/compatibility.
- `package.json` — update `files` only if the chosen policy/helper path is not already covered. With the recommended `assets/` + `src/` paths, no package-file allowlist change should be required.

### Global config/profile sync and launch path

- `src/global/materialize.js` — materialize policy-derived permissions into `<OPENCODE_HOME>/kits/openkit/opencode.json` and `<OPENCODE_HOME>/profiles/openkit/opencode.json` during first `openkit run`, `install-global`, and `upgrade` flows.
- `src/global/mcp/profile-materializer.js` — ensure MCP profile updates preserve existing `permission` and policy metadata in the OpenKit profile instead of rewriting it away.
- `src/global/ensure-install.js` — no major behavior change expected; it should treat policy drift reported by doctor as a repair/upgrade signal only if the materialized install is stale or missing.
- `src/global/launcher.js` — no prompt handling changes. Only add pre-launch notice wiring if doctor/policy inspection needs to surface a degraded policy caveat before spawning OpenCode.

### Doctor and verification visibility

- `src/global/doctor.js` — add policy-source, materialized-profile, and upstream-support checks to `inspectGlobalDoctor()` and `renderGlobalDoctorSummary()`.
- `src/runtime/doctor.js` — update managed install drift validation so local/manual install checks compare policy-derived permissions rather than stale hardcoded lists.
- `src/runtime/doctor/install-doctor.js` — optional place to expose compact policy status in runtime doctor read models if implementation keeps install policy status separate from global doctor.
- `tests/global/doctor.test.js` — assert healthy, degraded, missing, malformed, and drifted policy output.
- `tests/global/ensure-install.test.js` — assert first-time materialization writes policy-derived global kit/profile config.
- `tests/install/materialize.test.js`, `tests/install/merge-policy.test.js`, and `tests/runtime/doctor.test.js` — update expected permission output and drift checks.
- New focused tests, recommended: `tests/global/command-permission-policy.test.js` and/or `tests/install/command-permission-policy.test.js` for schema, projection, dangerous entries, and unsupported-granularity reporting.

### Documentation and package sync

- `context/core/project-config.md` — update the Permission Policy section to reference the canonical policy file and global materialization path.
- `context/core/runtime-surfaces.md` — mention command permission policy health under `global_cli` / `package` / `documentation` validation surfaces if needed.
- `docs/operator/supported-surfaces.md` and `docs/operator/surface-contract.md` — describe default allow, confirm-required dangerous categories, OpenCode-owned `Always Allow`, and upstream limitation handling.
- `docs/operator/README.md` — update only if onboarding/default behavior wording changes.
- `docs/maintainer/test-matrix.md` — add a row or note for command permission policy/materialization changes.
- `docs/kit-internals/01-system-overview.md` or `docs/kit-internals/07-operator-runbook.md` — update only where current OpenCode config/profile materialization is explained.
- `AGENTS.md` — update only if command-reality or current-state bullets need to name the new canonical policy file.
- `assets/install-bundle/opencode/` — update only if source docs/agent/command files that are part of the install bundle change; run `npm run sync:install-bundle` before verification if they do.

## Boundaries And Component Decisions

- **Canonical source:** `assets/default-command-permission-policy.json` is the product source of truth. Static config files may carry materialized projections, but tests must prevent them from drifting from the policy.
- **Projection over scattered lists:** hardcoded permission maps in `src/global/materialize.js`, `src/runtime/doctor.js`, install templates, and test fixtures should be replaced or validated against the policy projection.
- **Global product path first:** passing implementation requires global OpenKit-managed profile/config coverage. Updating only `.opencode/opencode.json` is insufficient.
- **Repo-local config is compatibility/authoring:** `.opencode/opencode.json` should align with the policy, but it must not be described as the primary operator target for globally installed OpenKit.
- **No OpenCode prompt control:** OpenKit writes config and reports health. It does not intercept prompts, auto-answer confirmations, or create permission memory beyond OpenCode's own `Always Allow` behavior.
- **Git/release safety remains separate:** command permission defaults do not authorize commits, amend, destructive git, force-push, release publish, or deploy operations. Existing agent safety protocol remains binding even if OpenCode config says a command is allowed.
- **Honest semantics:** if upstream OpenCode supports only a flat permission map, implementation may project known `allow` and `ask` entries but must label true default-allow-with-exceptions as `degraded` or `unsupported` where applicable.

## Interfaces And Data Contracts

### Policy schema recommendation

Use a plain JSON policy with a schema id and explicit projection metadata. Keep it reviewable and small enough for maintainers to audit.

Recommended shape:

```json
{
  "schema": "openkit/command-permission-policy@1",
  "version": 1,
  "intent": "default-allow-with-confirm-required-exceptions",
  "validationSurface": "package",
  "defaults": {
    "desiredAction": "allow",
    "opencodeDefaultAction": "allow"
  },
  "opencodeProjection": {
    "targetKey": "permission",
    "defaultActionField": "defaultAction",
    "defaultActionSupport": "verify-at-runtime",
    "fallbackWhenUnsupported": "explicit-permission-map-with-visible-degraded-status"
  },
  "routineAllowExamples": [
    { "id": "tool.read", "permissionKey": "read", "action": "allow" },
    { "id": "tool.write", "permissionKey": "write", "action": "allow" },
    { "id": "shell.bash", "permissionKey": "bash", "action": "allow", "caveat": "dangerous subcommands require exception support to be enforceable" },
    { "id": "git.log", "permissionKey": "git log", "action": "allow" },
    { "id": "git.diff", "permissionKey": "git diff", "action": "allow" }
  ],
  "confirmRequired": [
    {
      "id": "delete.rm",
      "category": "delete-data-loss",
      "permissionKey": "rm",
      "action": "ask",
      "risk": "file-or-directory-removal",
      "minimumRequired": true,
      "opencodeSupport": "exact"
    }
  ],
  "unsupportedGranularity": []
}
```

Implementation may rename fields if tests and docs remain clear, but it must preserve these concepts:

- schema/version identifier;
- desired default action;
- supported OpenCode projection metadata;
- routine allow examples used for docs/tests, not as the full safety model;
- confirm-required entries with category, action, risk, and support/granularity status;
- unsupported or degraded matching notes for argument-sensitive or wrapped commands.

### Policy projection contract

The shared helper should expose a small API similar to:

```text
loadDefaultCommandPermissionPolicy({ packageRoot? }) -> policy
validateCommandPermissionPolicy(policy) -> { status, errors, warnings }
buildOpenCodePermissionConfig(policy, { opencodeCapabilities? }) -> {
  permission,
  support: supported | degraded | unsupported,
  unsupportedGranularity,
  caveats
}
inspectCommandPermissionPolicy({ policy, config, configPath, scope }) -> {
  status: healthy | degraded | unsupported | missing | malformed | drifted,
  surface,
  configPath,
  desiredDefaultAction,
  effectiveProjection,
  missingConfirmRequired,
  missingRoutineAllows,
  unsupportedGranularity,
  issues,
  caveats,
  nextActions
}
```

Rules:

- `buildOpenCodePermissionConfig()` must not output unverified OpenCode config keys as if they are honored. If `defaultAction` support is unconfirmed, put the intent in OpenKit policy metadata/reporting and project only known supported `permission` entries.
- `inspectCommandPermissionPolicy()` must compare materialized config to policy-derived expected output, not to a separate hardcoded list.
- Dangerous commands that cannot be represented exactly must appear in `unsupportedGranularity` and doctor/verify caveats.
- No helper may execute a command or answer a prompt; helpers are config/read-model only.

### Minimum confirm-required categories

The policy must include entries or explicit unsupported-granularity records for:

- delete/data-loss: `rm`, `rmdir`, `unlink`, shell removal forms where representable;
- destructive git: `git reset --hard`, `git clean`, discard-style `git restore` / `git checkout`, `git push --force`, `git push --force-with-lease`;
- package/release/deploy publish: `npm publish`, `npm unpublish`, `openkit release publish`, deploy/release publish commands with external side effects;
- database destructive: drop/truncate/reset/wipe forms where representable;
- privileged/system-impacting: `sudo`, `chmod`, `chown` where representable.

If OpenCode can only match exact command keys and cannot distinguish arguments or shell wrappers, implementation should still include the policy intent and report those categories as unsupported or coarse rather than pretending they are protected.

## Risks And Trade-offs

- **Risk: upstream OpenCode does not support true default-allow exception semantics.** Mitigation: policy report uses `degraded`/`unsupported`, doctor prints a visible limitation, and docs avoid claiming prompt-free execution when it cannot be proven.
- **Risk: broad `bash: allow` bypasses dangerous subcommand entries.** Mitigation: policy inspection must flag broad-shell allow plus unsupported subcommand matching as degraded; do not claim dangerous shell forms are protected unless OpenCode can enforce them.
- **Risk: policy/config drift.** Mitigation: generated projections and tests compare `.opencode/opencode.json`, `assets/opencode.json.template`, global materialization output, and doctor expected assets to the canonical policy.
- **Risk: user-managed global OpenCode config conflicts.** Mitigation: preserve existing non-OpenKit-owned config, report conflict/drift, and recommend `openkit upgrade` or manual review; do not overwrite silently.
- **Risk: expanding dangerous list becomes speculative.** Mitigation: keep entries categorized, reviewable, and support-labeled; unsupported categories are visible limitations, not implementation failures hidden in prose.
- **Trade-off: a flat config projection may still enumerate routine allow examples.** Accepted for MVP only as a compatibility projection. The canonical policy remains default-allow intent and doctor must label any flat-map fallback as degraded if true default semantics are unavailable.

## Implementation Slices

### [ ] Slice 1: Canonical policy and projection helper

- **Files**: `assets/default-command-permission-policy.json`, `src/permissions/command-permission-policy.js`, `tests/global/command-permission-policy.test.js` or `tests/install/command-permission-policy.test.js`.
- **Goal**: define the policy source and shared validation/projection/inspection helper before changing materialization.
- **Validation Command**: `node --test tests/global/command-permission-policy.test.js tests/install/command-permission-policy.test.js` using whichever new test files are created.
- **Details**:
  - Write failing tests first for schema validation, minimum dangerous entries, policy-to-OpenCode projection, and unsupported/defaultAction reporting.
  - Keep policy JSON free of comments and raw environment/secret values.
  - Projection should produce the current compatible permission map plus support/caveat metadata.
  - If no OpenCode-supported `defaultAction` field is verified, tests should expect degraded/unsupported support metadata instead of a false full-support claim.

### [ ] Slice 2: Global materialization and repo-local config alignment

- **Files**: `src/global/materialize.js`, `src/global/mcp/profile-materializer.js` if preservation needs hardening, `src/install/materialize.js`, `assets/opencode.json.template`, `.opencode/opencode.json`, and affected materialization tests.
- **Goal**: make first-time global install, `openkit run`, `install-global`, and `upgrade` write policy-derived permissions to OpenKit-owned config/profile surfaces, while repo-local compatibility config stays aligned.
- **Validation Command**: `node --test tests/global/ensure-install.test.js tests/install/materialize.test.js tests/install/merge-policy.test.js tests/runtime/doctor.test.js`.
- **Details**:
  - Replace or constrain hardcoded permission maps with calls to the policy projection helper.
  - Ensure `<OPENCODE_HOME>/kits/openkit/opencode.json` and `<OPENCODE_HOME>/profiles/openkit/opencode.json` carry the same policy-derived permission projection after `materializeGlobalInstall()`.
  - Ensure MCP profile materialization preserves the permission section when adding/removing MCP entries.
  - Local/manual install merge policy should continue fail-closed behavior for unsupported user-owned rewrites.
  - Repo-local `.opencode/opencode.json` remains compatibility/authoring, not the only passing target.

### [ ] Slice 3: Doctor, verification, and drift visibility

- **Files**: `src/global/doctor.js`, `src/runtime/doctor.js`, `src/runtime/doctor/install-doctor.js` if used, `tests/global/doctor.test.js`, `tests/runtime/doctor.test.js`, and policy tests from Slice 1.
- **Goal**: make `openkit doctor` and runtime doctor checks expose policy presence, parse/schema health, materialized config alignment, dangerous-entry coverage, routine allow/default-allow projection, and upstream support limitations.
- **Validation Command**: `node --test tests/global/doctor.test.js tests/runtime/doctor.test.js tests/global/command-permission-policy.test.js`.
- **Details**:
  - Doctor summary should include a compact line such as `Command permission policy: healthy|degraded|unsupported|drifted` plus config path and next action.
  - Missing/malformed policy should make doctor non-healthy and recommend `openkit upgrade` or package refresh, not silently fall back to hardcoded config.
  - Drift between policy and materialized global profile/config should be reported as non-healthy or degraded with a clear path to run `openkit upgrade`.
  - If OpenCode cannot honor true defaultAction semantics or argument-sensitive dangerous entries, doctor must say so explicitly and avoid prompt-free/protected overclaims.

### [ ] Slice 4: Documentation, package checks, and governance alignment

- **Files**: `context/core/project-config.md`, `context/core/runtime-surfaces.md` if needed, `docs/operator/supported-surfaces.md`, `docs/operator/surface-contract.md`, `docs/operator/README.md` if needed, `docs/maintainer/test-matrix.md`, relevant `docs/kit-internals/*`, `AGENTS.md` only if current-state bullets change, and install-bundle copies if bundled source docs/prompts change.
- **Goal**: document the product contract and validation surface split without changing workflow/lane semantics or safety protocol.
- **Validation Command**: `npm run verify:governance && npm run verify:install-bundle` if install-bundle-covered files changed.
- **Details**:
  - State that normal/non-dangerous commands default to allow only where OpenCode supports the policy semantics.
  - State dangerous categories remain confirmation-required and unsupported matching granularity is reported.
  - State OpenCode `Always Allow` persistence is OpenCode-owned, not an OpenKit hidden approval store.
  - State git/release safety protocol is unchanged even when command permissions are less noisy.
  - Keep `target_project_app` validation unavailable unless a real target project defines app-native commands.

### [ ] Slice 5: Final package/global verification and handoff evidence

- **Files**: no new feature files expected beyond fixes from earlier slices; workflow evidence/QA artifacts later in the lane may reference this solution.
- **Goal**: run the smallest targeted checks plus full OpenKit gate before Code Review/QA.
- **Validation Command**: `node --test tests/install/*.test.js && node --test tests/global/*.test.js && node --test tests/runtime/doctor.test.js tests/runtime/governance-enforcement.test.js && node --test tests/cli/openkit-cli.test.js && npm run verify:install-bundle && npm run verify:governance && npm run verify:all`.
- **Details**:
  - Add `npm pack --dry-run --json` as package evidence if reviewers need proof that the new policy file ships in the package.
  - Record unavailable `target_project_app` validation explicitly.
  - If any command cannot run due to local environment, capture the exact command, exit status, and blocker instead of substituting unrelated evidence.

## Dependency Graph

- Sequential constraints:
  - `Slice 1 -> Slice 2 -> Slice 3 -> Slice 4 -> Slice 5`.
  - Policy schema/projection must exist before materialization and doctor work.
  - Materialization must exist before doctor can truthfully report profile/config alignment.
  - Docs should be finalized after the actual support/degraded behavior is known.
- Parallelization: `parallel_mode = none`.
- Why no parallelism: this feature touches the same policy/config/doctor/docs/test fixtures across slices, and parallel edits would create high drift/merge risk for the canonical policy projection.
- Critical path: policy helper -> global/profile materialization -> doctor support/drift report -> docs/package verification.

## Validation Matrix

| Acceptance target | Validation path | Surface |
| --- | --- | --- |
| AC1 canonical machine-readable policy | Policy schema/projection tests; package dry run if needed | `package` |
| AC2 global installed runtime uses policy | `node --test tests/global/ensure-install.test.js tests/global/doctor.test.js` | `global_cli` |
| AC3 repo-local config not only target | Global tests plus `.opencode/opencode.json` alignment test | `global_cli` / `compatibility_runtime` |
| AC4 routine commands avoid repeated confirmation where supported | Policy projection tests and doctor support status; manual OpenCode prompt behavior only if upstream supports observable test path | `global_cli` / upstream caveat |
| AC5 delete/data-loss commands ask | Policy tests assert `rm`, `rmdir`, `unlink` coverage or unsupported-granularity entries; doctor shows confirm-required coverage | `package` / `global_cli` |
| AC6 destructive git asks and git protocol unchanged | Policy tests for destructive git entries; docs/governance review for unchanged safety protocol | `package` / `documentation` |
| AC7 publish/deploy/db destructive commands ask | Policy tests for category entries and support labels | `package` / `global_cli` |
| AC8 privileged/system-impacting handled | Policy tests for `sudo`, `chmod`, `chown` or explicit unsupported limitations | `package` / `global_cli` |
| AC9 doctor reports policy health and drift | `node --test tests/global/doctor.test.js tests/runtime/doctor.test.js` | `global_cli` / `compatibility_runtime` |
| AC10 verification covers effective behavior or limitations | Targeted tests plus `npm run verify:all`; evidence records unsupported upstream semantics | multiple OpenKit surfaces |
| AC11 no prompt broker/auto-confirm MVP | Code review search/review; docs/governance test where applicable | `runtime_tooling` / `documentation` |
| AC12 docs match product contract | `npm run verify:governance`; docs review | `documentation` |

Full recommended pre-review command set:

```bash
node --test tests/install/*.test.js
node --test tests/global/*.test.js
node --test tests/runtime/doctor.test.js tests/runtime/governance-enforcement.test.js
node --test tests/cli/openkit-cli.test.js
npm run verify:install-bundle
npm run verify:governance
npm run verify:all
```

Optional package proof if requested during review/release prep:

```bash
npm pack --dry-run --json
```

Target-project app build/lint/test validation is unavailable for this repository unless a separate target project defines those commands.

## Integration Checkpoint

Before Code Review, FullstackAgent should provide one compact evidence note covering:

- canonical policy file path and schema id;
- generated/materialized permission projection in global kit config and OpenKit profile config;
- repo-local compatibility config alignment;
- doctor output status for policy health and upstream support/degraded limitations;
- exact dangerous-command categories covered and categories marked unsupported/coarse;
- confirmation that no prompt broker, pseudo-terminal auto-confirm, or hidden prompt interception was added;
- targeted and full validation commands run, with surface labels.

## Rollback Notes And Guardrails

- Roll back as one unit: policy file, projection helper, materialization changes, doctor checks, tests, and docs. Partial rollback risks config/policy drift.
- If policy projection causes unsafe or noisy behavior, revert materialization to the previous explicit permission map while keeping doctor/docs honest about degraded behavior.
- If OpenCode rejects a proposed `defaultAction` field, remove it from materialized OpenCode config and leave the intent only in OpenKit policy/reporting until upstream support is verified.
- Do not overwrite user-managed global OpenCode config conflicts. Preserve existing conflict/fail-closed merge behavior.
- Do not add a prompt broker or auto-confirm workaround as a rollback/repair path.
- Do not change lane semantics, workflow state enums, approval gates, or task-board/parallel behavior for this feature.
- Do not change agent git/release safety protocol. Dangerous git, publish, release, deploy, and destructive operations still require explicit user intent and existing safety checks.

## Reviewer Focus Points

- Verify every materialized permission map is derived from or checked against `assets/default-command-permission-policy.json`.
- Verify global profile/config materialization is tested; `.opencode/opencode.json` alone must not satisfy acceptance.
- Verify doctor reports missing/malformed/drifted policy and upstream unsupported/defaultAction limitations without overclaiming.
- Verify broad allowed commands such as `bash` do not lead docs/tests to claim dangerous shell forms are protected unless OpenCode can enforce exceptions.
- Verify no implementation answers prompts, shells through a pseudo-terminal to auto-confirm, or creates hidden approval memory.
- Verify package/docs validation surfaces are labeled correctly and `target_project_app` remains unavailable.

## Implementation Handoff Notes

- Start with tests for the policy schema/projection and doctor degraded semantics, then implement the helper and wire materialization.
- Prefer one shared helper over duplicating dangerous-command lists in materializer, doctor, docs, and tests.
- Use support labels (`supported`, `degraded`, `unsupported`) and existing capability vocabulary where surfaced to users.
- Keep implementation conservative: if exact argument-sensitive matching cannot be proven, report it as unsupported/coarse instead of inventing matching behavior.
- Preserve the current full-delivery flow: after implementation, route to Code Reviewer for scope compliance first, then QA for behavior/evidence verification.
