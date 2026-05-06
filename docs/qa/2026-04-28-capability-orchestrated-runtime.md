---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-953
feature_slug: capability-orchestrated-runtime
source_scope: docs/scope/2026-04-28-capability-orchestrated-runtime.md
source_plan: docs/solution/2026-04-28-capability-orchestrated-runtime.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Capability-Orchestrated Runtime

## Overall Status

- PASS
- FEATURE-953 satisfies the approved scope and solution for a governed capability-orchestrated runtime. Focused runtime, MCP, package, governance, workflow-state, whitespace, and scan validation passed on the relevant OpenKit surfaces. Code Review is recorded as PASS in workflow-state evidence and the `code_review_to_qa` approval is approved.
- No target-project application build, lint, test, smoke, or regression command exists for this OpenKit runtime feature. `target_project_app` validation is explicitly unavailable and was not substituted with OpenKit runtime, package, scan, workflow-state, MCP, or governance checks.

## Verification Scope

- Scope package: `docs/scope/2026-04-28-capability-orchestrated-runtime.md`
- Solution package: `docs/solution/2026-04-28-capability-orchestrated-runtime.md`
- QA target: `docs/qa/2026-04-28-capability-orchestrated-runtime.md`
- Runtime implementation surfaces: `src/capabilities/`, `src/runtime/capability-registry.js`, `src/runtime/managers/capability-registry-manager.js`, `src/runtime/tools/capability/`, `src/runtime/tools/tool-registry.js`, `src/runtime/tools/workflow/runtime-summary.js`, `src/runtime/create-runtime-interface.js`, `src/mcp-server/tool-schemas.js`
- Documentation surfaces: `docs/governance/skill-metadata.md`, `docs/operator/mcp-configuration.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- Test surfaces: `tests/runtime/capability-tools.test.js`, `tests/runtime/capability-registry.test.js`, `tests/runtime/skill-catalog.test.js`, `tests/runtime/mcp-catalog.test.js`, `tests/mcp-server/mcp-server.test.js`, `tests/runtime/runtime-platform.test.js`

## Observed Result

- PASS: capability graph/registry behavior is covered by targeted runtime tests.
- PASS: ranking, selection, metadata-only handling, safer-local preference, policy gating, ledger, readiness dashboard, runtime summary, and runtime interface behavior are covered by targeted capability tools tests.
- PASS: skill and MCP catalogs preserve metadata/status/redaction boundaries.
- PASS: MCP server exposes and executes capability readiness/ledger tools with bounded redacted output.
- PASS: runtime platform checks preserve workflow-backed tools and role/stage runtime behavior.
- PASS: package and governance gates pass.
- PASS: workflow-state validates and shows active FEATURE-953 in `full_qa`, Code Review PASS, scan evidence, and missing QA report prior to this artifact.
- PASS: focused rule/security scans on corrected absolute repository paths passed with zero findings.

## Behavior Impact

- Capability registration is metadata-first and not hidden activation.
- Capability routing is bounded, explainable, role/stage-aware, and safer-local by default.
- Metadata-only skills remain discoverable but non-loadable.
- Mutating, external, browser, git, and policy-gated paths expose gate/caveat states before use.
- Decision ledger/readiness summaries are bounded, redacted, and validation-surface labeled.
- Workflow authority is preserved; capability orchestration does not approve gates, replace Code Review/QA, or mutate done state.

## Spec Compliance

| Acceptance Criteria | Result | Evidence |
| --- | --- | --- |
| AC1 capabilities register by default as metadata | PASS | `node --test tests/runtime/capability-registry.test.js`; graph normalization tests; workflow-state capability guidance. |
| AC2 registration distinguishes capability families | PASS | `capability-registry`, `skill-catalog`, `mcp-catalog`, and `capability-tools` tests cover runtime, MCP, skill, metadata-only, custom/bundled, browser/external, policy, and target validation distinctions. |
| AC3 ranking produces explainable recommendations | PASS | `capability-tools` tests cover graph-backed rank mode, bounded selected/downgraded/blocked/unavailable groups, reasons, caveats, and no silent fallback. |
| AC4 ranking respects role and stage boundaries | PASS | `capability-tools` and `runtime-platform` tests cover role/stage guardrails; workflow-state show reports `full / full_qa / QAAgent` guidance without authority bypass. |
| AC5 ranking prefers safer local available capabilities | PASS | `capability-tools` safer-local and policy guardrail tests passed. |
| AC6 metadata-only skills discoverable but not loadable | PASS | `capability-registry`, `skill-catalog`, and `capability-tools` metadata-only/non-loadable tests passed. |
| AC7 selective skill loading avoids prompt bloat | PASS | Runtime summary and capability guidance tests verify compact bounded guidance and no full catalog dumps. |
| AC8 skill loading is visible and attributable | PASS | Capability router/ledger tests verify selection decisions, persisted ledger entries, reasons, and caveats. |
| AC9 safe local tool use reports real surfaces | PASS | Runtime tool tests and workflow-state output label `runtime_tooling`, `compatibility_runtime`, `package`, and unavailable `target_project_app` separately. |
| AC10 mutating capabilities are policy-gated | PASS | Activation policy tests cover local mutating and git gate outcomes before execution. |
| AC11 dangerous command safety is preserved | PASS | Activation policy and governance tests passed; workflow-state/solution evidence preserves git safety and dangerous-command caveats. |
| AC12 external MCP use is conditional | PASS | MCP catalog and capability-tools tests cover missing key, placeholder key, disabled MCP, and not-configured external MCP caveats. |
| AC13 browser MCP use is conditional and non-authoritative | PASS | Capability-tools activation policy tests cover browser allowance/relevance requirements; QA does not treat browser evidence as completion proof. |
| AC14 policy blocks and skips produce next actions | PASS | Capability router tests cover blocked/unavailable/not-configured next-action guidance and no hidden fallback. |
| AC15 evidence/caveat ledger records capability decisions | PASS | Capability ledger tests verify persisted decision entries and runtime MCP server readiness/ledger tool execution. |
| AC16 ledger and outputs redact sensitive data | PASS | Capability ledger sanitization tests, MCP catalog key placeholder tests, MCP server redacted output tests, and package secret scan passed. |
| AC17 readiness dashboard summarizes capability health | PASS | Capability readiness read model and runtime summary tests passed. |
| AC18 dashboard distinguishes fresh, cached, and stale state | PASS | Capability readiness read model tests passed; workflow-state show reports last-known freshness and refresh routes. |
| AC19 detailed inventory requires explicit follow-up | PASS | Runtime summary/capability guidance tests verify compact defaults and explicit follow-up tools. |
| AC20 target-project validation remains separate | PASS | Tests and workflow-state output label OpenKit checks by real surface; no OpenKit check is reported as `target_project_app`. |
| AC21 missing app-native validation is reported unavailable | PASS | `tool.typecheck`, `tool.lint`, and `tool.test-run` returned unavailable; package readiness and workflow-state show explicitly state `target_project_app` unavailable. |
| AC22 degraded or missing capability metadata fails safely | PASS | Capability-tools tests cover unknown workflow state, no metadata-backed match, disabled/not-configured MCPs, and unavailable paths. |
| AC23 workflow contract is preserved | PASS | `npm run verify:governance`, `runtime-platform`, and workflow-state show preserve full-delivery stage/owner/gate model; Code Review and QA remain explicit gates. |
| AC24 operator documentation explains governed autonomy | PASS | `npm run verify:governance` passed; updated governance/operator/internals docs describe metadata registration, ranking, selective loading, policy gates, ledger, readiness, redaction, stale state, and validation-surface separation. |

## Quality Checks

| Command / Tool | Validation Surface | Exit / Status | Evidence Summary |
| --- | --- | --- | --- |
| `node --test tests/runtime/capability-tools.test.js` | `runtime_tooling` | 0 | 23/23 tests passed; covers inventory, router, health, MCP doctor, guidance, rank mode, ledger, readiness, policy gates, metadata-only, safer-local, runtime summary, target app unavailable. |
| `node --test tests/runtime/capability-registry.test.js` | `runtime_tooling` | 0 | 8/8 tests passed; covers default capability registry, standardized states/surfaces, graph normalization, metadata-only non-loadability. |
| `node --test tests/runtime/skill-catalog.test.js` | `runtime_tooling` | 0 | 6/6 tests passed; covers v2 governed metadata, maturity separate from runtime state, redacted MCP references, stable stub rejection. |
| `node --test tests/runtime/mcp-catalog.test.js` | `runtime_tooling` | 0 | 3/3 tests passed; covers default MCP entries, key placeholders, optional/preview/policy-gated labels. |
| `node --test tests/mcp-server/mcp-server.test.js` | `runtime_tooling` | 0 | 12/12 tests passed; capability readiness and ledger tools execute with bounded redacted output; Semgrep unavailable paths return structured responses when applicable. |
| `node --test tests/runtime/runtime-platform.test.js` | `runtime_tooling` | 0 | 25/25 tests passed; runtime platform and workflow-backed tools pass. Node emitted a non-fatal `MODULE_TYPELESS_PACKAGE_JSON` warning from global kit path. |
| `npm run verify:install-bundle` | `package` | 0 | Derived install bundle is in sync. |
| `npm run verify:governance` | `documentation` / `runtime_tooling` / `compatibility_runtime` | 0 | Governance, registry metadata, and workflow contract consistency tests passed: 21/21, 7/7, and 9/9. |
| `npm run verify:mcp-secret-package-readiness` | `package` | 0 | Package readiness passed; 470 package files checked, 38 required files missing 0, 2 required prefixes missing 0, forbidden patterns present 0, 466 secret text files findings 0, dry-run only, `target_project_app` unavailable. |
| `git diff --check` | repository hygiene | 0 | No whitespace errors reported. |
| `node .opencode/workflow-state.js validate` | `compatibility_runtime` | 0 | Managed workflow state is valid. |
| `node .opencode/workflow-state.js show` | `compatibility_runtime` | 0 | Active work item `feature-953` is in `full_qa`; Code Review PASS recorded; QA report was missing before this artifact; target app validation unavailable; capability guidance advisory only. |
| `tool.typecheck` | `target_project_app` | unavailable | No `tsconfig.json` found; target-project app typecheck validation unavailable. |
| `tool.lint` | `target_project_app` | unavailable | No linter configuration found; target-project app lint validation unavailable. |
| `tool.test-run` | `target_project_app` | unavailable | No test framework detected; target-project app test validation unavailable. |

## Scan/Tool Evidence

Initial QA direct scan attempts with project-relative paths resolved against `/Users/duypham/Code` instead of `/Users/duypham/Code/open-kit`, producing Semgrep exit code 2 before scanning the intended targets. Those failed relative-path attempts are not used as acceptance evidence.

Corrected absolute-path scan evidence:

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` on `/Users/duypham/Code/open-kit/src/capabilities` | available / succeeded / exit 0 | none | 0 findings, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; not `target_project_app` | `src/capabilities/` |
| `tool.rule-scan` on `/Users/duypham/Code/open-kit/src/runtime/tools/capability` | available / succeeded / exit 0 | none | 0 findings, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; not `target_project_app` | `src/runtime/tools/capability/` |
| `tool.security-scan` on `/Users/duypham/Code/open-kit/src/capabilities` | available / succeeded / exit 0 | none | 0 findings, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; not `target_project_app` | `src/capabilities/` |
| `tool.security-scan` on `/Users/duypham/Code/open-kit/src/runtime/tools/capability` | available / succeeded / exit 0 | none | 0 findings, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | none | `runtime_tooling`; not `target_project_app` | `src/runtime/tools/capability/` |

Workflow-state scan evidence also records `feature-953-code-review-pass`, `feature-953-structured-rule-scan`, and `feature-953-structured-security-scan` as successful targeted Code Review evidence with zero FEATURE-953 findings. Workflow-state notes two whole-project codemod `new Function` security findings in `src/runtime/tools/codemod/` as out-of-scope existing debt and policy-gating context, not FEATURE-953 blockers.

## Supervisor Dialogue Evidence

- PASS: workflow-state `code_review_to_qa` approval is approved by `QAAgent` with notes: "Code Review PASS; targeted rule/security scans on FEATURE-953 changed hotspots have zero findings; existing codemod new Function findings are out-of-scope debt and policy-gating context."
- PASS: verification evidence id `feature-953-code-review-pass` records Code Reviewer PASS for scope compliance and code quality with targeted rule/security scans on FEATURE-953 changed hotspots reporting zero findings.
- Supervisor dialogue-specific behavior is not in FEATURE-953 scope; no supervisor dialogue evidence was required or used as delivery proof.

## Test Evidence

- `target_project_app`: unavailable.
- `tool.typecheck`: unavailable because no `tsconfig.json` exists in the project root.
- `tool.lint`: unavailable because no supported linter configuration exists in the project root.
- `tool.test-run`: unavailable because no supported test framework was detected in the project root.
- OpenKit runtime tests, package checks, governance checks, workflow-state checks, MCP checks, and scan tools are not target-project app build/lint/test evidence.

## Recommended Route

- PASS to `qa_to_done`.
- Ready for done decision: yes, subject to the user or workflow owner approving the final `qa_to_done` gate.

## Issues

- Non-blocking: `tests/runtime/runtime-platform.test.js` emitted a Node `MODULE_TYPELESS_PACKAGE_JSON` warning from `/Users/duypham/.config/opencode/kits/openkit/src/global/worktree-manager.js`; tests passed and this does not affect FEATURE-953 acceptance.
- Non-blocking: whole-project security scan context in workflow-state mentions two existing codemod `new Function` findings outside FEATURE-953 changed files. FEATURE-953 improves policy-gating context for codemod-style mutating capability surfaces; no FEATURE-953 blocker remains.
- Non-blocking: `node .opencode/workflow-state.js show` reports `adr: recommended-now`; no ADR was required by the supplied QA request, and this QA pass is limited to verification/artifact creation.
- Non-blocking: broad `npm run verify:all` was not run. The requested focused validation matrix passed, and `verify:all` would add broad Semgrep/full-suite coverage beyond the requested focused QA scope.
- None.

## Conclusion

FEATURE-953 is QA PASS. The implementation satisfies AC1-AC24 with focused passing validation, Code Review PASS evidence, clean targeted scan evidence, explicit validation-surface labeling, and no `target_project_app` overclaim.
