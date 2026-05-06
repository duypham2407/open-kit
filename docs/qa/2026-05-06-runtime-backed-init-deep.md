---
artifact_type: qa_report
version: 1
status: pass
feature_id: FEATURE-953
feature_slug: runtime-backed-init-deep
source_plan: docs/solution/2026-05-06-runtime-backed-init-deep.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Runtime-Backed `/init-deep`

## Overall Status
- PASS

## Verification Scope

- Runtime-backed command registration and executor behavior for `/init-deep`
- Project-owned root `AGENTS.md` generation behavior
- Compatibility fallback to `.opencode/openkit/AGENTS.md`
- Documentation and command-reality alignment

## Observed Result

- Runtime foundation now exposes a narrow command executor with a registered `/init-deep` handler.
- `/init-deep` writes a normal root `AGENTS.md` file using repository signals and preserves an OpenKit workflow overlay section.
- Runtime command metadata marks `/init-deep` as runtime-backed.
- Context injection still falls back to `.opencode/openkit/AGENTS.md` when root `AGENTS.md` is absent.

## Behavior Impact

- Positive: OpenKit now has a real runtime-backed repository-guidance command.
- Positive: root `AGENTS.md` ownership is compatible with git workflows.
- Neutral: other markdown-based commands remain prompt-template surfaces.

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| `/init-deep` is runtime-backed and inspectable | PASS | Runtime interface exposes runtime command metadata and tests execute the handler directly. |
| Root `AGENTS.md` is project-owned and commit-safe | PASS | Generated file is written as a normal file, not a shim or symlink. |
| Generated content is project-first with OpenKit overlay | PASS | Output includes repository signals, validation command status, and workflow overlay guidance. |
| Missing app validation is reported honestly | PASS | Generated output reports unavailable build/lint/test commands when scripts are absent. |
| Compatibility fallback remains intact | PASS | Runtime context injection still uses `.opencode/openkit/AGENTS.md` when root guidance is absent. |

## Quality Checks

- Runtime command architecture remains narrow and scoped to `/init-deep`.
- Generated output uses conservative repository signals and avoids unsupported framework claims.
- Docs updated to reflect command reality and root-vs-compatibility ownership split.

## Scan/Tool Evidence

| Evidence Item | Direct Tool Status | Substitute/Manual Evidence | Finding Counts | Classification Summary | False-Positive Rationale | Manual Override Caveats | Validation Surface | Artifact Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tool.rule-scan` | not run | none | n/a | no scan findings reviewed for this feature | n/a | feature validated through targeted runtime/unit/governance tests only | `runtime_tooling` | `tests/runtime/runtime-bootstrap.test.js`, `tests/runtime/runtime-platform.test.js`, `tests/cli/openkit-cli.test.js`, `tests/runtime/governance-enforcement.test.js`, `tests/runtime/registry-metadata.test.js` |
| `tool.security-scan` | not run | none | n/a | no scan findings reviewed for this feature | n/a | feature validated through targeted runtime/unit/governance tests only | `runtime_tooling` | `tests/runtime/runtime-bootstrap.test.js`, `tests/runtime/runtime-platform.test.js`, `tests/cli/openkit-cli.test.js`, `tests/runtime/governance-enforcement.test.js`, `tests/runtime/registry-metadata.test.js` |

- Direct tool status: targeted automated tests run; rule/security scan tools were not part of this feature gate.
- Substitute status and limitations: no substitute scans used.
- Classification summary: runtime and documentation behavior validated by direct tests.
- False-positive rationale: none.
- Manual override caveats: scan tools were omitted because the feature scope centered on runtime command behavior and docs alignment.
- Validation-surface labels and target-project app validation split: all evidence is `runtime_tooling` or `documentation`; no `target_project_app` claim.
- Artifact refs: `docs/scope/2026-05-06-runtime-backed-init-deep.md`, `docs/solution/2026-05-06-runtime-backed-init-deep.md`

## Test Evidence

- `node --test tests/runtime/runtime-bootstrap.test.js`
- `node --test tests/runtime/runtime-platform.test.js`
- `node --test tests/cli/openkit-cli.test.js`
- `node --test tests/runtime/governance-enforcement.test.js tests/runtime/registry-metadata.test.js`

## Recommended Route

- Ready for done.

## Issues

- None.

## Conclusion

- `/init-deep` now behaves as a runtime-backed OpenKit command with tested project-owned `AGENTS.md` generation and preserved compatibility guidance boundaries.
