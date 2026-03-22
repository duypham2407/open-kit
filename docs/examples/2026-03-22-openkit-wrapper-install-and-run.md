# OpenKit Wrapper Install And Run Walkthrough

This example shows the supported wrapper-first path for getting OpenKit running in a repository.

Use this as the primary operator walkthrough. If you need lower-level state inspection after the wrapper is installed, drop down to the repository/runtime internals such as `node .opencode/workflow-state.js status` only after the wrapper path is in a known-good state.

## Scenario

- repository already uses OpenCode directly through `.opencode/opencode.json`
- operator wants the supported OpenKit wrapper entrypoint without replacing the checked-in runtime manifest
- operator wants a readiness check before launching `opencode` through the wrapper

## 1. Inspect the starting point

Assume the repository already contains:

- `.opencode/opencode.json`
- no root `opencode.json`
- no `.openkit/openkit-install.json`

That means the repository has a raw runtime surface but not the managed wrapper surface yet.

## 2. Install the wrapper path

Run:

```bash
openkit install
```

Expected outcome:

- the command reports that it detected an existing OpenCode runtime
- root `opencode.json` is created for the wrapper surface
- `.openkit/openkit-install.json` is created for wrapper-owned install state
- the existing `.opencode/opencode.json` file is preserved as-is

This is the additive path. The wrapper sits over the checked-in runtime rather than overwriting it.

## 3. Check wrapper readiness

Run:

```bash
openkit doctor
```

Expected outcome when the wrapper install is healthy:

- `Status: healthy`
- `Can run cleanly: yes`
- `Owned by OpenKit: opencode.json, .openkit/openkit-install.json`
- `Drifted assets: none`

If `openkit doctor` reports `install-missing`, `install-incomplete`, `drift-detected`, or missing runtime prerequisites, fix that first before using `openkit run`.

## 4. Launch through the wrapper

Run:

```bash
openkit run --help
```

or, for a normal launch:

```bash
openkit run
```

What the wrapper does:

- discovers the repository's `.opencode/opencode.json`
- sets `OPENCODE_CONFIG_DIR` to the managed runtime directory
- layers the wrapper-managed config over the current OpenCode baseline for this session
- launches `opencode` through the supported managed path

The wrapper path is the supported launch path because it makes the OpenKit-managed layering explicit and inspectable.

## 5. Drop down to runtime internals only when needed

After the wrapper is installed and healthy, use lower-level commands only for maintainer tasks such as workflow-state inspection:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

Those commands operate on the repository/runtime internals under the wrapper. They are useful, but they do not replace `openkit doctor` as the supported wrapper readiness check.

## 6. Conflict example

If the repository already has an incompatible root `opencode.json`, `openkit install` stops instead of rewriting it.

Expected conflict behavior:

- exit non-zero
- report the conflicting path
- report a reason such as `unsupported-top-level-key`
- report `manual-review-required`

That non-destructive conflict path is intentional. The wrapper should not silently take ownership of user-managed top-level config.

## Validation Notes

The wrapper commands exercised in this walkthrough should stay aligned with the automated smoke coverage in `tests/cli/openkit-cli.test.js`.
