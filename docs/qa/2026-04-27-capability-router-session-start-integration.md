---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-949
feature_slug: capability-router-session-start-integration
source_plan: docs/solution/2026-04-27-capability-router-session-start-integration.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Capability Router Session-Start Integration

## Overall Status

- PASS

## Verification Scope

- Validated approved scope: `docs/scope/2026-04-27-capability-router-session-start-integration.md`.
- Validated approved solution: `docs/solution/2026-04-27-capability-router-session-start-integration.md`.
- Validated Code Review handoff: Code Review PASS with no findings.
- Checked OpenKit surfaces affected by FEATURE-949:
  - `global_cli` / hook behavior: session-start startup guidance block and managed-state startup smoke.
  - `runtime_tooling`: capability guidance builder, capability router summary path, runtime capability tools, scan tools, redaction and role/stage behavior.
  - `compatibility_runtime`: workflow-state status/resume/readiness/read-model behavior, task board readiness, evidence records.
  - `documentation`: operator, maintainer, governance, kit-internals, and core runtime-surface docs.
  - `package`: install-bundle synchronization because packaged operator/runtime docs and runtime source are included in the install bundle.
  - `target_project_app`: explicitly unavailable; this feature does not add or validate a target application build/lint/test command.

## Observed Result

PASS. FEATURE-949 satisfies the approved acceptance criteria. No open QA issues were found, direct scan findings are non-blocking after QA triage, and QA recommends closure through `qa_to_done`.

## Behavior Impact

- Session start now emits a compact `<openkit_capability_guidance>` startup snapshot after runtime status.
- Runtime status/resume/read models expose matching compact capability guidance with `runtime_tooling` surface labels.
- Guidance remains advisory and lazy: it recommends explicit follow-up calls but does not load skill bodies, call the `skill` tool, execute MCP-backed tools, run provider/network checks, mutate workflow state, approve gates, or claim target-app validation.
- Role/stage guardrails are visible for Master, ProductLead, SolutionLead, FullstackAgent, CodeReviewer, QAAgent, QuickAgent, and migration contexts.
- Unavailable/degraded/not_configured/needs-key/custom-MCP/stale-snapshot caveats remain visible and secret-safe.
- No marketplace, keychain, custom MCP lifecycle expansion, lane/stage semantic change, or target-project app validation claim was introduced.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Compact guidance caps/no full catalog | PASS | Session-start and capability-builder spot checks stayed within 25 lines / 2,400 chars. Session-start active-state smoke rendered 14 guidance lines. Builder sentinel check rendered 13 lines / 2,207 chars. Tests assert no full skill, bundled MCP, or custom MCP catalog dump. |
| Advisory-only/lazy activation | PASS | Session-start, builder, and runtime tests assert “advisory only; no skill or MCP was auto-activated”; output avoids hidden “loaded/ran/verified/healthy now” claims. Startup skill loading remains controlled by existing `OPENKIT_SESSION_START_NO_SKILL`, separate from capability guidance. |
| Role/stage guardrails | PASS | `tests/runtime/capability-tools.test.js` covers MasterOrchestrator, ProductLead, SolutionLead, FullstackAgent, CodeReviewer, QAAgent, QuickAgent, and migration guardrails. Active-state smoke showed `full / full_qa / QAAgent` guidance with QA-only verification/evidence wording. |
| Session-start integration | PASS | `.opencode/tests/session-start-hook.test.js` passed 8/8. Manual smoke with active managed FEATURE-949 state printed `<openkit_runtime_status>`, then `<openkit_capability_guidance>`, then resume hints; the guidance block included startup snapshot and refresh routes. |
| Runtime summary exposure | PASS | `.opencode/tests/workflow-state-cli.test.js` and `tests/runtime/runtime-platform.test.js` passed. `resume-summary --json` exposed `capability_guidance` / `capability_guidance_lines`; source runtime-summary/controller spot checks exposed `capabilityGuidance` / `capabilityGuidanceLines` with `runtime_tooling` labels. |
| Unavailable/needs-key/custom MCP caveats | PASS | Output and tests show unavailable bundled MCPs, `not_configured`/`needs-key` key-required MCPs, and custom MCPs as `custom_mcp` with origin/ownership labels and “not bundled defaults” wording. No custom entries are implied when none are configured. |
| Stale snapshot caveat | PASS | Session-start says capability readiness can change after the startup snapshot; runtime summary says the read model may be stale unless refreshed explicitly. Refresh routes include runtime-summary, capability-router, skill-index, capability-inventory, mcp-doctor, and capability-health. |
| Redaction/no raw secrets | PASS | Capability builder sentinel check did not leak the synthetic secret-like value. Tests cover redacted key state and no provider/env/header payload leakage. Docs examples use placeholder/redacted language. |
| Docs/governance | PASS | `npm run verify:governance` passed. Operator, maintainer, governance, kit-internals, project-config, and runtime-surfaces docs describe advisory guidance, compact output, lazy activation, role/stage boundaries, status vocabulary, custom MCP visibility, stale caveats, redaction, and validation-surface boundaries. |
| No marketplace/keychain/custom expansion | PASS | Scope/solution non-goals preserved. Code and docs route detailed setup to existing explicit MCP tools/commands and do not introduce marketplace, keychain, password-manager, secret-sync, provider onboarding, or new custom MCP lifecycle behavior. |
| No lane/stage semantics change | PASS | Workflow-state validation, governance, and contract consistency suites passed. Guidance uses canonical mode/stage/owner vocabulary and does not change approval gates, stage names, lane semantics, escalation rules, or workflow-state enums. |
| No target_project_app claim | PASS | `tool.typecheck`, `tool.lint`, and `tool.test-run` returned `unavailable` because no target-project app-native TS/lint/test framework is detected. Report and runtime/docs label OpenKit checks as `global_cli`, `runtime_tooling`, `compatibility_runtime`, `documentation`, or `package`, never target app proof. |

## Quality Checks

| Check | Surface | Exit | Evidence |
| --- | --- | ---: | --- |
| `node --test ".opencode/tests/session-start-hook.test.js"` | `global_cli` / hook behavior | 0 | 8 tests passed. |
| `node --test ".opencode/tests/workflow-state-cli.test.js"` | `compatibility_runtime` | 0 | 71 tests passed, including compact capability guidance lines and JSON read-model coverage. |
| `node --test "tests/runtime/capability-tools.test.js"` | `runtime_tooling` | 0 | 12 tests passed, including compact/advisory guidance, role guardrails, custom MCP labels, needs-key caveats, redaction, unknown state, router/index/bindings behavior. |
| `node --test "tests/runtime/runtime-platform.test.js"` | `runtime_tooling` / `compatibility_runtime` | 0 | 25 tests passed, including runtime-summary capability guidance and target-project validation boundary assertions. |
| `npm run verify:governance` | `documentation` | 0 | Governance, registry metadata, and workflow contract consistency suites passed. |
| `npm run verify:runtime-foundation` | `runtime_tooling` | 0 | Runtime config, capability registry, and runtime bootstrap suites passed. |
| `npm run verify:install-bundle` | `package` | 0 | Reported “Derived install bundle is in sync.” |
| `npm run verify:semgrep-quality` | `runtime_tooling` | 0 | 5 Semgrep quality/security rule-pack regression tests passed. |
| `npm run verify:all` | mixed OpenKit surfaces | 0 | Full OpenKit gate passed; high-volume output was saved by the tool layer. Tail reported 473 runtime tests, 30 install tests, 92 global tests, and 101 CLI tests passing, plus chained package/governance/semgrep suites. |
| Direct runtime `tool.rule-scan` over FEATURE-949 changed files | `runtime_tooling` | 0 | 24 files scanned; 336 warnings, all from `.opencode/workflow-state.js` CLI terminal output and triaged non-blocking. |
| Direct runtime `tool.security-scan` over FEATURE-949 changed files | `runtime_tooling` | 0 | 24 files scanned; 1 test-fixture secret warning in `tests/runtime/runtime-platform.test.js`, triaged false positive. |
| Active managed-state session-start smoke | `global_cli` / hook behavior | 0 | Startup output included compact `full / full_qa / QAAgent` guidance, stale snapshot/refresh wording, needs-key caveats, custom MCP caveat, target app unavailable caveat, and no hidden activation claim. |
| Capability builder redaction/caps spot check | `runtime_tooling` | 0 | 13 lines / 2,207 chars; QA guardrail, advisory wording, needs-key, custom origin label, target-app unavailable present; synthetic sentinel did not leak. |
| `node .opencode/workflow-state.js resume-summary --json` guidance extraction | `compatibility_runtime` | 0 | FEATURE-949 JSON included `capability_guidance`, `capability_guidance_lines`, `runtime_tooling` surface, 14 lines, QA guardrail, stale/snapshot wording, and target-app unavailable caveat. |
| Source runtime-summary/controller spot checks | `runtime_tooling` / `compatibility_runtime` | 0 | Source runtime-summary tool and workflow-state controller returned `capabilityGuidance`/`capabilityGuidanceLines` for active FEATURE-949 state when `OPENKIT_KIT_ROOT` pointed at the checked-in source. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Workflow state valid. |
| `node .opencode/workflow-state.js validate-work-item-board feature-949` | `compatibility_runtime` | 0 | Task board valid. |
| `node .opencode/workflow-state.js integration-check feature-949` | `compatibility_runtime` | 0 | Integration ready: yes. |
| `tool.typecheck` / `tool.lint` / `tool.test-run` probes | `target_project_app` | 0 tool calls | All returned `unavailable` (`No tsconfig.json`, `No linter configuration`, `No test framework detected`), as expected for this OpenKit runtime/docs feature. |

## Tool Evidence

- rule-scan: 336 findings on 24 changed files; direct runtime `tool.rule-scan` available/succeeded. QA classification: 0 blocking, 0 true positive, 1 non-blocking-noise group (`no-console-log` in workflow-state CLI terminal presenter), 0 false positive, 0 follow-up, 0 unclassified.
- security-scan: 1 finding on 24 changed files; direct runtime `tool.security-scan` available/succeeded. QA classification: 0 blocking, 0 true positive, 0 non-blocking noise, 1 false-positive group (`no-hardcoded-secret` on a non-sensitive test fixture placeholder), 0 follow-up, 0 unclassified.
- evidence-capture: 3 QA records written through `tool.evidence-capture` / workflow runtime: `feature-949-qa-automated-validation-2026-04-27`, `feature-949-qa-direct-scans-2026-04-27`, and `feature-949-qa-manual-runtime-spot-checks-2026-04-27`.
- syntax-outline: attempted for changed source files and project-wide structural expectations, but unavailable/degraded in this QA namespace due path resolver returning `missing-file`/`invalid-path` for the active root and `fileCount: 0` project-wide. Substituted with targeted source reads plus structural assertions in `tests/runtime/capability-tools.test.js`, `.opencode/tests/session-start-hook.test.js`, `.opencode/tests/workflow-state-cli.test.js`, and `tests/runtime/runtime-platform.test.js`.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available/succeeded; 24 changed implementation/doc files scanned through OpenKit runtime tool harness | none for scan execution; QA triage applied to fresh findings | 336 total warnings | blocking 0, true_positive 0, non_blocking_noise 1 group, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-949-direct-scan-details.json`; evidence `feature-949-qa-direct-scans-2026-04-27` |
| `tool.security-scan` | available/succeeded; 24 changed implementation/doc files scanned through OpenKit runtime tool harness | none for scan execution; QA triage applied to fresh finding | 1 total error-severity finding | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 1 group, follow_up 0, unclassified 0 | Test fixture placeholder in `tests/runtime/runtime-platform.test.js` verifies env substitution; it is not a real credential, is not production config, and has no runtime security impact. | none | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-949-direct-scan-details.json`; evidence `feature-949-qa-direct-scans-2026-04-27` |

- Direct tool status: both direct scan tools were available and completed successfully over the FEATURE-949 changed-file set.
- Substitute status and limitations: no substitute scan used for rule/security scan gates.
- Classification summary: no blocking or true-positive findings remain after QA triage.
- False-positive rationale: the only security finding is a non-sensitive placeholder fixture in a runtime-platform test.
- Manual override caveats: none.
- Validation-surface labels and target-project app validation split: scan execution is `runtime_tooling`; recorded workflow evidence/read models are `compatibility_runtime`; docs are `documentation`; install-bundle sync is `package`; target-project app validation is unavailable.
- Artifact refs: `.openkit/artifacts/feature-949-direct-scan-details.json`; QA evidence IDs above.

## Test Evidence

Fresh QA evidence records:

- `feature-949-qa-automated-validation-2026-04-27` — automated QA validation commands and gates, all exit 0.
- `feature-949-qa-direct-scans-2026-04-27` — fresh direct rule/security scan evidence and QA triage summary, no blockers.
- `feature-949-qa-manual-runtime-spot-checks-2026-04-27` — manual/runtime spot checks for session-start output, runtime summary exposure, redaction, docs/governance coverage, and target-app unavailable probes.

Command notes:

- `npm run verify:all` produced high-volume output; the Bash tool saved full output to an artifact path, and the visible tail reported all suites passing with exit 0.
- Node emitted non-fatal `MODULE_TYPELESS_PACKAGE_JSON` warnings from the managed global kit during some runtime-platform/runtime-foundation checks. The affected commands exited 0 and the warning does not alter FEATURE-949 behavior.
- Runtime-summary in the generic in-session runtime tool namespace reflects the currently installed global kit unless `OPENKIT_KIT_ROOT` points at the checked-in source; source-level runtime-summary/controller spot checks confirmed the FEATURE-949 guidance fields exist in the implementation under review.

## Issues

No open QA issues.

Non-blocking caveats:

- Direct scan noise: `.opencode/workflow-state.js` intentionally uses `console.log` for CLI output; this is covered by workflow-state CLI regression tests and is non-blocking.
- Security scan false positive: runtime-platform test uses a placeholder token-like fixture to assert env substitution. It is not a real secret and is not production/runtime credential material.
- Syntax-outline tool path resolution was unavailable/degraded in this QA namespace; structural verification was substituted with automated tests and targeted source reads.
- Target-project application validation remains unavailable because this repository has no target app-native build/lint/test command for FEATURE-949.

## Recommended Route

Approve/recommend `qa_to_done`. Route to `MasterOrchestrator` for final closure handling and `full_done` advancement after it links this QA report and records the closure gate.

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | `feature-949-qa-automated-validation-2026-04-27`; `feature-949-qa-direct-scans-2026-04-27`; `feature-949-qa-manual-runtime-spot-checks-2026-04-27` | Acceptance criteria satisfied; no blocking runtime/tooling/docs/package/compatibility regressions observed; target app validation correctly unavailable. | approve/recommend `qa_to_done` |

## Conclusion

FEATURE-949 passes final QA. The implementation provides compact capability-router guidance in session-start and runtime summary surfaces, preserves advisory/lazy activation, enforces role/stage guardrails, exposes unavailable/not_configured/needs-key/custom/stale caveats, keeps secret output redacted, updates docs/governance, and avoids marketplace/keychain/custom-MCP/lane-stage/target-app expansion.
