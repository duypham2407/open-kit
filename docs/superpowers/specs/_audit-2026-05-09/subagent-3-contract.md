## [Subagent 3] — Contract Layer

### Critical

(none)

No in-scope path causes an immediate bootstrap-breaking contract break. The three lane commands exist; each command's stage chain is consistent with the active FSM; no agent references a command or skill entirely absent from the repo.

### High

- [3-H-1] registry.json kit version frozen at 0.3.36 while published package is 0.5.1 — `registry.json:6`
  - Description: `registry.json` carries `"version": "0.3.36"` in its `kit` block. `package.json` is `"0.5.1"`, `RELEASES.md` and `CHANGELOG.md` declare `0.5.1`. Tooling reading `registry.json` to determine kit version sees a stale value two minor versions behind. (This duplicates Subagent 2's [2-C-1] from the contract layer's perspective.)
  - Evidence: `registry.json:6`: `"version": "0.3.36"`. `package.json:3`: `"version": "0.5.1"`. `RELEASES.md:3`: `npm latest: @duypham93/openkit@0.5.1`.
  - Suggested fix: update `registry.json:6` to `"0.5.1"` to match `package.json`.

- [3-H-2] commands/configure-embedding.md exists on disk but is absent from registry.json — `src/commands/configure-embedding.md:1`
  - Description: `registry.json` lists 14 commands under `components.commands`. `src/commands/configure-embedding.md` is present (15th file in `src/commands/`) but no registry entry. Operator/runtime tooling discovering commands via registry will not surface `/configure-embedding`, even though it is documented in README.md (lines 462-486) as active.
  - Evidence: `ls commands/` shows `configure-embedding.md`; `grep "configure-embedding" registry.json` returns no path entry.
  - Suggested fix: add a registry entry for `command.configure-embedding` with `"path": "commands/configure-embedding.md"`.

- [3-H-3] agents reference `tool.heuristic-lsp` which is not in registry.json or any runtimeTool — `src/agents/solution-lead-agent.md:51`, `src/agents/code-reviewer.md:76`
  - Description: Both agents list `tool.heuristic-lsp` as a SHOULD or MAY tool. Registry `runtimeTools` contains `tool.lsp-diagnostics` and `tool.lsp-symbols`, no `tool.heuristic-lsp`. LSP source files in `src/runtime/tools/lsp/` implement `lsp-diagnostics`, `lsp-goto-definition`, `lsp-find-references`, `lsp-symbols` — none match `heuristic-lsp`. Agents directing models to invoke a non-existent tool will cause runtime errors or be silently ignored.
  - Evidence: `src/agents/solution-lead-agent.md:51`: ``| `tool.heuristic-lsp` | Symbol references and rename impact ...``. `src/agents/code-reviewer.md:76`: same row. `grep -n "heuristic" registry.json` returns zero results.
  - Suggested fix: replace `tool.heuristic-lsp` with correct registered IDs (`tool.lsp-symbols`, `tool.graph-find-references`, or `tool.graph-goto-definition`), or register the tool if intentionally unregistered.

### Medium

- [3-M-1] docs/governance/skill-metadata.md lists `quick_brainstorm` as a valid stage in normative enum — `docs/governance/skill-metadata.md:36`
  - Description: Skill-metadata governance file (canonical reference for valid stage labels) includes `quick_brainstorm`. Per CHANGELOG.md:14 and active-contract.json, `quick_brainstorm` was removed in v0.5.1. Skill authors reading the governance doc may add `quick_brainstorm` to new metadata, causing validation drift.
  - Evidence: line 36: `"Stages must use current workflow stage labels such as 'quick_intake', 'quick_brainstorm', 'quick_plan', ..."`.
  - Suggested fix: remove `quick_brainstorm` from the stage list on line 36.

- [3-M-2] docs/operations/runbooks/workflow-state-smoke-tests.md still uses `quick_brainstorm` in live CLI example — `docs/operations/runbooks/workflow-state-smoke-tests.md:255`
  - Description: Operator runbook contains `node .opencode/workflow-state.js advance-stage quick_brainstorm`. Stage no longer exists in FSM. Operator following this step gets an error.
  - Suggested fix: replace `quick_brainstorm` with `quick_plan` on line 255.

- [3-M-3] docs/maintainer/2026-03-26-role-operating-policy.md refers to `quick_brainstorm` as active stage in normative bullet — `docs/maintainer/2026-03-26-role-operating-policy.md:126`
  - Description: Role policy (referenced by AGENTS.md as short-form contract) states `quick_brainstorm clarification + alignment...` as if stage exists. Contradicts current workflow. Agents consulting this doc see a phantom stage.
  - Suggested fix: replace with `quick_plan` (clarify-and-align phase) on line 126.

- [3-M-4] docs/solution/2026-04-27-standardize-bundled-skill-metadata.md lists `quick_brainstorm` as current valid stage in normative constraint — `docs/solution/2026-04-27-standardize-bundled-skill-metadata.md:263`
  - Description: Solution package describes acceptance criterion explicitly naming `quick_brainstorm` as a "current stage name only" that skills must use.
  - Suggested fix: remove from line 263 (or annotate as archival).

- [3-M-5] 7 of 20 bundled skills have SKILL.md with no YAML frontmatter (no name/description) — `src/skills/{browser-automation,codebase-exploration,deep-research,dev-browser,frontend-ui-ux,git-master,refactoring}/SKILL.md:1`
  - Description: Governance doc states canonical machine-readable skill record must include `name` and `description`. While `src/capabilities/skill-catalog.js` is canonical (not SKILL.md), audit scope specifies SKILL.md must have valid frontmatter. 13 skills do; the 7 listed start directly with H1 (no `---`).
  - Evidence: all 7 begin with `# <skill-name>` (no `---` delimiter). 13 valid skills follow `---\nname: ...\ndescription: ...` pattern.
  - Suggested fix: add YAML frontmatter `---\nname: <directory-name>\ndescription: "..."\n---` to top of each affected file.

### Low

- [3-L-1] `migration_baseline` stage has ambiguous ownership — `src/agents/master-orchestrator.md:41`, `src/commands/migrate.md:46`
  - Description: master-orchestrator.md says "dispatches Solution Lead for baseline, then advances to migration_strategy". commands/migrate.md shows chain `migration_intake (MO) → migration_baseline → migration_strategy (Solution Lead)` with no owner label on baseline. workflow.md pipeline diagram shows `Solution Lead ← baseline...`. active-contract.json has no per-stage owner map. Ambiguity could lead an agent to skip baseline evidence.
  - Suggested fix: add explicit `(Solution Lead)` annotation on `migration_baseline` in commands/migrate.md:46.

- [3-L-2] No surviving references to deprecated `/task` or `/brainstorm` in agent/command files (clean) — Notes only.

- [3-L-3] Historical docs retain `quick_brainstorm` (archival, not active surface) — `docs/superpowers/plans/...`, `docs/scope/...`, `docs/qa/...`
  - Description: Pre-v0.5.1 plan/spec files contain 40+ `quick_brainstorm` references. AGENTS.md marks docs/archive/ historical only; risk low but volume could confuse maintainer search.
  - Suggested fix: consider deprecation header or move/annotate.

- [3-L-4] AGENTS.md does not enumerate `/configure-embedding` — `AGENTS.md:27`
  - Description: AGENTS.md:27 lists commands but omits `/configure-embedding`. README.md:462 documents it; commands/configure-embedding.md exists.
  - Suggested fix: add `/configure-embedding` to the AGENTS.md command list.

### Notes

- Directories read:
  - `src/agents/` (all 7 files)
  - `src/commands/` (all 15 files)
  - `src/skills/` (all 20 SKILL.md files)
  - `registry.json`, `AGENTS.md`, `instructions/`, `src/context/`
  - `README.md`, `CHANGELOG.md`, `RELEASES.md`
  - Selected docs/governance/, docs/operations/, docs/maintainer/, docs/solution/ files for cross-checks
- Directories skipped (with reason): src/, .opencode/lib/, hooks/, scripts/, tests/, bin/ — out of scope
- Open questions for main agent: confirm whether `tool.heuristic-lsp` (3-H-3) was meant as `tool.lsp-symbols` or a separate heuristic tool; what's the intended ownership for `migration_baseline` (3-L-1).
