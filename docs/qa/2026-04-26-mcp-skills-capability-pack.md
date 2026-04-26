---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-941
feature_slug: mcp-skills-capability-pack
source_plan: docs/solution/2026-04-26-mcp-skills-capability-pack.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: MCP + Skills Capability Pack

## Overall Status

- PASS

## Verification Scope

QA verified FEATURE-941 against:

- Scope package: `docs/scope/2026-04-26-mcp-skills-capability-pack.md`
- Solution package: `docs/solution/2026-04-26-mcp-skills-capability-pack.md`
- Code re-review context: Code Reviewer re-review PASS; `F941-DOCS-001` resolved
- User-visible surfaces:
  - bundled MCP catalog and bundled skill catalog
  - `openkit configure mcp list|doctor|enable|disable|set-key|unset-key|test`
  - local-only secret store and `set-key` auto-enable behavior
  - `--scope openkit`, `--scope global`, and `--scope both`
  - generated profile placeholder-only behavior
  - `openkit run` secret loading into the managed child process
  - runtime capability inventory/router/health/MCP doctor/skill index/skill-MCP binding tools
  - operator documentation, direct OpenCode caveat, validation-surface boundary, and no raw secret rule

Target-project application validation remains unavailable for this feature because this repository does not define a target application build, lint, test, smoke, or regression command for an external app.

## Observed Result

PASS. Acceptance criteria are satisfied with no new QA issues. The prior documentation gap `F941-DOCS-001` is resolved and remains resolved in QA.

## Behavior Impact

- Operators can discover bundled MCPs and bundled skills without manual config edits.
- Operators can configure MCP enablement, keys, scope materialization, and readiness through `openkit configure mcp ...`.
- Key-required MCPs expose missing/present key state only as redacted state; placeholders are used in generated profiles.
- `set-key` stores raw values only in the local OpenKit secret file under the OpenCode home-derived settings root, enforces POSIX `0700`/`0600` permissions in the tested environment, and auto-enables the selected scope.
- `unset-key` removes the key while preserving explicit enablement, so enabled key-required MCPs return `not_configured` until a key is restored or the MCP is disabled.
- `openkit run` loads the local secret file into the launched OpenCode process environment without printing or serializing secret values into runtime config content.
- Runtime tools expose capability inventory, routing, health, MCP doctor, skill index, and skill/MCP bindings with `runtime_tooling` labels and redacted key state.
- Optional and preview/policy-gated capabilities remain discoverable and do not block normal OpenKit install/doctor/run behavior.

## Acceptance Mapping

| Acceptance Target | Result | QA Evidence |
| --- | --- | --- |
| Bundled MCP catalog discoverable with required ids (`openkit`, `chrome-devtools`, `playwright`, `context7`, `grep_app`, `websearch`, `sequential-thinking`, policy-gated `git`, optional `augment_context_engine`) | PASS | `src/capabilities/mcp-catalog.js`; `tests/runtime/mcp-catalog.test.js`; targeted Node tests passed |
| Bundled skill catalog covers workflow, codebase/research/refactoring, frontend/UI/browser/deployment, React/Next/React Native, MUI, Vercel, and Rust suites | PASS | `src/capabilities/skill-catalog.js`; `tests/runtime/skill-catalog.test.js`; unavailable skill files are labeled honestly |
| Key-required catalog entries show placeholders, missing-key guidance, and `not_configured` without raw keys | PASS | `tests/runtime/mcp-catalog.test.js`; `tests/cli/configure-mcp.test.js`; smoke test confirmed no sentinel value in output/profile/config/state |
| Optional dependency absence does not fail inventory/doctor/run | PASS | `augment_context_engine` is optional and reported unavailable/degraded; `tests/runtime/capability-tools.test.js`; `tests/global/doctor.test.js` |
| Preview/experimental/policy-gated status visible | PASS | `sequential-thinking` preview, `git` policy-gated preview, preview skills; verified in catalog/tool tests and docs |
| `openkit configure mcp list` defaults to OpenKit scope | PASS | `tests/cli/configure-mcp.test.js`; smoke list output showed `Scope: openkit` when no scope supplied |
| `doctor` reports missing keys, disabled state, missing dependencies, optional states, and direct OpenCode caveat safely | PASS | `tests/cli/configure-mcp.test.js`; `tests/global/doctor.test.js`; docs cover global/both direct OpenCode caveat |
| `enable`/`disable` materialize only selected scope and keep disabled MCPs visible | PASS | `tests/cli/configure-mcp.test.js`; `tests/global/mcp-profile-materializer.test.js`; smoke test covered global enable/disable |
| `set-key` stores only in local secret file, enforces permissions, and auto-enables selected scope | PASS | `tests/global/mcp-secret-manager.test.js`; `tests/cli/configure-mcp.test.js`; smoke test verified `0700` settings dir and `0600` `secrets.env` |
| `unset-key` removes the local value without printing it and does not disable the MCP | PASS | `tests/cli/configure-mcp.test.js`; smoke test verified key removal and preserved OpenKit enablement |
| `test` reports pass/fail/degraded/skipped without exposing credentials | PASS | `tests/cli/configure-mcp.test.js`; disabled MCP test path returns disabled/skipped result without raw value |
| Scope behavior for `openkit`, `global`, and `both` is supported | PASS | `tests/global/mcp-profile-materializer.test.js`; smoke JSON output distinguished `openkit` enabled from `global` disabled for the same MCP |
| Generated profiles are placeholder-only | PASS | `tests/global/mcp-profile-materializer.test.js`; smoke test verified profile env value `${CONTEXT7_API_KEY}` and no sentinel outside `secrets.env` |
| `openkit run` loads local secrets into the managed child process and preserves explicit env precedence | PASS | `tests/cli/openkit-cli.test.js` includes mocked `opencode` child assertions and no stdout/stderr/runtime-config leakage |
| Runtime capability inventory/router/health/MCP doctor/skill-index/skill-MCP binding tools are exposed | PASS | `src/runtime/tools/capability/`; `src/mcp-server/tool-schemas.js`; `tests/runtime/capability-tools.test.js`; `tests/mcp-server/mcp-server.test.js` |
| Operator docs explain catalogs, commands, scopes, secret store, permission expectations, direct OpenCode caveat, no raw secret rule, and validation boundaries | PASS | `docs/operator/mcp-configuration.md`; operator index docs; `tests/runtime/governance-enforcement.test.js` |
| Raw secrets are not written to reports/evidence/docs/generated profiles/log-like outputs | PASS | Smoke test used a synthetic sentinel placeholder and verified no sentinel in command output, generated profiles, config, or profile state; this report records no raw secret value |
| Target-project app validation remains separate | PASS | Docs and this QA report label target-project validation as unavailable; OpenKit CLI/runtime/package checks are not represented as target app validation |

## Evidence

### Fresh QA validation commands

| Command / Check | Exit Status | Evidence Summary |
| --- | ---: | --- |
| `node --test tests/cli/configure-mcp.test.js tests/global/mcp-secret-manager.test.js tests/global/mcp-config-store.test.js tests/global/mcp-profile-materializer.test.js tests/cli/openkit-cli.test.js tests/global/doctor.test.js tests/runtime/mcp-catalog.test.js tests/runtime/skill-catalog.test.js tests/runtime/capability-tools.test.js tests/runtime/capability-registry.test.js tests/runtime/runtime-bootstrap.test.js tests/runtime/doctor.test.js tests/runtime/mcp-dispatch.test.js tests/mcp-server/mcp-server.test.js` | 0 | Targeted FEATURE-941 suite: 124 tests passed, 0 failed. |
| Temporary `OPENCODE_HOME` smoke: `openkit configure mcp list --scope both`, `doctor --scope both`, `enable`, `disable`, `set-key --scope both --stdin`, `unset-key`, profile/config/permission/redaction checks | 0 | Verified configure flow, set-key auto-enable, placeholder-only profiles, `0700`/`0600`, preserved enablement after unset, and no sentinel leakage outside `secrets.env`. |
| `npx --no-install semgrep scan --json --config assets/semgrep/packs/quality-default.yml <46 FEATURE-941 files> --output .openkit/artifacts/feature-941-qa-semgrep-quality.json` | 0 | Substitute quality scan completed. 747 findings total; QA triage: 746 non-blocking no-var overmatch noise, 1 false-positive documented test parser catch; 0 blocking/true-positive/follow-up/unclassified QA findings. |
| `npx --no-install semgrep scan --json --config assets/semgrep/packs/security-audit.yml <46 FEATURE-941 files> --output .openkit/artifacts/feature-941-qa-semgrep-security.json` | 0 | Substitute security scan completed: 0 findings. |
| `npm run verify:runtime-foundation && npm run verify:governance && npm run verify:install-bundle && npm run verify:all` | 0 | Package verification completed; `verify:all` final suite reported 447 tests passed, 0 failed. |
| `node .opencode/workflow-state.js validate && node .opencode/workflow-state.js validate-work-item-board feature-941 && node .opencode/workflow-state.js check-stage-readiness` before linking QA report | 1 expected before report link | Workflow state and task board valid; readiness blocked by missing QA report before this artifact was linked. |

### Workflow evidence records

QA recorded evidence through both the in-session evidence tool and the workflow-state CLI because the incoming state explicitly reported missing manual/runtime evidence.

| Evidence ID | Kind | Scope | Summary |
| --- | --- | --- | --- |
| `feature-941-qa-acceptance-manual` | manual | `full_qa` | Manual acceptance mapping across catalogs, configure commands, scopes, secret safety, run loading, runtime tools, docs, and validation boundary. |
| `feature-941-qa-runtime-validation` | runtime | `full_qa` | Fresh runtime/global CLI validation, configure smoke, workflow validation, and target-project validation boundary. |
| `feature-941-qa-automated-validation` | automated | `full_qa` | Targeted Node tests and package verification passed. |
| `feature-941-qa-scan-evidence` | automated | `full_qa` | QA Semgrep quality/security substitute scan results and triage summary. |
| `feature-941-qa-review-context` | review | `full_qa` | Code re-review context consumed; `F941-DOCS-001` resolved. |
| `feature-941-qa-manual-cli` | manual | `full_qa` | CLI-recorded manual acceptance mapping mirror. |
| `feature-941-qa-runtime-cli` | runtime | `full_qa` | CLI-recorded runtime validation mirror. |

## Tool Evidence

- rule-scan: 747 findings on 46 files via substitute Semgrep CLI (`quality-default.yml`); direct `tool.rule-scan` was not available/callable in this QA API session and local direct runtime invocation timed out. QA classification: 0 blocking, 0 true-positive, 746 non-blocking noise, 1 false-positive, 0 follow-up, 0 unclassified.
- security-scan: 0 findings on 46 files via substitute Semgrep CLI (`security-audit.yml`); direct `tool.security-scan` was not available/callable in this QA API session and local direct runtime invocation timed out.
- evidence-capture: 5 in-session records written with `tool.evidence-capture`, plus 2 workflow-state CLI evidence records written for manual/runtime readiness coverage.
- syntax-outline: unavailable for structural verification in this session. `tool.syntax-outline` returned `invalid-path` for absolute changed-file paths and `missing-file` for relative paths despite file existence; fallback structural verification used `tool.look-at`, targeted `Read`, targeted tests, and runtime/catalog smoke checks. Files fallback-inspected included `src/capabilities/mcp-catalog.js`, `src/capabilities/skill-catalog.js`, `src/global/mcp/mcp-configurator.js`, `src/global/mcp/secret-manager.js`, `src/global/mcp/profile-materializer.js`, and `src/runtime/managers/capability-registry-manager.js`.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | unavailable/call timed out in QA API session | `npx --no-install semgrep scan --json --config assets/semgrep/packs/quality-default.yml <46 FEATURE-941 files>` | 747 total; 746 `no-var-declaration`; 1 `no-empty-catch`; warning-level rule findings | 0 blocking, 0 true-positive, 746 non-blocking noise, 1 false-positive, 0 follow-up, 0 unclassified | `no-empty-catch` points at `tests/mcp-server/mcp-server.test.js` JSON-RPC test helper that intentionally ignores non-JSON process noise; inline comment documents why the error is non-actionable and tests pass. | Substitute scan, not direct runtime invocation. `no-var-declaration` overmatches import/const/let/module text in modern ESM and is treated as rule noise, consistent with prior review evidence. | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-941-qa-semgrep-quality.json`; evidence id `feature-941-qa-scan-evidence` |
| `tool.security-scan` | unavailable/call timed out in QA API session | `npx --no-install semgrep scan --json --config assets/semgrep/packs/security-audit.yml <46 FEATURE-941 files>` | 0 findings | 0 blocking, 0 true-positive, 0 non-blocking noise, 0 false-positive, 0 follow-up, 0 unclassified | none | Substitute scan, not direct runtime invocation. | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `.openkit/artifacts/feature-941-qa-semgrep-security.json`; evidence id `feature-941-qa-scan-evidence` |

## Test Evidence

- Targeted FEATURE-941 Node tests passed: 124 passed, 0 failed.
- Package verification passed, including `verify:runtime-foundation`, `verify:governance`, `verify:install-bundle`, and `verify:all`.
- `verify:all` final suite passed: 447 passed, 0 failed.
- Configure smoke passed in a temporary OpenCode home without recording any raw secret value.
- Workflow-state `validate` and `validate-work-item-board feature-941` passed before report linking; final readiness is recorded after linking this QA report.

## Behavior Impact By Surface

| Surface | Result | Notes |
| --- | --- | --- |
| `global_cli` | PASS | `openkit configure mcp ...`, `openkit doctor`, and `openkit run` behavior validated through targeted tests and smoke. |
| `runtime_tooling` | PASS | Capability inventory/router/health/MCP doctor/skill-index/skill-MCP binding tools validated with standard status labels and redacted key state. |
| `documentation` | PASS | Operator docs added and governed by tests; examples use placeholders and state validation boundaries. |
| `compatibility_runtime` | PASS | Workflow state validation and task-board validation passed; evidence records written. |
| `target_project_app` | unavailable | No target application commands are defined for this OpenKit repository feature. |

## Issue List

No new QA issues.

Previously routed issue:

| Issue ID | Status | QA Disposition |
| --- | --- | --- |
| `F941-DOCS-001` | resolved | Operator MCP configuration documentation exists, is indexed from operator docs, and is covered by governance tests. |

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | Fresh QA manual/runtime/automated/review evidence recorded; targeted and package verification passed; scans triaged with no blockers. | User-visible FEATURE-941 behavior is verified across OpenKit CLI/runtime/docs surfaces. | `qa_to_done` |

## Recommended Route

Recommend `qa_to_done`.

No rework route is required because QA found no open implementation bug, design flaw, or requirement gap.

## Caveats

- Direct runtime `tool.rule-scan` and `tool.security-scan` were not callable through the available QA API namespace; substitute Semgrep CLI scans were run and recorded with limitations.
- `tool.syntax-outline` was unavailable/degraded for changed-file structural verification due to invalid/missing path responses despite file existence; fallback inspection and targeted tests were used.
- Quality Semgrep output is noisy because the bundled `no-var-declaration` rule overmatches modern ESM/test text. The scan artifact is retained, and QA triage found no blocking quality issue.
- Target-project app validation is unavailable and was not substituted with OpenKit CLI/runtime checks.

## Conclusion

FEATURE-941 satisfies the approved acceptance criteria for the MCP + skills capability pack. The implementation is closure-ready from QA with a `qa_to_done` recommendation.
