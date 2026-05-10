---
title: OpenKit Project Audit Report
date: 2026-05-09
baseline_commit: 619b7c8
spec: docs/superpowers/specs/2026-05-09-project-audit-design.md
status: awaiting user review
package_version_audited: 0.5.1
---

# OpenKit Project Audit Report

## Executive summary

| Priority | Count | Per subagent (S1/S2/S3/S4) | Cross-layer |
|----------|------:|:---------------------------|:------------|
| Critical | 4     | 2 / 0 / 0 / 1              | 1 duplicate (D-1, raised from S2 Critical + S3 High) |
| High     | 14    | 3 / 4 / 2 / 5              | 0 |
| Medium   | 21    | 5 / 6 / 5 / 5              | 1 (X-1) |
| Low      | 13    | 4 / 2 / 3 / 3              | 1 (X-2) |
| **Total**| **52**| —                          | **2 new** |

**Post-audit findings (added during Wave 1 execution)**:

| Priority | Count | Source |
|----------|------:|--------|
| Critical | 0 | — |
| High     | 1 | [N-1] discovered while investigating skipped baseline failure |

The audit's read-only subagents could not execute CLI/test code, so 5 pre-existing test failures and 1 macOS-only CLI bug were initially missed. Four were repaired as Wave 0 baseline cleanup; the fifth ([N-1] below) was deeper than a quick fix and is queued for Wave 2.

(One additional Subagent 3 finding, [3-L-2], was a clean "no action" observation and is excluded from the count above.)

### Top concerns
The audit surfaces three clusters of risk. **Cluster 1 — duplicated runtime contracts**: two FSM transition tables ([1-C-1]) and two parallel gate systems ([1-H-2]) both live on the `advance-stage` path, producing silent rejections that look like bugs to the caller; these are runtime-correctness Criticals. **Cluster 2 — release blocker + supply-chain shape**: `registry.json` and the install manifest still carry `0.3.36` while `package.json` is `0.5.1` ([D-1]), which the release `verifyReleaseMetadata` check will reject; the upgrade flow is also non-atomic and leaves an empty kit-root if interrupted ([2-H-1]). **Cluster 3 — security boundary at config-loaded commands**: `ast-grep-search` joins user input into a shell string ([4-C-1]), and three further config/env-driven RCE or arbitrary-read paths exist for operators who run OpenKit against untrusted target projects ([4-H-1], [4-H-2], [4-H-3], [4-H-4]). All three clusters are addressable independently.

## Methodology

- **Spec:** `docs/superpowers/specs/2026-05-09-project-audit-design.md`
- **Approach:** four parallel subagents (§2) — Runtime + Workflow Core, Install/CLI/Distribution, Contract Layer, and Cross-cutting (security, supply chain, coverage) — followed by main-agent dedupe and five cross-layer drift checks (§3.2).
- **Verification:** Critical 100% (every cited file:line re-read by main agent), High spot-check 5/14 picked deterministically (every 3rd finding by merged-list order). All 5 spot-checks passed; no subagent re-dispatch was triggered (§3.3).
- **Baseline commit:** `619b7c8` (working tree was clean before audit started).
- **Working artefacts:** the four sub-reports and the merged-findings document are preserved under `docs/superpowers/specs/_audit-2026-05-09/` for reproducibility.

### Verification record
| ID    | Status | Note |
|-------|--------|------|
| 1-C-1 | ✓ verified | 5 of the 6 transition divergences claimed by Subagent 1 confirmed; one was a counting nit, root cause unchanged. |
| 1-C-2 | ✓ verified | MCP schema/handler mismatch confirmed verbatim. |
| 4-C-1 | ✓ verified | `args.join(' ')` passed to `execSync` confirmed at line 63. |
| D-1   | ✓ verified | `package.json` 0.5.1 vs `registry.json` 0.3.36 vs install-manifest 0.3.36 confirmed. |
| 1-H-1, 2-H-1, 2-H-4, 3-H-3, 4-H-3 | ✓ verified | spot-check 5/14, all passed. |

## Cross-layer findings

The main agent ran five drift checks the subagents could not run individually.

- **[X-1] Medium** — `CHANGELOG.md` and `RELEASES.md` are not declared in `package.json#files` and `npm pack --dry-run` confirms neither is shipped in the published tarball. `RELEASES.md` is the canonical pointer to per-version release notes that the README references for upgrade flow; users running `npm view` cannot see it without going to GitHub.
  - File: `package.json:18-44` (the `files` array)
  - Suggested fix: add `"CHANGELOG.md"` and `"RELEASES.md"` (and consider `release-notes/`) to `package.json#files`.

- **[X-2] Low** — There is no test that asserts the two FSM tables (`src/runtime/workflow/state-machine.js` and `src/runtime/state/transition-engine.js`) agree. A regression test of the form "for every mode, `state-machine[mode]` deep-equals `transition-engine[mode]`" would have caught `[1-C-1]`.
  - Suggested fix: add `src/tests/runtime/fsm-table-consistency.test.js` that imports both modules and asserts deep-equal of their per-mode transition maps.

The other three checks were clean: stages in `registry.json` match the FSM `STAGE_ORDER`; agents do not reference any `skill.<id>` that is missing from the registry; all 27 entries in `package.json#files` exist on disk and the install-manifest's `wrapperFacingMetadata` is a subset of `pkg.files`. Version drift between `package.json` and `registry.json`/`install-manifest.json` is captured under `[D-1]`.

## Critical

### [D-1] Version drift: package.json 0.5.1 vs registry.json/install-manifest.json 0.3.36
- **Location:** `package.json:3`, `registry.json:6`, `src/openkit-runtime/install-manifest.json:6`
- **Source:** Subagent 2 [2-C-1] (Critical) + Subagent 3 [3-H-1] (High) + Subagent 2 [2-L-1]; merged.
- **Description:** `package.json` declares `0.5.1`. Both `registry.json#kit.version` and `src/openkit-runtime/install-manifest.json#kit.version` are still `0.3.36`. `verifyReleaseMetadata` in `src/release/workflow.js:178` throws "Version metadata is out of sync" if these disagree, blocking `openkit release verify`/`publish`. `updateVersionMetadata` (line 107) string-replaces the *current* value, so it cannot self-heal: it would replace `0.5.1` in files that contain `0.3.36`, leaving them unchanged.
- **Evidence:** `package.json:3` "version": "0.5.1"; `registry.json:6` "version": "0.3.36"; `src/openkit-runtime/install-manifest.json:6` "version": "0.3.36" — all three confirmed by `node -e "console.log(require(...).version)"`.
- **Suggested fix:** run `openkit release prepare 0.5.1`, or manually update the kit.version field in both files to `0.5.1`.

### [1-C-1] Two divergent FSM transition tables
- **Location:** `src/runtime/workflow/state-machine.js:29-57` vs `src/runtime/state/transition-engine.js:37-65`
- **Source:** Subagent 1.
- **Description:** `tool.advance-stage` (`src/runtime/tools/workflow/advance-stage.js`) calls `isValidTransition` from `state-machine.js` for the FSM check, but `workflowKernel.advanceStage()` re-validates inside `WorkflowStateManager.advanceStage()` which uses `TransitionEngine` from `transition-engine.js`. The two tables disagree on five `full`/`migration` transitions, so a target the first table accepts may be rejected by the second, producing an unrecoverable "failed to persist" error visible to the model with no useful guidance.
- **Evidence (verified):**
  - `full_solution`: state-machine `[full_implementation]` vs transition-engine `[full_implementation, full_product]`
  - `full_code_review`: state-machine 4 targets vs transition-engine 2 targets
  - `full_qa`: state-machine 4 targets vs transition-engine 2 targets
  - `migration_strategy`: state-machine `[migration_upgrade]` vs transition-engine `[migration_upgrade, migration_baseline]`
  - `migration_code_review`: state-machine 3 targets vs transition-engine 2 targets
- **Suggested fix:** merge both tables into one authoritative source imported by both `advance-stage.js` and `WorkflowStateManager`.

### [1-C-2] tool.workflow-state MCP schema vs handler contract mismatch
- **Location:** `src/mcp-server/tool-schemas.js:297-310` vs `src/runtime/tools/workflow/workflow-state.js:23-48`
- **Source:** Subagent 1.
- **Description:** The MCP schema advertises `command: enum ['status', 'show', 'doctor', 'metrics']` as the only input. The handler ignores `command` entirely and reads `workItemId`. Any model calling `{ command: 'show' }` or `{ command: 'doctor' }` receives a null result with no error indication — a silent broken tool on the main workflow read path.
- **Evidence:** schema line 303-307 declares `command` enum; handler line 25 immediately checks `'workItemId' in normalizedInput` — `command` is never read.
- **Suggested fix:** either remove the `command` property from the schema and document `workItemId`, or implement `command` dispatch in the handler.

### [4-C-1] Command injection in ast-grep-search via args.join(' ')
- **Location:** `src/runtime/tools/ast/ast-grep-search.js:55-69`
- **Source:** Subagent 4.
- **Description:** The `execSync` call constructs a single shell string from `args.join(' ')` where `pattern` and `lang` are user-supplied. A crafted pattern such as `"foo" --output /dev/null; rm -rf /tmp` will be interpreted by the shell because the args array is collapsed to a single unescaped string before being handed to `execSync`.
- **Evidence:** lines 55-69 show `args = ['ast-grep', 'run', '--pattern', pattern, '--lang', lang, '--json', targetPath || projectRoot]` followed by `execSync(args.join(' '), {...})`.
- **Suggested fix:** replace `execSync(args.join(' '), ...)` with `spawnSync('ast-grep', args.slice(1), ...)` to pass argv as an array; this eliminates the shell entirely.

## High

### [1-H-1] safeCall in workflow-kernel.js swallows all controller throws
- **Location:** `src/runtime/workflow-kernel.js:150-155`
- **Description:** `function safeCall(fn, fallback) { try { return fn(); } catch { return fallback; } }`. All write operations (`startBackgroundRun`, `completeBackgroundRun`, `claimTask`, `setTaskStatus`) route through `safeCall(..., null)` and return `null` on failure, with no error surfaced. A SQLite lock, disk full, or malformed JSON in the controller produces a null return that callers treat as a no-op.
- **Suggested fix:** log the swallowed exception and propagate a structured error so handlers can surface the failure.

### [1-H-2] Two incompatible gate systems both live on advance-stage
- **Location:** `src/runtime/workflow/gate-requirements.js:8-58` vs `src/runtime/state/gate-registry.js:17-93`
- **Description:** `advance-stage.js` calls `checkGateRequirements` (gate-requirements) first, then `WorkflowStateManager.advanceStage` re-checks gates via `GateRegistry`. The two systems use different IDs (`'quick_intake→quick_plan'` vs `'quick.understanding_confirmed'`) and different persistence; a gate passed in one may still block in the other.
- **Suggested fix:** designate one as authoritative and remove or proxy the other. The `EVIDENCE_TO_GATE` map at `advance-stage.js:131-143` partially bridges them but does not fully reconcile.

### [1-H-3] tool.bootstrap-workflow registered in runtime but absent from MCP schema
- **Location:** `src/runtime/tools/tool-registry.js:68` vs `src/mcp-server/tool-schemas.js`
- **Description:** `createBootstrapWorkflowTool` is registered in the runtime but not in `TOOL_SCHEMAS`, so `src/mcp-server/index.js:149` filters it out (`if (!schema) continue`). The `MasterOrchestrator` role depends on this tool to start any lane; without an MCP entry it is unreachable.
- **Suggested fix:** add a `'tool.bootstrap-workflow'` entry to `TOOL_SCHEMAS` matching `{ lane, description, featureSlug?, archivePrior? }`.

### [2-H-1] Upgrade is non-atomic; mid-flight failure leaves empty kit-root
- **Location:** `src/global/materialize.js:165-172`
- **Description:** `materializeGlobalInstall` calls `removePathIfPresent(paths.kitRoot)` and `removePathIfPresent(paths.profilesRoot)` first, then `mkdirSync` and a copy loop. There is no temp-directory rename and no rollback if the process is killed, crashes, or hits a permission error mid-copy. A user whose `openkit upgrade` dies partway through has an empty `kitRoot` until they reinstall the npm package.
- **Suggested fix:** copy assets to a sibling temp dir first, then atomic-rename it over the existing `kitRoot`. Keep the previous `kitRoot` until the rename succeeds.

### [2-H-2] Doctor reports canRunCleanly: true even when runtime sub-checks fail
- **Location:** `src/global/doctor.js:208-225`
- **Description:** `runtimeDoctor` (workflow, capabilities, background, mcp, models) is computed but its sub-check results are never inspected nor pushed into `issues`. `canRunCleanly` is computed from `issues.length === 0` only. A broken workflow state still produces `canRunCleanly: true` and exit code 0.
- **Suggested fix:** add post-assignment checks that push status-based entries from each sub-check into `issues` before `canRunCleanly` is computed.

### [2-H-3] mergeUniqueArray uses Object.is() so object items dedupe by reference, not value
- **Location:** `src/install/merge-policy.js:32`
- **Description:** `!merged.some((existing) => Object.is(existing, item))` compares by reference. Two structurally identical objects (e.g., from two parses of the same `instructions` array) are never considered equal, so each re-install appends new copies. Currently latent because the install template has no array-valued allowlisted keys, but any future template with `instructions`/`plugin`/`permission` arrays will accumulate duplicates.
- **Suggested fix:** replace `Object.is` with deep-equality (e.g., `JSON.stringify`-based) for object/array items.

### [2-H-4] Upgrade command has no try/catch around materializeGlobalInstall
- **Location:** `src/cli/commands/upgrade.js:14-31`
- **Description:** `upgradeCommand.run` calls `materializeGlobalInstall({ env: process.env })` directly. Any failure (permissions, disk full, missing source) is uncaught; combined with [2-H-1], the partially-deleted state is unrecoverable from the user's perspective.
- **Suggested fix:** wrap `materializeGlobalInstall` in try/catch; emit a user-facing error via `io.stderr.write` before `return 1`.

### [3-H-2] commands/configure-embedding.md exists on disk but absent from registry.json
- **Location:** `src/commands/configure-embedding.md:1`; `registry.json` (no entry)
- **Description:** `registry.json` lists 14 commands; the 15th file (`configure-embedding.md`) is documented in `README.md:462-486` and present on disk but has no registry entry. Tooling that discovers commands via the registry will not surface `/configure-embedding`.
- **Suggested fix:** add an entry to `registry.json#components.commands` for `command.configure-embedding` with `"path": "commands/configure-embedding.md"`.

### [3-H-3] Agents reference tool.heuristic-lsp which is not registered
- **Location:** `src/agents/solution-lead-agent.md:51`, `src/agents/code-reviewer.md:76`
- **Description:** Both agents list `tool.heuristic-lsp` as a SHOULD/MAY tool. `registry.json` registers `tool.lsp-diagnostics` and `tool.lsp-symbols` but no `tool.heuristic-lsp`. Implementations under `src/runtime/tools/lsp/` do not match this name. Agents directing models to invoke this tool will either error out or be silently ignored.
- **Suggested fix:** replace `tool.heuristic-lsp` with the correct registered ID (`tool.lsp-symbols`, `tool.graph-find-references`, or `tool.graph-goto-definition`), or register it if intentionally implemented.

### [4-H-1] Config-driven RCE via supervisorDialogue.openclaw.command
- **Location:** `src/runtime/supervisor/openclaw-adapter.js:40`
- **Description:** The openclaw supervisor reads `command` and `args` from the user's runtime config (`src/openkit-runtime/openkit.json`) and `spawn`s them with no allowlist or path validation. A target project repo with a crafted `src/openkit-runtime/openkit.json` can execute arbitrary binaries when the operator runs OpenKit against it.
- **Suggested fix:** apply the `SHELL_OPERATORS`/`SHELL_LAUNCHERS` checks from `custom-mcp-validation.js` to `openclaw.command`; require an absolute path; reject shell metacharacters.

### [4-H-2] Config-driven RCE via external MCP stdio command
- **Location:** `src/runtime/mcp/dispatch.js:183`
- **Description:** `invokeStdioExternal` spawns `server.command` with `server.args` taken verbatim from `.mcp.json`/`src/openkit-runtime/mcp.json`. No validation. An attacker with write access to a target project's `.mcp.json` can achieve RCE when the operator runs `openkit run` against that project.
- **Suggested fix:** apply the same `SHELL_OPERATORS`/`SHELL_LAUNCHERS`/`SHELL_EXEC_FLAGS` checks already in `custom-mcp-validation.js` to commands loaded from `.mcp.json`.

### [4-H-3] OPENKIT_SECURITY_CLI env var allows arbitrary binary
- **Location:** `src/global/mcp/secret-stores/keychain-adapter.js:26`
- **Description:** `createKeychainAdapter` accepts `env.OPENKIT_SECURITY_CLI` without validation. A poisoned env (e.g., from a malicious `.env` in a worktree) can substitute any binary for `/usr/bin/security`, which then receives the keychain password via `-w value`.
- **Suggested fix:** when `OPENKIT_SECURITY_CLI` is set, require an absolute path matching a known-safe pattern (e.g., starts with `/usr/`); otherwise reject and fall back to `/usr/bin/security`.

### [4-H-4] Arbitrary file read via file:// prompt references (no project-root boundary)
- **Location:** `src/runtime/config/prompt-file-loader.js:16, 24`
- **Description:** `resolveFileUri` accepts `file:///etc/passwd` (absolute) and `file://~/sensitive` (home-relative) without any boundary check, then passes the resolved path to `fs.readFileSync`. A malicious runtime config can exfiltrate any file readable by the process.
- **Suggested fix:** apply `isInsideProjectRoot` after resolving; reject paths that escape the project root for relative/home-relative references.

### [4-H-5] No E2E test for hooks/graph-indexer.js
- **Location:** `src/hooks/graph-indexer.js`
- **Description:** The graph-indexer hook is spawned detached and fire-and-forget on every session start. It builds the in-memory project graph (critical for graph-tool accuracy), but no test in `src/tests/` or `src/openkit-runtime/tests/` exercises the hook's binary entry point — only the DB layer is tested.
- **Suggested fix:** add an integration test under `src/tests/runtime/` that spawns `graph-indexer.js` against a fixture project and asserts the DB is populated.

### [N-1] switch-profiles CLI silently no-ops on macOS due to symlink-aware import.meta.url comparison (post-audit)
- **Location:** `src/runtime/switch-profiles-cli.js:117`
- **Source:** Discovered during Wave 1 baseline investigation when test `src/tests/cli/openkit-cli.test.js:709` failed with empty stdout.
- **Description:** The entry-point guard reads `if (import.meta.url === \`file://${process.argv[1]}\`)`. Node.js resolves `import.meta.url` through symlinks (e.g., `file:///private/var/folders/...`), but `process.argv[1]` retains the raw path the shell passed (e.g., `/var/folders/...`). On macOS, the system temp directory `/var/folders/...` is a symlink to `/private/var/folders/...`, so the two strings disagree and the guard is false. The CLI body never runs. The process exits 0 with empty stdout — no error, no diagnostic. End users running `openkit switch-profiles` from any path under `/var/...` (or any other symlinked prefix) hit a silent no-op.
- **Evidence/repro:**
  - Direct probe: `import.meta.url` = `file:///private/var/folders/.../switch-profiles-cli.js`, `process.argv[1]` = `/var/folders/.../switch-profiles-cli.js`. The string concatenation yields `file:///var/folders/...`, which does not equal `import.meta.url`.
  - Test reproduction: `src/tests/cli/openkit-cli.test.js:698-710` spawns the materialized wrapper at `<tempProject>/.opencode/switch-profiles.js`, which spawns the CLI from `<tempHome>/kits/openkit/src/runtime/switch-profiles-cli.js`. Both paths live under `/var/folders/...` on macOS. Wrapper returns exit 0, but stdout is empty (line 709 assertion fails).
  - The guard pattern works on Linux (no `/private` symlink prefix) and on macOS when invoked through real-paths only — masking the bug from many environments.
- **Suggested fix:** Replace the URL-string comparison with a real-path comparison: `realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])`. This handles symlink resolution on both sides. (See https://github.com/nodejs/node/issues/41072 for the underlying Node.js behavior.) The same regression test (`src/tests/cli/openkit-cli.test.js:698-710`) will then pass, restoring full `verify:all` green status.
- **Why audit missed:** The four audit subagents were `Explore` (read-only). They did not run tests or invoke CLIs, so could not observe stdout/exit-code behavior. The wrapper code itself is structurally fine and didn't pattern-match any of the issue categories the subagents looked for.

## Medium

- **[1-M-1]** `gateOverrides` parameter accepted by handler but absent from MCP schema — `src/mcp-server/tool-schemas.js:338-361` vs `src/runtime/tools/workflow/advance-stage.js:8`
- **[1-M-2]** `quick_intake → quick_plan` gate dead in persistence layer — `src/runtime/workflow/gate-requirements.js:10-12`
- **[1-M-3]** Fresh-project bootstrap: write methods silently fail until `src/openkit-runtime/` exists — `src/runtime/workflow-kernel.js:134-148, 349-360`
- **[1-M-4]** Blocking sync `fs.readFileSync` in `session-start.js` (no size cap) — `src/hooks/session-start.js:321, 334`
- **[1-M-5]** FSM asymmetry `migration_strategy → migration_baseline` allowed in transition-engine but not in state-machine — `src/runtime/state/transition-engine.js:59` vs `src/runtime/workflow/state-machine.js:52`
- **[2-M-1]** `install` command prints "Installed OpenKit globally" before install runs — `src/cli/commands/install.js:71`
- **[2-M-2]** `GLOBAL_KIT_ASSETS` has duplicate entries (`bin`, `src/mcp-server`) — `src/global/materialize.js:22, 25, 37, 42`
- **[2-M-3]** `src/install/runtime-migration.js` is a no-op stub never imported — `src/install/runtime-migration.js:1-6`
- **[2-M-4]** `collectFiles` follows symlinks without cycle guard — `src/install/asset-manifest.js:436-447`
- **[2-M-5]** `verify-install-bundle.mjs` does not cross-check bundled paths against `pkg.files` — `scripts/verify-install-bundle.mjs`
- **[2-M-6]** TOCTOU race in concurrent `materializeInstall` — `src/install/materialize.js:55-110`
- **[3-M-1]** `docs/governance/skill-metadata.md:36` lists removed `quick_brainstorm` as valid stage
- **[3-M-2]** Operator runbook uses `quick_brainstorm` in CLI example — `docs/operations/runbooks/workflow-state-smoke-tests.md:255`
- **[3-M-3]** Role operating policy refers to `quick_brainstorm` as active — `docs/maintainer/2026-03-26-role-operating-policy.md:126`
- **[3-M-4]** Solution doc lists `quick_brainstorm` as normative — `docs/solution/2026-04-27-standardize-bundled-skill-metadata.md:263`
- **[3-M-5]** 7 of 20 skills have SKILL.md without YAML frontmatter — `src/skills/{browser-automation,codebase-exploration,deep-research,dev-browser,frontend-ui-ux,git-master,refactoring}/SKILL.md:1`
- **[4-M-1]** Workspace shim code-gen does not assert path components are well-formed — `src/global/workspace-shim.js:161-284`
- **[4-M-2]** Caret-pinned dependencies allow unreviewed minor/patch upgrades — `package.json:9-16`
- **[4-M-3]** `tool.invocation-log` records full tool result objects without redaction — `src/openkit-runtime/lib/invocation-log.js:156`
- **[4-M-4]** Semgrep rules missing patterns for command-injection / path-traversal — `assets/semgrep/packs/security-audit.yml`
- **[4-M-5]** `quality-rules.test.js` security pack test only covers one rule — `src/tests/semgrep/quality-rules.test.js:232`
- **[X-1]** `CHANGELOG.md` and `RELEASES.md` are not in `package.json#files` and not shipped in the npm tarball — `package.json:18-44`

## Low

- **[1-L-1]** No size/timeout guard on synchronous reads in `session-start.js` — `src/hooks/session-start.js:316-344`
- **[1-L-2]** `TransactionLog.query()` reads entire JSONL into memory, no cap — `src/runtime/state/transaction-log.js:87-108`
- **[1-L-3]** `captureRevision` uses `JSON.stringify` (drops `undefined` keys) — `src/openkit-runtime/lib/state-guard.js:10-28`
- **[1-L-4]** Dead gate `quick_intake→quick_plan` cannot be satisfied via EVIDENCE_TO_GATE — `src/runtime/tools/workflow/advance-stage.js:132`
- **[2-L-2]** `runtime-profile-materializer.js` writes without project-root validation — `src/install/runtime-profile-materializer.js:4-8`
- **[2-L-3]** `src/bin/openkit-mcp.js` has no error handling at startup — `src/bin/openkit-mcp.js:9`
- **[3-L-1]** `migration_baseline` stage has ambiguous ownership in agent/command docs — `src/agents/master-orchestrator.md:41`, `src/commands/migrate.md:46`
- **[3-L-3]** Historical docs retain `quick_brainstorm` (archival, not active surface) — `docs/superpowers/plans/...`, `docs/scope/...`, `docs/qa/...`
- **[3-L-4]** AGENTS.md does not enumerate `/configure-embedding` — `AGENTS.md:27`
- **[4-L-1]** `prebuild-install` is a transitive dep that fetches binaries at install (no SRI) — transitive
- **[4-L-2]** `session-start.js` prints absolute paths on every session start (filesystem layout disclosure to stdout) — `src/hooks/session-start.js:271-283`
- **[4-L-3]** No real-dir E2E for upgrade flow — `src/tests/cli/openkit-cli.test.js:1325`
- **[X-2]** No test asserts the two FSM tables agree — would have caught `[1-C-1]`

## Coverage summary

### Subagent 1 — Runtime + Workflow Core
- **Read:** `src/openkit-runtime/lib/` (all 20 files), `src/runtime/state/`, `src/runtime/workflow/`, `src/runtime/workflow-kernel.js`, `src/runtime/project-root.js`, `src/runtime/tools/workflow/`, `src/runtime/tools/tool-registry.js`, `src/mcp-server/`, `src/hooks/` (4 files), `src/runtime/managers/project-graph-manager.js`, `src/runtime/analysis/file-watcher.js`, `src/runtime/tools/shared/project-file-utils.js`, `src/openkit-runtime/lib/policy-engine.js`, `state-guard.js`, `runtime-paths.js`.
- **Skipped (with reason):** `node_modules/`, `release-notes/` (out of scope); some `src/runtime/` subdirs (`src/hooks/*`, `mcp/*`, `specialists/*`, `recovery/*`) only partially read; `src/openkit-runtime/lib/workflow-state-controller.js` too large (69K tokens) — only portions read by offset.
- **Open questions raised:** which FSM table is ground truth (1-C-1 motivates picking one); whether `gate-requirements.js` is meant to replace `gate-registry.js` or vice versa (1-H-2); whether `tool.bootstrap-workflow` MCP absence is intentional (1-H-3); whether `quick_intake → quick_plan` gate definition is leftover from `quick_brainstorm` removal (1-M-2, 1-L-4).

### Subagent 2 — Install / CLI / Distribution
- **Read:** `src/install/` (all 8 files), `bin/` (both files), `scripts/` (all 4 files), `package.json`, `src/openkit-runtime/install-manifest.json`, `registry.json` (version field only), `src/cli/commands/{doctor,upgrade,install,install-global}.js`, `src/global/{doctor,materialize,paths}.js`, `src/cli/index.js`, `src/release/workflow.js`, `src/opencode/config-schema.js`, `assets/opencode.json.template`.
- **Skipped:** `src/openkit-runtime/lib/`, `src/runtime/`, `src/mcp-server/`, `src/agents/`, `src/commands/`, `src/skills/`, registry.json body — out of scope per instructions.
- **Open questions raised:** was the version drift (D-1) intentional or a process miss; should `runtimeDoctor` sub-check failures elevate `canRunCleanly: false` (2-H-2 is a policy call); is there a near-term plan to add array allowlists to the install template (2-H-3 is latent until then).

### Subagent 3 — Contract Layer
- **Read:** `src/agents/` (all 7), `src/commands/` (all 15), `src/skills/` (all 20 SKILL.md), `registry.json`, `AGENTS.md`, `instructions/`, `src/context/`, `README.md`, `CHANGELOG.md`, `RELEASES.md`; selected docs/governance/, docs/operations/, docs/maintainer/, docs/solution/ for cross-checks.
- **Skipped:** `src/`, `src/openkit-runtime/lib/`, `src/hooks/`, `scripts/`, `src/tests/`, `bin/` — out of scope.
- **Open questions raised:** confirm whether `tool.heuristic-lsp` (3-H-3) was meant as `tool.lsp-symbols` or a separate heuristic tool; intended ownership for `migration_baseline` (3-L-1).

### Subagent 4 — Cross-cutting
- **Read:** `src/`, `src/openkit-runtime/lib/`, `src/hooks/`, `bin/`, `scripts/`, `package.json`, `package-lock.json` (selected), `src/tests/semgrep/`, `assets/semgrep/`, `src/runtime/tools/ast/`, `src/runtime/supervisor/`, `src/runtime/mcp/`, `src/global/mcp/secret-stores/`, `src/runtime/config/`, `src/global/workspace-shim.js`, `src/openkit-runtime/lib/invocation-log.js`.
- **Skipped:** `node_modules/`, `release-notes/` — out of scope.
- **Open questions raised:** severity of [4-H-1]/[4-H-2] depends on threat model — does OpenKit assume target project repos are trusted? If yes, downgrade these to Medium; if no (operator may run against untrusted repos), keep as High. The audit report keeps them as High pending product clarification.

## Working artefacts

The merged-findings document and the four sub-reports are preserved under `docs/superpowers/specs/_audit-2026-05-09/`:
- `subagent-1-runtime.md`
- `subagent-2-install.md`
- `subagent-3-contract.md`
- `subagent-4-crosscutting.md`
- `merged-findings.md` (includes verification log)

These remain available for reproducibility and to support the fix plan.
