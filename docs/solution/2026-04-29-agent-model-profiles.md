---
artifact_type: solution_package
version: 1
status: approval_ready
feature_id: FEATURE-961
feature_slug: agent-model-profiles
source_scope_package: docs/scope/2026-04-29-agent-model-profiles.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Agent Model Profiles

## Current-State Discovery Summary

Inspected source of truth and workflow surfaces:

- `docs/scope/2026-04-29-agent-model-profiles.md`: approved Product Lead scope, stories, acceptance criteria, edge cases, and validation-surface constraints.
- `context/core/workflow.md`: full-delivery stage contract, Solution Lead output expectations, approval gate `solution_to_fullstack`, and task-board parallelization semantics.
- `package.json`: available repository commands and test surfaces.

Inspected global CLI and launch surfaces:

- `bin/openkit.js`: delegates all CLI entry to `src/cli/index.js`.
- `src/cli/index.js`: command registry currently includes `run`, `configure`, `configure-agent-models`, and other global commands, but no `profiles` command yet.
- `src/cli/commands/configure-agent-models.js`: existing interactive agent-model setup, argument parsing, `opencode models` discovery, provider/model grouping, variant selection, prompt adapter, and global install guard.
- `src/cli/commands/run.js`: `openkit run` entrypoint and launch handoff to `launchGlobalOpenKit`.
- `src/global/launcher.js`: currently builds `OPENCODE_CONFIG_CONTENT` by layering `buildAgentModelConfigOverrides(paths.agentModelSettingsPath)` over baseline config before launching `opencode`.
- `src/global/paths.js`: global OpenKit settings live under `OPENCODE_HOME/openkit`; existing `agentModelSettingsPath` is `OPENCODE_HOME/openkit/agent-models.json`.

Inspected agent-model and runtime surfaces:

- `src/global/agent-models.js`: current persisted per-agent model override store, catalog reading from global `registry.json`, model id validation, two-entry per-agent `profiles` helper, and launch config override builder.
- `src/runtime/config-validation.js`: current validation for `agentModels`, fallback fields, auto-fallback, and per-agent `profiles` array.
- `src/runtime/profile-switch-cli.js`: existing session-local per-agent profile-switch CLI backed by workspace state and `openkit.runtime.jsonc` per-agent profile counts.
- `src/runtime/managers/agent-profile-switch-manager.js`: existing workspace-local manual selections stored in `.opencode/agent-profile-switches.json`, keyed by agent id and profile index.
- `src/runtime/tools/models/profile-switch.js`: existing runtime tool that lists/toggles per-agent profile entries in resolved model runtime state.
- `src/install/runtime-profile-materializer.js`: simple runtime profile materialization helper, not directly sufficient for this feature.

Inspected command and install-bundle surfaces:

- `commands/configure-agent-models.md`: existing in-session documentation command for model configuration.
- `commands/*.md` and `assets/install-bundle/opencode/commands/*.md`: no `/switch-profiles` command exists yet in repository or install bundle.

Inspected tests:

- `tests/cli/configure-agent-models.test.js`: tests current CLI interactive model selection with fake `opencode models` output and prompt injection.
- `tests/global/agent-models.test.js`: tests current agent-model persistence, variants, fallback policy, per-agent quick-switch profiles, catalog reading, and model id validation.
- `tests/cli/run-options.test.js`, `tests/cli/openkit-cli.test.js`, `tests/cli/run*.test.js` discovered by test glob as relevant places for run/CLI registration coverage.
- `tests/runtime/*.test.js` discovered runtime test surface for model/runtime/session behavior additions.

Stray scaffold discovered:

- `/home/duypham/Projects/docs/solution/2026-04-29-agent-model-profiles.md` exists outside the active repository and is a draft scaffold for this same artifact. It should be removed because the correct artifact path is inside `/home/duypham/Projects/open-kit`.

## Recommended Technical Approach

Implement global agent model profiles as a new global settings store and CLI command, then layer the selected profile into launch/session behavior through one resolver shared by `openkit run` and `/switch-profiles`.

Why this is sufficient:

- The Product Lead scope requires reusable global profiles, not project/workspace-local profiles. `getGlobalPaths()` already centralizes global OpenKit settings under `OPENCODE_HOME/openkit`, so a sibling store to `agent-models.json` fits the existing path model.
- The current `configure-agent-models` command already contains the model discovery and interactive selection experience that the scope wants to preserve. Extracting reusable chooser/catalog helpers avoids divergent provider/model UX.
- Launch currently applies model overrides through `OPENCODE_CONFIG_CONTENT`. Applying a resolved profile by generating the same agent override shape keeps the integration narrow and avoids changing OpenCode itself.
- Session-only switching needs workspace/runtime state, not global config mutation. The existing session-local profile-switch state proves the pattern, but its per-agent/index semantics are not the product behavior. Replace or extend it with a session active-profile state keyed by profile name for the current workspace session.
- Delete safety needs visibility into running sessions. The launcher already records runtime sessions through `sessionStateManager.recordRuntimeSession`; the implementation should add active profile metadata there and query it before deletion.

## Impacted Files And Surfaces

Expected source additions:

- `src/global/agent-model-profiles.js`: global profile store, validation, profile resolution, default-profile helpers, delete-safety predicates, and config override builder.
- `src/cli/commands/profiles.js`: new `openkit profiles` command with `--create`, `--edit`, `--list`, `--delete`, `--set-default`, and help text.
- `src/cli/commands/agent-model-selection.js` or equivalent shared helper: extracted provider/model discovery and prompt helpers from `configure-agent-models.js` for reuse by both commands.
- `src/runtime/managers/session-profile-manager.js` or replacement of the narrow `AgentProfileSwitchManager`: workspace/session active profile state for `/switch-profiles`.
- `commands/switch-profiles.md`: in-session command definition for interactive profile switching.

Expected source changes:

- `src/cli/index.js`: register `profiles`.
- `src/cli/commands/configure-agent-models.js`: consume shared model-selection helpers without changing existing behavior.
- `src/global/paths.js`: add `agentModelProfilesPath`, likely `path.join(settingsRoot, 'agent-model-profiles.json')`.
- `src/global/launcher.js`: resolve global default profile at launch, merge profile overrides over baseline/current model settings, pass active profile metadata into runtime/session environment or session state.
- Runtime bootstrap/session manager files reached from `bootstrapRuntimeFoundation()` and `sessionStateManager.recordRuntimeSession`: record and expose the active profile for deletion checks.
- `assets/install-bundle/opencode/commands/`: include synced `/switch-profiles` command after running the existing install-bundle sync process or by making equivalent source/bundle changes per repository convention.
- `package.json` only if new verification scripts are intentionally added; not required by this solution.

Expected test additions/updates:

- `tests/global/agent-model-profiles.test.js`: store contract, default handling, partial fallback resolution, invalid/missing model detection, delete-safety predicate behavior.
- `tests/cli/profiles.test.js`: command registration, list/create/edit/delete/default flows, prompt cancellation, duplicate names, model-choice source reuse.
- `tests/cli/run-options.test.js` or `tests/cli/openkit-cli.test.js`: CLI registration/help coverage as needed.
- `tests/runtime/profile-switch.test.js` or focused runtime manager tests: session-only switch state and active profile isolation.
- `tests/global/agent-models.test.js` and `tests/cli/configure-agent-models.test.js`: regression coverage after helper extraction.

## Data And Config Contract

Add a global profile store at `OPENCODE_HOME/openkit/agent-model-profiles.json`:

```json
{
  "schema": "openkit/agent-model-profiles@1",
  "stateVersion": 1,
  "updatedAt": "2026-04-29T00:00:00.000Z",
  "defaultProfile": "reasoning-heavy",
  "profiles": {
    "reasoning-heavy": {
      "name": "reasoning-heavy",
      "description": "optional user-facing description",
      "agentModels": {
        "product-lead-agent": { "model": "openai/gpt-5", "variant": "high" },
        "solution-lead-agent": { "model": "openai/gpt-5", "variant": "high" }
      },
      "createdAt": "2026-04-29T00:00:00.000Z",
      "updatedAt": "2026-04-29T00:00:00.000Z"
    }
  }
}
```

Contract rules:

- Store is global under OpenCode home, not project or workspace local.
- Profile names are unique object keys and should be normalized by trimming surrounding whitespace. Do not silently case-fold unless implementation also defines that behavior in help text and tests.
- `agentModels` keys are OpenKit agent ids from `readAgentCatalog()`, such as `product-lead-agent`, `solution-lead-agent`, `fullstack-agent`, `code-reviewer`, and `qa-agent`.
- Each selected role value uses the same model-entry shape as `agent-models.json`: `model` plus optional `variant`, `fallback_models`, and `auto_fallback` only if intentionally supported in the wizard. The minimum required shape for this feature is `model` plus optional `variant`.
- Partial profiles are valid. Missing agent ids are omitted rather than stored with null values.
- Empty profiles should not be saved from the main wizard because they cannot change behavior; cancellation must leave state unchanged.
- Stored profile references should be validated against the currently available `opencode models` list before create/edit save and before switch/default application when model discovery is available. If unavailable, create/edit must fail safely; runtime application should surface a clear mismatch and retain fallback/current config rather than silently applying invalid entries.
- Existing `OPENCODE_HOME/openkit/agent-models.json` remains the current/default model configuration and fallback base.

Resolution order for an agent at launch/session time:

1. Baseline `OPENCODE_CONFIG_CONTENT` supplied by caller.
2. Current/default per-agent model settings from `agent-models.json`.
3. Active global profile entries for matching agent ids only.
4. For agents omitted by active profile, keep the current/default settings from step 2.

Session active profile state:

- Store session-scoped selection under the managed workspace runtime root, not under global settings.
- Recommended file: `<workspaceRoot>/.opencode/active-agent-model-profile.json` or an equivalent session-state field managed by the runtime session manager.
- Minimum fields: schema, stateVersion, profileName, selectedAt, source (`global_default` or `switch_profiles`), workspaceId/session id if available.
- This state must not mutate `agent-model-profiles.json` or `agent-models.json`.

Running-session delete guard:

- Extend recorded runtime session metadata to include active profile name.
- Delete checks should query known non-terminal running sessions and block if any active session uses the selected profile.
- If session liveness cannot be proven, prefer blocking with clear guidance over deleting a possibly active profile.

## Interfaces, Commands, And Behavior Boundaries

Global CLI:

- `openkit profiles --create`: requires interactive IO; prompts for unique profile name, role/agent selections, configured provider/model choices, optional variants, and confirmation before save.
- `openkit profiles --edit`: lists existing profiles, lets the user choose one, then update role/model selections using the same wizard style. Save should be atomic after confirmation.
- `openkit profiles --list`: prints existing profile names, selected roles/counts, and marks the global default when set. Empty list exits successfully with a clear no-profiles message.
- `openkit profiles --delete`: lists profiles, blocks default profile deletion, blocks active-running-session deletion, confirms before removal, then removes from global store.
- `openkit profiles --set-default`: lists profiles and sets the selected existing profile as future launch default. Missing/invalid selection leaves default unchanged.
- `openkit profiles --help`: documents the short flags and explicitly states profiles are global and `/switch-profiles` is session-only.

In-session command:

- `/switch-profiles`: opens an interactive list of existing global profiles.
- On selection, validates the profile still exists and is applicable, writes current-session active profile state, and applies the selected profile immediately for subsequent agent/model resolution in the current session.
- Empty profile list reports no profiles are available and leaves session state unchanged.
- Cancellation leaves session state unchanged.
- `/switch-profiles <name>` direct argument support is out of scope and must not be required by tests or docs for this feature.
- `/switch-profiles` must not set global default, edit global profiles, delete profiles, or alter other sessions.

Model choice boundary:

- Main create/edit flow must use existing configured provider/model choices from the current `opencode models` discovery path in `configure-agent-models.js`.
- Do not add arbitrary model-id entry as the main path. Existing exact provider/model entry inside the chooser should only be accepted if it is present in the discovered model entries; if the current helper allows unknown provider/model strings, tighten the shared helper for profile create/edit or provide a strict mode.

Compatibility boundary:

- Existing `configure-agent-models` behavior must remain compatible.
- Existing per-agent two-profile runtime switch code is a lower-level/legacy model switching surface and should not be exposed as the product `/switch-profiles` UX unless adapted to named global profiles.

## Implementation Slices

parallel_mode: `none`

Why: this feature crosses global config storage, CLI UX, launcher layering, runtime session state, in-session commands, and delete safety. The shared data contract and resolver must land before dependent UX and runtime behavior to avoid divergent assumptions.

safe_parallel_zones: `[]`

sequential_constraints:

- `SLICE-01 -> SLICE-02 -> SLICE-03 -> SLICE-04 -> SLICE-05 -> SLICE-06 -> SLICE-07`

max_active_execution_tracks: `1`

### SLICE-01: Shared Model Selection Helpers

Objective: Extract reusable model discovery and interactive selection from `configure-agent-models.js` without behavior regression.

Tasks:

- Move reusable pieces such as `runOpenCodeModels`, model parsing, provider grouping, prompt adapter, prompt line, model chooser, and variant chooser into a shared CLI helper module.
- Add strict model-selection mode for profile create/edit where returned selections must come from discovered model entries.
- Keep `configure-agent-models --interactive`, `--models`, and direct `--agent --model` behavior covered by existing tests.

Dependencies: none.

Validation focus: existing configure-agent-model tests continue passing; new helper tests if behavior is non-trivial.

### SLICE-02: Global Profile Store And Resolver

Objective: Add persisted global profile data contract and pure resolution functions.

Tasks:

- Add `agentModelProfilesPath` to `getGlobalPaths()`.
- Implement read/create/update/delete/list/default helpers in `src/global/agent-model-profiles.js`.
- Implement validation for schema shape, duplicate/missing profile names, known agent ids, partial profiles, and model entry shape.
- Implement `buildAgentModelProfileConfigOverrides({ baseSettingsPath, profilesPath, activeProfileName })` or equivalent resolver that layers active profile entries over current/default settings while preserving fallback for omitted roles.
- Add stale model-reference detection helper that compares profile models with discovered configured models when discovery is available.

Dependencies: SLICE-01 for strict discovered-model validation if model availability checks are included here.

Validation focus: unit tests for store defaults, partial fallback, missing default, stale model references, and no mutation on failed operations.

### SLICE-03: `openkit profiles` Global CLI

Objective: Add the short operator CLI for profile management.

Tasks:

- Add `src/cli/commands/profiles.js` with flag parser for exactly `--create`, `--edit`, `--list`, `--delete`, `--set-default`, and help.
- Register `profiles` in `src/cli/index.js`.
- Reuse global install guard pattern from `configure-agent-models`.
- Implement create/edit interactive wizard using shared agent catalog and strict model chooser.
- Implement list/default/delete flows and cancellation safety.
- Add duplicate-name blocking and empty-list messaging.

Dependencies: SLICE-01, SLICE-02.

Validation focus: CLI tests with fake `OPENCODE_HOME`, fake `opencode models`, prompt injection, and file assertions.

### SLICE-04: Launch Default Profile Resolution

Objective: Make `openkit run` start with the configured global default profile.

Tasks:

- Update `launchGlobalOpenKit()` to read profile store after workspace bootstrap.
- Resolve active launch profile as global default when configured; otherwise preserve current `agent-models.json` behavior.
- Merge baseline inline config, current/default model settings, and profile overrides in the documented order.
- Record active profile metadata into runtime/session state for delete-safety and diagnostics.
- Surface clear warnings/errors for missing default profile or invalid/stale model references without silently applying bad profile entries.

Dependencies: SLICE-02.

Validation focus: launcher tests with stub spawn and temp `OPENCODE_HOME`, asserting `OPENCODE_CONFIG_CONTENT` includes default profile overrides while omitted agents retain fallback settings.

### SLICE-05: Session-Scoped `/switch-profiles`

Objective: Add in-session interactive profile switching with current-session-only semantics.

Tasks:

- Add `commands/switch-profiles.md` and install-bundle counterpart.
- Implement runtime command/tool support for listing global profiles and selecting one interactively in-session.
- Write selected profile to workspace/session state only.
- Ensure selected profile immediately affects subsequent model resolution in the current runtime session.
- Do not mutate global default, global profile store, or other sessions.
- Handle no profiles, cancellation, missing selected profile after list display, and unsafe apply failures.

Dependencies: SLICE-02, SLICE-04.

Validation focus: runtime manager/tool tests proving session-only state and global default immutability; command file sync validation.

### SLICE-06: Delete Safety Across Default And Running Sessions

Objective: Block unsafe deletion cases.

Tasks:

- Block deletion when selected profile equals `defaultProfile` with guidance to set another default first.
- Query runtime/session records for active running sessions using the profile.
- Block deletion when any running session reports the selected profile active, with guidance to exit affected sessions first.
- Allow deletion only when neither guard applies and user confirms.
- Ensure deleted profile no longer appears in subsequent list/switch selections.

Dependencies: SLICE-03, SLICE-04, SLICE-05.

Validation focus: unit tests for default guard, running-session guard, stale/non-running session handling, and successful deletion.

### SLICE-07: Integration, Docs, And Bundle Sync

Objective: Align command docs, install bundle, and end-to-end validation.

Tasks:

- Update CLI help tests and any operator docs that list global CLI commands if they exist in current docs.
- Ensure `commands/switch-profiles.md` is included in `assets/install-bundle/opencode/commands/` through `npm run sync:install-bundle` or equivalent source-preserving update.
- Run targeted and broader OpenKit verification commands listed in the validation matrix.
- Record unavailable target-project app validation explicitly in handoff/QA evidence.

Dependencies: all prior slices.

Validation focus: install-bundle verification and end-to-end happy path with fake model catalog where possible.

## Validation Matrix

| Surface | Command | When | Evidence Expected |
| --- | --- | --- | --- |
| global_cli | `node --test tests/global/agent-model-profiles.test.js` | After SLICE-02 | Profile store contract, partial fallback, default handling, stale model validation, delete predicate behavior. |
| global_cli | `node --test tests/cli/profiles.test.js` | After SLICE-03 and SLICE-06 | `openkit profiles` create/edit/list/delete/default flows, cancellation, duplicate names, strict model choices. |
| global_cli regression | `node --test tests/cli/configure-agent-models.test.js` | After SLICE-01 | Existing configure-agent-model setup remains unchanged after helper extraction. |
| global_cli/runtime launch | `node --test tests/cli/run-options.test.js` | After SLICE-04 if touched | Existing run option behavior remains unchanged. |
| global_cli/runtime launch | `node --test tests/runtime/launcher.test.js` | After SLICE-04 | `openkit run` launch config layering includes global default profile and fallback behavior. |
| in_session | `node --test tests/runtime/profile-switch.test.js` | After SLICE-05 | `/switch-profiles` supporting manager/tool applies current-session profile only and handles empty/cancel/missing cases. |
| runtime/compatibility | `node --test tests/runtime/runtime-bootstrap.test.js` | After SLICE-05 | Runtime bootstrap still initializes managers/tools with new profile support. |
| install/runtime bundle | `npm run verify:install-bundle` | After SLICE-07 | Command bundle includes `/switch-profiles` and generated install surfaces are synchronized. |
| broader OpenKit regression | `npm run verify:governance` | Before Fullstack handoff to review | Workflow/governance contracts still pass. |
| broader OpenKit regression | `npm run verify:all` | Before QA when feasible | Full repository verification for OpenKit runtime/CLI surfaces. Note this includes Semgrep quality and may fail if Semgrep tooling is unavailable; do not treat a local Semgrep skip as CI-quality evidence. |
| target-project app | unavailable | Always for this feature unless a separate target project defines commands | No target-project application build/lint/test exists for this OpenKit feature. Do not substitute OpenKit CLI/runtime checks as target-app validation. |

Additional concrete commands available from `package.json`:

- `npm run verify:runtime-foundation`
- `npm run verify:governance`
- `npm run verify:install-bundle`
- `npm run verify:mcp-secret-package-readiness`
- `npm run verify:semgrep-quality`
- `node --test tests/global/agent-models.test.js`
- `node --test tests/cli/openkit-cli.test.js`

Use targeted `node --test ...` commands during slices, then run the broader commands after integration.

## Acceptance Trace

| AC | Scope Requirement | Implementation Slice | Validation |
| --- | --- | --- | --- |
| AC-01 | Profiles are global to OpenKit | SLICE-02, SLICE-03 | `tests/global/agent-model-profiles.test.js`, `tests/cli/profiles.test.js` with temp `OPENCODE_HOME`. |
| AC-02 | Short management CLI | SLICE-03 | `tests/cli/profiles.test.js`, `tests/cli/openkit-cli.test.js`. |
| AC-03 | Interactive create/edit UX | SLICE-01, SLICE-03 | `tests/cli/profiles.test.js` prompt-injection flows. |
| AC-04 | Valid model choices from configured list | SLICE-01, SLICE-03 | Fake `opencode models` tests proving arbitrary undiscovered model ids are not accepted in profile wizard. |
| AC-05 | Partial profile fallback | SLICE-02, SLICE-04 | Store/resolver tests and launcher config layering tests. |
| AC-06 | Global default startup | SLICE-04 | Launcher test asserting default profile active on `openkit run`. |
| AC-07 | In-session interactive switch | SLICE-05 | Runtime profile switch manager/tool tests and command artifact inspection. |
| AC-08 | Session-only switch | SLICE-05 | Tests proving global default/profile store unchanged and separate workspace/session state isolated. |
| AC-09 | No direct switch argument required | SLICE-05 | Command docs/tests only cover interactive `/switch-profiles`; no direct name argument requirement. |
| AC-10 | Delete blocks default | SLICE-06 | CLI/global tests for default delete guard. |
| AC-11 | Delete blocks active sessions | SLICE-04, SLICE-06 | Runtime/session metadata tests and CLI delete guard tests. |
| AC-12 | Empty/cancel-safe flows | SLICE-03, SLICE-05, SLICE-06 | CLI and runtime tests for cancellation/no profiles/unavailable models/no mutation. |
| AC-13 | Validation surface clarity | SLICE-07 | Handoff and QA evidence label `global_cli`, `in_session`, runtime/compatibility, and target-project app unavailable. |

## Risks And Rollback

Risks:

- Model chooser extraction could regress existing `configure-agent-models` UX. Mitigate with existing CLI tests before adding new profile behavior.
- Current chooser accepts exact provider/model strings even if not in the parsed list. The profile wizard must use strict discovered-list behavior to satisfy the scope.
- Applying profile changes immediately inside an already-running OpenCode session may be limited by how runtime model resolution is cached. Fullstack must verify whether subsequent agent invocations read session state dynamically; if not, add the smallest runtime invalidation/resolution seam rather than restarting the session.
- Running-session delete safety depends on reliable session liveness. If liveness is ambiguous, block deletion with guidance rather than risk deleting an active profile.
- Existing per-agent quick-switch state and new named global profiles can be confused. Keep names, files, and command text distinct.
- Install-bundle drift is likely if command docs are added only under `commands/`. Run bundle verification.

Rollback plan:

- Global profile store is additive. Removing the new `profiles` command registration and launch profile layering should return `openkit run` to current `agent-models.json` behavior.
- If `/switch-profiles` integration is unstable, leave global CLI profile management disabled behind command registration removal while preserving the store code for follow-up only if tests remain isolated.
- Do not migrate or rewrite existing `agent-models.json`; existing per-agent overrides must remain valid throughout rollback.
- Delete newly created `agent-model-profiles.json` test fixtures or user-created profiles only on explicit user request; rollback should not destructively remove user config by default.

## Reviewer Focus Points

- Confirm Product Lead scope is not expanded: no project-local profiles, no `/switch-profiles <name>`, no arbitrary model-id main flow, no in-session default mutation.
- Check global-vs-session boundary rigorously: CLI profile/default writes global state; `/switch-profiles` writes only session/workspace runtime state.
- Verify partial fallback resolution order and `OPENCODE_CONFIG_CONTENT` merge order.
- Inspect cancellation and failure paths for no-mutation guarantees.
- Inspect delete guard for both global default and running-session active profile cases.
- Confirm existing `configure-agent-models` behavior and tests remain compatible after helper extraction.
- Confirm install bundle includes new command docs and verification passes.

## QA Focus Points

- Create two profiles with different role/model mappings through `openkit profiles --create` using fake or real configured provider/model choices.
- Set one default, run `openkit run`, and verify default profile is initial active profile while omitted roles use current/default model settings.
- In one running session, use `/switch-profiles` to select another profile and verify the global default does not change.
- With two sessions, switch profile in one and verify the other session keeps its active profile.
- Attempt to delete the global default and verify deletion is blocked with actionable guidance.
- Attempt to delete a profile active in a running session and verify deletion is blocked with actionable guidance.
- Cancel create/edit/default/delete/switch prompts and verify no persisted or session state changes.
- Validate empty profile list behavior for `openkit profiles --list` and `/switch-profiles`.
- Label evidence as `global_cli`, `in_session`, and runtime/compatibility. Record target-project application validation as unavailable.

## Fullstack Handoff

Implement sequentially in the slice order above. Do not start with `/switch-profiles`; first establish the shared chooser and global profile store/resolver so CLI, launch, and runtime use the same contract.

Required implementation guardrails:

- Preserve existing `configure-agent-models` UX and direct override behavior.
- Keep global profile management under `OPENCODE_HOME/openkit`, not project-local `.opencode`.
- Use strict discovered provider/model choices for profile create/edit.
- Keep partial profiles sparse; do not write null entries for omitted roles.
- Keep `/switch-profiles` session-scoped and interactive-only for this feature.
- Block delete for default and active running-session profiles.
- Add focused tests with temp `OPENCODE_HOME`, fake `opencode models`, and prompt injection rather than relying on local user config.
- Run targeted validation after each slice and broader OpenKit verification before handoff to Code Reviewer/QA.

Minimum handoff evidence expected from Fullstack:

- Changed file list grouped by slice.
- Test output for targeted new tests.
- Regression output for `tests/cli/configure-agent-models.test.js` and relevant launcher/runtime tests.
- Install-bundle verification output if command docs are added.
- Explicit note that target-project app validation is unavailable for this OpenKit feature.
