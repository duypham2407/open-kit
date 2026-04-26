---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-943
feature_slug: normalize-direct-scan-tools
source_scope: docs/scope/2026-04-26-normalize-direct-scan-tools.md
source_solution: docs/solution/2026-04-26-normalize-direct-scan-tools.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Normalize Direct Scan Tools

## Overall Status

- **PASS**
- Recommended route: `qa_to_done`
- Work item: `feature-943`
- Stage verified: `full_qa`

## Verification Scope

QA verified the user-visible behavior promised by the scope and solution:

- Direct `tool.rule-scan` and `tool.security-scan` availability and structured scan result behavior for full-delivery owners when Semgrep-backed tooling is available.
- Per-work-item invocation logging for successful direct scans and retained failed/stale attempts.
- `details.scan_evidence` fields: direct tool identity/status, finding counts including `true_positive`, grouped triage, false-positive summary, artifact refs, validation-surface labels, stale-process caveats, substitute/manual distinction, and target-app validation boundary.
- MCP/server diagnostics for both Semgrep unavailable and stale/unregistered namespace cases.
- Workflow-state read models and policy gates for direct/substitute/manual scan evidence.
- Documentation/governance/install-bundle/package surfaces that describe and ship the normalized direct scan contract.
- Task board, workflow validation, stage readiness, and closeout readiness through `compatibility_runtime` checks.

## Observed Result

**PASS.** Fresh QA validation produced direct scan evidence and runtime evidence for the changed OpenKit surfaces. No unresolved QA issues were found.

Notes:

- Fresh QA direct scans succeeded through the OpenKit runtime tool wrapper with `stage=full_qa` and `owner=QAAgent`, and wrote entries to the active work-item invocation log.
- Historical failed direct scan attempts remain visible in the invocation log as `availability=unavailable` failures. They were not rewritten as successes.
- `npm run verify:semgrep-quality` initially failed because Semgrep runner discovery timed out through `npx --no-install semgrep` after skipping a self-recursive managed shim; the same command was rerun after confirming Semgrep availability and passed. The failed attempt is retained as environmental/transient evidence, not as a product behavior failure.
- `target_project_app` validation remains **unavailable** because this OpenKit repository feature does not define target-project app-native build/lint/test commands. OpenKit runtime, scan, workflow-state, governance, package, and CLI checks are not reported as target app validation.

## Behavior Impact

- Fullstack, Code Reviewer, and QA can rely on direct OpenKit scan evidence when Semgrep is available, rather than rescue scripts or hidden substitute evidence.
- Runtime logs now make direct scan attempts auditable per active work item, including both earlier failure/unavailable states and later successful direct scans.
- Human-facing read models summarize scan evidence compactly and link artifacts instead of requiring readers to inspect raw high-volume Semgrep output.
- MCP diagnostics distinguish direct scan namespace/stale-registration failures from Semgrep unavailability.
- Manual/substitute semantics remain visibly separate and cannot silently satisfy gates as direct evidence when direct tools are available.

## Acceptance Mapping

| Acceptance Criteria | Result | QA Evidence |
| --- | --- | --- |
| Fullstack/CodeReviewer/QA can produce direct rule/security scan evidence through normalized runtime path when Semgrep is available. | PASS | Fresh QA direct runtime scans produced `tool.rule-scan` and `tool.security-scan` evidence with `availability_state=available`, `result_state=succeeded`, `evidence_type=direct_tool`, and invocation refs. Earlier Fullstack/Code Review evidence also exists in workflow state. |
| Invocation log records successful direct scans scoped to active work item, while failed/stale attempts remain visible as failures. | PASS | `node .opencode/workflow-state.js show-invocations feature-943` showed 307 entries, 271 successful and 36 failed; fresh `full_qa` entries include stage/owner metadata, while earlier unavailable Semgrep attempts remain failure entries. |
| Evidence includes `details.scan_evidence` with direct tool, finding counts including `true_positive`, triage groups, false-positive summary, artifact refs, validation-surface labels, stale-process caveats. | PASS | Workflow evidence and QA artifacts `.openkit/artifacts/feature-943-qa-direct-scan-evidence.json`, `feature-943-qa-rule-scan-details.json`, and `feature-943-qa-security-scan-details.json` include these fields. Rule scan: total 326, `true_positive=0`, `non_blocking_noise=3`, `unclassified=0`; security scan: total 0. |
| MCP/server diagnostics for missing direct scan tools distinguish unregistered/stale namespace from Semgrep unavailable. | PASS | `node --test tests/mcp-server/mcp-server.test.js` passed; tests cover Semgrep-missing structured unavailable result and unknown direct scan tool returning `status=unregistered`, `namespace_status=unknown_tool`, stale-process caveat. |
| Substitute/manual override semantics remain separate and cannot silently replace direct evidence when direct scans are available. | PASS | Workflow controller/CLI tests passed; policy/readiness evidence rejects legacy source-only evidence, mismatched scan evidence, noisy available-output manual override bypass, and manual overrides without structured caveats. Fresh QA direct evidence has `substitute=null` and `manual_override=null`. |
| No raw high-volume scan dump in logs/read models; artifact refs used. | PASS | Invocation log/read-model tests passed, `show-invocations` printed compact metadata only, and scan evidence points to `.openkit/artifacts/...` refs. QA report summarizes counts/groups rather than raw Semgrep output. |
| No target-project app validation claim. | PASS | Scope/solution/report and evidence label OpenKit checks as `runtime_tooling`, `compatibility_runtime`, `documentation`, or package/global surfaces; `target_project_app` is explicitly unavailable. |

## Quality Checks

| Command / Check | Surface | Exit | Result |
| --- | --- | ---: | --- |
| `node --test "tests/runtime/audit-tools.test.js"` | `runtime_tooling` | 0 | PASS — 28/28 tests |
| `node --test "tests/runtime/invocation-logging.test.js"` | `runtime_tooling` / `compatibility_runtime` | 0 | PASS — 11/11 tests |
| `node --test "tests/mcp-server/mcp-server.test.js"` | `runtime_tooling` / MCP | 0 | PASS — 11/11 tests |
| `node --test ".opencode/tests/workflow-state-controller.test.js"` | `compatibility_runtime` | 0 | PASS — 130/130 tests |
| `node --test ".opencode/tests/workflow-state-cli.test.js"` | `compatibility_runtime` | 0 | PASS — 68/68 tests |
| `npm run verify:governance` | `documentation` / governance | 0 | PASS — governance, registry, contract consistency suites passed |
| `npm run verify:install-bundle` | package/docs derived bundle | 0 | PASS — derived install bundle in sync |
| `npm run verify:semgrep-quality` | `runtime_tooling` / Semgrep rule-pack | 1 then 0 | First run failed from transient Semgrep resolver timeout; rerun passed 5/5 tests and is the accepted gate evidence |
| `npm pack --dry-run` | package/global shipping surface | 0 | PASS — tarball includes scan runtime tools, MCP server, docs, install bundle, and Semgrep packs |
| Fresh QA direct scan script using `bootstrapRuntimeFoundation` tools | `runtime_tooling` | 0 | PASS — direct rule/security scans on 19 changed files/docs; artifact refs written |
| Fresh QA syntax outline script using `tool.syntax-outline` runtime tool | `runtime_tooling` | 0 | PASS — 13/13 changed JS files outlined |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | PASS — workflow state valid |
| `node .opencode/workflow-state.js validate-work-item-board feature-943` | `compatibility_runtime` | 0 | PASS — task board valid |
| `node .opencode/workflow-state.js check-stage-readiness` | `compatibility_runtime` | 0 | Initially blocked only by missing QA report; evidence readiness passed after QA evidence records |
| `node .opencode/workflow-state.js show-policy-status` | `compatibility_runtime` | 0 | PASS — Tier 2 tool evidence gate and Tier 3 runtime policy passed |
| `node .opencode/workflow-state.js validate-dod` | `compatibility_runtime` | 0 | PASS with expected remaining blockers before report/link: `qa_to_done` approval and `qa_report` artifact |

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available / succeeded; target scope: QA fresh direct scan on FEATURE-943 changed files plus scope/solution docs; namespace callable; stale caveat says earlier unavailable entries remain historical failed/stale attempts, not direct success claims | none (`substitute=null`, `manual_override=null`) | total 326 WARNING; blocking 0; `true_positive` 0; non-blocking noise 3 grouped categories; false positive 0; follow-up 0; unclassified 0 | groups 2 in fresh QA artifact: `no-console-log` CLI output accepted as non-blocking; `no-empty-catch` best-effort runtime logging/guard paths accepted as non-blocking | none; false-positive summary count 0 | none | direct execution: `runtime_tooling`; stored/read model: `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-943-qa-direct-scan-evidence.json`; `.openkit/artifacts/feature-943-qa-rule-scan-details.json`; `.opencode/work-items/feature-943/tool-invocations.json` |
| `tool.security-scan` | available / succeeded; target scope: QA fresh direct scan on FEATURE-943 changed files plus scope/solution docs; namespace callable | none (`substitute=null`, `manual_override=null`) | total 0; blocking 0; `true_positive` 0; non-blocking noise 0; false positive 0; follow-up 0; unclassified 0 | groups 0 | none; false-positive summary count 0 | none | direct execution: `runtime_tooling`; stored/read model: `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-943-qa-direct-scan-evidence.json`; `.openkit/artifacts/feature-943-qa-security-scan-details.json`; `.opencode/work-items/feature-943/tool-invocations.json` |

- Direct tool status: both direct scan tools were callable from fresh QA runtime context and logged as `stage=full_qa`, `owner=QAAgent`.
- Substitute status and limitations: not used for final QA evidence. Historical substitute/manual paths remain separate in policy tests and docs.
- Classification summary: no blocking, true-positive, unresolved security, or unclassified groups remain in final scan evidence.
- False-positive rationale: no false-positive classifications were needed in the fresh QA scans.
- Manual override caveats: none used for final QA; tests confirm manual overrides require structured caveats and cannot bypass noisy usable direct output.
- Validation-surface labels and target-project split: direct scans are `runtime_tooling`; workflow-state summaries are `compatibility_runtime`; docs/governance are `documentation`; package dry-run is package/global shipping evidence; target app validation unavailable.
- Artifact refs: high-volume details remain in `.openkit/artifacts/...`; no raw Semgrep dump is pasted into the report.

## Tool Evidence

- rule-scan: 326 findings on 19 files/docs, all grouped/classified with 0 blocking, 0 true-positive, 0 false-positive, 0 follow-up, 0 unclassified; direct tool available/succeeded.
- security-scan: 0 findings on 19 files/docs; direct tool available/succeeded.
- evidence-capture: 3 QA records written (`feature-943-qa-runtime-validation`, `feature-943-qa-acceptance-mapping`, `feature-943-qa-evidence-capture-tool`).
- syntax-outline: 13 changed JS/runtime/test files outlined through fresh runtime direct `tool.syntax-outline`; earlier API-level attempts returned invalid-path due active tool root/path mismatch, so QA used the fresh runtime direct tool and stored `.openkit/artifacts/feature-943-qa-syntax-outline.json`.

## Test Evidence

Fresh QA evidence IDs recorded in workflow state:

- `feature-943-qa-runtime-validation` — automated QA validation bundle, exit 0.
- `feature-943-qa-acceptance-mapping` — manual acceptance mapping, exit 0.
- `feature-943-qa-evidence-capture-tool` — `tool.evidence-capture` record, exit 0.

Previously available handoff evidence consumed by QA:

- `feature-943-direct-rule-scan` — direct rule scan evidence from implementation, exit 0.
- `feature-943-direct-security-scan` — direct security scan evidence from implementation, exit 0.
- `feature-943-blocker-resolution` — implementation blocker resolved and task board dev-done evidence, exit 0.
- `feature-943-code-review-pass` — Code Review PASS, exit 0.

QA artifact refs:

- `.openkit/artifacts/feature-943-qa-direct-scan-evidence.json`
- `.openkit/artifacts/feature-943-qa-rule-scan-details.json`
- `.openkit/artifacts/feature-943-qa-security-scan-details.json`
- `.openkit/artifacts/feature-943-qa-syntax-outline.json`
- `.opencode/work-items/feature-943/tool-invocations.json`

## Issues

No new QA issues found.

Existing historical issue status:

- `FEATURE-943-IMPL-BLOCKED` remains **resolved**. QA observed the previous unavailable direct scan attempts in the invocation log and verified fresh direct scan evidence now succeeds; no reopen is required.

## Verification Record(s)

| Issue Type | Severity | Rooted In | Evidence | Behavior Impact | Route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | Fresh QA validation and direct scan evidence passed; unresolved issues count is 0 | Required direct scan/logging/evidence behavior is closure-ready | `qa_to_done` |

## Recommended Route

- Recommend Master Orchestrator approve `qa_to_done` after linking this QA report artifact.
- Do not create a commit as part of QA; user explicitly said do not commit.

## Caveats

- `npm run verify:semgrep-quality` had one transient failure before passing on rerun; final gate evidence is the passing rerun.
- Fresh runtime direct `tool.syntax-outline` succeeded for structural QA. The in-session `openkit_tool_syntax-outline` API path returned invalid-path/missing-file earlier because its active project root was not the repository root; this was treated as a tool-surface path caveat and not as implementation failure because the runtime direct syntax tool outlined the changed files successfully.
- There is still no target-project app-native build/lint/test command for this OpenKit feature; target app validation is unavailable, not substituted.

## Conclusion

FEATURE-943 satisfies the approved scope. Direct scan tools are available and produce structured, logged, grouped evidence; stale/failed attempts remain visible; fallback/manual semantics stay separate; read models avoid raw scan walls; and validation surfaces remain honest. QA recommends `qa_to_done`.
