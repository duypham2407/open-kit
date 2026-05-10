# Potential Bugs Audit - 2026-05-10

## Scope

This report captures the potential bugs found during a Superpowers-backed review of the current OpenKit repository state on 2026-05-10.

Validation context:

- Full OpenKit gate: `npm run verify:all`
- Focused audit gate: `npm run verify:audit-wave-1`
- Release metadata gate: `node bin/openkit.js release verify --skip-tests`
- Release tests: `node --test tests/release/version-metadata-consistency.test.js tests/release/workflow.test.js`

The original scan below was read-only. The follow-up fix pass on 2026-05-10 updated code and tests; `src/openkit-runtime/tool-invocations.json` was already dirty before the fix pass and also records local runtime activity.

## 2026-05-10 Fix Follow-up

Status: fixed in the current worktree.

- Finding 1: fixed. `package-lock.json` root metadata now matches `package.json`, and `updateVersionMetadata()` updates structured release metadata (`package.json`, `package-lock.json`, `registry.json`, `src/openkit-runtime/install-manifest.json`) even when `package.json` already equals the requested version.
- Finding 2: fixed by the existing gate update. `verify:all` now runs `src/tests/release/*.test.js`.
- Finding 3: fixed. Workflow state callers now preserve structured controller errors and fail closed instead of treating `{ state: null, error }` as missing or incomplete state.

Validation after fixes:

```bash
node --test tests/release/version-metadata-consistency.test.js tests/release/workflow.test.js
node --test tests/runtime/advance-stage.test.js tests/runtime/action-gateway.test.js tests/runtime/role-guard-hook.test.js tests/runtime/audit-log.test.js
node --test tests/mcp-server/mcp-server.test.js tests/mcp-server/workflow-state-contract.test.js
node --test tests/runtime/workflow-kernel-error-propagation.test.js tests/runtime/workflow-kernel-integration.test.js
node --test tests/runtime/runtime-bootstrap.test.js tests/runtime/capability-tools.test.js
node bin/openkit.js release verify --skip-tests
npm run verify:audit-wave-1
npm run verify:all
```

All commands above passed after the fix pass.

Historical findings below describe the original observations before the user and follow-up fixes.

## Finding 1 - Critical - Release metadata drift blocks release verification

### Summary

The current package version is `0.7.0`, but two release metadata surfaces still report `0.6.0`.

### Evidence

- `package.json:3` has `"version": "0.7.0"`.
- `registry.json:6` has `"version": "0.6.0"` under `kit`.
- `src/openkit-runtime/install-manifest.json:6` has `"version": "0.6.0"` under `kit`.
- `src/release/workflow.js:171-179` verifies that `package.json`, `registry.json`, and `src/openkit-runtime/install-manifest.json` all match before release verification can pass.

### Reproduction

```bash
node bin/openkit.js release verify --skip-tests
```

Observed result:

```text
Version metadata is out of sync between package.json, registry.json, and .opencode/install-manifest.json.
```

Focused release tests also fail:

```bash
node --test tests/release/version-metadata-consistency.test.js tests/release/workflow.test.js
```

Observed failures:

- `package.json version matches registry.json kit.version`
- `package.json version matches install-manifest.json kit.version`

### Impact

`openkit release verify` and `openkit release publish` are blocked for the current `0.7.0` release state.

Any tooling that reads `registry.json#kit.version` or `src/openkit-runtime/install-manifest.json#kit.version` will see stale release metadata.

### Root Cause Notes

`src/release/workflow.js:93-96` returns early from `updateVersionMetadata()` when `package.json` already equals the requested target version. In the current state, `package.json` is already `0.7.0`, so a retry of `release prepare 0.7.0` would not rewrite the stale `0.6.0` values in `registry.json` or `src/openkit-runtime/install-manifest.json`.

### Suggested Fix

Update both stale metadata files to `0.7.0`, then run:

```bash
node --test tests/release/version-metadata-consistency.test.js tests/release/workflow.test.js
npm run verify:audit-wave-1
node bin/openkit.js release verify --skip-tests
```

Consider hardening `updateVersionMetadata()` so it can repair partial drift even when `package.json` already equals the requested version.

## Finding 2 - Important - `verify:all` and CI do not run release consistency tests

### Summary

The main verification command passes even while release consistency tests fail.

### Evidence

- `package.json:59` defines `verify:all`, but it does not include `src/tests/release/*.test.js`.
- `package.json:61` defines `verify:audit-wave-1`, which does include `src/tests/release/version-metadata-consistency.test.js`.
- `.github/workflows/verify.yml:29-30` runs only `npm run verify:all`.

### Reproduction

```bash
npm run verify:all
```

Observed result: passes outside the sandbox.

Then run:

```bash
npm run verify:audit-wave-1
```

Observed result: fails on the two version metadata consistency assertions described in Finding 1.

### Impact

CI can report green while the release workflow is broken. This lets release-blocking metadata drift reach the main branch undetected by the default gate.

### Root Cause Notes

The focused audit/release regression test was added as a separate script, but the canonical gate and CI workflow were not updated to run it.

### Suggested Fix

Add release consistency coverage to the canonical gate. Conservative options:

1. Add `node --test tests/release/*.test.js` to `verify:all`.
2. Or add `npm run verify:audit-wave-1` to `verify:all` if the audit wave gate is intended to remain current.

After updating the script, run:

```bash
npm run verify:all
```

This should fail until Finding 1 is fixed, then pass once metadata is aligned.

## Finding 3 - Medium - Workflow kernel still converts controller failures into fallback values

### Summary

`safeCall()` logs controller exceptions but still returns fallback values such as `null`.

### Evidence

- `src/runtime/workflow-kernel.js:150-162` catches all controller exceptions, writes a stderr message, and returns the caller's fallback.
- `src/tests/runtime/workflow-kernel-error-propagation.test.js:26-58` asserts that stderr logging occurs, but also asserts that `showState()` still returns `null` on failure.

### Reproduction

The current regression test demonstrates the behavior:

```bash
node --test tests/runtime/workflow-kernel-error-propagation.test.js
```

Expected behavior under the current test:

- corrupt JSON triggers a controller exception
- `safeCall()` logs to stderr
- `showState()` still returns `null`

### Impact

For callers that do not inspect stderr, real controller failures can still look like absent data or no-op results. Examples include malformed JSON, state read failures, SQLite locking, or unexpected controller errors.

This is lower risk than the original silent-swallow behavior because the error is now observable in stderr, but it is not yet a structured API-level error.

### Root Cause Notes

The implementation preserves backward compatibility for existing callers that treat `null` as "no value." That compatibility choice leaves ambiguity between "no state exists" and "state exists but the controller failed."

### Suggested Fix

Introduce a structured error result for workflow-kernel calls where callers can handle failures, for example:

```js
{ status: 'error', reason: 'controller_exception', message: error.message }
```

Migrate high-impact callers first instead of changing every return shape at once. Keep stderr logging as secondary diagnostic evidence.

## Environment Note - Sandbox-only npm cache failure

During validation, `npm run verify:all` initially failed inside the default sandbox at `verify:mcp-secret-package-readiness` because `npm pack --dry-run` could not access `~/.npm/_cacache/tmp`.

The focused command passed when rerun outside the sandbox, and `npm run verify:all` also passed outside the sandbox. This appears to be an environment/permission issue, not a project bug.
