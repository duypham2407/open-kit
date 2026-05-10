---
title: OpenKit Project Audit — Fix Plan
date: 2026-05-09
report: docs/superpowers/specs/2026-05-09-project-audit-report.md
spec: docs/superpowers/specs/2026-05-09-project-audit-design.md
baseline_commit: 619b7c8
status: awaiting user review
---

# OpenKit Project Audit — Fix Plan

This fix plan is a **spec**, not an implementation plan. After user approval, invoke `superpowers:writing-plans` to turn each wave into an implementation plan with TDD steps and execution order.

## Wave 0 — Pre-fix safety net

Run before touching any production code.

- [ ] `npm run verify:all` passes on baseline commit `619b7c8`
- [ ] E2E smoke: bootstrap each of the 3 lanes (`/quick-task`, `/delivery`, `/migrate`) on a fresh project and confirm advance-stage works
- [ ] Tag baseline: `git tag audit-baseline-2026-05-09`
- [ ] Snapshot output of `npm pack --dry-run --json` to confirm what is currently shipped (used as before/after diff for [X-1])

## Wave 1 — Critical (4 entries)

These must be fixed before the next release. Topo order: D-1 → 1-C-1 → 1-C-2 → 4-C-1 (D-1 blocks publish, so it goes first; the others are independent).

### [D-1] Resync version metadata across package.json, registry.json, install-manifest.json
- **Priority:** Critical
- **Location:** `package.json:3`, `registry.json:6`, `src/openkit-runtime/install-manifest.json:6`
- **Root cause:** Two release artefacts were not updated to match `package.json` when bumping to `0.5.1`. `updateVersionMetadata` cannot self-heal because it string-replaces the *current* version.
- **Fix approach:** Run `openkit release prepare 0.5.1` to align both files. If that command itself has the bug (the 0.5.1 string is what it would search for), do a one-shot manual edit to set `kit.version = "0.5.1"` in both files, then verify the release prepare flow is idempotent for future bumps.
- **Acceptance criteria:**
  - [ ] `node -e "console.log(require('./registry.json').kit.version)"` prints `0.5.1`
  - [ ] `node -e "console.log(require('./.opencode/install-manifest.json').kit.version)"` prints `0.5.1`
  - [ ] `npm run verify:all` continues to pass
  - [ ] Release verify (the workflow `verifyReleaseMetadata` calls) succeeds
  - [ ] Test added/extended: a regression test under `src/tests/release/` (or `src/tests/runtime/registry-metadata.test.js`) that asserts `registry.kit.version === pkg.version` and `install-manifest.kit.version === pkg.version`
- **Risk if fixed wrong:** If `updateVersionMetadata` itself is buggy, future bumps still drift. Watch for whether the release prepare command writes the correct values.
- **Estimated effort:** S
- **Depends on:** none

### [1-C-1] Merge two divergent FSM transition tables into one source of truth
- **Priority:** Critical
- **Location:** `src/runtime/workflow/state-machine.js:29-57` and `src/runtime/state/transition-engine.js:37-65`
- **Root cause:** The full/migration transition rules drifted across two files that are both consulted on the advance-stage path. The five differences cause silent rejections from `WorkflowStateManager` even when `advance-stage`'s pre-check passes.
- **Fix approach:** Extract a single canonical TRANSITIONS module (e.g., `src/runtime/state/transitions.js`) keyed by mode that exports the per-mode transition map and per-stage owners. Make both `state-machine.js` and `transition-engine.js` import from it. Choose the more permissive set as the merged truth (transition-engine for `migration_strategy → migration_baseline`; state-machine for `full_code_review → full_solution|full_product`) — but document the choice and update callers that depend on the stricter form. Add `[X-2]` consistency test as part of the same change.
- **Acceptance criteria:**
  - [ ] Both files import the canonical TRANSITIONS module; no duplicate map literals remain
  - [ ] New test `src/tests/runtime/fsm-table-consistency.test.js` asserts deep-equal of per-mode transition maps (covers [X-2])
  - [ ] Existing `src/tests/runtime/advance-stage.test.js` and `src/openkit-runtime/tests/workflow-state-controller.test.js` continue to pass
  - [ ] Manual smoke: each of the 3 lanes can advance through its full stage chain and back-rework on full/migration where intended
- **Risk if fixed wrong:** Choosing the wrong direction merges a less-permissive set could break in-flight migrations. Mitigate by reviewing actual usage in tests + smoke tests for full and migration lanes.
- **Estimated effort:** M
- **Depends on:** none

### [1-C-2] Reconcile tool.workflow-state MCP schema with handler
- **Priority:** Critical
- **Location:** `src/mcp-server/tool-schemas.js:297-310` and `src/runtime/tools/workflow/workflow-state.js:23-48`
- **Root cause:** The schema documents a `command` enum the handler never reads, so any model invoking `{ command: 'show' }` gets a null result silently.
- **Fix approach:** Pick one direction. Option A — drop the `command` enum and document `workItemId` as the only input; this matches current behavior. Option B — implement the `command` dispatch (status / show / doctor / metrics) in the handler and route to the appropriate kernel function. Recommend Option A since callers already use `workItemId`-style invocation; option B widens the surface area unnecessarily.
- **Acceptance criteria:**
  - [ ] Schema and handler accept the same input shape (verified by a contract test)
  - [x] New test `src/tests/mcp-server/workflow-state-contract.test.js` asserts schema/handler contract agreement at the schema layer (handler is exercised end-to-end by `src/tests/runtime/tools/workflow-state.test.js` and `src/tests/runtime/tools/workflow-state-integration.test.js`; layered test scope decided during Wave 1 planning)
  - [ ] Existing MCP tests pass
- **Risk if fixed wrong:** If users have integrations passing `command`, breaking change. Audit whether any test or runtime path actually sends `command` first; the handler shows none does.
- **Estimated effort:** S
- **Depends on:** none

### [4-C-1] Replace shell-string execSync in ast-grep-search with argv-based spawnSync
- **Priority:** Critical
- **Location:** `src/runtime/tools/ast/ast-grep-search.js:55-69`
- **Root cause:** `execSync(args.join(' '), …)` collapses the args array into a single shell-interpreted string. `pattern` and `lang` are user-supplied via tool input, so injection through shell metacharacters or newline payloads is possible.
- **Fix approach:** Replace `execSync(args.join(' '), …)` with `spawnSync('ast-grep', args.slice(1), { …, shell: false })`. Capture stdout from `result.stdout` (a Buffer) and JSON.parse as before. Keep timeout, maxBuffer, and stdio config. Add a semgrep rule to flag this exact pattern (`execSync` with `.join`) per [4-M-4].
- **Acceptance criteria:**
  - [ ] `execSync` no longer used in `ast-grep-search.js`; `spawnSync` is used with `shell: false`
  - [ ] New test `src/tests/runtime/ast-grep-search-injection.test.js` asserts a pattern containing shell metacharacters returns no matches and does not execute the metacharacters (e.g., does not create a side-effect file)
  - [ ] Existing `ast-grep-search` tests continue to pass
  - [ ] Companion semgrep rule (covered by [4-M-4]) flags any future regression
- **Risk if fixed wrong:** spawnSync arg semantics differ slightly from a shell command line; verify Windows behavior if Windows is supported (currently Node's spawn handles it).
- **Estimated effort:** S
- **Depends on:** none (semgrep rule from [4-M-4] is bonus, not a blocker)

## Wave 2 — High (15 entries)

Topo order: contract drift first (so runtime work that follows lands on a clean contract), then runtime correctness, then security, then test coverage, then post-audit cleanup. Specifically:

1. [D-1] is in Wave 1.
2. **Contract drift:** [3-H-2], [3-H-3], [1-H-3] — clean up registry/agent contract before runtime fixes.
3. **Runtime correctness:** [1-H-1], [1-H-2], [2-H-2], [2-H-3]
4. **Install/upgrade safety:** [2-H-1], [2-H-4]
5. **Security boundary:** [4-H-1], [4-H-2], [4-H-3], [4-H-4]
6. **Test coverage:** [4-H-5]
7. **Post-audit:** [N-1] — switch-profiles CLI macOS symlink bug. Standalone, no dependencies; can land anywhere in Wave 2.

### [3-H-2] Add registry entry for /configure-embedding
- **Priority:** High
- **Location:** `registry.json` (no entry); `src/commands/configure-embedding.md:1`
- **Root cause:** Command file added without a corresponding registry entry.
- **Fix approach:** Insert an entry under `components.commands` matching the schema used by other commands: `{ "id": "command.configure-embedding", "path": "commands/configure-embedding.md", "audience": "operator", … }`. Verify `src/tests/runtime/registry-metadata.test.js` enumerates from `registry.json` and that the new entry passes whatever schema check the test runs.
- **Acceptance criteria:**
  - [ ] `node -e "const r=require('./registry.json'); console.log(r.components.commands.find(c=>c.id==='command.configure-embedding'))"` prints the entry
  - [ ] `src/tests/runtime/registry-metadata.test.js` passes
  - [ ] `AGENTS.md:27` enumerates `/configure-embedding` (covers [3-L-4])
- **Risk if fixed wrong:** Schema mismatch causes registry-metadata tests to fail; fix by aligning fields with siblings.
- **Estimated effort:** S
- **Depends on:** none

### [3-H-3] Replace tool.heuristic-lsp with a registered tool ID
- **Priority:** High
- **Location:** `src/agents/solution-lead-agent.md:51`, `src/agents/code-reviewer.md:76`
- **Root cause:** Agents reference `tool.heuristic-lsp` which does not exist in `registry.json` or `src/runtime/tools/lsp/`. Likely a copy-paste from an earlier draft.
- **Fix approach:** Confirm the intent (probably "find references / rename impact"). Replace with `tool.lsp-symbols` or `tool.graph-find-references` per the row context. Cross-check both agent files use the same replacement to keep the contract consistent.
- **Acceptance criteria:**
  - [ ] Both agent files reference only registered tool IDs (verified by `grep -E "tool\.[a-z-]+" agents/*.md` and cross-referencing against `registry.json#runtimeTools`)
  - [ ] New test `src/tests/contract/agent-tool-references.test.js` parses each agent markdown and asserts every `tool.<id>` reference exists in the registry
- **Risk if fixed wrong:** Substituting the wrong tool degrades agent reasoning. Read the row's "purpose" column for both agents and pick the closest match.
- **Estimated effort:** S
- **Depends on:** none

### [1-H-3] Add MCP schema entry for tool.bootstrap-workflow
- **Priority:** High
- **Location:** `src/mcp-server/tool-schemas.js`; runtime registration at `src/runtime/tools/tool-registry.js:68`
- **Root cause:** Tool registered in runtime but missing from MCP `TOOL_SCHEMAS`, which filters it out at `index.js:149`.
- **Fix approach:** Add a `'tool.bootstrap-workflow'` entry to `TOOL_SCHEMAS` with `inputSchema` matching the runtime contract: `{ lane: enum [quick, delivery, migrate], description: string, featureSlug?: string, archivePrior?: boolean }`. Cross-check the runtime tool's `execute()` signature for the canonical input shape.
- **Acceptance criteria:**
  - [ ] `tool.bootstrap-workflow` appears in `getMcpExposedToolIds()` output
  - [ ] New test `src/tests/mcp-server/tool-schemas.test.js` (or extension of existing) asserts every runtime-registered tool has a matching MCP schema entry
  - [ ] Manual: MasterOrchestrator can call `tool.bootstrap-workflow` via MCP
- **Risk if fixed wrong:** Wrong schema shape causes the orchestrator to call with mismatched input. Mirror exactly what the runtime handler destructures.
- **Estimated effort:** S
- **Depends on:** none

### [1-H-1] Make safeCall surface errors instead of swallowing
- **Priority:** High
- **Location:** `src/runtime/workflow-kernel.js:150-155`
- **Root cause:** `safeCall` returns `fallback` on any throw, with no logging or signal.
- **Fix approach:** Add structured error capture: log the exception (with severity), and either (a) propagate a structured error result `{ status: 'error', reason: ... }` to callers, or (b) keep the fallback but expose the last error via `kernel.getLastError()` for inspection. Recommend (a) — change call sites to handle either a value or an error result. Audit each `safeCall(..., null)` to determine whether the caller can act on an error.
- **Acceptance criteria:**
  - [ ] No `safeCall` invocation silently returns `null` for an internal exception; either an error is logged or a structured result is returned
  - [ ] New test `src/tests/runtime/workflow-kernel-error-propagation.test.js` injects a throwing controller and asserts the error is observable to the caller
  - [ ] Existing `src/tests/runtime/workflow-kernel-integration.test.js` passes
- **Risk if fixed wrong:** Changing the return shape breaks every caller that treats `null` as "no-op". Migrate callers in the same change.
- **Estimated effort:** M
- **Depends on:** [1-C-2] (handler contract should be settled before kernel error shape changes)

### [1-H-2] Pick one authoritative gate system and remove the other
- **Priority:** High
- **Location:** `src/runtime/workflow/gate-requirements.js` and `src/runtime/state/gate-registry.js`
- **Root cause:** Two parallel gate systems with different IDs, authorities, and persistence layers, both consulted on advance-stage.
- **Fix approach:** Designate `GateRegistry` (state-layer, persisted in `state.gates`) as the canonical system since it integrates with `WorkflowStateManager`. Migrate the gate definitions from `gate-requirements.js` into `GateRegistry` with proper transition mapping. Update `EVIDENCE_TO_GATE` to fully cover the migrated gates. Remove `gate-requirements.js` and the `checkGateRequirements` call in `advance-stage.js`. This also fixes [1-M-2] and [1-L-4].
- **Acceptance criteria:**
  - [ ] `gate-requirements.js` deleted; `advance-stage.js` no longer calls `checkGateRequirements`
  - [ ] All previously defined gates exist in `GateRegistry` with correct `stage`/`targetStage` keys
  - [ ] New test `src/tests/runtime/gate-system-coverage.test.js` asserts every transition in TRANSITIONS that requires a gate has a matching `GateRegistry` entry
  - [ ] `src/tests/runtime/advance-stage.test.js` and `src/openkit-runtime/tests/workflow-state-controller.test.js` pass
- **Risk if fixed wrong:** If a gate previously enforced by gate-requirements is dropped during migration, a transition that should be gated becomes free. Inventory both files before deleting.
- **Estimated effort:** L
- **Depends on:** [1-C-1] (resolves transition table source of truth which gate-system reform depends on)

### [2-H-2] Make doctor.canRunCleanly reflect runtime sub-check status
- **Priority:** High
- **Location:** `src/global/doctor.js:208-225`
- **Root cause:** `runtimeDoctor` sub-checks (workflow, capabilities, background, mcp, models) are computed but never inspected before deriving `canRunCleanly`.
- **Fix approach:** After assigning `runtimeDoctor`, iterate its sub-checks and push a structured issue into the `issues` array for every status not in `('healthy', 'available')`. Update `canRunCleanly` derivation to consider `issues.length === 0` AND every sub-check healthy. Add a doctor exit-code mapping documented in the help text.
- **Acceptance criteria:**
  - [ ] When any `runtimeDoctor` sub-check is `unhealthy`/`degraded`, `canRunCleanly === false` and exit code is non-zero
  - [ ] When all checks healthy, `canRunCleanly === true`
  - [ ] New test `src/tests/global/doctor-sub-check-propagation.test.js` injects an unhealthy sub-check and asserts exit code 1
  - [ ] Existing `src/tests/global/doctor.test.js` passes
- **Risk if fixed wrong:** Over-strict `canRunCleanly` may report red on transient conditions; allow degraded-but-functional states to remain green if intended.
- **Estimated effort:** M
- **Depends on:** none

### [2-H-3] Replace Object.is with deep-equality in mergeUniqueArray
- **Priority:** High
- **Location:** `src/install/merge-policy.js:32`
- **Root cause:** `Object.is` compares object references, not value equality.
- **Fix approach:** Replace the dedupe predicate with a deep-equality check. Simplest correct: `JSON.stringify(existing) === JSON.stringify(item)` for objects/arrays, with `Object.is` fallback for primitives. Document the limitation that the comparison is order-sensitive for object keys (acceptable for install templates).
- **Acceptance criteria:**
  - [ ] `src/tests/install/merge-policy.test.js` adds a case where two structurally-identical objects are merged into a single entry
  - [ ] All existing merge-policy tests pass
- **Risk if fixed wrong:** Order-sensitive comparison may treat semantically-equal-but-key-different objects as distinct. For install templates this is acceptable; flag in a comment.
- **Estimated effort:** S
- **Depends on:** none

### [2-H-1] Make upgrade atomic via temp-dir + rename
- **Priority:** High
- **Location:** `src/global/materialize.js:165-172`
- **Root cause:** Sequence is "remove old, then copy new", so a mid-flight crash leaves an empty kit-root.
- **Fix approach:** Copy assets to a sibling temp directory (e.g., `paths.kitRoot + '.next-' + nonce`). On copy success, rename the existing `kitRoot` to `kitRoot + '.prev'`, rename the temp into place, then delete `.prev` after a brief sanity check. On any error, delete the temp dir and leave `kitRoot` untouched.
- **Acceptance criteria:**
  - [ ] New test `src/tests/global/upgrade-atomic.test.js` simulates a copy failure mid-way and asserts `kitRoot` still has the original content
  - [ ] Successful upgrade leaves `kitRoot` with new content and no leftover temp/`.prev` dirs
  - [ ] `src/tests/global/doctor.test.js` continues to pass
- **Risk if fixed wrong:** Cross-device rename fails on some FS layouts (rename across mount points). Use a sibling path under the same parent of `kitRoot` to avoid this.
- **Estimated effort:** M
- **Depends on:** none

### [2-H-4] Wrap upgrade command in try/catch with user-facing error
- **Priority:** High
- **Location:** `src/cli/commands/upgrade.js:14-31`
- **Root cause:** `materializeGlobalInstall` is called without error handling; uncaught exceptions emit a raw stack trace.
- **Fix approach:** Wrap the call in try/catch. On error, write a structured message to `io.stderr` indicating the partial state (if any) and how to recover (suggest `npm install -g @duypham93/openkit@latest` to repair). Return exit code 1.
- **Acceptance criteria:**
  - [ ] New test `src/tests/cli/upgrade-error-handling.test.js` injects a throwing materialize and asserts exit code 1 + a non-empty stderr message
  - [ ] Existing CLI tests pass
- **Risk if fixed wrong:** Catching too broadly may swallow important debug info; include the original error message in the structured output.
- **Estimated effort:** S
- **Depends on:** [2-H-1] (atomic upgrade reduces the recovery message complexity)

### [4-H-1] Validate openclaw.command before spawn
- **Priority:** High
- **Location:** `src/runtime/supervisor/openclaw-adapter.js:40`; schema at `src/runtime/config/schema.js:431`
- **Root cause:** No validation on `openclaw.command` beyond `typeof === 'string'`.
- **Fix approach:** In the schema validator (or in the adapter before spawn), apply the existing `SHELL_OPERATORS`/`SHELL_LAUNCHERS`/`SHELL_EXEC_FLAGS` checks from `custom-mcp-validation.js`. Require an absolute path; reject any string containing shell metacharacters. Document the policy.
- **Acceptance criteria:**
  - [ ] New test `src/tests/runtime/openclaw-command-validation.test.js` asserts that crafted commands (relative path, with shell metas) are rejected at config load
  - [ ] Existing supervisor tests pass
- **Risk if fixed wrong:** Legitimate commands with spaces in path may be rejected. Allow spaces; reject only metacharacters.
- **Estimated effort:** S
- **Depends on:** none

### [4-H-2] Validate external MCP stdio command before spawn
- **Priority:** High
- **Location:** `src/runtime/mcp/dispatch.js:183`; normalizer at `src/runtime/mcp/dispatch.js:27-65`
- **Root cause:** `server.command` from `.mcp.json` is spawned without validation.
- **Fix approach:** In `normalizeExternalServers`, apply the same `SHELL_OPERATORS` etc. checks from `custom-mcp-validation.js`. Reject the server entry (with a clear error to stderr) instead of spawning a malformed command.
- **Acceptance criteria:**
  - [ ] New test `src/tests/runtime/external-mcp-command-validation.test.js` asserts crafted commands are rejected with a clear error
  - [ ] `normalizeExternalServers` returns a structured error or filtered list when validation fails
- **Risk if fixed wrong:** Same as [4-H-1] — over-strict rejection of legitimate paths. Use the same validator both places to ensure consistency.
- **Estimated effort:** S
- **Depends on:** [4-H-1] (share the validator)

### [4-H-3] Validate OPENKIT_SECURITY_CLI before substitution
- **Priority:** High
- **Location:** `src/global/mcp/secret-stores/keychain-adapter.js:26`
- **Root cause:** `env.OPENKIT_SECURITY_CLI ?? '/usr/bin/security'` accepts any string as the binary.
- **Fix approach:** When the env var is set, require an absolute path matching a known-safe pattern (`/usr/bin/security` or paths under `/usr/`). On invalid value, log a warning to stderr and fall back to `/usr/bin/security`.
- **Acceptance criteria:**
  - [ ] New test `src/tests/global/keychain-cli-validation.test.js` sets `OPENKIT_SECURITY_CLI=/tmp/evil` and asserts the adapter falls back to `/usr/bin/security`
  - [ ] Setting `OPENKIT_SECURITY_CLI=/usr/bin/security` works
- **Risk if fixed wrong:** Locking down too tightly may break test harnesses that mock the security CLI. Allow `runner` injection in the constructor (already supported) so tests can override without env.
- **Estimated effort:** S
- **Depends on:** none

### [4-H-4] Apply project-root boundary check to file:// prompt references
- **Priority:** High
- **Location:** `src/runtime/config/prompt-file-loader.js:16, 24`
- **Root cause:** Absolute and home-relative `file://` URIs are resolved without boundary checks before `fs.readFileSync`.
- **Fix approach:** After resolving the absolute path, call `isInsideProjectRoot(projectRoot, resolved)` (the same helper used elsewhere in the runtime). If outside the project root, throw with a clear error. Allow the existing relative (`./`, `../`) form to continue working as long as the resolved path is still inside the project.
- **Acceptance criteria:**
  - [ ] New test `src/tests/runtime/prompt-file-loader-boundary.test.js` asserts `file:///etc/passwd` and `file://~/secret` are rejected
  - [ ] Legitimate in-project relative paths continue to work
  - [ ] Existing prompt-loader tests pass
- **Risk if fixed wrong:** Strict boundary enforcement may break a use case where users intentionally point to a file outside the project; if so, gate via an explicit opt-in flag rather than removing the check.
- **Estimated effort:** S
- **Depends on:** none

### [4-H-5] Add E2E test for hooks/graph-indexer.js
- **Priority:** High
- **Location:** `src/hooks/graph-indexer.js`
- **Root cause:** Critical fire-and-forget hook with no integration coverage.
- **Fix approach:** Add `src/tests/runtime/graph-indexer-e2e.test.js` that creates a fixture project (a small git tree with a few JS/TS files), spawns `node hooks/graph-indexer.js` against it, and asserts the resulting DB contains expected nodes/edges. Use existing fixture utilities under `src/tests/runtime/`.
- **Acceptance criteria:**
  - [ ] New test runs in `npm run verify:all` and asserts DB rows exist for fixture files
  - [ ] Test cleans up its fixture and DB after running
- **Risk if fixed wrong:** Long-running E2E may flake on slow CI. Use a small fixture (3-5 files) and a generous timeout.
- **Estimated effort:** M
- **Depends on:** none

### [N-1] Make switch-profiles CLI entry-point guard symlink-aware
- **Priority:** High
- **Location:** `src/runtime/switch-profiles-cli.js:117`
- **Root cause:** Entry-point guard uses `import.meta.url === \`file://${process.argv[1]}\``. On macOS, `import.meta.url` resolves through symlinks (`/private/var/...`) while `process.argv[1]` retains the raw path (`/var/...`). The two strings disagree and the CLI body is skipped — the process exits 0 with empty stdout, no diagnostic. Affects any spawn from a symlinked path prefix (macOS system temp, some custom user setups).
- **Fix approach:** Replace the URL-string comparison with a real-path comparison using `fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])`. Wrap in a try/catch in case `process.argv[1]` is undefined or points at a non-existent file. Add a small fallback (do nothing on guard failure rather than throwing) to preserve the existing safety property: the file is also imported by `src/cli/commands/switch-profiles.js` and must not auto-run when imported.
- **Acceptance criteria:**
  - [ ] `src/tests/cli/openkit-cli.test.js:709` ("openkit run creates CommonJS workflow wrappers without module-boundary warnings") asserts `assert.match(switchProfilesRun.stdout, /No global agent model profiles are available to switch/)` and now passes on macOS.
  - [ ] `npm run verify:all` exits 0 (no remaining backlog failure).
  - [ ] New unit test under `src/tests/runtime/switch-profiles-cli.test.js` (or extension of existing) imports the module and confirms it does NOT execute the CLI body when imported (only when spawned as the process entry-point).
  - [ ] Manual smoke: `node /tmp/<symlinked-path>/switch-profiles-cli.js` prints the empty-profile message instead of exiting silently.
- **Risk if fixed wrong:** If `realpathSync` throws (e.g., file deleted between spawn and check), the guard could mistakenly run the CLI when imported. The try/catch + fallback to "do nothing" is the safe direction; never default to "run the CLI."
- **Estimated effort:** S
- **Depends on:** none — standalone fix, doesn't touch shared modules.
- **Notes:** This finding was discovered during Wave 1 baseline investigation; the test (`src/tests/cli/openkit-cli.test.js:709`) already exists and currently fails. No new test infrastructure is needed.

## Wave 3 — Medium + Low

May be batched into one or two PRs. Low-priority items can be deferred or done opportunistically alongside related work.

### Medium

- **[1-M-1]** Add `gateOverrides` to MCP schema for `advance-stage` — `src/mcp-server/tool-schemas.js:338-361` — extend properties; effort: S
- **[1-M-2]** Resolved by [1-H-2] (gate-requirements consolidation) — no separate work
- **[1-M-3]** In `workflow-kernel.js`, ensure write-path methods auto-bootstrap or return a clear "needs-bootstrap" error instead of silent null — `src/runtime/workflow-kernel.js:134-148, 349-360` — effort: M
- **[1-M-4]** Replace blocking `readFileSync` in `session-start.js:321, 334` with async `readFile` + size cap — effort: S
- **[1-M-5]** Resolved by [1-C-1] (table merge) — no separate work
- **[2-M-1]** Move "Installed OpenKit globally" message after `materializeGlobalInstall` succeeds — `src/cli/commands/install.js:71` — effort: S
- **[2-M-2]** Deduplicate `GLOBAL_KIT_ASSETS` array — `src/global/materialize.js:22, 25, 37, 42` — effort: S
- **[2-M-3]** Remove unused `src/install/runtime-migration.js` stub or wire to canonical migration — effort: S
- **[2-M-4]** Add `!entry.isSymbolicLink()` guard in `collectFiles` — `src/install/asset-manifest.js:436-447` — effort: S
- **[2-M-5]** Extend `verify-install-bundle.mjs` to cross-check bundled paths against `pkg.files` — effort: S
- **[2-M-6]** Add file-lock with `O_EXCL` to `materializeInstall` to prevent TOCTOU — `src/install/materialize.js:55-110` — effort: M
- **[3-M-1]** Remove `quick_brainstorm` from `docs/governance/skill-metadata.md:36` — effort: S
- **[3-M-2]** Replace `quick_brainstorm` with `quick_plan` in operator runbook line 255 — effort: S
- **[3-M-3]** Update `docs/maintainer/2026-03-26-role-operating-policy.md:126` to refer to `quick_plan` — effort: S
- **[3-M-4]** Annotate or update `docs/solution/2026-04-27-standardize-bundled-skill-metadata.md:263` — effort: S
- **[3-M-5]** Add YAML frontmatter to 7 SKILL.md files (browser-automation, codebase-exploration, deep-research, dev-browser, frontend-ui-ux, git-master, refactoring) — effort: S
- **[4-M-1]** Assert path components are valid (no newlines) before generating `workspace-shim.js` scripts — effort: S
- **[4-M-2]** Decide policy on caret pinning; either pin exactly or document `npm ci`-only install — `package.json:9-16` — effort: S (policy + 1-line edit)
- **[4-M-3]** Add redaction pass to `invocationLogger.record` for the `result` field — `src/openkit-runtime/lib/invocation-log.js:156` — effort: M
- **[4-M-4]** Add semgrep rules for `execSync($X.join(...))`, `execSync($A + $B)`, and unbounded `fs.read*Sync` — `assets/semgrep/packs/security-audit.yml` — effort: M
- **[4-M-5]** Expand `src/tests/semgrep/quality-rules.test.js` with positive/negative fixtures for each existing security rule — effort: M
- **[X-1]** Add `"CHANGELOG.md"` and `"RELEASES.md"` (and consider `release-notes/`) to `package.json#files` — effort: S

### Low

- **[1-L-1]** Add size guard for synchronous reads in `session-start.js` — folded into [1-M-4]
- **[1-L-2]** Add line-cap to `TransactionLog.query()` — `src/runtime/state/transaction-log.js:87-108` — effort: S
- **[1-L-3]** Document `JSON.stringify` non-canonicalization caveats in `state-guard.js` (or use a canonical-json lib) — `src/openkit-runtime/lib/state-guard.js:10-28` — effort: S (doc only)
- **[1-L-4]** Resolved by [1-H-2] — no separate work
- **[2-L-2]** Add a JSDoc note to `runtime-profile-materializer.js` saying callers must validate target paths — effort: S
- **[2-L-3]** Wrap `src/bin/openkit-mcp.js` import in a startup-error handler that emits stderr — effort: S
- **[3-L-1]** Add `(Solution Lead)` annotation to `migration_baseline` row in `src/commands/migrate.md:46` — effort: S
- **[3-L-3]** Add deprecation banner to historical `quick_brainstorm` docs (or leave as-is given AGENTS.md already routes around archive) — effort: S (optional)
- **[3-L-4]** Resolved by [3-H-2] (when AGENTS.md is updated as part of the registry fix) — no separate work
- **[4-L-1]** Document `prebuild-install` supply-chain consideration in operator docs — effort: S (doc only)
- **[4-L-2]** Make absolute-path printing in `session-start.js:271-283` opt-out via env var — effort: S
- **[4-L-3]** Add real-dir E2E for upgrade — folded into [2-H-1] acceptance criteria
- **[X-2]** Resolved by [1-C-1] (FSM consistency test added with table merge) — no separate work

## Out-of-scope (deferred)

These were identified during audit but are explicitly **not** addressed in this fix plan:

- **Refactor of files > 500 lines** — `src/openkit-runtime/lib/workflow-state-controller.js` (≈ 69K tokens) is large and was only partially read by Subagent 1. Splitting it into focused modules is a separate workstream.
- **Public CLI/MCP API changes** — Any breaking change to surfaced commands or tool schemas requires a product decision (e.g., dropping `command` from `tool.workflow-state` schema in [1-C-2] is a small surface change handled in this plan; larger surface changes are not).
- **Performance optimization** — The blocking reads in [1-M-4] are correctness-adjacent; broader performance work (e.g., caching the skill catalog, lazy-loading agents) is deferred.

## Verification matrix

| Issue ID | Verification command or test |
|----------|------------------------------|
| [D-1]    | `npm run verify:all` + new `src/tests/release/version-metadata-consistency.test.js` |
| [1-C-1]  | `src/tests/runtime/fsm-table-consistency.test.js` (new) + existing `advance-stage.test.js` |
| [1-C-2]  | `src/tests/mcp-server/workflow-state-contract.test.js` (new) |
| [4-C-1]  | `src/tests/runtime/ast-grep-search-injection.test.js` (new) + semgrep rule |
| [1-H-1]  | `src/tests/runtime/workflow-kernel-error-propagation.test.js` (new) |
| [1-H-2]  | `src/tests/runtime/gate-system-coverage.test.js` (new) + advance-stage / controller tests |
| [1-H-3]  | extension of `src/tests/mcp-server/mcp-server.test.js`; manual MCP smoke |
| [2-H-1]  | `src/tests/global/upgrade-atomic.test.js` (new) |
| [2-H-2]  | `src/tests/global/doctor-sub-check-propagation.test.js` (new) |
| [2-H-3]  | extension of `src/tests/install/merge-policy.test.js` |
| [2-H-4]  | `src/tests/cli/upgrade-error-handling.test.js` (new) |
| [3-H-2]  | `src/tests/runtime/registry-metadata.test.js` (existing) |
| [3-H-3]  | `src/tests/contract/agent-tool-references.test.js` (new) |
| [4-H-1]  | `src/tests/runtime/openclaw-command-validation.test.js` (new) |
| [4-H-2]  | `src/tests/runtime/external-mcp-command-validation.test.js` (new) |
| [4-H-3]  | `src/tests/global/keychain-cli-validation.test.js` (new) |
| [4-H-4]  | `src/tests/runtime/prompt-file-loader-boundary.test.js` (new) |
| [4-H-5]  | `src/tests/runtime/graph-indexer-e2e.test.js` (new) |
| [N-1]    | `src/tests/cli/openkit-cli.test.js:640-711` (existing, currently failing on macOS) + new `src/tests/runtime/switch-profiles-cli.test.js` for import-vs-spawn behavior |
| Medium / Low / [X-*] | Existing suites + targeted small additions per entry |

After every wave, run `npm run verify:all` and a manual smoke test of all 3 lanes on a fresh project before proceeding to the next wave.
