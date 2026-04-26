---
artifact_type: qa_report
version: 1
status: final
feature_id: FEATURE-939
feature_slug: scan-tool-evidence-pipeline
source_plan: docs/solution/2026-04-25-scan-tool-evidence-pipeline.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Scan Tool Evidence Pipeline

## Overall Status

- **PASS**
- Recommended route: `qa_to_done`

## Verification Scope

QA verified FEATURE-939 against the approved scope and solution artifacts:

- Scope: `docs/scope/2026-04-25-scan-tool-evidence-pipeline.md`
- Solution: `docs/solution/2026-04-25-scan-tool-evidence-pipeline.md`

Surfaces checked:

- Direct scan exposure and structured unavailable/degraded responses for `tool.rule-scan` and `tool.security-scan`.
- Structured workflow evidence capture/read models for direct scan, substitute scan, and manual override evidence.
- Gate behavior for missing evidence, source-only scan evidence, mismatched structured tool identity, unclassified findings, non-blocking noisy findings, false positives, unresolved true positives, and manual overrides.
- Role prompts, QA template, operator/maintainer docs, and install bundle sync.
- Runtime, compatibility runtime, documentation, and target-project validation-surface split.
- Feature-level full QA closure readiness; no target-project application build/lint/test behavior was claimed.

## Observed Result

**PASS.** AC1.1-AC7.2 are covered by runtime tests, workflow-state policy tests, governance tests, full-suite verification, direct runtime scan probing, changed-file Semgrep substitute scans, and manual QA triage. No new QA blocking issues were found.

## Behavior Impact

- OpenKit now exposes Semgrep-backed rule/security scan tools through the runtime/MCP contract and returns structured scan results or structured unavailability instead of silent/empty results.
- Workflow evidence and read models preserve direct/substitute/manual scan distinctions, validation-surface labels, finding counts, classification summaries, false-positive rationale, manual override caveats, and artifact refs.
- Tool evidence gates reject missing scan evidence, unstructured source-only scan evidence, mismatched structured tool identity, unclassified findings, unresolved true positives, malformed manual overrides, and manual overrides that try to bypass noisy-but-available scan output.
- Reports/docs preserve the distinction between OpenKit `runtime_tooling` / `compatibility_runtime` evidence and unavailable `target_project_app` app-native validation.

## Tool Evidence

- **rule-scan:** direct native `tool.rule-scan` was not exposed as a callable tool in this QA API namespace; substitute evidence was used. Runtime/MCP direct exposure was verified by tests and by bootstrapping the runtime tool registry, where `tool.rule-scan` was listed and callable. Changed-file substitute Semgrep scan: **2,388 findings on 80 changed/untracked files**, all `WARNING`, grouped into 3 quality groups and classified as non-blocking noisy/follow-up scan debt for this feature. Implementation evidence also contains `scan-final-direct-rule` with direct structured `tool.rule-scan` evidence on `docs/operator/semgrep.md` with 0 findings.
- **security-scan:** direct native `tool.security-scan` was not exposed as a callable tool in this QA API namespace; substitute evidence was used. Runtime/MCP direct exposure was verified by tests and by bootstrapping the runtime tool registry, where `tool.security-scan` was listed and callable. Changed-file substitute Semgrep scan: **1 finding on 80 changed/untracked files**, classified as a test-fixture false positive with rationale below. Implementation evidence also contains `scan-final-direct-security` with direct structured `tool.security-scan` evidence on `docs/operator/semgrep.md` with 0 findings.
- **evidence-capture:** 1 managed QA verification evidence record written: `feature-939-qa-validation-evidence` (`kind=manual`, `scope=full_qa`, `exit_status=0`).
- **syntax-outline:** 0 files outlined; unavailable/degraded for this QA session because repeated calls returned `missing-file` or `invalid-path` for relevant absolute/project paths. QA substituted direct file reads and test references for structural verification.

### Scan/Tool Evidence Details

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | Runtime/MCP exposure verified; QA API direct namespace unavailable. Bootstrapped runtime direct probe: `available` / `succeeded`, `runtime_tooling`. | Changed-file Semgrep substitute scan ran against 80 changed/untracked files using `assets/semgrep/packs/quality-default.yml`. | 2,388 total, all `WARNING`: `no-var-declaration` 2,053; `no-console-log` 321; `no-empty-catch` 14. | 3 groups; blocking=0; true_positive unresolved=0; non-blocking noise/follow-up=3; unclassified=0 after QA triage. | None claimed for this quality scan; noisy groups remain traceable for rule tuning. | None used. Manual override was not used to bypass noisy output. | Scan execution: `runtime_tooling`; QA report/evidence record: `compatibility_runtime`; not `target_project_app`. | This QA report; `assets/semgrep/packs/quality-default.yml`; `tests/runtime/audit-tools.test.js`; `.opencode/tests/workflow-state-controller.test.js`. |
| `tool.security-scan` | Runtime/MCP exposure verified; QA API direct namespace unavailable. Bootstrapped runtime direct probe: `available` / `succeeded`, `runtime_tooling`. | Changed-file Semgrep substitute scan ran against 80 changed/untracked files using `assets/semgrep/packs/security-audit.yml`. | 1 total, `ERROR`: `openkit.security.no-hardcoded-secret` in `tests/runtime/runtime-platform.test.js`. | 1 group; blocking=0 after false-positive classification; true_positive unresolved=0; unclassified=0 after QA triage. | The finding is a test-only placeholder around `.mcp.json` interpolation (`${TEST_TOKEN}` / `secret`) in `tests/runtime/runtime-platform.test.js`, not a production/runtime secret and not exploitable credential material. Follow-up: none required for FEATURE-939; optional future rule tuning for fixtures. | None used. | Scan execution: `runtime_tooling`; QA report/evidence record: `compatibility_runtime`; not `target_project_app`. | This QA report; `assets/semgrep/packs/security-audit.yml`; `tests/runtime/runtime-platform.test.js`; `tests/runtime/audit-tools.test.js`. |

Additional direct runtime probe note: a whole-project runtime scan probe confirmed the runtime tools execute and return structured results (`rule`: 3,318 warnings; `security`: 2 findings in pre-existing codemod files). QA did not use the whole-project untriaged probe as gate-passing evidence; changed-file substitute scans above are the QA scan evidence for this feature.

## Acceptance Coverage Matrix

| Acceptance Criteria | Result | Evidence |
| --- | --- | --- |
| AC1.1 Required scan tools are available where gates require them | PASS | `node --test tests/mcp-server/mcp-server.test.js` passed; MCP `tools/list` includes `tool.rule-scan` and `tool.security-scan`; bootstrapped runtime registry listed and executed both tools. |
| AC1.2 Unavailable scan tools fail visibly | PASS | MCP and audit-tool tests verify missing Semgrep returns structured `unavailable` with reason/fallback; scan failure/invalid path/not configured paths tested. |
| AC2.1 Successful scan evidence is captured | PASS | `tests/runtime/runtime-platform.test.js` and `.opencode/tests/workflow-state-cli.test.js` passed; evidence records preserve `details.scan_evidence`, validation surface, counts, classifications, false-positive summary, and artifact refs. |
| AC2.2 Substitute scan evidence is captured separately | PASS | CLI/read-model tests distinguish `substitute_scan` from direct evidence and preserve direct-tool unavailable state separately from what ran. |
| AC3.1 High-volume warnings are summarized before gate decisions | PASS | Audit tests cover grouped triage; forced high-volume buffer test returns `scan_failed` + `degraded` + artifact refs, not `unavailable`; QA changed-file scan grouped 2,388 warnings into 3 triage groups. |
| AC3.2 Non-blocking noise remains traceable | PASS | Gate tests pass classified non-blocking noise only with rationale/traceability; QA quality groups recorded rule/count/sample context and non-blocking rationale. |
| AC4.1 False positives require contextual rationale | PASS | Audit/gate tests require rule/file/context/rationale/impact/follow-up; QA classified the only changed-file security finding with test-fixture context and no production impact. |
| AC4.2 Test-fixture security placeholders can be non-blocking only with evidence | PASS | Controller tests require full false-positive fixture details; QA security scan finding in `tests/runtime/runtime-platform.test.js` is test-only placeholder evidence, not production code. |
| AC5.1 Gate decisions use classified scan outcomes | PASS | Controller tests block missing evidence, source-only scan evidence, unclassified findings, mismatched tool identity, and unresolved true positives; `show-policy-status` reports Tier 2 and Tier 3 passed for FEATURE-939. |
| AC5.2 Manual overrides are visibly exceptional | PASS | Controller/CLI tests reject malformed overrides and prevent overrides from bypassing noisy available scans; docs and QA template require caveats. No QA override used. |
| AC6.1 Code review and QA reports include a scan evidence section | PASS | Governance and workflow-contract tests passed; source agent prompts, QA template, and install-bundle agent copies require direct status, substitute/manual distinction, counts, classifications, false positives, caveats, validation surfaces, and artifact refs. |
| AC6.2 Runtime and operator surfaces preserve validation-surface split | PASS | Runtime-platform, workflow-state CLI, external-tools, governance, and docs checks passed; report labels OpenKit scan evidence separately from target-project app validation. |
| AC7.1 OpenKit scans do not replace app-native validation | PASS | External validation tests and docs preserve `target_project_app` unavailable semantics when no app-native build/lint/test command exists. This QA report does not claim target app validation. |
| AC7.2 Future app-native commands remain independent | PASS | External tool tests validate app-native typecheck/lint/test detection separately; scan evidence remains `runtime_tooling` / `compatibility_runtime`. |

## Validation Commands And Results

| Command | Surface | Result |
| --- | --- | --- |
| `node --test tests/mcp-server/mcp-server.test.js` | `runtime_tooling` / MCP | PASS: 7 tests passed. |
| `node --test tests/runtime/audit-tools.test.js` | `runtime_tooling` | PASS: 26 tests passed. |
| `node --test tests/runtime/runtime-platform.test.js` | `runtime_tooling` / `compatibility_runtime` | PASS: 25 tests passed. |
| `node --test .opencode/tests/workflow-state-controller.test.js .opencode/tests/workflow-state-cli.test.js` | `compatibility_runtime` | PASS: 190 tests passed. |
| `npm run verify:runtime-foundation` | OpenKit runtime | PASS: runtime config/capability/bootstrap suites passed (14 + 4 + 5 tests). |
| `npm run verify:governance` | `documentation` / governance | PASS: governance, registry metadata, and contract consistency passed (16 + 5 + 9 tests). |
| `npm run verify:all` | OpenKit runtime/CLI/docs/install bundle | PASS on rerun with extended timeout. First run timed out at 300s during workflow-state CLI; rerun completed successfully with exit status 0. |
| `node .opencode/workflow-state.js validate && node .opencode/workflow-state.js show-policy-status && node .opencode/workflow-state.js show-invocations feature-939` | `compatibility_runtime` | PASS: workflow state valid; next stage `full_done`; Tier 2 tool evidence gate passed; Tier 3 runtime policy passed; invocation log has 2 successful entries (`tool.rule-scan`, `tool.security-scan`). |
| `node --test tests/runtime/external-tools.test.js` | `target_project_app` detection semantics | PASS: 44 tests passed; external typecheck/lint/test tools report unavailable when no target-project config/framework exists and active when config exists. |
| `npm run verify:install-bundle` | install bundle/docs | PASS: derived install bundle is in sync. |
| `node --test .opencode/tests/workflow-contract-consistency.test.js` | workflow/docs contract | PASS: 9 tests passed. |
| Runtime direct scan probe via `bootstrapRuntimeFoundation(...).tools.tools[...]` | `runtime_tooling` | PASS for capability/callability: both scan tools listed and executed with structured results. |
| Changed-file Semgrep substitute scans | `runtime_tooling` substitute evidence | PASS after QA triage: rule scan 2,388 warnings grouped/classified non-blocking; security scan 1 test-fixture false positive; no blocking true-positive changed-file security findings remain. |

## Target-Project Validation Split

- No target-project application build/lint/test commands were invented or claimed.
- OpenKit repository validation commands above validate OpenKit runtime, CLI, compatibility runtime, install-bundle, governance, and documentation surfaces.
- `target_project_app` validation remains unavailable unless a target project defines app-native build/lint/test/smoke commands.

## Issues

No new QA issues.

Previously recorded implementation issues are resolved in workflow state and were regression-checked by QA evidence:

| Issue ID | Type | Severity | Rooted In | QA Status |
| --- | --- | --- | --- | --- |
| `feature-939-unstructured-scan-evidence-bypass` | bug | critical | implementation | Resolved; source-only scan evidence is blocked. |
| `feature-939-high-volume-scan-misclassified` | bug | high | implementation | Resolved; high-volume output is `scan_failed` + `degraded`, not `unavailable`. |
| `feature-939-out-of-scope-supervisor-dialogue` | bug | high | implementation | Resolved; `npm run verify:all` passed on QA rerun. |
| `feature-939-scan-gate-tool-id-mismatch` | bug | critical | implementation | Resolved; mismatched structured tool identity is blocked even when Tier 3 invocation exists. |

## Residual Risks And Caveats

- The QA API namespace in this session did not expose native `tool.rule-scan` / `tool.security-scan` functions. Runtime/MCP availability was verified through product tests and runtime bootstrap, and QA used Semgrep substitute scans with explicit classification.
- The bundled quality scan remains high-noise on this repository, especially `no-var-declaration`, `no-console-log`, and `no-empty-catch`. QA classified these as non-blocking for FEATURE-939 because they are grouped, traceable, covered by tests, and not target-project app failures. Future rule tuning remains advisable.
- A whole-project security probe still sees pre-existing `new Function()` findings in codemod tooling outside the FEATURE-939 changed-file set. This was not introduced by FEATURE-939 and is not treated as a changed-file closure blocker, but future security review of codemod inline-transform handling may be useful.
- The `syntax-outline` runtime tool was unavailable/degraded for this QA session path model, so structural verification used direct file reads and test evidence instead.
- Full-delivery task-board tasks remain `dev_done`; feature-level QA is passing, but Master Orchestrator should reconcile/advance workflow state during closure.

## Verification Records

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | QA found no new blocking defects. | AC1.1-AC7.2 verified; no target-project app validation invented. | `qa_to_done` |

## Conclusion

FEATURE-939 is closure-ready from QA. Recommend Master Orchestrator proceed with `qa_to_done` after linking this QA report and preserving the scan/tool evidence caveats above.
