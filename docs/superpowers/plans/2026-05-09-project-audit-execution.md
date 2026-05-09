# OpenKit Full Project Audit — Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full audit defined in `docs/superpowers/specs/2026-05-09-project-audit-design.md`, producing two committed deliverables: an audit report and a fix plan, both ready for user review.

**Architecture:** Dispatch 4 parallel subagents (Runtime/Workflow, Install/CLI, Contract Layer, Cross-cutting) each scanning a distinct slice of the repo and returning a uniform sub-report. Main agent then deduplicates findings, runs five cross-layer drift checks the subagents cannot see, verifies Critical (100%) and a 1/3 spot-check of High, and writes the report + fix plan to `docs/superpowers/specs/`.

**Tech Stack:** Node.js project (npm package `@duypham93/openkit` v0.5.1). Audit is read-only — no source files are modified during this plan; only two markdown deliverables are created. Subagents use `Explore` (read-only) where possible; `general-purpose` only when broader reasoning is needed.

**Spec reference:** `docs/superpowers/specs/2026-05-09-project-audit-design.md` (sections referenced as §1.1–§5.6).

---

## Pre-flight

### Task 0: Verify clean baseline & confirm spec is committed

**Files:**
- Read-only: `docs/superpowers/specs/2026-05-09-project-audit-design.md`

- [ ] **Step 1: Confirm working tree is clean**

Run: `git status --short`
Expected: empty output (no staged or unstaged changes)

If the working tree is not clean, stop and ask the user how to proceed. Do not stash automatically.

- [ ] **Step 2: Confirm the design spec exists and is committed**

Run: `git log --oneline -- docs/superpowers/specs/2026-05-09-project-audit-design.md`
Expected: at least one commit referencing the spec (e.g. `e41ff3d` or later).

If the spec is uncommitted or missing, stop — re-run `superpowers:brainstorming` first.

- [ ] **Step 3: Record baseline commit SHA**

Run: `git rev-parse HEAD`
Save the output as `BASELINE_SHA` for reference in the audit report (so reviewers know which tree was audited).

---

## Phase A — Parallel sub-agent scans (§2)

The four subagent tasks below MUST be dispatched **concurrently** in a single assistant message containing four `Agent` tool calls. Do not run them sequentially.

Each subagent prompt MUST:
1. Tell the subagent it is part of a coordinated audit (so it does not propose fixes).
2. Tell it the **exact** in-scope paths and out-of-scope paths.
3. Require the uniform sub-report template from §2.5 of the spec.
4. Forbid editing files (read-only audit).
5. Require explicit `file:line` for every Critical/High finding.
6. Require a `Notes` section listing every directory it actually read and any it skipped (with reason).
7. Cap response length: target ≤ 6000 words to keep the parent context manageable.

The shared sub-report template each subagent must produce (paste verbatim into each prompt):

```
## [Subagent N] — <vùng>

### Critical
- [N-C-1] <title> — `path/to/file.js:LINE` (or LINE-LINE)
  - Description (1-2 sentences)
  - Evidence/repro: <how I know — code excerpt, grep result, or repro steps>
  - Suggested fix (1 line, no code)

### High
- [N-H-1] ...

### Medium
- [N-M-1] ...

### Low
- [N-L-1] ...

### Notes
- Directories read: <list>
- Directories skipped (with reason): <list or "none">
- Open questions for main agent: <list or "none">
```

ID prefix per subagent: `1-` for runtime, `2-` for install, `3-` for contract, `4-` for cross-cutting. So a Critical from subagent 2 is `[2-C-1]`.

### Task 1: Dispatch all four subagents in parallel

**Files:**
- Read-only: entire repo (each subagent gets a distinct slice)
- No files created in this task — sub-reports come back as tool results and are saved in Task 2.

- [ ] **Step 1: Send a single assistant message containing four `Agent` tool calls**

The four `Agent` tool calls in that single message:

**Call 1 — Subagent 1 (Runtime + Workflow Core), `subagent_type: Explore`, `description: "Audit runtime + workflow core"`:**

```
You are Subagent 1 in a coordinated audit of the OpenKit project (npm package @duypham93/openkit v0.5.1). This is a READ-ONLY audit — you must not edit any files.

In-scope paths:
- .opencode/lib/ (workflow-state, kernel, controller, FSM, bootstrap)
- src/runtime/
- src/mcp-server/
- hooks/

Out-of-scope: everything else (other subagents are covering it). Do not read node_modules/, release-notes/, or files outside the in-scope list.

Look for:
- FSM transitions that are invalid, dead, or missing (especially after the recent quick_brainstorm removal — check that no code, schema, or config still references quick_brainstorm)
- Race conditions when multiple processes touch the SQLite workflow state
- Bootstrap path quick_intake → quick_plan: any leftover artefacts or broken references
- Error handling in kernel/controller: swallowed throws, silent fallbacks, missing await
- MCP tool schemas vs handler signature mismatches in src/mcp-server/
- Hook lifecycle issues in hooks/: blocking I/O on session-start, infinite loops in graph-indexer, side effects on user repos
- State path resolution edge cases: fresh project (no .opencode/state), paths containing spaces, symlinked project roots

For every Critical or High finding you MUST cite an exact file path and line number (or line range), plus a short evidence snippet (code excerpt or grep output). For Medium/Low, file:line is still required but evidence can be a one-line reasoning.

Return your findings using EXACTLY this template (use ID prefix `1-`):

## [Subagent 1] — Runtime + Workflow Core

### Critical
- [1-C-1] <title> — `path/to/file.js:LINE`
  - Description (1-2 sentences)
  - Evidence/repro: <how I know>
  - Suggested fix (1 line, no code)

### High
- [1-H-1] ...

### Medium
- [1-M-1] ...

### Low
- [1-L-1] ...

### Notes
- Directories read: <list>
- Directories skipped (with reason): <list or "none">
- Open questions for main agent: <list or "none">

Cap your response at ~6000 words. Do not propose code; the parent agent will design fixes separately. If you find no issues at a priority level, write `(none)` under that heading.
```

**Call 2 — Subagent 2 (Install / CLI / Distribution), `subagent_type: Explore`, `description: "Audit install + CLI + distribution"`:**

```
You are Subagent 2 in a coordinated audit of the OpenKit project (npm package @duypham93/openkit v0.5.1). This is a READ-ONLY audit — you must not edit any files.

In-scope paths:
- src/install/
- bin/ (openkit.js, openkit-mcp.js)
- scripts/ (sync-install-bundle.mjs, verify-install-bundle.mjs, verify-mcp-secret-package-readiness.mjs, create-release-notes.js)
- package.json (especially the `files` field)
- The install manifest at .opencode/install-manifest.json
- The doctor command and upgrade flow (search src/ for "doctor" and "upgrade")

Out-of-scope: .opencode/lib/, src/runtime/, src/mcp-server/, agents/, commands/, skills/, registry.json. Other subagents cover those.

Look for:
- Files declared in package.json#files that don't exist on disk, or files on disk that should be in `files` but aren't
- src/install/merge-policy.js: does it overwrite user files without backup? Does it handle concurrent installs / partial writes?
- src/install/discovery.js and src/install/materialize.js: path traversal, symlink-follow vulnerabilities, permission errors
- Doctor command: any check that returns OK while the underlying state is broken (false green), or returns red on a healthy state (false red)
- Upgrade flow: data migration between versions, rollback safety, what happens if upgrade is interrupted halfway
- Verify scripts: do they actually catch the things they claim to (especially verify-mcp-secret-package-readiness.mjs and verify-install-bundle.mjs)
- bin/ entry points: argv parsing, error exit codes, behavior when run outside an OpenKit project

For every Critical or High finding you MUST cite an exact file path and line number (or line range), plus a short evidence snippet.

Return findings using the template (ID prefix `2-`):

## [Subagent 2] — Install / CLI / Distribution

### Critical / High / Medium / Low / Notes
(same structure as Subagent 1)

Cap response at ~6000 words. Read-only — do not propose code edits.
```

**Call 3 — Subagent 3 (Contract Layer), `subagent_type: Explore`, `description: "Audit agents/commands/skills contract"`:**

```
You are Subagent 3 in a coordinated audit of the OpenKit project (npm package @duypham93/openkit v0.5.1). This is a READ-ONLY audit — you must not edit any files.

In-scope paths:
- agents/*.md (7 files: master-orchestrator, product-lead-agent, solution-lead-agent, fullstack-agent, qa-agent, quick-agent, code-reviewer)
- commands/*.md (15 files)
- skills/ (20 bundled skill directories — read SKILL.md in each)
- registry.json
- AGENTS.md
- instructions/
- context/
- README.md, CHANGELOG.md, RELEASES.md (for cross-checks)

Out-of-scope: src/, .opencode/lib/, hooks/, scripts/, tests/, bin/. Other subagents cover those.

Look for:
- Drift between registry.json stages, FSM stages referenced from .opencode/lib/, and agent ownership claims in agents/*.md (do not load .opencode/lib/ files — instead, list the stage names referenced in registry.json and let the main agent reconcile against runtime)
- Agents that reference a command, skill, or tool that does not exist in this repo
- Commands that name a stage or agent that does not exist
- The 3 lanes (quick-task, delivery, migrate): for each lane, trace the chain of stages from kickoff to terminal stage. Flag any stage with no command that triggers it, or no agent that owns it.
- Skills under skills/: each must have a valid SKILL.md (frontmatter present, name matches directory, description present). Flag any skill with broken metadata or paths.
- Documentation drift: README.md, AGENTS.md, CHANGELOG.md, RELEASES.md, and package.json must agree on the current version string (currently "0.5.1") and on naming of lanes/agents/commands.
- AGENTS.md vs each agent's individual file in agents/: contradictions, missing agents, deprecated agents still listed.

For every Critical or High finding you MUST cite an exact file path and line number (or line range).

Return findings using the template (ID prefix `3-`):

## [Subagent 3] — Contract Layer

### Critical / High / Medium / Low / Notes
(same structure)

Cap response at ~6000 words. Read-only.
```

**Call 4 — Subagent 4 (Cross-cutting), `subagent_type: general-purpose`, `description: "Audit security + supply chain + coverage"`:**

```
You are Subagent 4 in a coordinated audit of the OpenKit project (npm package @duypham93/openkit v0.5.1). This is a READ-ONLY audit — you must not edit any files.

Scope: the entire repo, but focused by issue type rather than by directory. Skip node_modules/ and release-notes/.

Look for:

1. Command injection — every call to child_process.execSync, exec, spawn, spawnSync, or similar in src/, .opencode/lib/, hooks/, bin/, scripts/. For each call, identify whether any argument can be influenced by user-controlled input (config values, CLI args, file contents from a target project, env vars). Flag concrete examples.

2. Path traversal — file operations (fs.readFile, fs.writeFile, fs.readdir, fs.mkdirSync, etc.) that take paths derived from config files, user input, or files inside a target project, without normalization or boundary checks.

3. Secret handling — search for occurrences of process.env, dotenv, MCP secret loading, and any place a token/credential might be logged. Flag anywhere a secret could end up in a log line, error message, or audit log.

4. Supply chain — read package.json dependencies. For each direct dependency: pinned vs caret/range, known security advisories (use your knowledge — do not run external network calls), postinstall/preinstall scripts in dependencies that warrant scrutiny. Also check that no dependency is missing a lockfile entry.

5. Test coverage gaps — list the tests present under tests/ and .opencode/tests/. Compare against critical paths: bootstrap (quick/delivery/migrate lanes), merge-policy, hooks (session-start, graph-indexer), FSM transitions, doctor command, upgrade flow. Flag any critical path with only unit tests and no E2E coverage.

6. Existing semgrep / quality rules — read tests/semgrep/quality-rules.test.js and skim what it enforces. Identify rule categories that are conspicuously absent (e.g. command injection rules, secret-leak rules) given the surface area in #1–#3.

For every Critical or High finding you MUST cite an exact file path and line number (or line range), plus an evidence snippet (code excerpt, grep output, or test list).

Return findings using the template (ID prefix `4-`):

## [Subagent 4] — Cross-cutting

### Critical / High / Medium / Low / Notes
(same structure)

Cap response at ~6000 words. Read-only.
```

- [ ] **Step 2: Verify all four subagents returned**

Each tool result block should contain exactly one sub-report following the template (header `## [Subagent N] — ...`, sections Critical/High/Medium/Low/Notes).

If a subagent returned an empty or malformed report, do NOT proceed. Re-dispatch only that subagent with a clarifying note: *"Your previous response did not follow the required template. Please re-emit using exactly the template provided."*

- [ ] **Step 3: Sanity check that each sub-report cites real files**

For each subagent's first Critical (or first High if no Critical), spot-check the cited path with `ls`:

Run: `ls <path-cited>`
Expected: file exists.

If the cited path does not exist, the subagent hallucinated. Re-dispatch that subagent with a note instructing it to verify each path with `ls` before citing.

---

## Phase B — Persist sub-reports & sanity checks

### Task 2: Save the four sub-reports to disk (working scratch)

**Files:**
- Create: `docs/superpowers/specs/_audit-2026-05-09/subagent-1-runtime.md`
- Create: `docs/superpowers/specs/_audit-2026-05-09/subagent-2-install.md`
- Create: `docs/superpowers/specs/_audit-2026-05-09/subagent-3-contract.md`
- Create: `docs/superpowers/specs/_audit-2026-05-09/subagent-4-crosscutting.md`

These are working artifacts so the audit can survive a context compact (§5.4 of the spec). They will be committed at the end of Phase D.

- [ ] **Step 1: Create the scratch directory**

Run: `mkdir -p docs/superpowers/specs/_audit-2026-05-09`
Expected: directory exists.

- [ ] **Step 2: Write each sub-report to its own file**

Use the `Write` tool four times. Each file gets the verbatim sub-report from Task 1.

After writing, verify all four exist:

Run: `ls docs/superpowers/specs/_audit-2026-05-09/`
Expected:
```
subagent-1-runtime.md
subagent-2-install.md
subagent-3-contract.md
subagent-4-crosscutting.md
```

- [ ] **Step 3: Update TodoWrite/TaskCreate with audit progress snapshot**

Add a task `Audit state snapshot` with description containing: `Sub-reports written. Phase A complete. Next: cross-layer checks (§3.2).`

This is the recovery anchor if context is compacted.

---

## Phase C — Main agent: dedupe, cross-layer, verify (§3)

### Task 3: Dedupe & merge findings across the four sub-reports (§3.1)

**Files:**
- Read: all four files in `docs/superpowers/specs/_audit-2026-05-09/`
- Create: `docs/superpowers/specs/_audit-2026-05-09/merged-findings.md`

- [ ] **Step 1: Read all four sub-reports**

Use the `Read` tool on each of the four files written in Task 2.

- [ ] **Step 2: Build a merged-findings document**

Create `docs/superpowers/specs/_audit-2026-05-09/merged-findings.md` with this structure:

```markdown
# Merged audit findings

## Duplicates (issues flagged by ≥2 subagents)

For each duplicate group, list:
- Combined ID: `[D-1]` (D = duplicate)
- Source IDs: e.g. `[1-C-2] + [4-H-3]`
- Title (use the clearest title)
- File:line (intersection)
- Final priority (highest of the two)

## Unique findings

List every non-duplicate issue from all four sub-reports under its priority heading, preserving its original ID:

### Critical
- [1-C-1] ...
- [2-C-1] ...

### High
- ...

### Medium
- ...

### Low
- ...
```

The dedupe rule (from §3.1): two issues are duplicates if they cite overlapping line ranges OR clearly describe the same root cause even if cited in different files (e.g. "FSM stage missing" found by both subagent 1 and 3).

When unsure, list as duplicate and note the ambiguity. The final report can break them apart again if needed.

- [ ] **Step 3: Verify the merged file is internally consistent**

Run: `grep -c "^- \[" docs/superpowers/specs/_audit-2026-05-09/merged-findings.md`
Expected: a count ≥ the sum of unique findings across sub-reports minus duplicates.

If the count looks suspiciously low (e.g. you dropped a section), re-read your sub-reports and patch the merged file.

### Task 4: Run the five cross-layer drift checks (§3.2)

**Files:**
- Read-only across multiple files
- Append to: `docs/superpowers/specs/_audit-2026-05-09/merged-findings.md` (new section: `## Cross-layer findings`)

Each cross-layer check below produces zero or more new findings with ID prefix `X-` (cross). These do NOT come from any single subagent — they come from the main agent comparing sources.

- [ ] **Step 1: Cross-layer check 1 — FSM ↔ registry.json ↔ commands**

Run:
```
grep -hE 'stage[s]?[: ]+["a-z_]+' registry.json | sort -u > /tmp/audit-stages-registry.txt
grep -rohE '"[a-z_]+_(intake|plan|design|build|verify|done|brainstorm|complete)"' .opencode/lib/ | sort -u > /tmp/audit-stages-fsm.txt
grep -lE 'stage[s]?[: ]+' commands/*.md > /tmp/audit-commands-with-stages.txt
```

Then read both `/tmp/audit-stages-*.txt` and the listed command files. Compare:
- Stages in `registry.json` that don't appear in `.opencode/lib/`
- Stages in `.opencode/lib/` that don't appear in `registry.json`
- Stages referenced by commands that are in neither set

For each mismatch, append a finding `[X-1], [X-2], ...` to the cross-layer section of `merged-findings.md`. Use priority **High** if the mismatch could cause bootstrap failure, otherwise Medium.

- [ ] **Step 2: Cross-layer check 2 — Agents ↔ skills ↔ commands**

Read every `agents/*.md`, every `commands/*.md`, and every `skills/*/SKILL.md`.

For each `<reference>` in agent files (mentions of skills, commands, or other agents):
Run: `ls <referenced-path>` (or `grep -l <referenced-name> commands/ skills/ agents/`).
If the reference cannot be resolved, append a cross-layer finding.

For each command's frontmatter or body that names a skill/agent: same check.

- [ ] **Step 3: Cross-layer check 3 — package.json#files ↔ filesystem ↔ install manifest**

Run:
```
node -e "const p=require('./package.json'); console.log(p.files.join('\n'))" > /tmp/audit-pkg-files.txt
cat .opencode/install-manifest.json
```

For each entry in `/tmp/audit-pkg-files.txt`:
Run: `ls -d <entry>` (use `-d` because some entries are directories).
Flag entries that don't exist.

For each top-level directory or file that *should* be shipped (anything outside `node_modules/`, `tests/`, `release-notes/`, `docs/superpowers/`, `.git/`, `.github/`, dotfiles) but is NOT in `pkg.files`: flag as potential missed asset.

Compare with `install-manifest.json` entries — they must be a subset of `pkg.files`.

- [ ] **Step 4: Cross-layer check 4 — Version consistency**

Run:
```
node -e "console.log(require('./package.json').version)"
grep -E '^## \[?[0-9]+\.[0-9]+\.[0-9]+' CHANGELOG.md | head -3
grep -E 'v?[0-9]+\.[0-9]+\.[0-9]+' RELEASES.md | head -3
grep -E 'v?[0-9]+\.[0-9]+\.[0-9]+' README.md AGENTS.md | head -10
```

Verify the package.json version matches the latest CHANGELOG entry and is mentioned (or not contradicted) in README/AGENTS/RELEASES. Flag any disagreement.

- [ ] **Step 5: Cross-layer check 5 — Test coverage of critical paths**

Critical paths (from §3.2 of the spec): bootstrap (3 lanes), merge-policy, hooks, FSM transitions, doctor, upgrade.

Run:
```
ls tests/runtime/*.test.js .opencode/tests/*.test.js
```

For each critical path, find at least one E2E or integration test (not just unit). Search for keywords:
- bootstrap: `grep -l "bootstrap" tests/runtime/*.test.js .opencode/tests/*.test.js`
- merge-policy: `grep -l "merge-policy\|mergePolicy" tests/install/*.test.js`
- hooks: `grep -l "session-start\|graph-indexer" tests/runtime/*.test.js .opencode/tests/*.test.js`
- doctor: `grep -l "doctor" tests/runtime/*.test.js .opencode/tests/*.test.js tests/cli/*.test.js`
- upgrade: `grep -l "upgrade" tests/runtime/*.test.js .opencode/tests/*.test.js tests/cli/*.test.js`

Any critical path with zero matching test files: flag as `[X-?]` Medium (test coverage gap).

- [ ] **Step 6: Append all cross-layer findings to merged-findings.md**

The new section structure:

```markdown
## Cross-layer findings

### High
- [X-1] ...

### Medium
- [X-3] ...
```

### Task 5: Verify Critical (100%) and spot-check High (1/3) (§3.3)

**Files:**
- Read-only across cited files
- Append to: `docs/superpowers/specs/_audit-2026-05-09/merged-findings.md` (new section: `## Verification log`)

- [ ] **Step 1: Verify every Critical finding by re-reading the cited file**

For each Critical (including duplicates and cross-layer):
Run: `Read` on the cited path with `offset` set to a few lines above the cited line and a small `limit` (~30 lines).
Confirm the evidence in the sub-report matches what the file actually says.

If it doesn't match: downgrade or remove the finding, and log the action in the Verification log section.

- [ ] **Step 2: Spot-check 1/3 of High findings**

Count the High findings (including cross-layer). Pick `ceil(count / 3)` of them at random — easiest deterministic way: pick every 3rd one starting from the first.

For each picked High: Read the cited file as in Step 1.

If ≥ 50% of the spot-checked Highs fail verification: re-dispatch the relevant subagent (the one whose ID prefix matches) with a note: *"Several of your High findings failed verification (list specific IDs). Please re-verify all your High findings using the Read tool to confirm exact file:line, then re-emit your sub-report."*

- [ ] **Step 3: Append verification log**

```markdown
## Verification log

### Critical (100% verified)
- [1-C-1] ✓ verified at file.js:123 — evidence matches
- [1-C-2] ✗ DOWNGRADED to High — evidence misread; actual line shows ...
- ...

### High (spot-check 1/3)
- [2-H-1] (spot-checked) ✓
- [2-H-4] (spot-checked) ✗ — DOWNGRADED to Medium
- ...

### Re-dispatches triggered
- (list any subagent re-dispatches)
```

---

## Phase D — Write deliverables (§3.5, §4)

### Task 6: Write the audit report

**Files:**
- Create: `docs/superpowers/specs/2026-05-09-project-audit-report.md`
- Read: `docs/superpowers/specs/_audit-2026-05-09/merged-findings.md`
- Read: each `docs/superpowers/specs/_audit-2026-05-09/subagent-*.md` (for the Notes / coverage sections)

- [ ] **Step 1: Read merged-findings.md and extract counts**

Count findings by priority across (a) per-subagent and (b) cross-layer. Build a summary table.

- [ ] **Step 2: Write the report file using this structure**

```markdown
---
title: OpenKit Project Audit Report
date: 2026-05-09
baseline_commit: <BASELINE_SHA from Task 0>
spec: docs/superpowers/specs/2026-05-09-project-audit-design.md
status: awaiting user review
---

# OpenKit Project Audit Report

## Executive summary

| Priority | Count | From subagents | From cross-layer |
|----------|-------|----------------|------------------|
| Critical | N | n/n/n/n | n |
| High | N | n/n/n/n | n |
| Medium | N | n/n/n/n | n |
| Low | N | n/n/n/n | n |

(Brief 3-5 sentence narrative: top concerns and their themes.)

## Methodology

- Spec: `docs/superpowers/specs/2026-05-09-project-audit-design.md`
- Approach: 4 parallel subagents (§2) + main-agent dedupe + 5 cross-layer checks (§3.2)
- Verification: Critical 100% / High spot-check 1/3 (§3.3)
- Baseline commit: <BASELINE_SHA>

## Cross-layer findings

(Insert verbatim from merged-findings.md `## Cross-layer findings` section.)

## Critical

(Insert each Critical finding from merged-findings.md, grouped by source subagent. For duplicates, use the merged entry.)

Each entry must have: ID, title, `file:line`, description, evidence, suggested fix one-liner.

## High

(Same structure.)

## Medium

(Same structure.)

## Low

(Same structure.)

## Coverage summary

For each of the four subagent areas, list:
- Directories actually read (from each sub-report's Notes section)
- Directories skipped (with reason)
- Open questions raised by the subagent
```

- [ ] **Step 3: Verify the executive summary counts equal the section counts**

Run: `grep -cE '^- \[[0-9X]-[CHML]-' docs/superpowers/specs/2026-05-09-project-audit-report.md`
Expected: equals total findings in the executive summary table.

If they don't match, fix the counts (the table is canonical for the reader).

### Task 7: Write the fix plan

**Files:**
- Create: `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md`
- Read: `docs/superpowers/specs/2026-05-09-project-audit-report.md`

- [ ] **Step 1: For every Critical and High finding, build a fix entry**

Each Critical/High in the audit report becomes one entry in the fix plan using the §4.1 template:

```markdown
### [<original-id>] <title>
- **Priority**: Critical | High
- **Location**: `path/to/file.js:LINE`
- **Root cause**: 1-2 sentences
- **Fix approach**: 2-4 sentences (no code)
- **Acceptance criteria**:
  - [ ] <verifiable check 1>
  - [ ] <verifiable check 2>
  - [ ] Test added/extended: `<path/to/test.test.js>`
- **Risk if fixed wrong**: <backward-compat / migration concern, or "low — isolated change">
- **Estimated effort**: S | M | L
- **Depends on**: [<id>, <id>] or "none"
```

For Medium and Low, use a condensed entry (single line each, grouped under a heading) — they don't need full templates because Wave 3 can batch them:

```markdown
- [<id>] <title> — `file:line` — <one-line fix sketch> — effort: S/M/L
```

- [ ] **Step 2: Assemble the fix plan in wave structure (§4.2)**

```markdown
---
title: OpenKit Project Audit — Fix Plan
date: 2026-05-09
report: docs/superpowers/specs/2026-05-09-project-audit-report.md
status: awaiting user review
---

# OpenKit Project Audit — Fix Plan

## Wave 0 — Pre-fix safety net
- [ ] `npm run verify:all` passes on the baseline commit (<BASELINE_SHA>)
- [ ] E2E smoke: bootstrap each of the 3 lanes on a fresh project
- [ ] Tag baseline commit: `git tag audit-baseline-2026-05-09`

## Wave 1 — Critical
(One full entry per Critical finding, sorted by topo order from `Depends on`.)

## Wave 2 — High
(One full entry per High finding, sorted by topo order.)

## Wave 3 — Medium + Low
### Medium
(Condensed entries.)

### Low
(Condensed entries.)

## Out-of-scope (deferred)
- Refactor of any file > 500 lines (flagged but not fixed)
- Changes to public CLI/MCP API surface (require product decision)
- Performance optimization unrelated to correctness

## Verification matrix

| Issue ID | Verification command or test |
|----------|------------------------------|
| [1-C-1]  | `npm run verify:runtime-foundation` |
| ...      | ... |
```

The verification matrix should map every Critical/High to at least one existing or planned test/command from `package.json` scripts (e.g. `npm run verify:all`, `npm run verify:runtime-foundation`, `npm run verify:governance`).

- [ ] **Step 3: Verify the fix plan covers every Critical/High in the report**

Run:
```
grep -cE '^- \[[0-9X]-[CH]-' docs/superpowers/specs/2026-05-09-project-audit-report.md
grep -cE '^### \[[0-9X]-[CH]-' docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md
```

The two counts should be equal (every Critical/High in the report has a fix entry). If unequal, find the gap and add the missing entry.

### Task 8: Self-review the deliverables

**Files:**
- Read: `docs/superpowers/specs/2026-05-09-project-audit-report.md`
- Read: `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md`

- [ ] **Step 1: Placeholder scan on both files**

Run:
```
grep -nE 'TBD|TODO|<placeholder>|<insert>|XXX|FIXME' docs/superpowers/specs/2026-05-09-project-audit-report.md docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md
```
Expected: empty output.

If anything is found, fix it inline.

- [ ] **Step 2: ID consistency check**

Every ID in the fix plan must appear in the report:

Run:
```
grep -oE '\[[0-9X]-[CH]-[0-9]+\]' docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md | sort -u > /tmp/fix-ids.txt
grep -oE '\[[0-9X]-[CHML]-[0-9]+\]' docs/superpowers/specs/2026-05-09-project-audit-report.md | sort -u > /tmp/report-ids.txt
comm -23 /tmp/fix-ids.txt /tmp/report-ids.txt
```
Expected: empty (no IDs in fix plan that aren't in report).

If non-empty, fix the typo or add the missing finding to the report.

- [ ] **Step 3: Acceptance criteria check**

Every Critical/High fix entry must have at least 2 acceptance-criteria checkboxes:

Run:
```
awk '/^### \[[0-9X]-[CH]-/{flag=1; id=$0; cb=0; next} /^### /{if(flag && cb<2) print id" → only "cb" criteria"; flag=0} flag && /^  - \[ \]/{cb++} END{if(flag && cb<2) print id" → only "cb" criteria"}' docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md
```
Expected: empty.

If any entry has fewer than 2 criteria, add criteria.

### Task 9: Commit the deliverables

**Files:**
- Stage: `docs/superpowers/specs/2026-05-09-project-audit-report.md`
- Stage: `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md`
- Stage: `docs/superpowers/specs/_audit-2026-05-09/` (working artefacts; useful for reproducibility)

- [ ] **Step 1: Stage all audit outputs**

Run:
```
git add docs/superpowers/specs/2026-05-09-project-audit-report.md \
        docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md \
        docs/superpowers/specs/_audit-2026-05-09/
git status --short
```
Expected: 7 new files staged — `2026-05-09-project-audit-report.md`, `2026-05-09-project-audit-fix-plan.md`, and the 5 working artefacts under `_audit-2026-05-09/` (4 sub-reports + `merged-findings.md`).

- [ ] **Step 2: Commit**

Run:
```
git commit -m "$(cat <<'EOF'
docs(audit): full project audit report and fix plan (v0.5.1)

Run the audit defined in
docs/superpowers/specs/2026-05-09-project-audit-design.md against
baseline commit <BASELINE_SHA>. Four parallel subagents covered
runtime/workflow, install/CLI, contract layer, and cross-cutting
concerns; the main agent ran five cross-layer drift checks and
verified every Critical (100%) and a 1/3 spot-check of High.

Deliverables:
- audit report grouped by priority and subagent
- wave-based fix plan with acceptance criteria for every Critical/High
- working sub-reports preserved under specs/_audit-2026-05-09/

No source files were modified; this is read-only audit output.
The fix plan will be turned into an implementation plan in a
follow-up writing-plans cycle after user review.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, working tree clean.

- [ ] **Step 3: Verify clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -1`
Expected: shows the audit commit.

---

## Phase E — Hand off to user

### Task 10: Notify user with deliverable paths and recommended next step

**Files:** none (this is a message, not a code change).

- [ ] **Step 1: Emit a short summary message**

Tell the user:
1. Both deliverables are committed (give the SHA).
2. Paths:
   - `docs/superpowers/specs/2026-05-09-project-audit-report.md`
   - `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md`
3. Counts (Critical/High/Medium/Low).
4. Next step per spec §5.1 step [7]: after user reviews, invoke `superpowers:writing-plans` again to turn the fix plan into an implementation plan for fix execution.

Do NOT auto-invoke writing-plans. Wait for user review and approval first.

---

## Notes on context management (§5.4)

If context usage approaches 80% of the window during Phases C–D:

1. Before any compact, ensure all sub-reports are written to disk (Task 2 done) and `merged-findings.md` is written if Phase C has started.
2. Add/update a TodoWrite task `Audit recovery anchor` whose description lists exactly which Phase/Task is in progress and what the next sub-step is.
3. Compact. After compact, re-read the most recent sub-task in this plan, re-read `merged-findings.md`, and resume.

Subagent contexts are independent — only the main session needs compacting.
