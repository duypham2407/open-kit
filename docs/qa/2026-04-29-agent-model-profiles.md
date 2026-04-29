---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-961
feature_slug: agent-model-profiles
source_plan: docs/solution/2026-04-29-agent-model-profiles.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Agent Model Profiles

## Overall Status
- PASS

## Verification Scope
- Approved scope: `docs/scope/2026-04-29-agent-model-profiles.md`.
- Approved solution: `docs/solution/2026-04-29-agent-model-profiles.md`.
- Code review status supplied by delegation: PASS after CR-001 and CR-002 fixes.
- QA covered OpenKit `global_cli`, `in_session`, runtime launch/bootstrap, install-bundle, governance, and scan/tool evidence surfaces.
- QA did not edit implementation code. The only QA-authored artifact is this report.

## Observed Result
- PASS: requested targeted and broader OpenKit validation commands passed.
- `openkit profiles` behavior is covered for create, edit, list, delete, set-default, duplicate-name handling, cancellation/no-mutation, empty-list messaging, strict discovered-model choices, role removal during edit, default deletion guard, running-session deletion guard, terminal/failed session deletion allowance, and post-delete list behavior.
- Runtime/session behavior is covered for global default profile layering in `openkit run`, partial profile fallback, stale/invalid default handling, session-scoped `/switch-profiles`, no global default mutation, multi-session isolation through runtime session ids, no direct-argument requirement, no-profiles/cancellation/missing selection handling, and fail-closed invalid session/profile entries.
- Install bundle verification passed and confirms command bundle sync, including `/switch-profiles` derived surfaces.
- Governance verification passed.

## Behavior Impact
- Operators can manage reusable global agent model profiles through `openkit profiles` before launch.
- New `openkit run` sessions can start from the configured global default profile while omitted roles fall back to current/default agent model settings.
- In-session `/switch-profiles` changes only the current runtime session's active profile and preserves global default and other sessions.
- Profile deletion is guarded against global default usage and active running-session usage while allowing deletion after terminal/failed/stopped sessions.

## Spec Compliance
| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| AC-01 global profile scope | PASS | Global store path and temp `OPENCODE_HOME` behavior covered by `tests/global/agent-model-profiles.test.js` and `tests/cli/profiles.test.js`. |
| AC-02 short management CLI | PASS | `openkit profiles --create`, `--edit`, `--list`, `--delete`, and `--set-default` covered by `tests/cli/profiles.test.js`; help/registration covered by `tests/cli/openkit-cli.test.js`. |
| AC-03 interactive create/edit UX | PASS | Prompt-injection tests cover create and edit wizard behavior using shared model selection helpers. |
| AC-04 valid configured model choices only | PASS | `tests/cli/agent-model-selection.test.js` and profile CLI tests prove strict interactive selection returns discovered model entries and rejects unsupported configure-agent-model options. |
| AC-05 partial profile fallback | PASS | Store/resolver and launcher tests cover sparse profiles and omitted-role fallback to base/current settings. |
| AC-06 global default startup | PASS | `tests/runtime/launcher.test.js` covers default profile layering in `launchGlobalOpenKit`. |
| AC-07 in-session interactive switch | PASS | `tests/runtime/profile-switch.test.js` covers listing profiles and selecting one through runtime tool/manager paths. |
| AC-08 session-only switch | PASS | Runtime tests cover global default/profile store immutability and workspace/runtime-session isolation. |
| AC-09 no direct switch argument required | PASS | CLI tests cover wrapper behavior and short in-session syntax; implementation evidence does not require `/switch-profiles <name>` direct argument support for this feature. |
| AC-10 delete blocks default | PASS | CLI/global tests cover default deletion guard and guidance path. |
| AC-11 delete blocks active sessions | PASS | Global, CLI, launcher, and session-profile tests cover launch metadata and session-specific active-profile guards for running sessions. |
| AC-12 empty/cancel-safe flows | PASS | CLI/runtime tests cover empty profile list, unavailable/no selection, cancellation, missing selection, apply failure, and no-mutation behavior. |
| AC-13 validation surface clarity | PASS | Evidence below labels `global_cli`, `in_session`, `runtime_tooling`, `install_bundle`, `governance`, and unavailable `target_project_app` separately. |

## Quality Checks
- No QA-blocking behavior defect was observed in the requested validation scope.
- Existing `configure-agent-models` regression coverage passed after shared helper extraction.
- Runtime bootstrap and launcher regression coverage passed after profile-session additions.
- Install bundle and governance checks passed.

## Scan/Tool Evidence
| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available; result `succeeded`; scope `/home/duypham/Projects/open-kit`; bundled quality config | none | 360 WARNING project-wide findings | non-blocking for FEATURE-961 QA; project-wide warnings are existing/noisy quality findings and not tied to the agent-model profile acceptance behavior validated here | No false-positive classification applied in tool output; findings were treated as residual project-wide noise rather than FEATURE-961 blockers | Full output was truncated by tool and persisted at `/home/duypham/.local/share/opencode/tool-output/tool_dd8022ce0001Rh9W17MrPFRvrl`; no manual override of feature behavior evidence | `runtime_tooling`; not `target_project_app` | direct tool output in session; evidence id `feature-961-qa-verification-2026-04-29` |
| `tool.security-scan` | available; result `succeeded`; scope `/home/duypham/Projects/open-kit`; bundled security config | none | 2 ERROR findings, both `no-new-function` | non-blocking for FEATURE-961 QA; findings are in existing codemod tools outside FEATURE-961 profile-management, launcher, session-profile, and command surfaces | Not marked false-positive; classified as unrelated project-wide residual risk outside this feature's implementation scope | Semgrep stderr labels 2 findings as blocking, but direct tool triage had blockingCount 0/unclassifiedCount 1; QA records this discrepancy and does not use it as target-project app validation | `runtime_tooling`; not `target_project_app` | `src/runtime/tools/codemod/codemod-apply.js:67`, `src/runtime/tools/codemod/codemod-preview.js:109`, evidence id `feature-961-qa-verification-2026-04-29` |

- Direct tool status: both direct scan tools were callable and completed successfully.
- Substitute status and limitations: no substitute scan was needed.
- Classification summary: scan findings are project-wide residual/non-feature findings; no FEATURE-961-specific scan blocker identified.
- False-positive rationale: none claimed.
- Manual override caveats: QA did not override implementation behavior based on scans; security scan output contains an upstream/tool classification discrepancy between stderr blocking count and structured triage summary.
- Validation-surface labels and target-project app validation split: scan evidence is OpenKit `runtime_tooling`, not `target_project_app`.
- Artifact refs: this QA report plus evidence id `feature-961-qa-verification-2026-04-29`.

## Supervisor Dialogue Evidence
- Not applicable. FEATURE-961 does not touch OpenClaw/OpenKit supervisor dialogue behavior.
- Target-project app validation: unavailable unless an actual target project defines app-native build, lint, or test commands. OpenKit CLI/runtime/governance/scan checks above are not target-project application validation.

## Test Evidence
| Surface | Command | Result | Evidence |
| --- | --- | --- | --- |
| `global_cli` profile store | `node --test tests/global/agent-model-profiles.test.js` | PASS | 16 tests passed, 0 failed. |
| `global_cli` model selection | `node --test tests/cli/agent-model-selection.test.js` | PASS | 1 test passed, 0 failed. |
| `global_cli` profiles command | `node --test tests/cli/profiles.test.js` | PASS | 12 tests passed, 0 failed. |
| `in_session` profile switch | `node --test tests/runtime/profile-switch.test.js` | PASS | 9 tests passed, 0 failed. |
| `global_cli` regression | `node --test tests/cli/configure-agent-models.test.js` | PASS | 7 tests passed, 0 failed. |
| `runtime_tooling` bootstrap | `node --test tests/runtime/runtime-bootstrap.test.js` | PASS | 8 tests passed, 0 failed. |
| `runtime_tooling` launcher | `node --test tests/runtime/launcher.test.js` | PASS | 28 tests passed, 0 failed. |
| `global_cli` broad CLI regression | `node --test tests/cli/openkit-cli.test.js` | PASS | 31 tests passed, 0 failed. |
| `install_bundle` | `npm run verify:install-bundle` | PASS | Derived install bundle is in sync. |
| `governance` | `npm run verify:governance` | PASS | 21 governance tests, 7 registry metadata tests, and 9 workflow-contract tests passed. |
| `runtime_tooling` quality scan | `tool.rule-scan` | PASS with residual warnings | Direct scan succeeded with 360 WARNING project-wide findings; no FEATURE-961-specific blocker identified. |
| `runtime_tooling` security scan | `tool.security-scan` | PASS with unrelated residual findings | Direct scan succeeded with 2 ERROR findings in codemod tools outside FEATURE-961 scope. |
| `target_project_app` | unavailable | N/A | No target-project application build/lint/test command exists for this OpenKit feature. |

## Residual Risks
- Manual live TTY UX was not exercised outside automated prompt-injection tests; the feasible QA path used Node test suites with fake `OPENCODE_HOME`, fake model discovery, and prompt adapters.
- Direct project-wide security scan still reports two existing `new Function()` findings in codemod tooling outside FEATURE-961 surfaces; this remains a general runtime-tooling risk, not a profile-management acceptance blocker.
- Direct project-wide quality scan reports 360 existing warnings, mostly broad production-console style findings; no targeted FEATURE-961 behavior failure was observed.
- Target-project app validation is unavailable and not applicable for this OpenKit feature.

## Recommended Route
- Recommend `qa_to_done`.

## Issues
- None for FEATURE-961 acceptance behavior.

## Verification Record
- issue_type: none
- severity: none
- rooted_in: none
- evidence: see commands above and evidence id `feature-961-qa-verification-2026-04-29`
- behavior_impact: FEATURE-961 profile management, launch layering, session switch, delete safety, cancellation, empty-list behavior, docs/install bundle sync, and governance validation passed
- route: `qa_to_done`

## Conclusion
- FEATURE-961 QA status is PASS.
