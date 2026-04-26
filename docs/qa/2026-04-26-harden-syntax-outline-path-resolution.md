---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-944
feature_slug: harden-syntax-outline-path-resolution
source_plan: docs/solution/2026-04-26-harden-syntax-outline-path-resolution.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Harden Syntax Outline Path Resolution

## Overall Status

- **PASS**

## Verification Scope

QA verified FEATURE-944 against the approved scope and solution for these surfaces:

- `runtime_tooling`: direct `tool.syntax-outline`, `tool.syntax-context`, `tool.syntax-locate`, shared resolver behavior, runtime/MCP source-root normalization, direct rule/security scans, OpenKit runtime/package verification.
- `compatibility_runtime`: managed workflow-state validation, feature task-board validation, recorded QA evidence, readiness inspection.
- `documentation`: scope/solution/code-review caveats and QA report wording preserve the distinction between runtime tooling, stored workflow evidence, and unavailable target-project application validation.

Changed files considered in QA scans and structural checks:

- `src/mcp-server/args.js`
- `src/mcp-server/index.js`
- `src/runtime/analysis/import-graph-builder.js`
- `src/runtime/create-runtime-interface.js`
- `src/runtime/index.js`
- `src/runtime/managers/syntax-index-manager.js`
- `src/runtime/project-root.js`
- `src/runtime/tools/shared/project-file-utils.js`
- `src/runtime/tools/wrap-tool-execution.js`
- `tests/mcp-server/mcp-server.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/runtime/syntax-path-resolution.test.js`

## Observed Result

- **PASS** — QA found no user-visible runtime behavior defects against the approved acceptance criteria.
- Direct runtime smoke confirms valid supported files resolve through relative, `./`/dot-normalized, and absolute in-root requests using a fresh runtime bootstrap.
- `syntax-context` and `syntax-locate` inherit the shared resolver and continue returning normal node/match behavior for supported files.
- Existing unsupported files are reported as `unsupported-language`, not `invalid-path` or `missing-file`.
- Missing files, directories, outside-root paths, and symlink escapes produce distinct honest statuses/reasons.
- Runtime root normalization handles leaked `{cwd}` and honors valid `OPENKIT_PROJECT_ROOT` precedence.
- Caveat: the already-attached in-session MCP server in this QA session still resolves paths under `/Users/duypham/Code/{cwd}` and returns stale `missing-file`/`invalid-path` responses until that MCP process is restarted. Fresh direct runtime bootstrap and a newly spawned MCP server both pass the FEATURE-944 behavior matrix.
- Target-project application validation remains **unavailable**; no OpenKit runtime/package checks are claimed as `target_project_app` build, lint, test, smoke, or regression evidence.

## Behavior Impact

- Code Reviewer, QA Agent, Fullstack Agent, and Solution Lead can rely on fresh OpenKit syntax tooling to inspect valid project source files by project-relative and absolute in-root paths.
- Runtime tooling failure reports are more diagnostic: unsupported language, missing file, directory/not-file, outside-root, and symlink escape are distinguishable.
- Path safety remains intact: outside-root absolute paths and symlink escapes are rejected rather than read.
- Existing live OpenCode sessions may need MCP restart to pick up the new resolver/root normalization; this is a deployment/session refresh caveat, not a checked-in runtime behavior failure.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Existing supported project-relative source file does not return `invalid-path`/`missing-file` because of path resolution | PASS | `node --test tests/runtime/syntax-path-resolution.test.js` passed; direct smoke returned `ok` for `src/runtime/tools/syntax/syntax-outline.js`. |
| Existing supported absolute in-root file matches relative request | PASS | Direct smoke returned `ok`, same `relativePath`, and same resolved path for absolute and relative requests. |
| Safe `./`, `.`, redundant separators, and safe normalization are accepted inside root | PASS | Direct smoke returned `ok` for `./src/runtime/tools/syntax/./syntax-outline.js  `; tests cover dot-normalized and safe parent segments. |
| Project-local `.opencode/openkit/...` file is not confused with workspace mirror | PASS | `tests/runtime/syntax-path-resolution.test.js` passes `.opencode/openkit/shim.js` as an exact project-local file. |
| Absolute outside-root path is rejected | PASS | Direct smoke returned `invalid-path` with `reason: outside-root`; targeted tests pass. |
| Relative traversal that escapes source root is rejected | PASS | Targeted test covers `../outside.js` with `invalid-path`/`outside-root`. |
| Directory target is not treated as an empty successful outline | PASS | Direct smoke returned `not-file` with `reason: directory`; targeted tests pass. |
| Missing in-root file reports real `missing-file` without alternate-root search | PASS | Direct smoke returned `missing-file` with `reason: missing-file`; targeted tests pass. |
| Symlink escape is rejected after canonical resolution | PASS | Direct smoke on a temp fixture returned `invalid-path` with `reason: symlink-outside-root`; targeted symlink test passes. |
| Existing unsupported file is labeled unsupported/degraded syntax tooling, not path failure | PASS | Direct smoke returned `unsupported-language` for `README.md`; runtime-platform and syntax-path tests pass. |
| Parser/tool failures are not mislabeled as path failures | PASS | `SyntaxIndexManager.readFile` wraps parser init, read, and parse failures as `parser-unavailable`, `read-error`, `parse-error`, or `missing-file` for races; code review PASS and full runtime suite passed. |
| Evidence summaries distinguish requested/resolved path and validation surface | PASS | Direct smoke outputs requested/resolved/relative path and `validationSurface: runtime_tooling`; QA evidence is stored through workflow state separately. |
| Manual fallback reads are not claimed as syntax-outline success | PASS | No manual file read was used as a substitute for successful fresh runtime verification; stale in-session MCP caveat is documented separately. |
| `syntax-context`/`syntax-locate` only inherit shared resolver behavior | PASS | Targeted tests and direct smoke show `status: ok` for context/locate with unchanged node/match behavior. |
| No target-project app-native validation is claimed | PASS | All evidence is labeled `runtime_tooling` or `compatibility_runtime`; `target_project_app` remains unavailable. |
| FEATURE-943 scan-tool work remains out of scope | PASS | QA saw no Semgrep/rule-pack implementation changes in FEATURE-944; scans are validation evidence only. |

## Quality Checks

- Code Review handoff: PASS, no findings. QA accepted the caveat that the already-attached in-session MCP server may require restart before it reflects new resolver/root normalization.
- Structural inspection: required `tool.syntax-outline` was attempted on changed source/test files. The attached in-session MCP is stale and returned `missing-file` for changed files under `/Users/duypham/Code/{cwd}`; QA substituted fresh direct runtime bootstrap and targeted tests, and documented the caveat.
- Runtime/package verification: targeted tests, direct smoke, `npm run verify:runtime-foundation`, `npm run verify:install-bundle`, and `npm run verify:all` all passed.
- Workflow/runtime verification: managed workflow state validates; feature task board validates; all FEATURE-944 tasks are `dev_done`.

## Tool Evidence

- rule-scan: 2 findings on 12 files; direct `tool.rule-scan` available/succeeded. Findings are accepted non-blocking existing empty-catch warnings in `src/runtime/tools/wrap-tool-execution.js`; blocking findings 0.
- security-scan: 0 findings on 12 files; direct `tool.security-scan` available/succeeded.
- evidence-capture: 4 QA CLI evidence records written to managed workflow state plus 1 `tool.evidence-capture` record attempted in-session; managed state contains the 4 CLI records used for readiness/evidence (`feature-944-qa-tests-2026-04-26`, `feature-944-qa-runtime-smoke-2026-04-26`, `feature-944-qa-scan-evidence-2026-04-26`, `feature-944-qa-package-workflow-2026-04-26`).
- syntax-outline: attempted on 12 changed files through attached in-session MCP; stale MCP returned `/Users/duypham/Code/{cwd}`-rooted `missing-file`. Substituted and verified structural/runtime expectations via fresh `bootstrapRuntimeFoundation`, targeted syntax tests, direct smoke matrix, and newly spawned MCP server.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available / succeeded on 12 changed FEATURE-944 files | none | 2 total findings, both WARNING | blocking 0; true_positive 0; non_blocking_noise 2 findings in 1 group; false_positive 0; follow_up 0; unclassified 0 | Not false positives; accepted non-blocking existing best-effort empty-catch warnings in `wrap-tool-execution.js` guard/invocation logging paths. FEATURE-944 did not introduce those catch bodies; it only added `not-file` status classification in the same file. | none | `runtime_tooling`; not `target_project_app` | `.openkit/artifacts/feature-944-qa-rule-security-scan-2026-04-26.json`; evidence `feature-944-qa-scan-evidence-2026-04-26` |
| `tool.security-scan` | available / succeeded on 12 changed FEATURE-944 files | none | 0 total findings | blocking 0; true_positive 0; non_blocking_noise 0; false_positive 0; follow_up 0; unclassified 0 | none | none | `runtime_tooling`; not `target_project_app` | `.openkit/artifacts/feature-944-qa-rule-security-scan-2026-04-26.json`; evidence `feature-944-qa-scan-evidence-2026-04-26` |

- Direct tool status: both scan tools were invoked through fresh OpenKit runtime tooling and returned succeeded results for the full changed-file set.
- Substitute status and limitations: no substitute scan was needed for rule/security scans. For syntax-outline structural inspection, the attached in-session MCP was stale; fresh direct runtime bootstrap and a newly spawned MCP server were used to verify behavior.
- Classification summary: scan blockers 0.
- False-positive rationale: no findings were classified as false positives.
- Manual override caveats: none for scans; session-restart caveat applies only to attached in-session MCP freshness.
- Validation-surface labels: scan and direct syntax behavior are `runtime_tooling`; stored workflow evidence is `compatibility_runtime`; target-project application validation is unavailable.
- Artifact refs: `.openkit/artifacts/feature-944-qa-rule-security-scan-2026-04-26.json`.

## Test Evidence

| Command | Exit | Evidence ID | Notes |
| --- | ---: | --- | --- |
| `node --test "tests/runtime/syntax-path-resolution.test.js"` | 0 | `feature-944-qa-tests-2026-04-26` | 6/6 pass; covers relative, dot-normalized, absolute, compatibility path, unsupported, missing, directory, outside-root, symlink escape, context/locate inheritance, and placeholder bootstrap. |
| `node --test "tests/runtime/runtime-platform.test.js"` | 0 | `feature-944-qa-tests-2026-04-26` | 25/25 pass; includes syntax unsupported/invalid/missing runtime behavior and runtime tool metadata. |
| `node --test "tests/runtime/runtime-bootstrap.test.js"` | 0 | `feature-944-qa-tests-2026-04-26` | 7/7 pass; includes leaked `{cwd}` normalization without managed/global root use. |
| `node --test "tests/mcp-server/mcp-server.test.js"` | 0 | `feature-944-qa-tests-2026-04-26` | 9/9 pass; includes spawned MCP server placeholder-root syntax-outline behavior. |
| `node --input-type=module -e <FEATURE-944 QA direct syntax and MCP smoke matrix>` | 0 | `feature-944-qa-runtime-smoke-2026-04-26` | Fresh runtime matrix passed for relative, dot-normalized, absolute, unsupported, missing, directory, outside-root, symlink escape, context, locate, and spawned MCP placeholder case. |
| `node --input-type=module -e <OPENKIT_PROJECT_ROOT precedence check>` | 0 | covered in report | Confirms valid `OPENKIT_PROJECT_ROOT` is selected over wrong repository/cwd fallback. |
| `node --input-type=module -e <QA rule/security scan changed-file matrix>` | 0 | `feature-944-qa-scan-evidence-2026-04-26` | Direct scan tools succeeded; no blocking scan findings. |
| `npm run verify:runtime-foundation` | 0 | `feature-944-qa-package-workflow-2026-04-26` | Runtime foundation regression passed. |
| `npm run verify:install-bundle` | 0 | `feature-944-qa-package-workflow-2026-04-26` | Derived install bundle in sync. |
| `npm run verify:all` | 0 | `feature-944-qa-package-workflow-2026-04-26` | Full OpenKit verification passed; 456 tests, 1 suite, 456 pass, 0 fail in final node test summary. |
| `node .opencode/workflow-state.js validate` with managed `OPENKIT_WORKFLOW_STATE` | 0 | `feature-944-qa-package-workflow-2026-04-26` | Managed workflow state valid. |
| `node .opencode/workflow-state.js validate-work-item-board feature-944` with managed `OPENKIT_WORKFLOW_STATE` | 0 | `feature-944-qa-package-workflow-2026-04-26` | Feature task board valid. |
| `node .opencode/workflow-state.js check-stage-readiness` before QA report link | 0 | `feature-944-qa-package-workflow-2026-04-26` | Pre-report blockers were `qa_report` artifact and runtime evidence only; QA has now recorded runtime evidence and created this report. |
| `node .opencode/workflow-state.js list-tasks feature-944` with managed `OPENKIT_WORKFLOW_STATE` | 0 | `feature-944-qa-package-workflow-2026-04-26` | All tasks `dev_done`. |

## Evidence Records

- `feature-944-qa-tests-2026-04-26` — targeted syntax/runtime/MCP tests passed (`runtime_tooling`).
- `feature-944-qa-runtime-smoke-2026-04-26` — direct runtime syntax smoke and spawned MCP placeholder smoke passed (`runtime_tooling`), with live in-session MCP restart caveat recorded.
- `feature-944-qa-scan-evidence-2026-04-26` — direct rule/security scans passed with no blockers (`runtime_tooling`).
- `feature-944-qa-package-workflow-2026-04-26` — package/runtime/workflow validation passed (`runtime_tooling` and `compatibility_runtime`).

## Issues

- None.

## Caveats / Residual Risk

- Existing attached MCP process in this session is stale and still returns `/Users/duypham/Code/{cwd}`-rooted `missing-file`/`invalid-path` responses. A fresh MCP process passes the placeholder normalization smoke, so operators should restart the OpenCode/OpenKit MCP session to see the new behavior live.
- The two rule-scan warnings are accepted non-blocking existing empty-catch warnings in best-effort guard/invocation logging paths, not FEATURE-944 behavior failures.
- No target-project application build/lint/test command exists for this repository; `target_project_app` validation is unavailable.

## Recommended Route

- **Recommend `qa_to_done`.**

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | `feature-944-qa-tests-2026-04-26`; `feature-944-qa-runtime-smoke-2026-04-26`; `feature-944-qa-scan-evidence-2026-04-26`; `feature-944-qa-package-workflow-2026-04-26` | Acceptance criteria passed; no behavior failure found. | `qa_to_done` |

## Conclusion

FEATURE-944 is closure-ready from QA. The implementation satisfies the approved acceptance criteria with fresh runtime/tooling and workflow-state evidence. The only caveat is session freshness: restart the already-attached MCP server/OpenCode session before relying on live in-session `openkit_tool.syntax-outline` results.
