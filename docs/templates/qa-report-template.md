---
artifact_type: qa_report
version: 1
status: draft
feature_id: FEATURE-000
feature_slug: example-feature
source_plan: docs/solution/YYYY-MM-DD-example-feature.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: <Feature Name>

## Overall Status
- PASS | FAIL

## Verification Scope

## Observed Result

## Behavior Impact

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| | | |

## Quality Checks

## Scan/Tool Evidence

Use this section for FEATURE-939 scan/tool evidence expectations. Do not omit direct tool state, substitute/manual evidence, classification, false-positive rationale, manual override caveats, validation-surface labels, or artifact refs when `tool.rule-scan` or `tool.security-scan` is unavailable, degraded, noisy, or substituted.

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | availability/result state, scope | substitute status and limitations, or `none` | total by severity/category | blocking / true_positive / non_blocking_noise / false_positive / follow_up / unclassified | rule, file/area, context, rationale, impact, follow-up when applicable | target stage, unavailable tool, reason, actor, substitute limitations, caveat when applicable | `runtime_tooling` or stored `compatibility_runtime`; not `target_project_app` | raw scan output, evidence ids, task refs |
| `tool.security-scan` | availability/result state, scope | substitute status and limitations, or `none` | total by severity/category | blocking / true_positive / non_blocking_noise / false_positive / follow_up / unclassified | rule, file/area, context, rationale, impact, follow-up when applicable | target stage, unavailable tool, reason, actor, substitute limitations, caveat when applicable | `runtime_tooling` or stored `compatibility_runtime`; not `target_project_app` | raw scan output, evidence ids, task refs |

- Direct tool status:
- Substitute status and limitations:
- Classification summary:
- False-positive rationale:
- Manual override caveats:
- Validation-surface labels and target-project app validation split:
- Artifact refs:

## Supervisor Dialogue Evidence

Use this section when the feature touches OpenClaw/OpenKit supervisor dialogue, including FEATURE-940. Cite the current feature's approved scope, solution, implementation evidence, code review evidence, and QA artifacts. FEATURE-937 may be referenced only as historical risk context, not as delivery proof. Keep FEATURE-939 scan/tool evidence in the `Scan/Tool Evidence` section above.

| Evidence Target | Required QA Proof | Validation Surface | Artifact Refs |
| --- | --- | --- | --- |
| Supervisor health | health state such as disabled, unconfigured, degraded, offline, unavailable, or healthy; include whether the state is fatal or non-fatal | `runtime_tooling` for manager/config health; stored `compatibility_runtime` for workflow-state read models | |
| Outbound event statuses | outbound OpenKit event behavior after a successful OpenKit authority write; pending/delivered/failed/skipped counts or examples; proof failed/rejected writes are not reported as successful events | `compatibility_runtime` or `runtime_tooling` | |
| Inbound dispositions | acknowledgement, advisory proposal, concern, attention request, invalid, duplicate, and rejected authority-boundary dispositions; confirm none are treated as approvals, task assignments, issue closures, or verification results | `compatibility_runtime` or `runtime_tooling` | |
| Authority-boundary rejection | rejected/quarantined or human-attention disposition for any inbound request to run commands, edit code, change workflow state, approve gates, update task boards, record evidence, close issues, or mark QA complete | `compatibility_runtime` or `runtime_tooling` | |
| Duplicate/repeated proposal | duplicate message identity and repeated proposal key handling; show duplicate/repeated proposal pressure did not create duplicate actionable work while preserving audit records | `compatibility_runtime` or `runtime_tooling` | |
| Degraded/offline scenario | disabled, unconfigured, unreachable, timeout, invalid response, failed delivery, or skipped delivery path; show normal OpenKit workflow validation continues | `runtime_tooling` plus stored `compatibility_runtime` when evidence is persisted | |
| No workflow mutation from inbound | proof that inbound OpenClaw messages did not mutate workflow state beyond supervisor dialogue records; include before/after state evidence or test assertions plus workflow-state validation where available | `compatibility_runtime` or `runtime_tooling`; never `target_project_app` | |

- FEATURE-940 artifact refs used:
- FEATURE-937 references, if any, are historical risk only:
- Proof no workflow mutation from inbound OpenClaw messages:
- Target-project app validation: unavailable unless an actual target project defines app-native build, lint, or test commands. Do not present OpenKit runtime, workflow-state, scan, governance, or CLI checks as target-project app validation.

## Test Evidence

## Recommended Route

## Issues

### ISSUE-001: <Title>
- Type:
- Severity:
- Rooted In:
- Recommended Owner:
- Evidence:
- Recommendation:

## Conclusion
