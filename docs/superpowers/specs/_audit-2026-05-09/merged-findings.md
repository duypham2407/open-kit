# Merged audit findings

## Duplicates (issues flagged by ≥2 subagents)

- **[D-1]** Version drift: `package.json` is `0.5.1` but `registry.json` and `.opencode/install-manifest.json` still show `0.3.36`
  - Source IDs: `[2-C-1] + [3-H-1] + [2-L-1]`
  - Files: `package.json:3`, `registry.json:6`, `.opencode/install-manifest.json:6`
  - Final priority: **Critical** (per §3.1 keep highest — Subagent 2 found this blocks `openkit release verify`/`publish` because `verifyReleaseMetadata` throws on disagreement)
  - Notes: Subagent 2 flagged the release-blocking impact (Critical); Subagent 3 flagged it as a doc-drift visibility issue (High). Same root cause, both observations valid.

## Unique findings

### Critical
- [1-C-1] Three divergent FSM transition tables — `src/runtime/workflow/state-machine.js:29-57` vs `src/runtime/state/transition-engine.js:37-65`
- [1-C-2] `tool.workflow-state` MCP schema vs handler contract mismatch — `src/mcp-server/tool-schemas.js:297-310` vs `src/runtime/tools/workflow/workflow-state.js:23-48`
- [4-C-1] Command injection in `ast-grep-search` via `args.join(' ')` — `src/runtime/tools/ast/ast-grep-search.js:63`
- [D-1] Version drift across package.json/registry.json/install-manifest.json — see Duplicates section above.

### High
- [1-H-1] `safeCall` in `workflow-kernel.js` swallows all controller throws — `src/runtime/workflow-kernel.js:150-155`
- [1-H-2] Two incompatible gate systems (gate-requirements vs gate-registry) both live on advance-stage — `src/runtime/workflow/gate-requirements.js:8-58` vs `src/runtime/state/gate-registry.js:17-93`
- [1-H-3] `tool.bootstrap-workflow` registered in runtime but absent from MCP schema — `src/runtime/tools/tool-registry.js:68` vs `src/mcp-server/tool-schemas.js`
- [2-H-1] Upgrade is non-atomic; mid-flight failure leaves empty kitRoot — `src/global/materialize.js:165-172`
- [2-H-2] Doctor reports `canRunCleanly: true` while runtime sub-checks may show failures — `src/global/doctor.js:208-225`
- [2-H-3] `mergeUniqueArray` uses `Object.is()` causing duplicate object items on repeated installs — `src/install/merge-policy.js:32`
- [2-H-4] Upgrade command has no try/catch around `materializeGlobalInstall` — `src/cli/commands/upgrade.js:20`
- [3-H-2] `commands/configure-embedding.md` exists on disk but absent from `registry.json` — `commands/configure-embedding.md:1`
- [3-H-3] Agents reference `tool.heuristic-lsp` which is not registered — `agents/solution-lead-agent.md:51`, `agents/code-reviewer.md:76`
- [4-H-1] Config-driven RCE via `supervisorDialogue.openclaw.command` — `src/runtime/supervisor/openclaw-adapter.js:40`
- [4-H-2] Config-driven RCE via external MCP stdio `command` — `src/runtime/mcp/dispatch.js:183`
- [4-H-3] `OPENKIT_SECURITY_CLI` env var allows arbitrary binary as macOS security CLI — `src/global/mcp/secret-stores/keychain-adapter.js:26`
- [4-H-4] Arbitrary file read via `file://` prompt references (no project-root boundary) — `src/runtime/config/prompt-file-loader.js:16,24`
- [4-H-5] No E2E test for `hooks/graph-indexer.js` — `hooks/graph-indexer.js`

### Medium
- [1-M-1] `gateOverrides` parameter not in MCP schema — `src/mcp-server/tool-schemas.js:338-361` vs `src/runtime/tools/workflow/advance-stage.js:8`
- [1-M-2] `quick_intake → quick_plan` gate dead in persistence layer — `src/runtime/workflow/gate-requirements.js:10-12`
- [1-M-3] Fresh-project bootstrap: write methods silently fail until `.opencode/` exists — `src/runtime/workflow-kernel.js:134-148, 349-360`
- [1-M-4] Blocking sync `fs.readFileSync` in `session-start.js` (no size cap) — `hooks/session-start.js:321, 334`
- [1-M-5] FSM asymmetry `migration_strategy → migration_baseline` — `src/runtime/state/transition-engine.js:59` vs `src/runtime/workflow/state-machine.js:52`
- [2-M-1] `install` command prints "Installed" before install runs — `src/cli/commands/install.js:71`
- [2-M-2] `GLOBAL_KIT_ASSETS` has duplicate entries (`bin`, `src/mcp-server`) — `src/global/materialize.js:22,25,37,42`
- [2-M-3] `src/install/runtime-migration.js` is a no-op stub never imported — `src/install/runtime-migration.js:1-6`
- [2-M-4] `collectFiles` in `asset-manifest.js` follows symlinks without cycle guard — `src/install/asset-manifest.js:436-447`
- [2-M-5] `verify-install-bundle.mjs` does not cross-check bundled paths against `pkg.files` — `scripts/verify-install-bundle.mjs`
- [2-M-6] TOCTOU race in concurrent `materializeInstall` — `src/install/materialize.js:55-110`
- [3-M-1] `docs/governance/skill-metadata.md:36` lists removed `quick_brainstorm` as valid stage
- [3-M-2] Operator runbook uses `quick_brainstorm` in CLI example — `docs/operations/runbooks/workflow-state-smoke-tests.md:255`
- [3-M-3] Role operating policy refers to `quick_brainstorm` as active — `docs/maintainer/2026-03-26-role-operating-policy.md:126`
- [3-M-4] Solution doc lists `quick_brainstorm` in normative constraint — `docs/solution/2026-04-27-standardize-bundled-skill-metadata.md:263`
- [3-M-5] 7 of 20 skills have SKILL.md without YAML frontmatter — `skills/{browser-automation,codebase-exploration,deep-research,dev-browser,frontend-ui-ux,git-master,refactoring}/SKILL.md:1`
- [4-M-1] Workspace shim code-gen uses path injection edge case — `src/global/workspace-shim.js:161-284`
- [4-M-2] Caret-pinned dependencies allow unreviewed minor/patch upgrades — `package.json:9-16`
- [4-M-3] `tool.invocation-log` records full tool result objects without redaction — `.opencode/lib/invocation-log.js:156`
- [4-M-4] Semgrep rules missing patterns for command-injection / path-traversal — `assets/semgrep/packs/security-audit.yml`
- [4-M-5] `quality-rules.test.js` security pack test only covers one rule — `tests/semgrep/quality-rules.test.js:232`

### Low
- [1-L-1] No size/timeout guard on synchronous reads in `session-start.js` — `hooks/session-start.js:316-344`
- [1-L-2] `TransactionLog.query()` reads entire JSONL into memory — `src/runtime/state/transaction-log.js:87-108`
- [1-L-3] `captureRevision` uses `JSON.stringify` (drops `undefined`) — `.opencode/lib/state-guard.js:10-28`
- [1-L-4] Dead gate `quick_intake→quick_plan` cannot be satisfied via EVIDENCE_TO_GATE — `src/runtime/tools/workflow/advance-stage.js:132`
- [2-L-2] `runtime-profile-materializer.js` writes without project-root validation — `src/install/runtime-profile-materializer.js:4-8`
- [2-L-3] `bin/openkit-mcp.js` has no error handling at startup — `bin/openkit-mcp.js:9`
- [3-L-1] `migration_baseline` stage has ambiguous ownership — `agents/master-orchestrator.md:41`, `commands/migrate.md:46`
- [3-L-3] Historical docs retain `quick_brainstorm` (archival, not active surface) — `docs/superpowers/plans/...`, `docs/scope/...`, `docs/qa/...`
- [3-L-4] AGENTS.md does not enumerate `/configure-embedding` — `AGENTS.md:27`
- [4-L-1] `prebuild-install` is transitive dep, fetches binaries at install (no SRI) — transitive
- [4-L-2] `session-start.js` prints absolute paths on every session start — `hooks/session-start.js:271-283`
- [4-L-3] No real-dir E2E for upgrade flow — `tests/cli/openkit-cli.test.js:1325`

(3-L-2 was a "clean" finding — no action — and is intentionally omitted from the action list.)

## Cross-layer findings (main-agent only)

These five drift checks (§3.2) were run by the main agent against multiple sources at once. Findings here did not appear in any single sub-report.

### Cross-layer check 1 — FSM ↔ registry.json ↔ commands
- **Result: clean.** Stages enumerated in `registry.json` match `STAGE_ORDER` in `src/runtime/state/transition-engine.js`. The `migration_report` token in `commands/write-solution.md:44,58` is an artefact name, not a stage. No mismatched stage names.

### Cross-layer check 2 — Agents ↔ skills ↔ commands
- **Result: clean for skill references.** `registry.json` lists 20 skills and 20 directories exist. No agent references a `skill.X` ID directly via `skill.<name>` syntax (agents use prose references). Tool-level drift is already captured in [3-H-3].

### Cross-layer check 3 — package.json#files ↔ filesystem ↔ install manifest
- All 27 entries in `package.json#files` exist on disk.
- The 3 wrapper-facing files in `.opencode/install-manifest.json` (`registry.json`, `.opencode/install-manifest.json`, `assets/install-bundle/opencode/skill-catalog.json`) are all in `pkg.files`.
- **[X-1] Medium** — `CHANGELOG.md`, `RELEASES.md` are not in `pkg.files` and not auto-included by npm. `npm pack --dry-run` confirms neither is shipped in the published tarball. `RELEASES.md` is the canonical pointer to per-version release notes referenced in upgrade flow; users who run `npm view @duypham93/openkit` cannot see it without going to the GitHub repo.
  - File: `package.json:18-44` (the `files` array)
  - Suggested fix: add `"CHANGELOG.md"` and `"RELEASES.md"` (and consider `release-notes/`) to `package.json#files`.

### Cross-layer check 4 — README ↔ AGENTS ↔ CHANGELOG ↔ version
- `package.json` = `0.5.1`, `CHANGELOG.md` latest = `0.5.1`, `RELEASES.md` = `0.5.1` ✓.
- README/AGENTS do not pin a version string.
- **Drift confirmed for `registry.json` (0.3.36) and `.opencode/install-manifest.json` (0.3.36)** — already captured as `[D-1]`. No new finding here.

### Cross-layer check 5 — Test coverage of critical paths
- bootstrap: covered by `tests/runtime/lane-bootstrap-e2e.test.js`, `tests/runtime/bootstrap-workflow.test.js`, `tests/runtime/workflow-kernel-fresh.test.js` ✓
- merge-policy: covered by `tests/install/merge-policy.test.js` ✓
- session-start hook: covered by `.opencode/tests/session-start-hook.test.js` ✓
- graph-indexer hook: **no test file** — already captured as `[4-H-5]`.
- doctor: covered by `tests/runtime/doctor.test.js` and `tests/global/doctor.test.js` ✓
- upgrade: only CLI-level mocked (`tests/cli/openkit-cli.test.js`) — already captured as `[4-L-3]`.
- **[X-2] Low** — FSM transition table itself has unit tests at `tests/runtime/advance-stage.test.js` but no test asserts the **two FSM tables** (`state-machine.js` vs `transition-engine.js`) **agree**, which is the root cause of `[1-C-1]`. A consistency test would have caught it.
  - Suggested fix: add `tests/runtime/fsm-table-consistency.test.js` that imports both tables and asserts deep-equal of their per-mode transition maps.


## Verification log

### Critical (100% verified)
- [1-C-1] ✓ verified — `state-machine.js:29-57` and `transition-engine.js:37-65` confirmed divergent. Note: 5 divergences confirmed (full_solution, full_code_review, full_qa, migration_strategy, migration_code_review), not 6 as Subagent 1 reported. Priority unchanged; root cause and impact identical.
- [1-C-2] ✓ verified — `tool-schemas.js:297-310` advertises `command` enum, `workflow-state.js:23-39` reads only `workItemId`. Contract mismatch confirmed.
- [4-C-1] ✓ verified — `ast-grep-search.js:55-69` shows `args.join(' ')` passed to `execSync` with user-controlled `pattern` and `lang`. Injection vector confirmed.
- [D-1] ✓ verified — `package.json:3` = "0.5.1", `registry.json` (kit.version field) = "0.3.36", `.opencode/install-manifest.json:6` = "0.3.36".

### High (spot-check 1/3, picked every 3rd: 1-H-1, 2-H-1, 2-H-4, 3-H-3, 4-H-3)
- [1-H-1] ✓ verified — `workflow-kernel.js:150-155` shows `try { return fn(); } catch { return fallback; }` exactly as reported.
- [2-H-1] ✓ verified — `materialize.js:165` `removePathIfPresent(paths.kitRoot)` then loop copy at line 171; no temp dir, no atomic rename.
- [2-H-4] ✓ verified — `upgrade.js:20` calls `materializeGlobalInstall` with no try/catch; rest of run() is plain stdout writes.
- [3-H-3] ✓ verified — `solution-lead-agent.md:51` and `code-reviewer.md:76` both list `tool.heuristic-lsp`; `grep -n "heuristic" registry.json` returns nothing.
- [4-H-3] ✓ verified — `keychain-adapter.js:26` shows `env.OPENKIT_SECURITY_CLI ?? '/usr/bin/security'` with no validation step.

### Re-dispatches triggered
- None. 5/5 spot-checked High passed verification (≥ 50% pass threshold not breached).
