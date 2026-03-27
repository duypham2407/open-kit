# Workflow Refactor Audit

Date: 2026-03-26

> Historical audit snapshot: many issues recorded here were fixed in later releases. Keep this file for audit history, not as the active current-state report.

This audit records the remaining drift between the intended workflow contract and the current repository state after the Product Lead / Solution Lead refactor.

## Target Workflow

- `Master Orchestrator` is procedural only.
- Full lane stages: `full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`.
- Migration lane stages: `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`.
- Full gates: `product_to_solution`, `solution_to_fullstack`, `fullstack_to_code_review`, `code_review_to_qa`, `qa_to_done`.
- Migration gates: `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_code_review`, `code_review_to_verify`, `migration_verified`.
- Active planning roles are `Product Lead` and `Solution Lead`.

## Current Status

- Core contract docs are mostly aligned.
- Runtime rules under `.opencode/lib/` are largely aligned.
- Main workflow test suite is mostly aligned, with 3 failing tests still concentrated in `artifact-scaffolder.test.js`.
- Several supporting docs, compatibility surfaces, and global-workspace helpers still reflect the legacy PM/BA/Architect/Tech Lead chain.

## Remaining Test Failures

### Blocking test failures

- `.opencode/tests/artifact-scaffolder.test.js`
  - `scaffold-artifact substitutes real checked-in templates correctly`
  - `scaffold-artifact creates an implementation plan and links it into state`
  - `scaffold-artifact rejects plans outside full_solution stage`

### Likely root cause

- Full-plan scaffolding fixtures still mix `full_solution` with `ProductLead` ownership instead of `SolutionLead` ownership.
- One rejection test still builds a `full_product` state with `SolutionLead` instead of `ProductLead`, so validation fails on owner before it reaches the intended scaffold-stage assertion.

## Confirmed Workflow Drift Outside The 3 Failing Tests

### 1. Global workspace bootstrap still uses legacy gates

- File: `src/global/workspace-state.js`
- Problem:
  - migration still initializes `upgrade_to_verify`
  - full still initializes `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`
- Impact:
  - any workspace-level bootstrap using this helper will create state that no longer matches the canonical runtime contract
- Priority: high

### 2. Parallel execution maintainer docs still describe the old role chain

- File: `docs/maintainer/parallel-execution-matrix.md`
- Problem:
  - still says migration baseline/strategy stay singleton under `Architect Agent` and `Tech Lead Agent`
  - still says full parallelism starts after `full_plan`
  - still lists `PM Agent`, `BA Agent`, `Architect Agent`, `Tech Lead Agent` as singleton planning chain
- Impact:
  - maintainers reading the matrix will reconstruct the wrong active workflow
- Priority: medium

- File: `docs/maintainer/conditional-parallel-execution-note.md`
- Problem:
  - still models the active team shape as PM / BA / Architect / Tech Lead
  - still says singleton stages are `full_brief`, `full_spec`, `full_architecture`, `full_plan`
- Impact:
  - documentation conflict with the new `Product Lead` / `Solution Lead` contract
- Priority: medium

### 3. Operations runbooks still describe the old full lane

- File: `docs/operations/runbooks/openkit-daily-usage.md`
- Problem:
  - full lane still documented as `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`
  - migration lane still omits `migration_code_review`
- Impact:
  - operator-facing instructions remain inaccurate
- Priority: high

- File: `docs/operations/runbooks/tech-lead-task-decomposition.md`
- Problem:
  - title and role model still assume `Tech Lead`
  - singleton planning roles still listed as PM / BA / Architect / Tech Lead
  - still says task boards start after `full_plan`
- Impact:
  - planning guidance is still anchored to the old chain
- Priority: medium

### 4. Template metadata still exposes legacy owners and approval gates

- File: `docs/templates/implementation-plan-template.md`
- Problem:
  - frontmatter still uses `owner: TechLeadAgent`
  - `approval_gate: tech_lead_to_fullstack`
- Impact:
  - freshly scaffolded compatibility plans still advertise the wrong owner and gate
- Priority: medium

- File: `docs/templates/migration-plan-template.md`
- Problem:
  - frontmatter still uses `owner: TechLeadAgent`
- Impact:
  - migration plan artifacts still imply old role ownership
- Priority: medium

### 5. Legacy role files still look active rather than deprecated compatibility views

- Files:
  - `agents/pm-agent.md`
  - `agents/ba-agent.md`
  - `agents/architect-agent.md`
  - `agents/tech-lead-agent.md`
- Problem:
  - these files still read as active runtime roles, not deprecated compatibility views
- Impact:
  - agent authors or maintainers can still infer the old chain as current truth
- Priority: medium

- Bundled mirrors also still reflect the old role contracts:
  - `assets/install-bundle/opencode/agents/PMAgent.md`
  - `assets/install-bundle/opencode/agents/BAAgent.md`
  - `assets/install-bundle/opencode/agents/ArchitectAgent.md`
  - `assets/install-bundle/opencode/agents/TechLeadAgent.md`

### 6. Code-review skill still mentions Tech Lead as an active review role

- File: `skills/code-review/SKILL.md`
- Problem:
  - says the skill is used by `Code Reviewer`, `QA Agent`, or `Tech Lead Agent`
- Impact:
  - skill guidance still leaks legacy planning role ownership
- Priority: low to medium

- Bundled mirror also drifts:
  - `assets/install-bundle/opencode/skills/code-review/SKILL.md`

### 7. Registry and asset manifest are only partially migrated

- File: `registry.json`
- Problem:
  - `Product Lead` and `Solution Lead` were added, but legacy split roles are still listed without deprecation semantics
- Impact:
  - metadata is ambiguous about which roles are active versus compatibility-only
- Priority: medium

- File: `src/install/asset-manifest.js`
- Problem:
  - still bundles legacy role files as first-class assets without marking them compatibility-only
- Impact:
  - installed surfaces can still present the old team as active if the consumer relies on asset inventory alone
- Priority: medium

### 8. Supporting tests still encode legacy compatibility semantics in a few places

- File: `.opencode/tests/work-item-store.test.js`
- Problem:
  - test fixture still includes `fullstack_to_qa`
- Impact:
  - even if test passes, the fixture documents the old full gate chain
- Priority: low to medium

### 9. Historical product docs remain intentionally stale, but can be mistaken for active truth

- Files:
  - `docs/scope/2026-03-21-openkit-full-delivery-multi-task-runtime.md`
  - `docs/solution/2026-03-23-openkit-global-install-runtime.md`
- Problem:
  - these still reference BA / Tech Lead ownership and the old full chain
- Impact:
  - low if treated as historical artifacts, but high if maintainers read them as active guidance
- Recommended action:
  - add explicit legacy note or historical banner rather than silently rewriting archival design docs

## Intentional Legacy Mentions That Are Probably Acceptable

- `tests/install/install-state.test.js` still expecting bundled legacy role asset ids is acceptable if the project intentionally keeps split-role assets as compatibility surfaces.
- `docs/maintainer/2026-03-26-workflow-refactor-change-map.md` contains old names intentionally as a migration checklist.

## Recommended Next Fix Order

1. Finish the 3 failing `artifact-scaffolder` tests.
2. Update `src/global/workspace-state.js` to the new gate set.
3. Update operator and maintainer runbooks:
   - `docs/operations/runbooks/openkit-daily-usage.md`
   - `docs/maintainer/parallel-execution-matrix.md`
   - `docs/maintainer/conditional-parallel-execution-note.md`
   - `docs/operations/runbooks/tech-lead-task-decomposition.md`
4. Update template frontmatter:
   - `docs/templates/implementation-plan-template.md`
   - `docs/templates/migration-plan-template.md`
5. Mark legacy split-role files as deprecated compatibility views.
6. Update `skills/code-review/SKILL.md` and bundled mirror.
7. Decide whether `registry.json` and `src/install/asset-manifest.js` should treat split roles as compatibility-only metadata and document that explicitly.

## Summary

The repository is mostly aligned with the new workflow at the canonical-contract and runtime-rule level, but it is not yet fully coherent end-to-end.

The largest remaining non-test mismatch is `src/global/workspace-state.js`, which still bootstraps old approval gates. After that, the biggest drift is in maintainer/operator docs and compatibility role surfaces that still present the old PM/BA/Architect/Tech Lead chain as if it were active.
