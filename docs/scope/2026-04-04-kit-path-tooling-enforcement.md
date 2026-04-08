---
artifact_type: scope_package
version: 1
status: draft
feature_id: FEATURE-006
feature_slug: kit-path-tooling-enforcement
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Kit Path & Tooling Enforcement

## Goal

Eliminate recurring path-not-found failures in global-install mode and close the gap between documented tool-substitution rules and actual runtime enforcement, so that operators and agents can trust that artifacts land in the right place and that kit intelligence tools are used by default instead of OS-level commands.

## Target Users

- **Kit operators** who install OpenKit globally (`openkit run`) and trigger full-delivery or migration work items against a project repository.
- **Agent roles** (Quick Agent, Fullstack Agent, Code Reviewer, QA Agent) that read or write artifacts and choose between OS tools and kit intelligence tools during sessions.
- **Kit maintainers** who rely on `openkit doctor` and the contract-consistency checks to detect drift between documented contracts and runtime behavior.

## Problem Statement

Three related but distinct problems are recurring:

### Problem 1 — Project-root mislabelling causes artifact misplacement

When OpenKit runs in global/managed mode, the runtime derives `projectRoot` incorrectly. `readManagedState` receives the managed runtime-workspace root from `ensureWorkItemStoreReady` but labels it `projectRoot`. This mislabelled value flows into `autoScaffoldPrimaryArtifactIfNeeded`, causing scaffolded scope and solution packages to land in the **wrong filesystem directory** — typically the parent of the actual project tree.

**Observed evidence (this work item):** The auto-scaffold for FEATURE-006 wrote `docs/scope/2026-04-04-kit-path-tooling-enforcement.md` to `/home/duypham/Projects/docs/scope/` instead of `/home/duypham/Projects/open-kit/docs/scope/`. The runtime status reports `project root: /home/duypham/Projects` when it should report `/home/duypham/Projects/open-kit`.

A prior scope package (`docs/scope/2026-04-04-full-lane-path-scaffold-fix.md`) diagnosed this same root cause and proposed a fix surface. After a recent pull, some improvements may have landed, but **the bug is still live** as of this session.

### Problem 2 — Doctor contract-consistency check fails due to wording drift

`openkit doctor` reports one error: `workflow contract states full delivery owns execution task boards`. The check in `contract-consistency.js` uses regex patterns that expect specific phrasing (e.g., "Execution task boards belong only to Full Delivery work items" or "full delivery owns task board"). The actual canonical text in `workflow.md` uses different wording: "task boards belong only to full-delivery work items" (no "Execution" prefix, hyphenated compound). Additionally, the check concatenates text from `docs/specs/` and `docs/plans/` files that were pruned during repository cleanup — those files no longer exist, removing supplementary matching text that previously made the check pass.

### Problem 3 — Tool-substitution rules are documented but not enforced at runtime

`context/core/tool-substitution-rules.md` declares that OS commands (`grep`, `find`, `cat`, `head`, `tail`, `sed`, `awk`, `wc`, `echo > file`) are **blocked** on source code files in `strict` mode (the default for quick and full work). `AGENTS.md` repeats this rule. However, agents routinely use these OS commands without runtime interception or rejection. The enforcement is purely advisory — there is no runtime mechanism that intercepts Bash tool calls, detects banned commands, and blocks or warns. The gap between "documented as blocked" and "actually allowed" erodes trust in the tool-substitution contract and means kit intelligence tools (semantic search, AST search, symbol navigation, etc.) are underused.

## In Scope

### Scope Area 1 — Path Resolution Correctness

- Fix the project-root mislabelling so that `readManagedState`, `autoScaffoldPrimaryArtifactIfNeeded`, `linkArtifact`, and `validatePrimaryArtifactContracts` all resolve the real project root consistently.
- Ensure auto-scaffold writes artifacts under the operator's actual project tree, not the managed runtime-workspace tree.
- Ensure template resolution searches the kit root and the real project root.
- Ensure manual `scaffold-artifact` and automatic `advance-stage` scaffold share the same path resolution.
- Ensure artifact paths stored in `state.artifacts.*` are relative to the real project root.
- Cover the three-root divergence scenario (runtimeRoot ≠ projectRoot ≠ kitRoot) in validation.

### Scope Area 2 — Doctor Contract-Consistency Alignment

- Fix the failing doctor check so that the regex patterns in `contract-consistency.js` match the canonical wording in `workflow.md` and `session-resume.md`.
- Remove or update references to pruned `docs/specs/` and `docs/plans/` files that the check concatenates.
- Ensure the check remains meaningful — it should validate that the workflow contract actually documents full-delivery task-board ownership, not just match arbitrary text.

### Scope Area 3 — Tool-Substitution Runtime Enforcement

- Introduce a runtime mechanism that intercepts agent Bash tool calls on source code files and applies the documented enforcement level (`strict`, `moderate`, `permissive`).
- In `strict` mode: block banned OS commands on source code files and return a clear error message directing the agent to the correct built-in or kit tool.
- In `moderate` mode: warn on banned OS commands but allow execution.
- In `permissive` mode: no intervention.
- Expose the active enforcement level in `openkit doctor` output.
- Ensure the enforcement mechanism does not block legitimate Bash usage (git, package managers, build/test runners, system operations).

## Out of Scope

- Changing the three-root path model itself (the split between projectRoot, runtimeRoot, and kitRoot is correct by design).
- Changing the global kit install flow, `openkit run`, or `openkit uninstall` beyond what path resolution requires.
- Changing the quick-lane scaffold path (task_card), which is not affected by the path bug.
- Adding new scaffold kinds or artifact types.
- Adding new kit intelligence tools — the current tool inventory is sufficient; the gap is enforcement of existing rules.
- Refactoring the tool-substitution rules document itself — the documented rules are correct; the gap is runtime enforcement.
- Full agent behavior monitoring or analytics — enforcement should be a focused interception mechanism, not a broad observability system.
- Migration slice board or task board path handling (separate concern from artifact scaffold paths).

## Main Flows

### Flow 1 — Operator triggers full-delivery work in global mode

1. Operator runs `openkit run` from their project directory.
2. Operator invokes `/delivery` or `/task` (routed to full).
3. Master Orchestrator creates work item, advances to `full_intake`, then to `full_product`.
4. Runtime auto-scaffolds `docs/scope/YYYY-MM-DD-<slug>.md`.
5. **Expected:** File lands in the operator's project tree. Template is found from kit root. Linked artifact path is project-relative. `openkit doctor` passes.
6. **Currently broken at step 5:** File lands in the wrong directory. Runtime status reports wrong project root.

### Flow 2 — Agent executes work and chooses tools

1. Agent receives a task during `full_implementation` or `quick_implement`.
2. Agent needs to search code, read files, or transform code.
3. **Expected:** Agent uses kit intelligence tools (semantic search, AST search, syntax outline) or built-in tools (Grep, Read, Edit). If agent attempts `grep`, `cat`, `find` on source files via Bash, runtime blocks the call in strict mode with a clear message.
4. **Currently broken at step 3:** Agent uses OS commands freely. No runtime interception occurs. Kit tools are underused.

### Flow 3 — Maintainer runs doctor diagnostics

1. Maintainer runs `openkit doctor` or `node .opencode/workflow-state.js doctor`.
2. Contract-consistency checks run against workflow docs.
3. **Expected:** All checks pass when the canonical docs are internally consistent.
4. **Currently broken at step 3:** One check fails due to regex/wording drift and pruned source files.

## Business Rules

1. **Artifacts always land in the project tree.** Auto-scaffolded and manually scaffolded scope, solution, and QA packages must write to the operator's real project root, never to the managed runtime-workspace path.
2. **Templates resolve from kit root or project root.** Template lookup must search the kit root first, then the real project root. It must never search only the runtime-workspace root.
3. **Linked artifact paths are project-relative.** Paths stored in `state.artifacts.*` must resolve correctly against the real project root regardless of runtime-workspace location.
4. **Manual and automatic scaffold share identical path resolution.** The three roots (projectRoot, runtimeRoot, kitRoot) must be resolved the same way by both code paths.
5. **State storage stays in the runtime root.** Workflow state, work-item state, and the compatibility mirror remain in the runtime-workspace root. Only artifact output goes to the project root.
6. **Doctor checks must match canonical wording.** Contract-consistency regex patterns must be maintained against the actual canonical workflow docs, not against pruned or historical supplementary docs.
7. **Doctor checks must reference only files that exist.** If a check concatenates text from multiple files, missing files must not silently weaken the check.
8. **Tool enforcement matches documented level.** The active enforcement level (strict/moderate/permissive) must produce the documented behavior: block, warn, or allow.
9. **Legitimate Bash usage is never blocked.** Git, package managers, build runners, system operations, and other non-source-reading Bash usage must remain unaffected by tool enforcement.
10. **Enforcement level is observable.** The active enforcement level must be visible in doctor output and runtime status so operators and agents know which rules are active.

## Acceptance Criteria Matrix

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | Full-delivery work item in global mode, `OPENKIT_KIT_ROOT` ≠ `OPENKIT_PROJECT_ROOT` | `advance-stage full_product` auto-scaffolds scope_package | File is created under `<projectRoot>/docs/scope/`, not under the runtime-workspace path |
| AC-2 | Same setup as AC-1, stage is `full_product` | `advance-stage full_solution` auto-scaffolds solution_package | File is created under `<projectRoot>/docs/solution/`, not under the runtime-workspace path |
| AC-3 | Templates exist only in kitRoot | Auto-scaffold runs for any stage | Template is found from kitRoot and scaffold succeeds |
| AC-4 | Local-only mode (runtimeRoot = projectRoot, no global env vars) | `advance-stage full_product` runs | Identical behavior to pre-fix local mode — no regression |
| AC-5 | Manual `scaffold-artifact scope_package` in global mode | Scaffold runs | Output path matches the auto-scaffold path from AC-1 exactly |
| AC-6 | Artifact is linked in state after auto-scaffold in global mode | `validatePrimaryArtifactContracts` runs | Validation resolves path against real project root and finds the file |
| AC-7 | Migration mode, `advance-stage migration_strategy` in global mode | Auto-scaffold runs for solution_package | Same correct path behavior as AC-1/AC-2 |
| AC-8 | Canonical `workflow.md` and `session-resume.md` unchanged | `openkit doctor` runs | The full-delivery task-board ownership check passes |
| AC-9 | Doctor check references `docs/specs/` or `docs/plans/` files | Those files do not exist | The check does not silently weaken — it either finds the relevant text in remaining sources or is updated to not require missing files |
| AC-10 | Agent issues `grep pattern src/file.js` via Bash in strict mode | Runtime intercepts the Bash call | Call is blocked with a clear error message naming the correct alternative tool |
| AC-11 | Agent issues `cat src/file.js` via Bash in strict mode | Runtime intercepts | Call is blocked with a message directing to the Read tool |
| AC-12 | Agent issues `find . -name '*.js'` via Bash in strict mode | Runtime intercepts | Call is blocked with a message directing to the Glob tool |
| AC-13 | Agent issues `git status` via Bash in strict mode | Runtime processes the call | Call proceeds normally — not blocked |
| AC-14 | Agent issues `npm install` or `node script.js` via Bash in strict mode | Runtime processes the call | Call proceeds normally — not blocked |
| AC-15 | Enforcement level is `moderate` | Agent issues `cat src/file.js` via Bash | Warning is emitted but call proceeds |
| AC-16 | Enforcement level is `permissive` | Agent issues `cat src/file.js` via Bash | No warning, call proceeds |
| AC-17 | Operator runs `openkit doctor` | Doctor output includes enforcement section | Active enforcement level and enforcement status are visible |
| AC-18 | `OPENKIT_ENFORCEMENT_LEVEL` env var is set to `permissive` | Doctor runs and status is checked | Enforcement level reflects the override, not the mode default |

## Edge Cases

- **`OPENKIT_PROJECT_ROOT` not set but `OPENKIT_KIT_ROOT` is set:** `resolveProjectRoot` falls back to `detectProjectRoot(cwd)`. Scaffold must still use the detected project root.
- **Project root has no `docs/scope/` or `docs/solution/` directory:** Scaffold must create the directory under the real project root.
- **Artifact already exists at target path:** Existing duplication guard must fire against the real project root path.
- **kitRoot equals projectRoot (authoring mode):** Template resolution finds templates on the first candidate and does not break.
- **runtimeRoot equals projectRoot (local-only mode):** The fix is a no-op — all existing local-mode behavior is preserved.
- **Agent command is ambiguous:** `grep` used in a pipeline with non-source targets (e.g., `grep pattern /etc/hosts`) should not be blocked. Enforcement should target source code file paths, not all grep usage globally.
- **Agent uses mixed command:** `git log | grep pattern` — the grep here operates on git output, not source files, and should not be blocked.
- **Kit intelligence tools are degraded or unindexed:** Enforcement should block the OS command but the error message should note that fallback to the built-in tool (Grep, Read, etc.) is still available, not only the kit intelligence tool.
- **Doctor check wording evolves again:** If workflow.md is edited in the future, the contract check should be resilient to minor phrasing changes while still validating the actual semantic claim (full delivery owns task boards).

## Error And Failure Cases

- **Path resolution returns wrong root:** Artifacts land in wrong directory. Validation fails because file does not exist at expected project-relative path. Doctor may report inconsistency. This is the current state for Problem 1.
- **Doctor check regex too strict:** Legitimate wording changes in workflow docs cause spurious doctor errors. Maintainers lose trust in doctor output. This is the current state for Problem 2.
- **Doctor check regex too loose:** Check passes even when the workflow contract no longer actually claims full-delivery task-board ownership. This would be a regression from overfixing.
- **Enforcement blocks legitimate Bash:** If the command classifier is too aggressive, agents cannot run git, package managers, or build tools. This would break agent workflow.
- **Enforcement misses banned commands:** If the classifier is too narrow, banned commands pass through and the documented contract remains unenforced.
- **Enforcement adds latency:** If interception adds noticeable delay to every Bash call, agent workflow degrades. Interception should be fast (pattern match, not full command parsing).

## Open Questions

1. **Scope Area 1 overlap with FIX-PATH-SCAFFOLD:** The earlier scope package `docs/scope/2026-04-04-full-lane-path-scaffold-fix.md` covers the same path-resolution bug. Is that work item still active, already merged, or superseded? If already merged, why is the bug still live? **Assumption for this scope:** The fix either did not land or was incomplete. This scope package treats path resolution as in-scope and does not depend on the prior work item.

2. **Enforcement interception point:** The tool-substitution-rules doc says enforcement is active, but no interception mechanism exists. Where in the runtime should the interception live — in the MCP server layer, in a Bash tool wrapper, or in the OpenCode permission system? **This is a Solution Lead decision, not a product decision.** Product requirement is: banned commands are blocked in strict mode.

3. **Source-file detection heuristic:** How does the enforcement mechanism distinguish `grep pattern src/file.js` (should block) from `grep pattern` on piped input (should allow)? **Assumption:** A reasonable heuristic based on command arguments and file path patterns is sufficient. Perfect accuracy is not required for v1 — false negatives (missed blocks) are more acceptable than false positives (blocking legitimate usage).

4. **Compatibility mirror sync for feature-006:** The compatibility mirror at `.opencode/workflow-state.json` still shows FEATURE-001 data even after `activate-work-item feature-006`. The managed state in the workspace root is correct. Is the compatibility mirror sync broken, or is this a consequence of the same project-root mislabelling? **Assumption:** This is likely part of Problem 1 and should be verified during implementation.

## Success Signal

- `openkit doctor` reports 0 errors on a clean checkout with no workarounds.
- Full-delivery auto-scaffold in global mode writes artifacts to the correct project directory on first attempt, verified by file existence at the expected project-relative path.
- An agent attempting `cat src/file.js` in strict mode receives a blocking error with a clear remediation message instead of the file contents.
- The active enforcement level is visible in `openkit doctor` output.

## Handoff Notes For Solution Lead

- **Scope Area 1** has a prior diagnosis in `docs/scope/2026-04-04-full-lane-path-scaffold-fix.md` with specific root-cause analysis pointing to `readManagedState` in `workflow-state-controller.js`. Use that analysis as a starting point but verify against current code — the fix may have been attempted and partially landed.
- **Scope Area 2** is narrow: update regex patterns in `.opencode/lib/contract-consistency.js` and remove stale file references to `docs/specs/` and `docs/plans/`. The existing test at `.opencode/tests/workflow-contract-consistency.test.js` (line ~290) has a passing variant that shows what wording the check should accept.
- **Scope Area 3** is the largest design surface. The product requirement is behavioral (block/warn/allow), not architectural. Solution Lead should decide the interception mechanism. Key constraint: no false positives on legitimate Bash (git, npm, build tools, system ops).
- The three scope areas are independently deliverable. Solution Lead may sequence them as separate slices if that reduces risk.
- Preserve existing local-only mode behavior — all fixes must be no-ops when runtimeRoot equals projectRoot.
