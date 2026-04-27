---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-945
feature_slug: interactive-mcp-setup-wizard
source_plan: docs/solution/2026-04-27-interactive-mcp-setup-wizard.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Interactive MCP Setup Wizard

## Overall Status

- **PASS**

## Verification Scope

- Verified the approved Product Lead scope in `docs/scope/2026-04-27-interactive-mcp-setup-wizard.md` against the Solution Lead plan in `docs/solution/2026-04-27-interactive-mcp-setup-wizard.md`.
- Covered the `global_cli` surface for `openkit configure mcp --interactive`, existing non-interactive MCP configure commands, scope handling, both-scope health output, and non-TTY behavior.
- Covered the secret-safety surface for hidden/injected secret prompt behavior, stdin-safe alternatives, permission inspection/repair, redacted summaries, placeholder-only profiles, and sentinel no-leakage assertions.
- Covered the `runtime_tooling` surface for MCP health/readiness read models and Semgrep quality/security scans.
- Covered the `documentation` and package surfaces for operator docs, governance checks, install-bundle synchronization, and command-reality wording.
- Covered the `compatibility_runtime` surface for workflow-state validation, task-board validation, evidence capture, and readiness inspection.
- `target_project_app` validation remains **unavailable** for this OpenKit feature because no separate target project app-native build/lint/test/smoke command was introduced or required.

## Observed Result

**PASS.** The implementation satisfies the acceptance criteria for the interactive MCP setup wizard. Fresh QA validation passed, the prior Code Review issue `FEATURE-945-CR-001` remains resolved, no new QA issues were found, and QA recommends `qa_to_done`.

## Behavior Impact

- Operators now have a guided TTY-only wizard at `openkit configure mcp --interactive` for bundled MCP setup.
- Non-TTY invocations fail fast with deterministic exit status `1`, no hang, no mutation, and safe non-interactive alternatives such as `set-key <mcp-id> --stdin`.
- Secret values are accepted only through hidden/injected prompt paths or the existing stdin path, stored only in the local OpenKit secret file, and represented elsewhere as placeholders or redacted state.
- Scope behavior distinguishes `openkit`, `global`, and `both`; both-scope health now reports separate OpenKit/global results.
- Disable/unset semantics preserve existing FEATURE-941 behavior: disabling does not remove stored keys; unsetting keys does not silently disable MCPs.
- Existing non-interactive MCP configure commands remain the automation path.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Interactive command `openkit configure mcp --interactive` exists and routes to guided setup. | PASS | CLI/wizard tests cover interactive routing, help, inventory, selection, mutation, finish, and cancel/no-op flows. |
| TTY/non-TTY behavior is safe and deterministic. | PASS | Non-TTY test and temp-home smoke exit `1`, do not hang, do not mutate, and print safe alternatives without `--value` raw-key guidance. |
| Hidden/stdin-safe secret handling. | PASS | Prompt helper requires TTY/raw-mode for hidden entry and fails closed to `set-key --stdin`; existing stdin set-key remains covered by CLI tests. |
| Raw secrets are redacted from output, profiles, docs, workflow evidence, and runtime summaries. | PASS | Sentinel tests assert raw values appear only in `secrets.env`; generated profiles use `${CONTEXT7_API_KEY}` placeholders; stdout/stderr and JSON results remain redacted. |
| `openkit`, `global`, and `both` scope semantics. | PASS | Tests cover default `openkit`, `global`, and `both`; final summaries and smoke evidence show per-scope results. |
| `set-key` writes secret then auto-enables selected scope only after success. | PASS | Service/wizard tests assert `set-key` records the binding, writes local secret once, enables both scopes when requested, and returns redacted per-scope results. |
| Disable and unset-key semantics remain unchanged. | PASS | CLI tests verify disable preserves stored key and unset-key removes key without disabling the MCP. |
| Per-scope both health. | PASS | Rework validation plus QA smoke show `context7 [openkit]: skipped (disabled)` and `context7 [global]: not_configured (missing_key)` separately. |
| Health test and repair paths. | PASS | Service/wizard tests cover disabled/missing-key health outcomes; secret-manager tests cover read-only inspection and scoped POSIX permission repair to `0700`/`0600`. |
| Documentation updated. | PASS | Operator docs, supported surfaces, runbook, kit internals, `AGENTS.md`, and `context/core/project-config.md` describe the wizard, scope caveats, secret safety, non-TTY alternatives, and validation boundaries; governance passed. |
| No custom MCP add/import/edit path and no optional alias. | PASS | Code search found no JS implementation for `mcp setup`, `configure mcp add`, or `configure mcp import`; docs/solution explicitly keep custom MCP add/import/edit and `openkit mcp setup` out of this delivery. |
| No `target_project_app` validation claim. | PASS | Report and evidence label OpenKit checks as `global_cli`, `runtime_tooling`, `documentation`, `package`, or `compatibility_runtime`; `target_project_app` remains unavailable. |

## Quality Checks

| Check | Command / Evidence | Exit | Result |
| --- | --- | --- | --- |
| Targeted CLI/wizard/service/secret/profile/runtime/docs tests | `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-interactive.test.js tests/global/mcp-interactive-wizard.test.js tests/global/mcp-secret-manager.test.js tests/global/mcp-profile-materializer.test.js tests/runtime/capability-tools.test.js tests/runtime/governance-enforcement.test.js` | 0 | PASS; 59 tests passed. |
| Governance, package, Semgrep rule-pack gate | `npm run verify:governance && npm run verify:install-bundle && npm run verify:semgrep-quality` | 0 | PASS; governance tests, install bundle, and 5 Semgrep regression tests passed. |
| QA Semgrep quality/security substitute scans | `semgrep scan --json --metrics=off --config assets/semgrep/packs/quality-default.yml <22 FEATURE-945 files>` and `... security-audit.yml ...` | 0 | PASS; 0 findings, 0 errors. Semgrep requested 22 changed files and scanned 13 JS-compatible targets under JS rules. |
| Manual/temp-home smoke | `node --input-type=module -e <temp-home smoke for enable global, test both --json, non-TTY interactive guard>` | 0 | PASS; both-scope health and non-TTY guard verified in isolated `OPENCODE_HOME`. |
| Workflow state and board validation | `node .opencode/workflow-state.js validate && node .opencode/workflow-state.js validate-work-item-board feature-945 && node .opencode/workflow-state.js check-stage-readiness` | 0 | PASS for validation/board; readiness before report/evidence correctly reported missing QA report and manual/runtime evidence. |

## Tool Evidence

- rule-scan: direct `tool.rule-scan` unavailable in this QA tool namespace; substituted Semgrep quality scan over 22 requested FEATURE-945 changed files / 13 scanned JS targets, 0 findings, 0 errors.
- security-scan: direct `tool.security-scan` unavailable in this QA tool namespace; substituted Semgrep security scan over 22 requested FEATURE-945 changed files / 13 scanned JS targets, 0 findings, 0 errors.
- evidence-capture: 2 records written through `tool.evidence-capture` (`feature-945-qa-runtime-validation-2026-04-27`, `feature-945-qa-manual-smoke-2026-04-27`).
- syntax-outline: attempted on changed source files, but the runtime syntax tool returned `invalid-path`/`missing-file` because its project root resolved to `/Users/duypham/Code/{cwd}`; fallback manual structural evidence used targeted `Read` inspections of `mcp-configurator.js`, `mcp-config-service.js`, `interactive-wizard.js`, `interactive-prompts.js`, `wizard-state-machine.js`, `health-checks.js`, `configure-mcp-interactive.test.js`, and `mcp-interactive-wizard.test.js`.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | unavailable in current QA tool namespace; prior Code Review direct scan remains historical implementation evidence, but QA did not have direct callable access | Fresh Semgrep CLI substitute with `assets/semgrep/packs/quality-default.yml` | 0 findings, 0 errors; 22 requested files, 13 JS targets scanned | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none required | Direct OpenKit scan tool unavailable to QA; substitute Semgrep CLI used and not treated as target-app validation | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `assets/semgrep/packs/quality-default.yml`; evidence id `feature-945-qa-runtime-validation-2026-04-27` |
| `tool.security-scan` | unavailable in current QA tool namespace; prior Code Review direct scan remains historical implementation evidence, but QA did not have direct callable access | Fresh Semgrep CLI substitute with `assets/semgrep/packs/security-audit.yml` | 0 findings, 0 errors; 22 requested files, 13 JS targets scanned | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none required | Direct OpenKit scan tool unavailable to QA; substitute Semgrep CLI used and not treated as target-app validation | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `assets/semgrep/packs/security-audit.yml`; evidence id `feature-945-qa-runtime-validation-2026-04-27` |

- Direct tool status: direct QA namespace did not expose `tool.rule-scan` or `tool.security-scan`; Semgrep substitute scans succeeded cleanly.
- Substitute status and limitations: substitute scans use bundled Semgrep rule packs through the CLI; Markdown/docs are requested for traceability but JS rules scan JS-compatible targets.
- Classification summary: no findings and no unclassified items.
- False-positive rationale: none needed.
- Manual override caveats: none used.
- Validation-surface labels and target-project app validation split: scan execution is `runtime_tooling`; stored workflow evidence is `compatibility_runtime`; neither is `target_project_app` validation.
- Artifact refs: source/test/doc files changed for FEATURE-945, Semgrep rule packs, and workflow evidence IDs listed below.

## Test Evidence

### Automated

- `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-interactive.test.js tests/global/mcp-interactive-wizard.test.js tests/global/mcp-secret-manager.test.js tests/global/mcp-profile-materializer.test.js tests/runtime/capability-tools.test.js tests/runtime/governance-enforcement.test.js` — exit `0`, 59 tests passed.
- `npm run verify:governance && npm run verify:install-bundle && npm run verify:semgrep-quality` — exit `0`.
- Fresh Semgrep substitute scans for quality and security rule packs — exit `0`, 0 findings / 0 errors.
- `node .opencode/workflow-state.js validate && node .opencode/workflow-state.js validate-work-item-board feature-945 && node .opencode/workflow-state.js check-stage-readiness` — exit `0`; validation and board passed, and readiness blockers before this report were expected missing QA artifacts/evidence.

### Manual / Smoke

- In an isolated temporary `OPENCODE_HOME`, QA enabled `context7` only for `global`, then ran both-scope health with JSON output. Result: `openkit` status `skipped` / reason `disabled`; `global` status `not_configured` / reason `missing_key`.
- In the same smoke, `openkit configure mcp --interactive` under non-TTY exited `1`, printed the interactive-terminal guard and `set-key <mcp-id> --scope openkit --stdin` guidance, did not suggest `--value`, did not create a secret file or OpenKit profile, and leaked no synthetic secret-like text.

## Evidence Records

- `feature-945-qa-runtime-validation-2026-04-27` — runtime QA evidence for targeted tests, governance/install/semgrep gates, substitute scans, and workflow validation.
- `feature-945-qa-manual-smoke-2026-04-27` — manual QA evidence for temp-home both-scope health and non-TTY guard smoke.

## Issues

- No new QA issues found.
- Prior issue `FEATURE-945-CR-001` is resolved and remains covered by fresh both-scope health tests and manual smoke evidence.

## Caveats

- `npm run verify:all` was previously attempted during implementation/review and timed out due suite duration; QA relied on the stronger targeted FEATURE-945 test set plus governance, install-bundle, Semgrep quality, direct/substitute scan, workflow validation, and temp-home smoke evidence.
- Direct `tool.rule-scan`, `tool.security-scan`, and `tool.syntax-outline` were not fully available from this QA namespace/session; unavailable tool states are recorded above with substitute evidence.
- `target_project_app` validation is unavailable; no target project app-native validation commands exist for this OpenKit feature.

## Recommended Route

- **Recommend `qa_to_done`.** Route back to `MasterOrchestrator` for closure/approval recording.

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | Automated tests, governance/install/semgrep gates, substitute Semgrep scans, temp-home smoke, workflow validation, and evidence capture all passed. | Interactive MCP setup wizard behavior is verified and no acceptance-impacting defects remain. | `qa_to_done` |

## Conclusion

FEATURE-945 passes final QA. The wizard meets the approved acceptance criteria for interactive setup, secret safety, scope semantics, both-scope health, docs, and validation-surface honesty. QA recommends closure through `qa_to_done`.
