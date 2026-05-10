## [Subagent 2] — Install / CLI / Distribution

### Critical

- [2-C-1] Version metadata out of sync between package.json, registry.json, and install-manifest.json — `src/openkit-runtime/install-manifest.json:6`, `registry.json:6`, `package.json:3`
  - Description: `package.json` declares version `"0.5.1"` while both `registry.json` and `src/openkit-runtime/install-manifest.json` still declare `"0.3.36"`. The `verifyReleaseMetadata` function in `src/release/workflow.js:178` throws `"Version metadata is out of sync"` if these disagree. `updateVersionMetadata` (line 107) performs string-replace of the *current* version across all files — meaning it will replace `"0.5.1"` in files that contain `"0.3.36"`, silently leaving them at the old value. Net effect: `openkit release verify` and `openkit release publish` hard-fail at metadata check, blocking npm publish.
  - Evidence: `registry.json:6`: `"version": "0.3.36"`. `install-manifest.json:6`: `"version": "0.3.36"`. `package.json:3`: `"version": "0.5.1"`.
  - Suggested fix: run `openkit release prepare 0.5.1` (or manually update kit.version in both files to `0.5.1`).

### High

- [2-H-1] Upgrade is non-atomic: destroying kit root before re-copying leaves an irreversible broken state on interruption — `src/global/materialize.js:165-172`
  - Description: `materializeGlobalInstall` calls `removePathIfPresent(paths.kitRoot)` (line 165) to delete the entire installed kit, then immediately begins copying assets in a loop. There is no temp-directory rename, no backup, no rollback if the process is killed, crashes, or hits a permission error mid-copy. A user whose `openkit upgrade` dies partway through is left with an empty `kitRoot`, making OpenKit completely inoperable until they reinstall the npm package.
  - Evidence: lines 165-172: `removePathIfPresent(paths.kitRoot)` then `for (const relativeAsset of GLOBAL_KIT_ASSETS) { copyAsset(...) }`.
  - Suggested fix: copy to sibling temp dir first, then atomic rename over existing `kitRoot`.

- [2-H-2] Doctor reports `canRunCleanly: true` while runtime sub-checks may show failures (false green) — `src/global/doctor.js:208-225`
  - Description: `runtimeDoctor` object (workflow, capabilities, background, mcp, models) is computed at lines 208-219, but its individual sub-check results are never inspected nor pushed into the `issues` array. `canRunCleanly` at line 225 is derived solely from `issues.length === 0`. A broken workflow state, unhealthy MCP setup, or degraded capability still produces `canRunCleanly: true` and exit code 0.
  - Evidence: lines 208-221 show `runtimeDoctor = { workflow: ..., ... }` with no `if (runtimeDoctor.workflow.status !== 'healthy') issues.push(...)` guard.
  - Suggested fix: add post-assignment checks pushing status-based entries from each sub-check into `issues` before computing `canRunCleanly`.

- [2-H-3] `mergeUniqueArray` uses `Object.is()` (reference equality) for object items, causing duplicate entries on repeated installs — `src/install/merge-policy.js:32`
  - Description: Dedup guard `!merged.some((existing) => Object.is(existing, item))` compares by reference. Two structurally identical objects (e.g., from two separate JSON parses of the same `instructions` or `plugin` array) are never considered equal. Each re-install appends new copies of every object-type array item. Currently latent (template has no array-valued allowlisted keys) but any future template with `instructions`/`plugin`/`permission` as arrays would accumulate duplicates indefinitely.
  - Evidence: `node -e` test confirms duplicates of `{type:'dir',path:'instructions/core'}` produce length 2.
  - Suggested fix: replace `Object.is` with deep-equality (e.g., `JSON.stringify`-based) for object/array items.

- [2-H-4] Upgrade command has no error handling: exceptions from `materializeGlobalInstall` crash the CLI — `src/cli/commands/upgrade.js:20`
  - Description: `upgradeCommand.run` calls `materializeGlobalInstall({ env: process.env })` with no try/catch. Any failure (permissions, disk full, missing source) produces an uncaught exception. Combined with [2-H-1], the partially-deleted state is unrecoverable.
  - Evidence: lines 14-31 contain no `try`/`catch`. The `install` command does catch tooling failures.
  - Suggested fix: wrap `materializeGlobalInstall` in try/catch in upgrade command; emit user-facing error before exit code 1.

### Medium

- [2-M-1] `install` command prints "Installed OpenKit globally" before installation runs — `src/cli/commands/install.js:71`
  - Description: Line 71 emits success message to stdout before `deps.materialize(...)` is called on line 73. If materialize throws, the user has already seen success.
  - Suggested fix: move the success message to after `materializeGlobalInstall` returns.

- [2-M-2] `GLOBAL_KIT_ASSETS` contains two duplicate entries causing redundant copies — `src/global/materialize.js:22,25,37,42`
  - Description: `'bin'` appears at lines 22 and 25; `'src/mcp-server'` at lines 37 and 42. Each directory copied twice per upgrade. `fs.cpSync` tolerates this, but it's wasteful and indicates copy/paste error.
  - Suggested fix: deduplicate the array.

- [2-M-3] `src/install/runtime-migration.js` is a no-op stub never imported — `src/install/runtime-migration.js:1-6`
  - Description: Exported `migrateRuntimeConfig` returns `{ migrated: true, config }` without performing migration. Real migration lives in `src/runtime/runtime-config-loader.js` under a different local function of the same name. `grep -rn "from.*runtime-migration"` finds zero importers.
  - Suggested fix: remove the file or replace with proper export consumed by `runtime-config-loader.js`.

- [2-M-4] `validateBundledAssetFiles`'s `collectFiles` follows symlinks without cycle guard — `src/install/asset-manifest.js:436-447`
  - Description: Recursive `collectFiles` uses `fs.readdirSync` and descends into any `entry.isDirectory()`. No `entry.isSymbolicLink()` check first; a circular symlink inside `assets/install-bundle/opencode/` would trigger an infinite loop.
  - Suggested fix: add `!entry.isSymbolicLink()` guard before recursing.

- [2-M-5] `verify-install-bundle.mjs` does not verify bundled assets appear in npm package — `scripts/verify-install-bundle.mjs`
  - Description: Script checks source-vs-bundle parity and skill catalog consistency, but does not confirm `assets/install-bundle/` is covered by `package.json#files`. Future bundle-output relocation would silently miss the published package.
  - Suggested fix: add a check cross-referencing bundled paths against `pkg.files` or the `npm pack --dry-run` output that `verify-mcp-secret-package-readiness.mjs` produces.

- [2-M-6] TOCTOU: two concurrent `materializeInstall` processes can both observe missing state and both write — `src/install/materialize.js:55-110`
  - Description: `readExistingJson(installStatePath)` (line 55) and `hasExistingInstallState` guard at line 88 are not protected by any file lock. Two parallel `openkit install` invocations can both pass the guard and both write `installStatePath`/`rootManifestPath`; second write silently overwrites the first.
  - Suggested fix: use exclusive file-lock (e.g., write `.lock` with `O_EXCL`) before state-check/write sequence.

### Low

- [2-L-1] Stale `"version": "0.3.36"` ships in published package — `src/openkit-runtime/install-manifest.json:6`
  - Description: Beyond blocking release flow (C-1), the stale version misleads any tooling reading this for compatibility.

- [2-L-2] `runtime-profile-materializer.js` writes to `targetPath` without project-root validation — `src/install/runtime-profile-materializer.js:4-8`
  - Description: All current callers supply safe paths but no bounds check.

- [2-L-3] `src/bin/openkit-mcp.js` has no error handling at startup — `src/bin/openkit-mcp.js:9`
  - Description: Single `import '../src/mcp-server/index.js'` with no try/catch. If MCP server crashes at startup, OpenCode receives silent stdio disconnect with no diagnostic.

### Notes

- Directories read:
  - `src/install/` (all 8 files)
  - `bin/` (both files)
  - `scripts/` (all 4 files)
  - `package.json`, `src/openkit-runtime/install-manifest.json`, `registry.json`
  - `src/cli/commands/doctor.js`, `upgrade.js`, `install.js`, `install-global.js`
  - `src/global/doctor.js`, `materialize.js`, `paths.js`
  - `src/cli/index.js`, `src/release/workflow.js`
  - `src/opencode/config-schema.js`, `assets/opencode.json.template`

- Directories skipped (with reason):
  - `src/openkit-runtime/lib/`, `src/runtime/`, `src/mcp-server/`, `src/agents/`, `src/commands/`, `src/skills/` — out of scope per instructions

- Open questions for main agent:
  1. Was version drift `0.3.36 → 0.5.1` intentional (release workflow partially run)? Or was `prepare` skipped? Determines whether C-1 is process or tooling bug.
  2. Should `runtimeDoctor` sub-check failures elevate `canRunCleanly: false`? Currently summary-only.
  3. `mergeUniqueArray Object.is` issue (H-3) is latent. Near-term plan to add array allowlists to install template?
