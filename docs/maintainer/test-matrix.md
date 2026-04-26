# Test Matrix

Use this matrix to choose the smallest honest verification set after changing OpenKit.

Fastest full gate:

```bash
npm run verify:all
```

## Runtime And CLI Test Surfaces

| If you change... | Run at minimum | Why |
| --- | --- | --- |
| workflow-state CLI output or commands | `node --test ".opencode/tests/workflow-state-cli.test.js"` | validates runtime CLI behavior |
| workflow-state resume, evidence, issue, readiness, or validation-surface labels | `node --test ".opencode/tests/workflow-state-cli.test.js"` | validates compatibility-runtime read-model output and surface labeling |
| governance or anti-hallucination prompt contracts | `node --test tests/runtime/governance-enforcement.test.js` | validates prompt, docs, and evidence-discipline guardrails |
| scan/tool evidence reporting prompts, QA templates, Semgrep docs, or manual override language | `npm run verify:governance` and `node --test ".opencode/tests/workflow-contract-consistency.test.js"` | validates that reporting surfaces preserve direct/substitute/manual distinctions, validation-surface labels, and workflow contract alignment |
| registry metadata contracts | `node --test tests/runtime/registry-metadata.test.js` | validates machine-readable workflow metadata |
| workflow-state controller logic | `node --test ".opencode/tests/workflow-state-controller.test.js"` | validates state transitions and controller rules |
| release readiness, DoD, analytics, or ops summaries | `node --test ".opencode/tests/workflow-state-controller.test.js" && node --test ".opencode/tests/workflow-state-cli.test.js"` | validates management and closure runtime behavior |
| release candidate workflow, rollback planning, or hotfix flow | `node --test ".opencode/tests/workflow-state-controller.test.js" && node --test ".opencode/tests/workflow-state-cli.test.js"` | validates release-level governance behavior |
| session-start hook or resume hint behavior | `node --test ".opencode/tests/session-start-hook.test.js"` | validates runtime status and resume hint output |
| workflow contract/schema alignment checks | `node --test ".opencode/tests/workflow-contract-consistency.test.js"` | validates docs/runtime consistency guardrails |
| top-level CLI help, run, install, or doctor behavior | `node --test tests/cli/openkit-cli.test.js` | validates product CLI behavior |
| onboarding flow text or defaults | `node --test tests/cli/onboard.test.js` | validates onboarding guidance |
| global doctor behavior | `node --test tests/global/doctor.test.js` | validates install/workspace readiness checks |
| global install materialization or launch wiring | `node --test tests/global/*.test.js` | validates managed-kit bootstrap and launch path |
| install merge policy or discovery | `node --test tests/install/*.test.js` | validates install safety and detection rules |
| CommonJS/runtime module boundary | `node --test tests/runtime/module-boundary.test.js` | validates legacy runtime boundary expectations |

## Recommended Bundles

### Docs And Runtime Guidance Changes

Run:

```bash
node --test ".opencode/tests/workflow-contract-consistency.test.js"
node --test ".opencode/tests/session-start-hook.test.js"
node --test ".opencode/tests/workflow-state-cli.test.js"
node --test tests/runtime/governance-enforcement.test.js
node --test tests/runtime/registry-metadata.test.js
```

### Scan Evidence Reporting Changes

Run:

```bash
npm run sync:install-bundle
npm run verify:install-bundle
npm run verify:governance
node --test ".opencode/tests/workflow-contract-consistency.test.js"
node .opencode/workflow-state.js validate
```

This bundle applies when changing role prompts, QA report templates, Semgrep/operator docs, supported-surface docs, approval gates, or tool-substitution guidance for scan evidence.

Maintainer assertions for this surface:

- bundled rule packs under `assets/semgrep/packs/` remain enough for standard OpenKit scan gates without hosted or network-only configs
- Availability states use `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`
- Result states distinguish scan execution success/failure from gate success/failure
- Evidence types remain distinct: `direct_tool`, `substitute_scan`, and `manual_override`
- High-volume finding triage groups results by rule, severity/category, area, and relevance instead of dumping raw output into reports
- False-positive requirements include rule/finding id, file or area, context, rationale, behavior/security impact, and follow-up decision
- Manual override limits keep overrides exceptional, caveated, and unavailable as a shortcut around noisy but usable scan findings
- OpenKit scan evidence remains `runtime_tooling` or stored `compatibility_runtime`; it does not replace `target_project_app` build/lint/test validation

### Product CLI Changes

Run:

```bash
node --test tests/cli/openkit-cli.test.js
node --test tests/cli/onboard.test.js
node --test tests/global/doctor.test.js
```

### Release And Analytics Changes

Run:

```bash
node --test ".opencode/tests/workflow-state-controller.test.js"
node --test ".opencode/tests/workflow-state-cli.test.js"
node --test tests/runtime/governance-enforcement.test.js
node --test tests/cli/release-cli.test.js
```

### Install Or Global Materialization Changes

Run:

```bash
node --test tests/install/*.test.js
node --test tests/global/*.test.js
node --test tests/cli/openkit-cli.test.js
npm run verify:install-bundle
```

## Validation Story Split

- `tests/` covers product CLI, global install, install policy, and release/runtime adapter behavior
- `.opencode/tests/` covers the checked-in workflow runtime, compatibility mirror, and session-start behavior
- this repository still does not define repo-native build/lint/test commands for arbitrary generated application code
- `openkit doctor` and `node .opencode/workflow-state.js doctor` validate different OpenKit surfaces and are not target-project app test substitutes
- use validation surface labels in reports: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, and `target_project_app`
- `target_project_app` evidence is valid only when the target project defines the corresponding build, lint, or test command; otherwise record that app-native validation is unavailable
- runtime bootstrap tests should cover tool metadata surface labels when a tool crosses surfaces, for example workflow-state tools as `compatibility_runtime` and external typecheck/lint/test probes as `target_project_app`
