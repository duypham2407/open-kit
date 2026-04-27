---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-947
feature_slug: standardize-bundled-skill-metadata
source_plan: docs/solution/2026-04-27-standardize-bundled-skill-metadata.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Standardize Bundled Skill Metadata

## Overall Status

- PASS

## Verification Scope

- Validated the approved scope package: `docs/scope/2026-04-27-standardize-bundled-skill-metadata.md`.
- Validated the approved solution package: `docs/solution/2026-04-27-standardize-bundled-skill-metadata.md`.
- Validated Code Review handoff context: Code Review PASS after source-skill drift rework; prior issue `FEATURE-947-CR-SOURCE-SKILL-DRIFT` is resolved in workflow state.
- Checked acceptance targets across these surfaces:
  - `runtime_tooling`: canonical skill metadata schema/catalog, runtime capability inventory, skill index, skill/MCP bindings, capability router, runtime summary, direct rule/security scan tools.
  - `package`: install bundle asset manifest, generated `assets/install-bundle/opencode/skill-catalog.json`, source/install-bundle drift validation, source-skill drift probe.
  - `documentation`: governance, operator, maintainer, kit-internals, runtime-surface docs, registry metadata.
  - `compatibility_runtime`: workflow-state validation and evidence records.
  - `target_project_app`: verified unavailable for this OpenKit metadata feature; no app-native target project build/lint/test command is claimed.

## Observed Result

PASS. FEATURE-947 satisfies the approved acceptance criteria. No open QA issues were found.

## Behavior Impact

- Bundled skills now expose a canonical v2 metadata shape with required identity, maturity, support, provenance, role/stage, trigger, packaging, docs, limitation, and recommended MCP fields.
- Skill maturity `status` is visibly separated from runtime `capabilityState`.
- Runtime inventory, skill index, skill/MCP bindings, router, and runtime summary expose metadata-backed skill information and caveats.
- Stub/metadata-only and preview skills are discoverable but not presented as stable defaults.
- Install-bundle verification detects source/catalog/manifest/bundle/generated-catalog drift, including the prior source-skill drift issue.
- Governance/operator/maintainer docs explain the metadata contract and validation boundaries.
- No marketplace installer, remote skill registry, lane/stage semantic change, or target-project app validation claim was introduced.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Every bundled skill record includes required metadata fields (`name`, `description`, `status`, `tags`, `roles`, `stages`, `triggers`, `recommended_mcps`, provenance/source, `support_level`) | PASS | Catalog summary: 52 records, 0 missing required fields. Covered by `tests/runtime/skill-catalog.test.js` and manual metadata summary. |
| Unsupported skill maturity statuses fail validation and supported statuses are `stable`, `preview`, `experimental` | PASS | `tests/runtime/skill-catalog.test.js` negative validation passed. Manual summary: stable=19, preview=32, experimental=1. |
| Stub/placeholder skills are not stable and carry limitation/provenance/support caveats | PASS | Manual summary found 0 stable stubs; metadata-only example `rust-router` is `preview`, `capabilityState=unavailable`, `support_level=stub`, `source.kind=stub`, `packaging.source=metadata_only`, `installBundle=false`, with visible limitation. |
| Stable/preview/experimental semantics visible in inventory/router output | PASS | Runtime spot checks verified stable `verification-before-completion`, preview/compatibility-only `git-master`, and metadata-only stub `rust-router`; router exact matches expose caveats and default route suppresses unavailable metadata-only records. |
| Role/stage taxonomy aligns with current OpenKit vocabulary and does not introduce new lane/stage semantics | PASS | Manual metadata summary found 0 unsupported role values and 0 unsupported stage values; `skill-metadata.md` documents `all` only as metadata wildcard. No workflow-stage enum changes observed beyond validation-surface vocabulary update. |
| Trigger metadata explains skill selection without hidden activation | PASS | Router spot checks returned `selectionReasons` for trigger/tag/role/stage matches and guidance: “Load the selected skill explicitly…” |
| Runtime capability inventory exposes canonical skill metadata fields | PASS | `tool.capability-inventory` spot check returned 52 skills with `status`, `capabilityState`, `support_level`, `source`, `roles`, `stages`, `tags`, `triggers`, `recommended_mcps`, `packaging`, and `limitations`. |
| Skill index uses canonical metadata and supports filters | PASS | `tool.skill-index` spot check returned preview records with status/support/capability caveats; `tests/runtime/capability-tools.test.js` passed. |
| Router stable-first and no-match behavior works | PASS | React/frontend route selected stable `vercel-react-best-practices` with reasons and MCP context; rust metadata-only route was suppressed by default; nonexistent tag returned `matchStatus=no_match` rather than unrelated fallback. |
| Recommended MCP linkage is advisory, recognized or caveated, and secret-free | PASS | `tool.skill-mcp-bindings` spot check returned 48 bindings with relationship/reason/status/caveats; React route showed `context7` not configured without hiding the skill or exposing secrets. |
| Provenance and support level are visible | PASS | Runtime samples showed `openkit_authored`/`maintained`, `compatibility`/`compatibility_only`, and `stub`/`stub`; registry/governance tests passed. |
| Source and install-bundle metadata stay synchronized and drift is detected | PASS | `npm run sync:install-bundle && npm run verify:install-bundle` passed; drift summary reported 20 source skill files, 20 repo-backed catalog entries, 0 missing/mismatch/extra/drift categories; synthetic added source skill probe was detected as missing metadata and missing install decision. |
| Install/upgrade package exposes same bundled skill metadata contract | PASS | Generated `assets/install-bundle/opencode/skill-catalog.json` validates on `package` surface; `tests/install/skill-bundle-sync.test.js`, `tests/install/install-state.test.js`, and `tests/runtime/registry-metadata.test.js` passed. |
| Docs/governance explain metadata contract and validation expectations | PASS | `docs/governance/skill-metadata.md`, governance README, operator/maintainer docs, and kit-internals docs were validated by `npm run verify:governance`. |
| No marketplace installer, remote skill registry, or third-party capability acquisition flow | PASS | Source scan found no runtime implementation of marketplace/remote skill registry/capability-pack installer behavior; scope/solution docs keep it out of scope. |
| No lane/stage semantic changes or workflow-state enum reinterpretation | PASS | Changes add `package` validation surface only; current role/stage labels remain canonical metadata labels. `npm run verify:governance` and `.opencode/tests/workflow-contract-consistency.test.js` passed. |
| No `target_project_app` validation overclaim | PASS | `tool.typecheck`, `tool.lint`, and `tool.test-run` returned unavailable: no tsconfig, linter config, or test framework detected for a target app; report labels all OpenKit checks by actual surfaces. |

## Quality Checks

| Check | Exit | Evidence |
| --- | ---: | --- |
| `node --test "tests/runtime/skill-catalog.test.js"` | 0 | 6 tests passed. |
| `node --test "tests/runtime/capability-registry.test.js"` | 0 | 5 tests passed. |
| `node --test "tests/runtime/capability-tools.test.js"` | 0 | 9 tests passed. |
| `node --test "tests/install/skill-bundle-sync.test.js"` | 0 | 4 tests passed, including extra source-skill drift fixture. |
| `node --test "tests/install/install-state.test.js"` | 0 | 9 tests passed. |
| `node --test "tests/mcp-server/mcp-server.test.js"` | 0 | 11 tests passed, including MCP server tool list/schema behavior and scan-tool unavailable shape. |
| `node --test "tests/runtime/registry-metadata.test.js"` | 0 | 7 tests passed. |
| `npm run sync:install-bundle && npm run verify:install-bundle` | 0 | Sync ran and verification reported “Derived install bundle is in sync.” |
| `npm run verify:governance` | 0 | Governance, registry metadata, and workflow contract consistency suites passed. |
| `npm run verify:runtime-foundation` | 0 | Runtime config, capability registry, and bootstrap suites passed. |
| `node .opencode/workflow-state.js validate` | 0 | Workflow state valid. |
| `npm run verify:semgrep-quality` | 0 | 5 Semgrep quality/security regression tests passed. |
| `npm run verify:all` | 0 | 469 runtime tests, 30 install tests, 92 global tests, 101 CLI tests, plus other chained suites passed; no failures. |
| Direct `tool.rule-scan` over 44 changed paths | 0 | Tool available; 44/44 per-file statuses `ok`; 0 findings. |
| Direct `tool.security-scan` over 44 changed paths | 0 | Tool available; 44/44 per-file statuses `ok`; 0 findings. |
| Runtime spot checks for inventory/index/router/bindings | 0 | 52 skills; maturity counts stable=19, preview=32, experimental=1; capability states available=19, unavailable=32, compatibility_only=1; support levels maintained=15, best_effort=4, compatibility_only=1, stub=32. |
| Source-skill drift probe | 0 | Synthetic `skills/zz-qa-drift-probe/SKILL.md` was reported in `missingSourceSkillCatalogEntries` and `sourceSkillsMissingInstallBundleDecision`. |
| Target-app validation probe | 0 | `tool.typecheck`, `tool.lint`, and `tool.test-run` each returned `unavailable`; no target-project app validation claimed. |

## Tool Evidence

- rule-scan: 0 findings on 44 changed paths; direct `tool.rule-scan` available and all per-file executions returned `ok`.
- security-scan: 0 findings on 44 changed paths; direct `tool.security-scan` available and all per-file executions returned `ok`.
- evidence-capture: 3 QA records written: `f947-qa-direct-scans-2026-04-27`, `f947-qa-validation-suite-2026-04-27`, `f947-qa-runtime-spot-checks-2026-04-27`.
- syntax-outline: unavailable/degraded in this QA namespace for repository path resolution (`missing-file`/`invalid-path` against leaked `{cwd}` runtime root); substituted with targeted source reads, AST/search tests, runtime spot checks, and full automated suites. Structural expectations were still verified through tests and runtime output.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available/succeeded; 44 changed paths scanned through OpenKit runtime tool harness | none | 0 total | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | evidence `f947-qa-direct-scans-2026-04-27`; changed FEATURE-947 paths |
| `tool.security-scan` | available/succeeded; 44 changed paths scanned through OpenKit runtime tool harness | none | 0 total | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | evidence `f947-qa-direct-scans-2026-04-27`; changed FEATURE-947 paths |

- Direct tool status: both direct scan tools were available and returned `ok` for every changed path.
- Substitute status and limitations: none for scan gates.
- Classification summary: no findings.
- False-positive rationale: none required.
- Manual override caveats: none.
- Validation-surface labels and target-project app validation split: scan execution is `runtime_tooling`; workflow evidence is `compatibility_runtime`; install-bundle sync is `package`; governance docs are `documentation`; target app validation is unavailable.
- Artifact refs: workflow evidence IDs above plus source/test files listed in evidence records.

## Test Evidence

QA recorded the following evidence through workflow state:

- `f947-qa-direct-scans-2026-04-27` — runtime scan evidence for direct rule/security scans over changed files.
- `f947-qa-validation-suite-2026-04-27` — automated test and verification evidence across runtime, package, documentation, MCP server, governance, and compatibility runtime surfaces.
- `f947-qa-runtime-spot-checks-2026-04-27` — manual/runtime spot-check evidence for representative stable, preview, stub, MCP caveat, source drift, and target-project-app boundary behavior.

Important command notes:

- `npm run verify:all` output was high-volume and saved by the tool layer, but the command exited 0 and its tail reported all chained suites passing.
- A repository-wide direct scan on the whole project was informational only and surfaced historical repo-wide warnings outside the changed FEATURE-947 paths. The QA gate used direct scan tools over changed FEATURE-947 paths and found 0 findings.
- Node emitted a non-fatal `MODULE_TYPELESS_PACKAGE_JSON` warning from the managed global kit during some runtime spot-check harnesses; tests and commands still exited 0. This warning is outside FEATURE-947 acceptance and did not affect observed behavior.

## Issues

No open QA issues.

Resolved historical issue confirmed:

- `FEATURE-947-CR-SOURCE-SKILL-DRIFT` — Code Review high-severity implementation bug. QA confirmed source-skill drift detection now enumerates source skills and detects an added uncataloged source skill.

## Recommended Route

Approve `qa_to_done` and advance `FEATURE-947` / `feature-947` from `full_qa` to `full_done`.

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | `f947-qa-direct-scans-2026-04-27`; `f947-qa-validation-suite-2026-04-27`; `f947-qa-runtime-spot-checks-2026-04-27` | Acceptance criteria satisfied; no runtime/package/docs/compatibility regressions observed; target app validation correctly unavailable | approve `qa_to_done` |

## Conclusion

FEATURE-947 passes QA. The implementation provides governed bundled skill metadata, synchronized install-bundle metadata, runtime exposure through inventory/index/bindings/router, visible preview/stub caveats, documentation/governance coverage, source-skill drift detection, and correct validation-surface boundaries without marketplace installer behavior or workflow lane/stage semantic changes.
