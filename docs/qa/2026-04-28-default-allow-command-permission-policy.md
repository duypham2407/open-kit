---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-960
feature_slug: default-allow-command-permission-policy
source_plan: docs/solution/2026-04-28-default-allow-command-permission-policy.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Default-Allow Command Permission Policy

## Overall Status
- PASS

## Verification Scope
- Canonical command permission policy source and schema validation.
- Policy-derived global kit/profile materialization, repo-local compatibility config alignment, and MCP profile preservation.
- Doctor visibility for degraded upstream OpenCode default-action support, missing/malformed policy, and drifted dangerous entries.
- Safety boundary: dangerous command projection, unchanged git/release safety docs, and no prompt broker / pseudo-terminal auto-confirm / hidden interceptor implementation.

## Observed Result
- PASS: implementation satisfies the approved FEATURE-960 scope and solution for the MVP.
- Routine command default-allow intent is represented through the canonical policy and explicit permission projection where current OpenCode config can express it.
- Dangerous delete, destructive git, publish/release/deploy, database-destructive, and privileged/system-impacting entries remain `ask` in policy projections.
- Doctor/reporting honestly labels effective support as `degraded` because OpenCode true `defaultAction` exception support is unverified.
- No QA finding requiring rework was observed.

## Behavior Impact
- Operators receive policy-derived OpenKit-managed config/profile materialization for global runtime surfaces instead of relying only on repo-local `.opencode/opencode.json`.
- `openkit doctor` can report policy source health, config/profile drift, and upstream limitation caveats.
- The implementation does not weaken agent git/release safety protocol and does not add hidden prompt handling.

## Spec Compliance
| Acceptance Target | Result | Notes |
| --- | --- | --- |
| AC1 canonical machine-readable policy | PASS | `assets/default-command-permission-policy.json` schema/version validated. |
| AC2 global installed runtime uses policy | PASS | Global materialization tests verify kit/profile config includes policy-derived permission and metadata. |
| AC3 repo-local config not only target | PASS | Global coverage exists; repo-local/template alignment is also tested. |
| AC4 routine commands avoid repeated confirmation where supported | PASS with caveat | Routine allows are projected; prompt-free behavior remains reported as degraded/unverified upstream. |
| AC5-AC8 dangerous categories ask | PASS | Policy/projection tests and configs preserve `ask` entries for required categories. |
| AC9 doctor reports policy health/drift | PASS | Tests cover healthy/degraded, missing, malformed, schema-malformed, and drifted cases. |
| AC10 verification covers effective limitations | PASS | Targeted/full gates passed; upstream limitation remains explicit. |
| AC11 no prompt broker/auto-confirm | PASS | Inspected changed source; no broker/PTY/hidden auto-confirm path added. |
| AC12 docs match product contract | PASS | Governance/docs verification passed. |

## Tool Evidence
- rule-scan: direct `tool.rule-scan` unavailable in QA namespace; substituted Semgrep quality scan over 25 requested FEATURE-960 changed files / 13 scanned JS targets, 0 findings, 0 errors.
- security-scan: direct `tool.security-scan` unavailable in QA namespace; substituted Semgrep security scan over 25 requested FEATURE-960 changed files / 15 scanned JS/JSON targets, 0 findings, 0 errors.
- evidence-capture: 1 QA record written (`feature-960-qa-verification-2026-04-28`).
- syntax-outline: attempted on changed JS files; unavailable due current tool project-root path resolution (`invalid-path`/`missing-file`), substituted targeted source reads and automated behavior tests.

## Evidence
- `node --test tests/global/command-permission-policy.test.js tests/global/ensure-install.test.js tests/global/doctor.test.js tests/global/mcp-profile-materializer.test.js tests/install/materialize.test.js tests/install/merge-policy.test.js tests/runtime/doctor.test.js` → exit 0, 81 pass.
- `semgrep scan --json --metrics=off --config assets/semgrep/packs/quality-default.yml <FEATURE-960 changed files>` → exit 0, 0 findings.
- `semgrep scan --json --metrics=off --config assets/semgrep/packs/security-audit.yml <FEATURE-960 changed files>` → exit 0, 0 findings.
- `npm run verify:all` → exit 0; full OpenKit gate passed, including install-bundle, MCP secret package readiness, governance, Semgrep quality, runtime/install/global/CLI tests.
- `npm pack --dry-run --json` → exit 0; package includes `assets/default-command-permission-policy.json` and `src/permissions/command-permission-policy.js`.
- Fix validation: `node --test tests/global/command-permission-policy.test.js tests/global/doctor.test.js && node --test tests/runtime/doctor.test.js` → exit 0, 49 pass.
- Target-project app validation: unavailable / not applicable; evidence is OpenKit `global_cli`, `package`, `runtime_tooling`, `compatibility_runtime`, and `documentation` only.

## Issues
- None.

## Recommended Route
- Recommend `qa_to_done`.

## Verification Record
- issue_type: none
- severity: none
- rooted_in: none
- evidence: see commands above and workflow evidence `feature-960-qa-verification-2026-04-28`
- behavior_impact: FEATURE-960 MVP behavior verified; upstream OpenCode support caveat remains visible by design
- route: `qa_to_done`
