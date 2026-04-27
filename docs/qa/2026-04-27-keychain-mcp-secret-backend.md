---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-950
feature_slug: keychain-mcp-secret-backend
source_plan: docs/solution/2026-04-27-keychain-mcp-secret-backend.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Keychain MCP Secret Backend

## Overall Status

- PASS

## Verification Scope

- Validated approved scope: `docs/scope/2026-04-27-keychain-mcp-secret-backend.md`.
- Validated approved solution: `docs/solution/2026-04-27-keychain-mcp-secret-backend.md`.
- Validated Code Review result after rework: Code Review PASS; prior metadata-gate issue resolved.
- Checked OpenKit surfaces affected by FEATURE-950:
  - `global_cli`: `openkit configure mcp` secret-store flags, doctor/list/copy/repair behavior, and `openkit run` launcher loading.
  - `runtime_tooling`: direct rule/security scan evidence and mocked keychain adapter behavior.
  - `compatibility_runtime`: workflow-state evidence, gates, readiness, and task board.
  - `documentation`: operator MCP configuration guidance and direct OpenCode caveats.
  - `target_project_app`: explicitly unavailable; this feature does not add or validate a target application build/lint/test command.

## Observed Result

PASS. FEATURE-950 satisfies the approved acceptance criteria. No open QA issues were found. QA recommends closure through `qa_to_done`.

## Behavior Impact

- `local_env_file` remains the default/fallback MCP secret store.
- `keychain` is opt-in and macOS-only; non-macOS/unavailable keychain paths fail closed and fall back without mutating local secrets.
- `openkit run` secret precedence is shell environment, then recorded matching Keychain metadata, then local env file.
- Keychain lookup is metadata-gated: stale or unrecorded Keychain items are ignored.
- CLI/wizard surfaces report store state and availability using redacted status, never raw secret values.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Local env-file fallback preserved | PASS | Existing local secret file behavior remains default/fallback and is covered by secret-manager and launcher tests. |
| Optional keychain backend | PASS | Keychain is selected through explicit store options and is unavailable on non-macOS or unavailable adapter paths. |
| Shell env > keychain > local env precedence | PASS | Launcher tests cover shell env precedence, recorded keychain loading, and local fallback. |
| Metadata-gated Keychain lookup | PASS | Rework tests cover stale/unrecorded Keychain values ignored and recorded service/account metadata required before lookup. |
| Keychain adapter mockability | PASS | Keychain adapter tests use fake runner paths; CI does not require real Keychain mutation. |
| Set/unset/list/copy/doctor/wizard store behavior | PASS | Targeted CLI/service/wizard tests cover backend-aware behavior and redacted reporting. |
| Non-macOS behavior | PASS | Adapter and launcher tests cover unavailable/non-macOS-style fallback. |
| No raw secret leakage | PASS | Tests and docs use sentinel/placeholder-only values; generated profiles/config/docs/evidence remain redacted. |
| Direct OpenCode caveat | PASS | Operator docs explain OpenKit secret loading vs direct `opencode` launch caveats. |
| No target_project_app claim | PASS | This report records only OpenKit runtime/CLI/docs/compatibility evidence. |

## Quality Checks

| Check | Surface | Exit | Evidence |
| --- | --- | ---: | --- |
| `node --test tests/runtime/launcher.test.js` | `global_cli` / launcher | 0 | 19 launcher tests passed after metadata-gate rework. |
| `node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js` | `global_cli` / runtime | 0 | 41 focused FEATURE-950 tests passed. |
| `npm run verify:governance` | `documentation` | 0 | Governance, registry metadata, and workflow contract tests passed during implementation evidence. |
| Direct `tool.rule-scan` | `runtime_tooling` | 0 | Structured rule-scan evidence recorded with zero findings on FEATURE-950 changed scopes. |
| Direct `tool.security-scan` | `runtime_tooling` | 0 | Structured security-scan evidence recorded; project-wide findings classified non-blocking for FEATURE-950 changed files. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Workflow state valid. |
| `node .opencode/workflow-state.js validate-work-item-board feature-950` | `compatibility_runtime` | 0 | Task board valid. |

## Test Evidence

Existing verification evidence recorded for FEATURE-950 is summarized below without adding new behavioral claims:

| Evidence | Surface | Exit | Result |
| --- | --- | ---: | --- |
| `node --test tests/runtime/launcher.test.js` | `global_cli` / launcher | 0 | 19 launcher tests passed after metadata-gate rework, including OpenKit run-loader secret precedence and metadata-gated Keychain loading/fallback behavior. |
| `node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js` | `global_cli` / `runtime_tooling` | 0 | 41 focused FEATURE-950 tests passed across the fake/mock Keychain adapter, backend-aware secret manager, CLI configure flows, and launcher integration. |
| `npm run verify:governance` | `documentation` / `compatibility_runtime` | 0 | Governance, registry metadata, documentation, and workflow contract checks passed during implementation evidence. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Workflow-state schema and linked artifact state validated in recorded evidence. |
| `node .opencode/workflow-state.js validate-work-item-board feature-950` | `compatibility_runtime` | 0 | FEATURE-950 task board validation passed in recorded evidence. |

Caveats preserved for this evidence:

- Real macOS Keychain mutation was not performed; Keychain behavior was validated through mocked/fake adapter paths so CI remains deterministic.
- Direct `opencode` launches do not automatically load OpenKit-managed local/keychain secrets unless environment propagation is handled outside OpenKit.
- `target_project_app` validation is unavailable by design for this repository/feature; OpenKit runtime, CLI, workflow-state, governance, and scan checks are not presented as target-project app build/lint/test evidence.

## Tool Evidence

- `tool.rule-scan`: direct, available, succeeded; finding counts all zero on targeted FEATURE-950 scopes.
- `tool.security-scan`: direct, available, succeeded; project-wide warning output triaged as non-blocking scan noise for this feature.
- Manual override: none.
- Target-project app validation: unavailable/not applicable.

## Issues

- `FEATURE-950-CR-KEYCHAIN-METADATA-GATE`: resolved. Code Review verified the run-loader now requires recorded matching Keychain metadata and ignores stale/unrecorded items.

No open QA issues.

## Evidence Records

- `FEATURE-950-rule-scan-structured`
- `FEATURE-950-security-scan-structured`
- `FEATURE-950-code-review-approval`
- `FEATURE-950-CR-KEYCHAIN-METADATA-GATE`
- `FEATURE-950-implementation-validation`

## Caveats

- Real macOS Keychain mutation was not performed in QA; behavior is covered by mock/fake adapter tests so CI stays deterministic.
- Direct `opencode` launches do not automatically load OpenKit-managed local/keychain secrets unless environment propagation is handled outside OpenKit.
- `target_project_app` validation remains unavailable because this repository has no target app-native build/lint/test command for this feature.

## Recommended Route

Approve/recommend `qa_to_done`. Route to `MasterOrchestrator` for final closure handling and `full_done` advancement.
