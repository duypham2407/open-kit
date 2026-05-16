# OpenKit OpenCode Discovery Layer Fix — Design Spec

- **Date**: 2026-05-16
- **Author**: Brainstormed via `superpowers:brainstorming`
- **Status**: Draft — pending user approval
- **Severity**: P0 — slash commands of OpenKit (`/delivery`, `/quick-task`, `/migrate`, ...) are not discoverable by OpenCode after the v0.9.0 source-tree reorganization
- **Versions affected**: 0.9.0, 0.9.1, 0.9.2 (target fix: 0.9.3)
- **Surfaces validated**: `global_cli`, `runtime_tooling`, `package`
- **Related commits**: `9300101 refactor: consolidate all source under /src`, `0774686 release: v0.9.0 - Structure reorganization`

## 1. Problem Statement

When the user runs `openkit run` after installing OpenKit v0.9.x globally, OpenCode launches but **none of the OpenKit slash commands appear** in the autocomplete:

- `/quick-task`, `/migrate`, `/delivery`, `/write-solution`, `/execute-solution`
- `/switch-profiles`, `/switch`, `/configure-agent-models`
- `/finish` (lane-completion command introduced in v0.7.0)

The MCP `openkit` server still runs (because its command path in `opencode.json` is absolute), and other built-in OpenCode/Anthropic features work. Only the kit-shipped slash commands and the kit's agents/skills are missing from OpenCode's view.

## 2. Root Cause

OpenCode discovers slash commands, agent definitions, and skills by **directory convention** at the root of `OPENCODE_CONFIG_DIR`:

```text
OPENCODE_CONFIG_DIR/
  ├── opencode.json
  ├── commands/*.md   ← slash commands
  ├── agents/*.md     ← agent definitions
  └── skills/<name>/SKILL.md
```

The OpenKit launcher (`src/global/launcher.js:673`) sets `OPENCODE_CONFIG_DIR = <kitRoot>` where `<kitRoot> = <OPENCODE_HOME>/kits/openkit`.

Before the v0.9.0 reorg, source files lived at the repo root (`commands/`, `agents/`, ...) and `materializeGlobalInstall` (`src/global/materialize.js`) copied them 1-1 into `<kitRoot>/commands/`, `<kitRoot>/agents/`, ... — matching OpenCode's discovery convention.

After v0.9.0, source files moved to `src/commands/`, `src/agents/`, ... and `GLOBAL_KIT_ASSETS` was updated to include the `src/` prefix (`materialize.js:27-51`). However the copy loop (`materialize.js:213`) does:

```js
copyAsset(path.join(PACKAGE_ROOT, relativeAsset), path.join(paths.kitRoot, relativeAsset));
```

This preserves the `src/` prefix at the destination, producing `<kitRoot>/src/commands/`, `<kitRoot>/src/agents/`, ... — directories **not scanned by OpenCode**.

### 2.1. Verified evidence on a real materialized kit

```text
/Users/<user>/.config/opencode/kits/openkit/
├── opencode.json                            ✓ present
├── commands/                                ✗ MISSING
├── agents/                                  ✗ MISSING
├── skills/                                  ✗ MISSING
└── src/
    ├── commands/delivery.md, quick-task.md, ...   ← copied here instead
    ├── agents/master-orchestrator.md, ...
    └── assets/install-bundle/opencode/
        ├── commands/   ← curated public surface (8 files, ready for OpenCode)
        ├── agents/     ← PascalCase filenames per OpenCode convention
        └── skills/
```

### 2.2. Downstream consumer-code drift

Audit reveals that *only* `materialize.js` was updated to keep the `src/` prefix at the destination. Many consumer modules still reference the **pre-reorg layout** (`<kitRoot>/hooks/`, `<kitRoot>/skills/`, `<kitRoot>/context/`):

- `src/hooks/session-start.js:237-242`
- `src/openkit-runtime/lib/workflow-state-controller.js:3846-3848, 3899-3901`
- `src/runtime/commands/builtin-commands.js:3-10`
- `src/audit/vietnamese-detection.js:13-14`
- `src/hooks/hooks.json:7`

This is a system-wide inconsistency: the materialized kit has Layer B (`<kitRoot>/src/...`) but Layer A (`<kitRoot>/commands/...`) is missing, and many consumers expect Layer A semantics.

## 3. Architecture — 3-Layer Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Source layer (npm package + repo)                                   │
│   src/commands/, src/agents/, src/skills/, src/context/,           │
│   src/hooks/, src/openkit-runtime/, ...                             │
│   src/assets/install-bundle/opencode/{commands,agents,skills,context}/  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ materializeGlobalInstall
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Kit-root layer  (<OPENCODE_HOME>/kits/openkit/)                     │
│                                                                     │
│  Layer A  — PUBLIC, OpenCode auto-discovers                         │
│    <kitRoot>/commands/        ← from install-bundle (curated)      │
│    <kitRoot>/agents/          ← from install-bundle (PascalCase)   │
│    <kitRoot>/skills/          ← from install-bundle                │
│    <kitRoot>/context/         ← from install-bundle (lane-sel etc) │
│    <kitRoot>/opencode.json                                          │
│                                                                     │
│  Layer B  — INTERNAL, kit code/hooks/managers/CLI consume           │
│    <kitRoot>/src/...          ← 1-1 mirror of source tree          │
│    <kitRoot>/node_modules     ← symlink                             │
│    <kitRoot>/install-state.json, managed-files.json                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ ensureWorkspaceShim
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Project shim layer (<projectRoot>/.opencode/openkit/)               │
│   AGENTS.md → kit AGENTS.md (symlink)                               │
│   context → kit src/context                                         │
│   docs/templates → kit docs/templates                               │
│   workflow-state.json, workflow-state.js                            │
│   ⚠ DO NOT bridge commands/agents/skills (would dual-list)         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1. Consumer reference rules

| Consumer | Reads | Resolves via |
|---|---|---|
| OpenCode | slash commands, agents, skills | `<kitRoot>/{commands,agents,skills}/` (auto by convention) |
| `session-start.js`, hooks | skill catalog, internal scripts | `<kitRoot>/src/skills/`, `<kitRoot>/src/hooks/*.js` |
| `workflow-state-controller.js` (doctor) | context docs, skill docs | `<kitRoot>/src/context/...`, `<kitRoot>/src/skills/<n>/SKILL.md` |
| `workspace-shim.js` | bridge files | `<kitRoot>/src/context`, `<kitRoot>/AGENTS.md` |
| `command-loader.js` runtime | project-local commands | `<projectRoot>/commands/` (unchanged, user-facing convention) |

## 4. Components & Files to Change

### Theme A — Materialize fix (CORE)

| Pri | File:Line | Change |
|---|---|---|
| P0 | `src/global/materialize.js:27-51` | Convert `GLOBAL_KIT_ASSETS` to `{ source, target }` shape for clarity. |
| P0 | `src/global/materialize.js` (new fn) | `stageOpenCodeDiscoveryLayer(kitRoot, packageRoot)` copies `src/assets/install-bundle/opencode/{commands,agents,skills,context}/*` → `<kitRoot>/{commands,agents,skills,context}/`. Called after Layer B copy, before commit. |
| P0 | `src/global/materialize.js` (new fn) | `validateMaterializedKitLayout(kitRoot)`: assert Layer A present (≥ 8 commands, ≥ 7 agents, ≥ 1 skill, opencode.json) and Layer B present (workflow-state.js, session-start.js). Throw `MaterializationError` if any missing. Called after stage, before commit. |
| P0 | `src/global/materialize.js:237` | SessionStart hook path keeps `<kitRoot>/src/hooks/session-start.js` (Layer B internal). Hooks are NOT part of Layer A — OpenCode does not discover them by convention. |
| P0 | `src/global/ensure-install.js` (new fn) | `detectKitLayoutDrift(kitRoot)` returns boolean; checks Layer A presence. When `true`, `ensureGlobalInstall` triggers action `repaired-layout`: re-runs `stageOpenCodeDiscoveryLayer + validateMaterializedKitLayout` without re-copying Layer B (cheap, no full re-materialize). Surfaces to caller as `{ action: 'repaired-layout', repaired: { commands, agents, skills, context } }`. |
| P0 | `src/cli/commands/run.js:119-127` | Add display block mirroring `action === 'repaired-tooling'` for `action === 'repaired-layout'`: "OpenKit detected missing OpenCode discovery layer and repaired it automatically." |

### Theme B — Install-bundle / asset-manifest expansion

| Pri | File:Line | Change |
|---|---|---|
| P0 | `src/install/asset-manifest.js:9-244` | Add to `OPENKIT_OPENCODE_BUNDLED_ASSETS`: `finish.md`, `handoff.md`, `start-work.md`. |
| P1 | same | Add `internalOnly: true` metadata + rationale for excluded commands (`browser-verify.md`, `configure-embedding.md`, `init-deep.md`, `refactor.md`, `stop-continuation.md`). |
| P0 | `src/install/asset-manifest.js:335` | Extend `validateBundledAssetFiles` to return new field `sourceCommandsMissingFromBundle`. |
| P0 | (run) `npm run sync:install-bundle` | Mirror the newly-listed commands into `src/assets/install-bundle/opencode/commands/`. |

### Theme C — Consumer path normalization

| Pri | File:Line | Before | After |
|---|---|---|---|
| P0 | `src/hooks/session-start.js:237-242` | `<kitRoot>/skills/...`, `<kitRoot>/hooks/graph-indexer.js`, `<kitRoot>/context/...` | `<kitRoot>/src/skills/...`, `<kitRoot>/src/hooks/graph-indexer.js`, `<kitRoot>/src/context/...` |
| P0 | `src/openkit-runtime/lib/workflow-state-controller.js:3846-3848, 3899-3901` | `<kitRoot>/hooks/...`, `<kitRoot>/skills/using-skills/SKILL.md` | `<kitRoot>/src/hooks/...`, `<kitRoot>/src/skills/using-skills/SKILL.md` |
| P0 | `src/global/workspace-shim.js:163` | `path.join(paths.kitRoot, 'src', 'context')` | **keep as-is** (already correct Layer B) |
| P1 | `src/runtime/commands/builtin-commands.js:3-10` | `path: 'commands/<file>.md'` | `path: 'src/commands/<file>.md'` OR resolve via `<kitRoot>/src/commands/` |
| P1 | `src/global/doctor.js:55,155` | already uses `kitRoot/src/...` | **keep** (correct Layer B) |
| P2 | `src/audit/vietnamese-detection.js:13-14` | `['skills/','agents/','commands/']` | `['src/skills/','src/agents/','src/commands/']` |
| P2 | `src/hooks/hooks.json:7` | `${OPENCODE_PLUGIN_ROOT}/hooks/session-start` | `${OPENCODE_PLUGIN_ROOT}/src/hooks/session-start.js` |

### Theme D — Install-manifest cleanup

| Pri | File:Line | Before | After |
|---|---|---|---|
| P1 | `src/openkit-runtime/install-manifest.json:21` | `"repositoryInternalRuntime": ".opencode/opencode.json"` | `"repositoryInternalRuntime": "src/openkit-runtime/opencode.json"` |
| P1 | `:22-26` | `wrapperFacingMetadata: [".opencode/install-manifest.json", "assets/install-bundle/.../skill-catalog.json"]` | `["src/openkit-runtime/install-manifest.json", "src/assets/install-bundle/opencode/skill-catalog.json"]` |
| P1 | `:29` | `"currentRuntimeManifest": ".opencode/opencode.json"` | `"currentRuntimeManifest": "src/openkit-runtime/opencode.json"` |

### Theme E — Test updates

| Pri | File | Change |
|---|---|---|
| P0 | `src/tests/runtime/registry-metadata.test.js:71` | Update assertion to assert `src/assets/install-bundle/...` (currently masks Theme D bug) |
| P1 | `src/tests/install/materialize.test.js:52,108,155` | Update fixture or assertion to absolute path of `bin/openkit-mcp.js` |
| P1 | `src/tests/install/merge-policy.test.js`, `doctor.test.js` | Same fixture drift |
| P0 NEW | `src/tests/install/materialize-global.test.js` | Assert Layer A presence after `materializeGlobalInstall` |
| P0 NEW | `src/tests/install/asset-manifest-coverage.test.js` | Assert every `src/commands/*.md` either bundled or `internalOnly` |
| P1 NEW | `src/tests/install/validate-materialized-kit-layout.test.js` | Unit test for the new validator |
| P1 NEW | `src/tests/cli/launcher-config-dir.test.js` | Assert `OPENCODE_CONFIG_DIR` dir has `commands/agents/skills/` at root |
| P1 NEW | `src/tests/install/workspace-shim-no-command-bridge.test.js` | Assert shim does NOT create `commands/` under project-shim |
| P1 NEW | `src/tests/runtime/doctor-discovery-layer.test.js` | Assert doctor catches missing Layer A |

### Theme F — Doctor & verify scripts

| Pri | File | Change |
|---|---|---|
| P1 | `src/global/doctor.js` (or `src/runtime/doctor.js`) | Add checks: `<kitRoot>/commands/`, `<kitRoot>/agents/`, `<kitRoot>/skills/` exist and non-empty. Surface: `runtime_tooling`. NextStep: `openkit upgrade`. |
| P1 | `package.json` scripts | Add `verify:materialized-layout` and `verify:install-bundle-coverage`. Add both to `verify:all`. |

## 5. Materialize Flow (Post-Fix)

```text
openkit run / openkit install --verify
        │
        ▼
ensureGlobalInstall(projectRoot, env)
        │
        ▼
materializeGlobalInstall({ env, kitVersion })
        │
        ├─[Lock]─ acquireExclusiveLock                                     (existing)
        ├─[Backup]─ backupIfPresent(kitRoot, profilesRoot)                 (existing)
        │
        ├─[Layer B copy]─ for {source,target} of GLOBAL_KIT_ASSETS:
        │       copyAsset(PACKAGE_ROOT/source, kitRoot/target)
        │
        ├─[Layer A stage]─ stageOpenCodeDiscoveryLayer(kitRoot, PACKAGE_ROOT):
        │       for class of ['commands','agents','skills','context']:
        │           if exists PACKAGE_ROOT/src/assets/install-bundle/opencode/<class>:
        │               fs.cpSync(..., kitRoot/<class>, { recursive: true })
        │
        ├─[Config]─ createOpenCodeConfig → write kitRoot/opencode.json
        ├─[State, Hooks, Profile, Tooling]                                  (existing)
        │
        ├─[Validate]─ validateMaterializedKitLayout(kitRoot):
        │       throw MaterializationError if missing Layer A or Layer B
        │
        └─[Commit/Rollback]─ commit on success, rollback on throw
```

## 6. Runtime Discovery Flow (No OpenKit Code Change)

```text
openkit run
  └─ launchGlobalOpenKit
      ├─ ensureWorkspaceBootstrap
      ├─ bootstrapRuntimeFoundation(env)
      └─ spawn 'opencode' with:
           OPENCODE_CONFIG_DIR  = kitRoot
           OPENKIT_KIT_ROOT     = kitRoot
           OPENKIT_SESSION_ID   = s_<6hex>
                  │
                  ▼
          OpenCode startup
            ├─ read kitRoot/opencode.json
            ├─ scan kitRoot/commands/*.md      ← Layer A
            ├─ scan kitRoot/agents/*.md        ← Layer A
            ├─ scan kitRoot/skills/<n>/SKILL.md ← Layer A
            └─ MCP openkit via absolute path  ← Layer B
```

## 7. Error Handling & Guards

| Failure mode | Detection | Behaviour |
|---|---|---|
| Bundle source missing from npm package | `validateMaterializedKitLayout` | Throw `MaterializationError('bundle source not in package')`, rollback. CI catches via `verify:install-bundle`. |
| Layer A dir created but empty | `validateMaterializedKitLayout` | Throw same; hint `npm run sync:install-bundle`. |
| Partial Layer B copy (disk full, EACCES) | existing try/catch → `rollbackBackup` | User sees stderr, state restored. |
| Concurrent materialize | `acquireExclusiveLock` (existing) | Second caller gets `concurrent-install-detected` conflict. |
| Stale cache on existing v0.9.0/.1/.2 install | `backupIfPresent + recreate` (existing) + drift detector in `ensureGlobalInstall` | Auto-repair on next `openkit run` or `openkit upgrade`. |
| OpenCode running while materialize | OpenCode reads files at startup; not affected | Doctor advises restart of `openkit run` to pick up new commands. |

## 8. Backward Compatibility

| Scenario | Behaviour |
|---|---|
| Fresh install (v0.9.3 first time) | Layer A + Layer B both present. ✓ |
| Upgrade from v0.9.0/.1/.2 broken | `openkit upgrade` triggers re-materialize → Layer A appears. ✓ |
| User runs only `openkit run` (no upgrade) | Drift detector in `ensureGlobalInstall` triggers `repaired-layout` action; user sees note "OpenKit detected missing OpenCode discovery layer and repaired it automatically." |
| User has project-local `.opencode/` from older version | Untouched; fix only operates on kit-root. |
| User has custom `<projectRoot>/commands/` | Untouched; OpenCode native project-local discovery still works. |

## 9. Testing Strategy

### 9.1. Pyramid

```text
                       ┌──────────────────────┐
                       │  E2E manual smoke    │   1 case
                       └──────────────────────┘
                ┌──────────────────────────────────────┐
                │  Integration (materialize-global)    │   3 cases
                └──────────────────────────────────────┘
        ┌──────────────────────────────────────────────────────┐
        │  Unit + invariant (validate + manifest coverage)     │   ~6 cases
        └──────────────────────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────────────┐
   │  Existing tests (registry, doctor, materialize) — updated      │
   └────────────────────────────────────────────────────────────────┘
```

### 9.2. New test files

See Theme E. Six new test files, each covering ≤ 5 cases.

### 9.3. Manual smoke (acceptance criterion)

```bash
rm -rf "$HOME/.config/opencode/kits/openkit"
node src/bin/openkit.js install --verify
ls "$HOME/.config/opencode/kits/openkit/commands/" | grep -E '(delivery|quick-task|migrate|finish)\.md'
ls "$HOME/.config/opencode/kits/openkit/agents/" | grep -E '(MasterOrchestrator|QuickAgent)\.md'
node src/bin/openkit.js run
# Inside session: type "/" → autocomplete must show /delivery, /quick-task, /migrate, /finish,
#                                              /write-solution, /execute-solution, /switch-profiles, /configure-agent-models
```

### 9.4. Verify scripts (CI gate)

```json
{
  "scripts": {
    "verify:materialized-layout": "node --test src/tests/install/materialize-global.test.js src/tests/install/validate-materialized-kit-layout.test.js src/tests/install/workspace-shim-no-command-bridge.test.js",
    "verify:install-bundle-coverage": "node --test src/tests/install/asset-manifest-coverage.test.js",
    "verify:all": "... && npm run verify:materialized-layout && npm run verify:install-bundle-coverage && ..."
  }
}
```

## 10. Rollout Plan

```text
PR #1 (P0 core fix)
  ├─ Theme A: materialize.js + stageOpenCodeDiscoveryLayer + validateMaterializedKitLayout
  ├─ Theme B (P0): asset-manifest expand + sync-install-bundle
  ├─ Theme C (P0): session-start.js + workflow-state-controller.js path normalize
  ├─ Theme E (P0): new tests + update registry-metadata test
  └─ CI: verify:all + verify:materialized-layout must pass

PR #2 (P1 cleanup; same release window)
  ├─ Theme C (P1): builtin-commands.js, doctor.js paths review
  ├─ Theme D: install-manifest.json path keys
  ├─ Theme E (P1): fixture updates in materialize.test.js / merge-policy.test.js
  └─ Theme F: doctor checks + verify scripts

PR #3 (P2 follow-up; does not block release)
  ├─ vietnamese-detection.js prefixes
  └─ hooks/hooks.json template

Release v0.9.3
  ├─ npm run sync:version → bump 0.9.3
  ├─ openkit release prepare 0.9.3 --summary "Restore slash command discovery post v0.9.0 reorg"
  ├─ openkit release verify  (full verify:all incl new tests)
  ├─ Manual smoke (9.3)
  └─ openkit release publish

Post-release
  ├─ release-notes/0.9.3.md: bug summary + remediation + user action (`openkit upgrade`)
  └─ README upgrade section pins v0.9.3
```

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenCode changes discovery convention | Low | High | Doctor check; pin tested opencode version in prereqs |
| User custom-adds files to `<kitRoot>/commands/` | Low | Medium | Materialize overwrites (kit root is managed); docs note this; `__OPENKIT_MANAGED__` marker possible |
| Concurrent `openkit install` race | Low (existing lock) | Low | Existing `acquireExclusiveLock` |
| Validation gate fails on fresh fs | Low | Medium | E2E test in CI; manual smoke before publish |
| Existing v0.9.0/.1/.2 users don't upgrade | Medium | High | Drift detector auto-repair; prominent release notes |
| Hidden test fixture masks new bug | Low | Low | `asset-manifest-coverage` test bakes the invariant |

## 12. Rollback Plan

If v0.9.3 ships and a regression surfaces:

1. `npm dist-tag add @duypham93/openkit@0.9.2 latest` (re-pin previous version).
2. Maintainer prepares `0.9.4` with the offending commit reverted.
3. Because `materializeGlobalInstall` already has backup/rollback semantics, users upgrading to 0.9.3 then downgrading remain safe.

## 13. Out of Scope

- Renaming kit-internal source layout (Layer B remains `<kitRoot>/src/...`).
- Changing OpenCode itself or its discovery convention.
- Re-introducing project-local command bridging through workspace-shim.
- Resolving CLAUDE.md / README documentation refresh for v0.9.3 — handled separately in release notes.

## 14. Acceptance Criteria

1. After `openkit install --verify` on a clean machine, `<kitRoot>/commands/`, `<kitRoot>/agents/`, `<kitRoot>/skills/` exist and contain at least the bundled curation.
2. `openkit run` launches OpenCode, and typing `/` shows `/delivery`, `/quick-task`, `/migrate`, `/finish`, `/write-solution`, `/execute-solution`, `/switch-profiles`, `/configure-agent-models` in autocomplete.
3. `openkit doctor` PASS for `kit-discovery-layer.commands/agents/skills` checks.
4. `npm run verify:all` (including new suites) PASS in CI.
5. Existing tests pass without disabling assertions.
6. `release-notes/0.9.3.md` documents the bug, fix, and user upgrade action.

## 15. Open Questions

- Should `/handoff`, `/start-work`, `/init-deep`, `/refactor`, `/stop-continuation` be public surface? (Spec marks `/finish`, `/handoff`, `/start-work` as public per docs; others marked `internalOnly`.)
- Does OpenCode have a future config field for custom commands directory? If so, Hướng C may become preferable in a later version; out-of-scope for this fix.
