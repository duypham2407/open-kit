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
| governance or anti-hallucination prompt contracts | `node --test tests/runtime/governance-enforcement.test.js` | validates prompt, docs, and evidence-discipline guardrails |
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
