---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-951
feature_slug: release-package-readiness-mcp-secret-backends
source_plan: docs/solution/2026-04-27-release-package-readiness-mcp-secret-backends.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Release Package Readiness For MCP Secret Backends

## Overall Status

- PASS

## Verification Scope

- Validated approved scope: `docs/scope/2026-04-27-release-package-readiness-mcp-secret-backends.md`.
- Validated approved solution: `docs/solution/2026-04-27-release-package-readiness-mcp-secret-backends.md`.
- Validated Code Review result after rework: PASS; prior interactive wizard scripted-answer issue is resolved.
- Checked the delivered FEATURE-951 surfaces:
  - `package`: `npm pack --dry-run --json` backed package readiness gate, required MCP secret backend file inclusion, forbidden runtime/secret artifacts, no persisted tarballs, and package text secret scan.
  - `global_cli`: install/global CLI smoke and MCP configure behavior through isolated tests and `verify:all`.
  - `runtime_tooling`: direct `tool.rule-scan` / `tool.security-scan`, syntax outlines for changed JS files, and fake/non-mutating keychain regression tests.
  - `documentation`: operator, supported-surfaces, maintainer test-matrix, and runbook guidance for package/global/secret-safety boundaries.
  - `compatibility_runtime`: workflow-state validation, stage readiness, issue closure, artifact linking, and evidence recording.
  - `target_project_app`: unavailable; no separate target application declares app-native build/lint/test/smoke commands for this feature.

## Observed Result

PASS. FEATURE-951 satisfies the approved acceptance criteria. Required package/global/runtime/documentation/compatibility evidence passed, direct changed-file scan evidence is clean, no raw secrets were reproduced in QA evidence, and no QA blockers remain.

## Behavior Impact

- The npm package now excludes active `.opencode/workflow-state.json` runtime state while keeping `.opencode/workflow-state.js` and required package/runtime surfaces.
- `npm run verify:mcp-secret-package-readiness` is available and included in `npm run verify:all`.
- The package gate proves required MCP secret backend, keychain adapter, CLI/runtime, install-bundle, operator docs, and release runbook files are present in the npm dry-run package file list.
- Forbidden package artifacts such as local secret env files, generated MCP state, active workflow mirrors, work-item state, runtime databases, extracted packages, and tarballs are rejected by the gate.
- Existing MCP secret behavior is preserved: `local_env_file` remains default, `keychain` remains opt-in/fake-only in CI validation, outputs stay redacted, and direct OpenCode launch caveats remain documented.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Required MCP secret backend files are present in npm package | PASS | `npm run verify:mcp-secret-package-readiness` passed with 461 package files checked and 38 required files missing 0. Required keychain adapter and MCP secret manager/runtime paths are included. |
| Global CLI/runtime files needed for MCP configure/run/materialization are included | PASS | Package gate required CLI/runtime/install materialization files; install/global tests and `verify:all` passed. |
| Docs and install-bundle assets are present or gate fails | PASS | Package gate requires packaged operator docs, release runbook, install-bundle README, and command/agent prefixes; `npm run verify:install-bundle` reported derived bundle in sync. |
| Required backend/runtime/docs removal fails the gate | PASS | `tests/install/mcp-secret-package-readiness.test.js` covers missing keychain adapter and forbidden artifact rejection. |
| Global install and CLI boundaries are isolated and redacted | PASS | Focused install/global tests and full `verify:all` passed. Tests use temporary homes/prefixes and redacted output; no real provider/network key use is required. |
| `local_env_file` default/fallback preserved | PASS | Focused MCP secret manager/configure/launcher tests passed; interactive wizard test now answers the new store prompt with `local_env_file`. |
| `keychain` opt-in/fake/non-mutating behavior preserved | PASS | Keychain adapter tests use fake runner behavior; QA did not mutate real macOS Keychain. |
| `openkit run` precedence remains shell > metadata-gated keychain > local env file | PASS | Focused launcher regression tests and `verify:all` passed. |
| No raw secret leakage in package/docs/log/evidence | PASS | Package gate reported 457 text files checked and 0 secret findings; report/evidence uses only placeholders/redacted summaries and does not reproduce sentinel values. |
| Temporary package/global artifacts are not committed | PASS | Package gate uses `npm pack --dry-run --json` and reported `temporary artifacts: none-persisted-dry-run-only`; post-validation git status shows no generated tarball/extraction artifacts. |
| Release gate documentation explains package/global/runtime/docs/compatibility split | PASS | Operator docs, supported-surfaces, maintainer test matrix, and new runbook describe `package`, `global_cli`, `runtime_tooling`, `documentation`, `compatibility_runtime`, and unavailable `target_project_app` boundaries. |
| FEATURE-950 behavior regression safety remains included | PASS | Focused MCP/keychain/configure/launcher commands and broader `verify:all` passed. |
| Target-project app validation unavailable and not substituted | PASS | Package gate output, docs, and this QA report explicitly mark `target_project_app` validation unavailable. |

## Quality Checks

| Check | Surface | Exit | Evidence |
| --- | --- | ---: | --- |
| `npm run verify:mcp-secret-package-readiness` | `package` | 0 | PASS; 461 package files, 38 required files missing 0, 2 required prefixes missing 0, 10 forbidden patterns present 0, 457 secret text files findings 0, no persisted tarball, `target_project_app` unavailable. |
| `node --test tests/install/mcp-secret-package-readiness.test.js` | `package` / `runtime_tooling` | 0 | 3/3 tests passed for package contract, missing/forbidden artifact rejection, and redacted rule/path-only secret findings. |
| `node --test tests/cli/configure-mcp-interactive.test.js` | `global_cli` | 0 | 6/6 tests passed; scripted set-key flow answers the new secret-store prompt and remains redacted. |
| `npm run verify:install-bundle` | `package` | 0 | Derived install bundle is in sync. |
| `npm run verify:governance` | `documentation` / `compatibility_runtime` | 0 | Governance, registry metadata, and workflow contract checks passed. |
| `npm run verify:semgrep-quality` | `runtime_tooling` | 0 | 5/5 Semgrep rule-pack regression tests passed, including security-pack sanity fixture. |
| `node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js` | `global_cli` / `runtime_tooling` | 0 | 41/41 focused MCP/keychain/configure/launcher regression tests passed with fake/non-mutating Keychain coverage. |
| `node --test tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js tests/cli/configure-mcp-custom.test.js tests/global/custom-mcp-store.test.js tests/global/mcp-profile-materializer.test.js` | `global_cli` / `runtime_tooling` | 0 | 43/43 interactive/custom/materializer tests passed with redacted custom MCP behavior. |
| `node --test tests/global/ensure-install.test.js tests/cli/install.test.js` | `global_cli` / `package` | 0 | 21/21 install/global materialization tests passed. |
| `node --test tests/install/install-state.test.js tests/install/materialize.test.js tests/install/skill-bundle-sync.test.js` | `package` | 0 | 19/19 install-state/materialization/bundle-sync tests passed. |
| `node .opencode/workflow-state.js validate-work-item-board feature-951` | `compatibility_runtime` | 0 | Feature task board valid; all 5 implementation tasks are `dev_done`. |
| `npm run verify:all` | mixed OpenKit surfaces | 0 | Full OpenKit repository validation passed; output was large and saved by the runtime at `/Users/duypham/.local/share/opencode/tool-output/tool_dd17119a10012nAQ0T5GzCpqWq`. This is not `target_project_app` evidence. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Workflow state is valid. |
| `node .opencode/workflow-state.js check-stage-readiness` before QA report/evidence | `compatibility_runtime` | 0 | Correctly reported not ready because QA report and manual/runtime evidence were still missing. |

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available / succeeded; changed JS/package targets scanned directly with repo-absolute paths; docs dirs also attempted and produced no code targets | none | 0 findings on required changed implementation/test/package scan targets | blocking=0, true_positive=0, non_blocking_noise=0, false_positive=0, follow_up=0, unclassified=0 | none | none | direct execution: `runtime_tooling`; stored workflow evidence: `compatibility_runtime`; not `target_project_app` | `scripts/verify-mcp-secret-package-readiness.mjs`; `tests/install/mcp-secret-package-readiness.test.js`; `tests/cli/configure-mcp-interactive.test.js`; `tests/runtime/governance-enforcement.test.js`; `package.json`; this QA report |
| `tool.security-scan` | available / succeeded; changed JS/package targets scanned directly with repo-absolute paths; docs dirs also attempted and produced no code targets | none | 0 findings on required changed implementation/test/package scan targets | blocking=0, true_positive=0, non_blocking_noise=0, false_positive=0, follow_up=0, unclassified=0 | none | none | direct execution: `runtime_tooling`; stored workflow evidence: `compatibility_runtime`; not `target_project_app` | `scripts/verify-mcp-secret-package-readiness.mjs`; `tests/install/mcp-secret-package-readiness.test.js`; `tests/cli/configure-mcp-interactive.test.js`; `tests/runtime/governance-enforcement.test.js`; `package.json`; this QA report |

- Direct tool status: direct `tool.rule-scan` and `tool.security-scan` were available and succeeded on FEATURE-951 changed source/test/package surfaces with zero required-scope findings.
- Substitute status and limitations: none; no substitute scan or manual override was needed for the required changed-file scan gate.
- Classification summary: required changed-file scan evidence has blocking=0, true_positive=0, non_blocking_noise=0, false_positive=0, follow_up=0, unclassified=0.
- Additional non-gating scan note: QA also probed the whole repository. Project-wide quality/security output includes existing findings outside FEATURE-951 changed files (for example historical CLI console-output noise and codemod `new Function` findings). Those are outside the verified package-readiness delta and are not used as the required changed-file gate. Required FEATURE-951 changed-file scans are clean.
- False-positive rationale: none claimed for required FEATURE-951 scans because there were zero required-scope findings.
- Manual override caveats: none.
- Validation-surface labels and target-project app validation split: OpenKit scans are `runtime_tooling`; workflow-stored evidence is `compatibility_runtime`; neither is `target_project_app` evidence.
- Artifact refs: this QA report; workflow evidence IDs listed in `Evidence Records`; raw large `verify:all` output artifact `/Users/duypham/.local/share/opencode/tool-output/tool_dd17119a10012nAQ0T5GzCpqWq`.

Tool Evidence:
- rule-scan: direct=available, result=succeeded, findings=0 on required FEATURE-951 changed source/test/package scan targets, surface=runtime_tooling.
- security-scan: direct=available, result=succeeded, findings=0 on required FEATURE-951 changed source/test/package scan targets, surface=runtime_tooling.
- evidence-capture: QA records written for automated/runtime/manual evidence and scan evidence with validation-surface labels and this QA report artifact ref.
- syntax-outline: 4 changed JavaScript files outlined (`scripts/verify-mcp-secret-package-readiness.mjs`, `tests/install/mcp-secret-package-readiness.test.js`, `tests/cli/configure-mcp-interactive.test.js`, `tests/runtime/governance-enforcement.test.js`); `package.json` reported unsupported-language and did not require structural source validation.
- classification summary: blocking=0, true_positive=0, non_blocking_noise=0, false_positive=0, follow_up=0, unclassified=0 for required changed-file scans.
- false positives: none.
- manual override caveats: none.
- artifact refs: `docs/qa/2026-04-27-release-package-readiness-mcp-secret-backends.md`; `scripts/verify-mcp-secret-package-readiness.mjs`; `tests/install/mcp-secret-package-readiness.test.js`; `package.json`; evidence IDs below.

## Supervisor Dialogue Evidence

Not applicable. FEATURE-951 does not change the OpenClaw/OpenKit supervisor dialogue surface. Runtime resume summary shows a supervisor dialogue store for the active work item with transport `unconfigured` and pending outbound dialogue records, but this is compatibility-runtime context only and not FEATURE-951 delivery proof.

- FEATURE-940 artifact refs used: none.
- FEATURE-937 references: none.
- Proof no workflow mutation from inbound OpenClaw messages: not in scope; no inbound supervisor messages were part of this QA validation.
- Target-project app validation: unavailable unless an actual target project defines app-native build, lint, or test commands. OpenKit package/runtime/workflow checks are not target-project app validation.

## Test Evidence

| Command | Surface | Exit | Result Summary |
| --- | --- | ---: | --- |
| `npm run verify:mcp-secret-package-readiness` | `package` | 0 | Package readiness PASS; dry-run package list only; 0 missing required files, 0 forbidden artifacts, 0 secret scan findings, no persisted tarballs, `target_project_app` unavailable. |
| `node --test tests/install/mcp-secret-package-readiness.test.js` | `package` / `runtime_tooling` | 0 | 3 tests passed. |
| `node --test tests/cli/configure-mcp-interactive.test.js` | `global_cli` | 0 | 6 tests passed. |
| `npm run verify:install-bundle` | `package` | 0 | Derived install bundle is in sync. |
| `npm run verify:governance` | `documentation` / `compatibility_runtime` | 0 | 37 total governance/registry/contract tests passed across invoked suites. |
| `npm run verify:semgrep-quality` | `runtime_tooling` | 0 | 5 Semgrep regression tests passed. |
| Focused MCP/keychain/launcher command | `global_cli` / `runtime_tooling` | 0 | 41 tests passed; fake/non-mutating Keychain coverage. |
| Interactive/custom/materializer command | `global_cli` / `runtime_tooling` | 0 | 43 tests passed. |
| Install CLI command | `global_cli` / `package` | 0 | 21 tests passed. |
| Install state/materialize/skill-bundle command | `package` | 0 | 19 tests passed. |
| Feature task-board validation | `compatibility_runtime` | 0 | Task board valid; all 5 tasks are `dev_done`. |
| `npm run verify:all` | mixed OpenKit surfaces | 0 | Full OpenKit verification passed; not app-native validation. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Workflow state valid. |
| `node .opencode/workflow-state.js check-stage-readiness` | `compatibility_runtime` | 0 | Pre-report/evidence check correctly identified missing QA artifacts/evidence; final check is expected after artifact linking/evidence recording. |

No command output in this QA report includes raw secret values. Real macOS Keychain was not mutated.

## Recommended Route

Recommend `qa_to_done` approval after this QA report is linked and QA evidence records are present in workflow state. Route to `MasterOrchestrator` for closure handling and `full_done` advancement.

## Issues

### FEATURE-951-CR-INTERACTIVE-WIZARD-TEST: Interactive MCP set-key test does not answer new secret store prompt

- Type: bug
- Severity: high
- Rooted In: implementation
- Recommended Owner: FullstackAgent
- Evidence: Code Review found the scripted interactive test answered the new secret-store prompt incorrectly; Fullstack rework changed the scripted answer to `local_env_file` before confirmation.
- Status: resolved before QA; focused interactive test and `verify:all` passed after rework.
- Recommendation: no QA rework required.

No open QA issues.

## Evidence Records

QA evidence IDs recorded or to be recorded for this report:

- `FEATURE-951-QA-automated-validation`
- `FEATURE-951-QA-runtime-validation`
- `FEATURE-951-QA-manual-acceptance`
- `FEATURE-951-QA-rule-scan-direct`
- `FEATURE-951-QA-security-scan-direct`
- `FEATURE-951-QA-report-artifact`

Existing implementation/review evidence considered:

- `FEATURE-951-code-review-approval`
- `FEATURE-951-cr-interactive-wizard-test-rework`
- `FEATURE-951-rule-scan-structured`
- `FEATURE-951-security-scan-structured`
- `feature-951-implementation-validation`

## Conclusion

FEATURE-951 is QA PASS for the approved full-delivery scope. The package readiness gate and tests prove release-critical MCP secret backend files are included, active runtime state is excluded, forbidden secret/runtime artifacts are absent, keychain validation remains fake/non-mutating, docs preserve validation-surface boundaries, and `target_project_app` validation remains explicitly unavailable.
