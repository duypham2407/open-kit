# Test Matrix

Use this matrix to choose the smallest honest verification set after changing OpenKit.

Fastest full gate:

```bash
npm run verify:all
```

## Runtime And CLI Test Surfaces

| If you change... | Run at minimum | Why |
| --- | --- | --- |
| FEATURE-950 capability status envelopes, phase completion evidence conventions, or capability-platform supported-surface docs | `node --test ".opencode/tests/workflow-state-cli.test.js" ".opencode/tests/workflow-contract-consistency.test.js"` plus the phase-specific runtime tests below | validates compatibility evidence/read-model behavior and preserves the canonical workflow contract while capability maturity docs change |
| workflow-state CLI output or commands | `node --test ".opencode/tests/workflow-state-cli.test.js"` | validates runtime CLI behavior |
| workflow-state resume, evidence, issue, readiness, or validation-surface labels | `node --test ".opencode/tests/workflow-state-cli.test.js"` | validates compatibility-runtime read-model output and surface labeling |
| governance or anti-hallucination prompt contracts | `node --test tests/runtime/governance-enforcement.test.js` | validates prompt, docs, and evidence-discipline guardrails |
| scan/tool evidence reporting prompts, QA templates, Semgrep docs, or manual override language | `npm run verify:governance` and `node --test ".opencode/tests/workflow-contract-consistency.test.js"` | validates that reporting surfaces preserve direct/substitute/manual distinctions, validation-surface labels, and workflow contract alignment |
| bundled Semgrep rule packs, Semgrep fixtures, or scan-time Semgrep resolver behavior | `npm run verify:semgrep-quality` and `node --test tests/runtime/audit-tools.test.js` | validates real Semgrep JSON output for quality no-var precision and security-pack sanity on controlled fixtures, plus direct-tool resolver fallback across managed/system PATH, `npx --no-install semgrep`, and Python module paths; Semgrep unavailability fails the gate by default, and any local `OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP=1` skip is non-CI convenience only, not gate evidence |
| registry metadata contracts | `node --test tests/runtime/registry-metadata.test.js` | validates machine-readable workflow metadata |
| workflow-state controller logic | `node --test ".opencode/tests/workflow-state-controller.test.js"` | validates state transitions and controller rules |
| release readiness, DoD, analytics, or ops summaries | `node --test ".opencode/tests/workflow-state-controller.test.js" && node --test ".opencode/tests/workflow-state-cli.test.js"` | validates management and closure runtime behavior |
| release candidate workflow, rollback planning, or hotfix flow | `node --test ".opencode/tests/workflow-state-controller.test.js" && node --test ".opencode/tests/workflow-state-cli.test.js"` | validates release-level governance behavior |
| session-start hook, resume hint behavior, or startup capability guidance | `node --test ".opencode/tests/session-start-hook.test.js"` | validates runtime status, resume hint output, compact capability guidance, stale snapshot wording, and no hidden skill/MCP activation |
| capability router guidance builder, role/stage routes, skill-index/MCP caveats, or custom MCP labeling | `node --test tests/runtime/capability-tools.test.js` | validates compact advisory routing, status vocabulary, redaction, custom/origin labeling, and explicit detail paths |
| MCP/extensibility capability envelopes, redacted status rows, or custom MCP readiness caveats | `node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/global/custom-mcp-store.test.js tests/global/custom-mcp-validation.test.js tests/global/mcp-config-store.test.js tests/global/mcp-secret-manager.test.js` | validates bundled/custom MCP readiness, secret redaction, origin/ownership labeling, and runtime inventory behavior |
| code-intelligence readiness, graph/semantic fallback evidence, or syntax/codemod capability states | `node --test tests/runtime/project-graph-manager.test.js tests/runtime/import-graph-builder.test.js tests/runtime/graph-db.test.js tests/runtime/graph-tools.test.js tests/runtime/semantic-memory.test.js tests/runtime/embedding-pipeline.test.js tests/runtime/syntax-path-resolution.test.js tests/runtime/codemod-tools.test.js tests/runtime/external-tools.test.js` | validates graph DB/indexing status, embedding/keyword fallback, syntax support boundaries, codemod preview/apply evidence, and unavailable target-project app validation |
| runtime summary or workflow-state capability guidance read models | `node --test ".opencode/tests/workflow-state-cli.test.js" && node --test tests/runtime/runtime-platform.test.js` | validates `capability_guidance`, rendered lines, validation-surface labels, and unavailable `target_project_app` wording |
| workflow contract/schema alignment checks | `node --test ".opencode/tests/workflow-contract-consistency.test.js"` | validates docs/runtime consistency guardrails |
| top-level CLI help, run, install, or doctor behavior | `node --test tests/cli/openkit-cli.test.js` | validates product CLI behavior |
| onboarding flow text or defaults | `node --test tests/cli/onboard.test.js` | validates onboarding guidance |
| global doctor behavior | `node --test tests/global/doctor.test.js` | validates install/workspace readiness checks |
| global install materialization or launch wiring | `node --test tests/global/*.test.js` | validates managed-kit bootstrap and launch path |
| command permission policy, default-allow projection, dangerous-command exceptions, or policy doctor visibility | `node --test tests/global/command-permission-policy.test.js tests/global/ensure-install.test.js tests/global/doctor.test.js tests/global/mcp-profile-materializer.test.js tests/install/materialize.test.js tests/install/merge-policy.test.js tests/runtime/doctor.test.js` plus `npm pack --dry-run --json` when package contents matter | validates the canonical policy source, global kit/profile materialization, MCP profile preservation, repo-local/manual install projection, drift reporting, and package inclusion without claiming target-project app behavior |
| install merge policy or discovery | `node --test tests/install/*.test.js` | validates install safety and detection rules |
| MCP secret backend package readiness, package allowlist, release packaging docs, or forbidden secret/generated artifacts | `npm run verify:mcp-secret-package-readiness` and `node --test tests/install/mcp-secret-package-readiness.test.js` | validates `npm pack --dry-run --json` package contents, required MCP secret backend files, no persisted tarballs, fake/no real Keychain CI expectations, no raw secrets, and unavailable `target_project_app` labeling |
| bundled skill metadata, skill router/index output, or skill package sync | `node --test tests/runtime/skill-catalog.test.js && node --test tests/runtime/capability-tools.test.js && node --test tests/install/skill-bundle-sync.test.js && npm run verify:install-bundle` | validates canonical metadata, runtime exposure, advisory MCP bindings, stable/preview/experimental status, and package sync |
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

When the guidance change touches capability-router/session-start integration, also run:

```bash
node --test tests/runtime/capability-tools.test.js
node --test tests/runtime/runtime-platform.test.js
```

Maintainer assertions for this surface:

- session-start/runtime guidance stays under compact caps and does not dump full skill, bundled MCP, or custom MCP catalogs
- wording remains advisory and says no skill or MCP was auto-activated
- role/stage guardrails preserve Master, Product, Solution, Fullstack, Code Reviewer, QA, Quick, and migration ownership boundaries
- custom MCP entries remain `kind=custom`, origin/ownership-labeled, and not bundled defaults
- stale snapshot/refresh paths and unavailable `target_project_app` validation stay visible
- raw secrets, env maps, auth headers, provider payloads, and token-like values never appear in output or docs examples

### Scan Evidence Reporting Changes

Run:

```bash
npm run sync:install-bundle
npm run verify:install-bundle
npm run verify:semgrep-quality
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

### MCP Secret Package Readiness Changes

Run:

```bash
npm run verify:mcp-secret-package-readiness
node --test tests/install/mcp-secret-package-readiness.test.js
npm run verify:install-bundle
npm run verify:governance
node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js
node .opencode/workflow-state.js validate
```

Maintainer assertions for this surface:

- `npm pack --dry-run --json` is the package file-list source and no package tarball is persisted
- required MCP secret backend, keychain adapter, CLI/runtime, install-bundle, and packaged docs are included
- forbidden generated artifacts such as `secrets.env`, `.env` files, workflow-state mirrors, work-item state, runtime databases, extracted packages, and tarballs are absent
- keychain CI evidence uses fake adapter/runner or structural validation only; no real macOS Keychain mutation is valid
- command output, docs, package metadata, generated profiles, logs, and workflow evidence use placeholders/redaction and do not print raw secrets
- package/global/runtime/documentation/compatibility evidence remains separate from unavailable `target_project_app` validation

## Validation Story Split

- `tests/` covers product CLI, global install, install policy, and release/runtime adapter behavior
- `.opencode/tests/` covers the checked-in workflow runtime, compatibility mirror, and session-start behavior
- this repository still does not define repo-native build/lint/test commands for arbitrary generated application code
- `openkit doctor` and `node .opencode/workflow-state.js doctor` validate different OpenKit surfaces and are not target-project app test substitutes
- use validation surface labels in reports: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, and `target_project_app`
- use `package` for install-bundle/source synchronization checks such as generated bundled skill metadata; keep it separate from `runtime_tooling`, `documentation`, and `target_project_app`
- use `package` for `npm run verify:mcp-secret-package-readiness`; it proves MCP secret backend package contents and forbidden artifact absence, not app behavior
- `target_project_app` evidence is valid only when the target project defines the corresponding build, lint, or test command; otherwise record that app-native validation is unavailable
- runtime bootstrap tests should cover tool metadata surface labels when a tool crosses surfaces, for example workflow-state tools as `compatibility_runtime` and external typecheck/lint/test probes as `target_project_app`
