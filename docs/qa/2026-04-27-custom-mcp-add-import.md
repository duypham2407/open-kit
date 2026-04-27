---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-948
feature_slug: custom-mcp-add-import
source_plan: docs/solution/2026-04-27-custom-mcp-add-import.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Custom MCP Add And Import

## Overall Status

- **PASS**

## Verification Scope

- Verified the approved scope in `docs/scope/2026-04-27-custom-mcp-add-import.md` against the Solution Lead package in `docs/solution/2026-04-27-custom-mcp-add-import.md`.
- Re-tested the QA rework for issue `QA-FEATURE-948-CUSTOM-DOCTOR-NO-ID` after Fullstack fix and Code Review PASS.
- Covered the `global_cli` surface for `openkit configure mcp custom list`, `add-local`, `add-remote`, `import-global`, `disable`, `remove`, `doctor`, and `test`.
- Covered the custom MCP store and profile materialization boundaries: custom entries in `<OPENCODE_HOME>/openkit/custom-mcp-config.json`, profile materialization into OpenKit/global profile surfaces, bundled catalog preservation, and unmanaged global conflict preservation.
- Covered local command validation, remote URL/header validation, token-like query-value rejection, placeholder-only materialization, import-global redaction, secret-store boundaries, and sentinel no-leakage.
- Covered runtime inventory/read-model and wizard visibility/test behavior through automated runtime/wizard tests and structural source review.
- Covered documentation/governance surfaces and validation-surface honesty, including explicit `target_project_app` unavailability.
- Covered `compatibility_runtime` through workflow-state validation, task-board validation, policy status, evidence capture, and resolved issue state.

## Observed Result

**PASS.** The no-id custom doctor defect is resolved, prior remote query secret blocker remains resolved, fresh QA re-test evidence passed, direct scans passed, workflow state is valid, unresolved issue count is 0, and QA recommends/approves `qa_to_done`.

Key fixed behavior verified in an isolated temporary `OPENCODE_HOME`:

```text
openkit configure mcp custom doctor --scope both --json
exit: 0
result: returns all custom MCP rows for openkit/global scopes
```

Text output also labels per-scope rows, for example:

```text
qa-remote [openkit] | kind=custom/remote | ...
qa-remote [global]  | kind=custom/remote | ...
Direct OpenCode launches do not load OpenKit secrets.env; export needed env vars or use openkit run.
```

Id-specific doctor remains scoped correctly:

```text
openkit configure mcp custom doctor qa-remote --scope both --json
exit: 0
result: exactly qa-remote/openkit and qa-remote/global rows
```

## Behavior Impact

- Operators can add local and remote custom MCPs, import a global entry, list custom entries, doctor all custom entries, doctor one custom entry, disable/test/remove custom entries, and preserve placeholder-only profile materialization.
- `custom doctor --scope both --json` now works without an id and returns custom MCP inventory rows for both `openkit` and `global` scopes.
- Text doctor output now makes per-scope rows visible and includes the Direct OpenCode caveat when `global`/`both` scope is requested.
- No raw sentinel secret leakage was observed. Raw local secret appeared only in `openkit/secrets.env`; raw imported source secret remained only in the source global fixture; rejected query secret was not persisted.
- Existing bundled catalog behavior and unmanaged global source entry preservation remained intact in the verified paths.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| Custom `add-local` exists and stores local command definitions safely. | PASS | Automated tests and temp-home smoke verified argv command storage, placeholder env binding, OpenKit profile materialization, risk warning, and redacted `set-key`. |
| Custom `add-remote` exists and validates safe remote definitions. | PASS | Automated tests and smoke verified safe HTTPS remote with placeholder header; localhost HTTP warning covered by tests. |
| Custom `import-global` imports selected global entries without source mutation. | PASS | Temp-home smoke verified source global config preserved raw source value only in source fixture and imported custom entry used `${QA_IMPORT_TOKEN}` placeholder. |
| Custom `list` supports empty and populated custom inventory. | PASS | Empty list did not create custom config; later list showed custom/origin-labeled rows across `openkit` and `global`. |
| Custom `disable` and `remove` are idempotent and scoped. | PASS | Temp-home smoke verified disable, skipped disabled test, `remove --scope all`, and repeated remove behavior. |
| Custom `doctor` supports optional id and both scope. | PASS | Re-test verified `custom doctor --scope both --json` returns all custom rows for openkit/global; text output labels scope rows and includes the Direct OpenCode caveat. |
| Id-specific custom `doctor` remains correct. | PASS | Re-test verified `custom doctor qa-remote --scope both --json/text` returns only `qa-remote` rows for `openkit` and `global`. |
| Custom `test` reports sanitized disabled/not-configured/provider-unverified states. | PASS | Automated tests and smoke verified specific custom test behavior; disabled local custom test reported disabled/skipped. |
| Custom store remains separate from bundled catalog/config. | PASS | Custom config schema `openkit/custom-mcp-config@1`; no bundled `context7` entry appeared in custom store; tests verify catalog separation. |
| No raw secret import/copy into config, profiles, docs, logs, workflow evidence, or command output. | PASS | Automated sentinel tests and smoke leak walk passed; raw imported source secret stayed only in source global config and local secret only in `openkit/secrets.env`. |
| Local command validation blocks unsafe shell forms and raw secret values. | PASS | Automated tests cover shell operators/shell launchers/raw secret args/env; smoke local add used argv array. |
| Remote URL/header validation rejects unsafe schemes, credentials, metadata hosts, raw headers, and query value secrets. | PASS | Rework tests and smoke verified token-like query value rejection without mutation or leakage. |
| Scope/materialization preserves placeholders, per-scope states, and unmanaged global conflicts. | PASS | Automated profile tests and smoke verified OpenKit/global rows, placeholder-only profile content, and source global preservation. |
| Health/runtime inventory distinguishes bundled vs custom with origin/ownership/status. | PASS | Runtime capability tests and structural outlines verify custom metadata in capability inventory and MCP doctor read models. |
| Interactive wizard visibility/test only, no full custom creation wizard. | PASS | Automated wizard tests verify custom entries are listed separately, custom tests route through the service, and creation is routed to non-interactive commands. |
| Docs/help/governance describe custom lifecycle and boundaries. | PASS | Governance tests and docs checks passed in focused suite; existing full `verify:all` evidence remains available from prior QA. |
| No `target_project_app` validation claim. | PASS | Scope/solution/docs/report label OpenKit checks as `global_cli`, `runtime_tooling`, `documentation`, or `compatibility_runtime`; target app validation remains unavailable. |

## Quality Checks

| Check | Command / Evidence | Exit | Result |
| --- | --- | --- | --- |
| Focused no-id doctor manual smoke | `node --input-type=module <isolated OPENCODE_HOME custom doctor smoke>` | 0 | PASS; no-id JSON doctor returns all custom rows for `openkit`/`global`, text output labels per-scope rows and includes Direct OpenCode caveat, id-specific doctor remains scoped, no sentinel leakage. |
| Focused custom MCP rework regression suite | `node --test tests/cli/configure-mcp-custom.test.js tests/global/custom-mcp-store.test.js tests/global/custom-mcp-validation.test.js tests/global/mcp-profile-materializer.test.js tests/global/mcp-secret-manager.test.js tests/global/mcp-interactive-wizard.test.js tests/cli/configure-mcp-interactive.test.js tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/runtime/governance-enforcement.test.js && node .opencode/workflow-state.js validate && node .opencode/workflow-state.js validate-work-item-board feature-948 && node .opencode/workflow-state.js show-policy-status` | 0 | PASS; 90 tests passed, workflow state valid, task board valid, policy status passed. |
| Direct rule/security scans for final rework surfaces | Runtime `tool.rule-scan` and `tool.security-scan` via `bootstrapRuntimeFoundation(...).tools.tools[...]` on `src/global/mcp/mcp-configurator.js`, `tests/cli/configure-mcp-custom.test.js`, and this QA report | 0 | PASS; both direct tools available/succeeded with 0 findings and 0 blocking groups. |
| Structural syntax outline | Runtime `tool.syntax-outline` via `bootstrapRuntimeFoundation` over 5 relevant JS implementation/runtime/test files | 0 | PASS; all 5 outlined successfully. |
| Prior broader validation retained | Full prior QA and implementation evidence in workflow state | 0 | PASS; earlier full/targeted suites, direct scans, and package gates remain recorded. |

## Tool Evidence

- rule-scan: 0 findings on 3 final rework/QA files; direct runtime tool available/succeeded. Prior changed-file scans also recorded 0 findings.
- security-scan: 0 findings on 3 final rework/QA files; direct runtime tool available/succeeded. Prior changed-file scans also recorded 0 findings.
- evidence-capture: 4 new re-test records written through `tool.evidence-capture` (`qa-feature-948-retest-doctor-no-id-smoke-2026-04-27`, `qa-feature-948-retest-focused-suite-2026-04-27`, `qa-feature-948-retest-direct-scans-2026-04-27`, `qa-feature-948-retest-syntax-outline-2026-04-27`). Earlier QA records remain in workflow history.
- syntax-outline: 5 relevant JS implementation/runtime/test files outlined via runtime tool.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | available/succeeded, 3 final rework/QA files | none | 0 total, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | A broader 35-file re-scan attempt timed out at 120s; final gate used focused rework direct scans plus prior full changed-file scan evidence. | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `qa-feature-948-retest-direct-scans-2026-04-27`; `src/global/mcp/mcp-configurator.js`; `tests/cli/configure-mcp-custom.test.js`; `docs/qa/2026-04-27-custom-mcp-add-import.md` |
| `tool.security-scan` | available/succeeded, 3 final rework/QA files | none | 0 total, 0 blocking | blocking 0, true_positive 0, non_blocking_noise 0, false_positive 0, follow_up 0, unclassified 0 | none | A broader 35-file re-scan attempt timed out at 120s; final gate used focused rework direct scans plus prior full changed-file scan evidence. | `runtime_tooling`; stored evidence is `compatibility_runtime`; not `target_project_app` | `qa-feature-948-retest-direct-scans-2026-04-27`; `src/global/mcp/mcp-configurator.js`; `tests/cli/configure-mcp-custom.test.js`; `docs/qa/2026-04-27-custom-mcp-add-import.md` |

- Direct tool status: direct runtime scans were callable from a repo-root `bootstrapRuntimeFoundation` context and succeeded.
- Substitute status and limitations: no scan substitute or manual override used.
- Classification summary: no findings and no unclassified groups.
- False-positive rationale: none needed.
- Manual override caveats: none used.
- Validation-surface labels and target-project app validation split: scans are `runtime_tooling`; evidence storage/workflow-state reads are `compatibility_runtime`; no target app validation exists or is claimed.

## Test Evidence

### Automated

- Focused regression command — exit `0`; 90 tests passed, including:
  - `custom doctor without id reports all custom MCPs for both scope as JSON`;
  - `custom doctor without id reports both-scope custom MCPs as text`;
  - no raw secret leakage paths;
  - runtime capability inventory and MCP doctor include custom MCP ownership metadata;
  - governance/runtime surface boundary checks.
- `node .opencode/workflow-state.js validate` — exit `0`.
- `node .opencode/workflow-state.js validate-work-item-board feature-948` — exit `0`.
- `node .opencode/workflow-state.js show-policy-status` — exit `0`; tool evidence gate and runtime policy passed.
- Direct `tool.rule-scan` and `tool.security-scan` focused sweep — exit `0`, 0 findings each.
- Runtime syntax outline focused sweep — exit `0`, 5 files outlined.

### Manual / Smoke

- Temporary isolated `OPENCODE_HOME`: `/var/folders/yb/q95996d56fz63xb3hypl4p580000gn/T/openkit-f948-qa-retest-EnHtAa`.
- Commands exercised: custom empty list, add-local, set-key custom binding, add-remote, rejected query-secret remote, import-global, no-id JSON doctor, no-id text doctor, id-specific JSON doctor, id-specific text doctor, custom test, disable, disabled test, remove all, repeated remove.
- Passing smoke assertions:
  - `custom doctor --scope both --json` returned all custom rows for `qa-imported`, `qa-local`, and `qa-remote` across both scopes;
  - text doctor output included rows such as `qa-remote [openkit]` and `qa-remote [global]`;
  - text doctor output included `Direct OpenCode launches do not load OpenKit secrets.env; export needed env vars or use openkit run.`;
  - id-specific doctor returned only `qa-remote:openkit` and `qa-remote:global`;
  - query-secret remote did not persist;
  - imported raw env secret converted to `${QA_IMPORT_TOKEN}`;
  - raw local secret appeared only in `openkit/secrets.env`;
  - file walk found 0 unexpected sentinel leaks.

## Evidence Records

New QA re-test records:

- `qa-feature-948-retest-doctor-no-id-smoke-2026-04-27` — manual smoke for no-id doctor JSON/text, id-specific doctor, and no-leakage.
- `qa-feature-948-retest-focused-suite-2026-04-27` — automated focused regression suite plus workflow validation/policy status.
- `qa-feature-948-retest-direct-scans-2026-04-27` — direct rule/security scans on final rework/QA surfaces.
- `qa-feature-948-retest-syntax-outline-2026-04-27` — runtime structural syntax outline.

Earlier retained QA records:

- `qa-feature-948-automated-suite-2026-04-27`
- `qa-feature-948-direct-scans-2026-04-27`
- `qa-feature-948-manual-temp-home-smoke-2026-04-27`
- `qa-feature-948-syntax-outline-2026-04-27`
- `qa-feature-948-automated-suite-cli-2026-04-27`
- `qa-feature-948-direct-scans-cli-2026-04-27`
- `qa-feature-948-manual-temp-home-smoke-cli-2026-04-27`
- `qa-feature-948-syntax-outline-cli-2026-04-27`

## Issues

- No open QA issues remain.
- `QA-FEATURE-948-CUSTOM-DOCTOR-NO-ID` is resolved and re-tested by QA.
- Historical issue `CR-FEATURE-948-REMOTE-QUERY-SECRET` remains resolved; QA rechecked token-like query value rejection and no persistence/leakage.

## Caveats

- The managed runtime task board exists under the OpenKit workspace store with seven `dev_done` tasks and no task-level QA owners/artifact refs. Because the approved solution set `parallel_mode: none`, QA used feature-level validation evidence.
- The repository has OpenKit runtime/CLI test tooling, but no target-project application build/lint/test command. No `target_project_app` validation is claimed.
- A broader final direct scan sweep over 35 files timed out at 120 seconds; direct focused scans on final rework/QA surfaces passed and earlier broader changed-file direct scan evidence remains recorded.

## Recommended Route

- **Approve / recommend `qa_to_done`.** Route back to `MasterOrchestrator` for final closure (`full_done`).

## Verification Record(s)

| issue_type | severity | rooted_in | evidence | behavior_impact | route |
| --- | --- | --- | --- | --- | --- |
| none | none | none | No-id doctor JSON/text smoke passed, 90 focused tests passed, direct scans passed, syntax outline passed, workflow validate/task board/policy status passed, issue telemetry shows 0 open issues. | Custom MCP add/import lifecycle behavior is verified, including no-id doctor and no secret leakage. | `qa_to_done` |

## Conclusion

FEATURE-948 passes final QA after rework. The custom MCP lifecycle satisfies the approved acceptance criteria, the no-id custom doctor defect is fixed, raw secret handling remains bounded to approved paths, and validation evidence is recorded with correct runtime surface labels. QA recommends closure through `qa_to_done`.
