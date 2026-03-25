# Cross-Platform Validation

Use this runbook to validate the OpenKit global install path consistently across Linux, macOS, and Windows.

If you want a simple scorecard while testing, pair this runbook with `cross-platform-validation-checklist.md`.

The goal is to prove that the supported operator flow works end to end on each OS:

- install the CLI
- materialize the managed global kit
- launch OpenCode through `openkit run`
- configure per-agent models
- run health checks, upgrade, and uninstall cleanly

## Scope

Validate these operating systems separately:

- Linux
- macOS
- Windows

Treat Linux as the baseline reference, then compare macOS and Windows behavior against the same checklist.

## Preconditions

Before starting on any OS:

- ensure `node`, `npm`, and `opencode` are available on `PATH`
- use a fresh `OPENCODE_HOME` so earlier test state does not affect results
- use a disposable test project directory rather than a production repository
- keep the OpenKit package version the same across all OS validation runs

Suggested test homes:

```bash
export OPENCODE_HOME=/tmp/opencode-openkit-test
```

```powershell
$env:OPENCODE_HOME="$env:TEMP\opencode-openkit-test"
```

## Pass Criteria

Count the OS as validated when all are true:

- `openkit run` works on a clean setup and on a second run
- `openkit doctor` reports sensible status before and after install
- `openkit configure-agent-models --interactive` is usable
- `openkit upgrade` refreshes without breaking the workspace
- `openkit uninstall` removes the managed install cleanly
- no hard blocker appears in wrapper execution, path detection, or session-start bootstrap

Use these labels consistently:

- `pass`: the expected operator flow works
- `soft fail`: the flow works but produces notable warnings or UX rough edges
- `hard fail`: a supported operator path is blocked

## Validation Matrix

Run the same flow on each OS.

### 1. Baseline CLI checks

```bash
openkit --help
openkit doctor
```

Expected results:

- `openkit --help` exits successfully and lists the main commands
- `openkit doctor` does not crash on a clean machine state
- if no install exists yet, `doctor` reports an install-missing style result with a clear next step

Record:

- exit code
- obvious shell or path issues
- whether help output looks complete and readable

### 2. Global install materialization

```bash
openkit install-global
```

Expected results:

- install exits successfully
- the managed kit appears under the OpenCode home directory
- the OpenKit profile is created under the OpenCode home directory

Verify these exist after install:

- `kits/openkit/.opencode/workflow-state.js`
- `profiles/openkit/opencode.json`
- `profiles/openkit/hooks.json`

### 3. Post-install doctor

```bash
openkit doctor
```

Expected results:

- install is no longer reported missing
- the command reports a healthy or workspace-ready state
- the output explains what to run next

### 4. First run path

Create a disposable project directory and run:

```bash
mkdir test-openkit-project
cd test-openkit-project
openkit run
```

Expected results:

- OpenCode launches successfully or the launcher path completes successfully
- workspace state is created under the OpenCode home directory
- no wrapper or module-boundary errors appear

Verify if needed:

```bash
node .opencode/openkit/workflow-state.js help
node .opencode/workflow-state.js help
```

These should work without crashing and without unexpected Node warnings.

### 5. Re-run path

Run again from the same project:

```bash
openkit run
```

Expected results:

- no unnecessary reinstall behavior
- the second run is still healthy and usable

### 6. Agent model setup

Check the model-selection flow:

```bash
openkit configure-agent-models --list
openkit configure-agent-models --models
openkit configure-agent-models --interactive
```

Expected interactive behavior:

- agent selection works
- provider selection works
- model selection works
- variant selection appears when runtime metadata exposes variants
- if verbose discovery fails, the flow falls back to plain model selection instead of hard failing

After saving a model override, rerun:

```bash
openkit configure-agent-models --list
openkit run
```

Confirm the saved override persists and does not break launch.

### 7. Upgrade path

```bash
openkit upgrade
openkit doctor
```

Expected results:

- the managed global install refreshes cleanly
- `doctor` still reports a healthy or usable state
- existing workspace state is not broken

### 8. Uninstall path

```bash
openkit uninstall
```

Optionally also test:

```bash
openkit uninstall --remove-workspaces
```

Expected results:

- managed kit and profile are removed cleanly
- optional workspace cleanup only removes managed workspace state
- `openkit doctor` returns to an install-missing style result after uninstall

## OS-Specific Notes

### Linux

- Treat Linux as the baseline reference path.
- Record any issue that appears only after repeated `run -> upgrade -> run` cycles.

### macOS

- Pay attention to executable permissions and shell PATH differences.
- Confirm `node`, `npm`, and `opencode` are all visible from the terminal used for testing.

### Windows

- Prefer testing in PowerShell first.
- If practical, also smoke-test in Command Prompt.
- Pay special attention to:
  - `opencode.cmd` detection
  - path quoting when directories contain spaces
  - wrapper execution and session-start bootstrap behavior
  - line-ending sensitivity and shell-bridge behavior

## Minimal Command Set

If you need a fast pass instead of the full matrix, run at least this set on each OS:

```bash
openkit --help
openkit doctor
openkit install-global
openkit doctor
openkit configure-agent-models --list
openkit configure-agent-models --models
openkit configure-agent-models --interactive
openkit run
openkit upgrade
openkit uninstall
```

## Reporting Template

Capture results in a short matrix like this:

```text
OS: <linux|macos|windows>
Version: <openkit version>
Node: <node version>
OpenCode: <opencode version if known>

Install: pass|soft fail|hard fail
Doctor: pass|soft fail|hard fail
Run: pass|soft fail|hard fail
Configure models: pass|soft fail|hard fail
Upgrade: pass|soft fail|hard fail
Uninstall: pass|soft fail|hard fail

Notes:
- <important warning or blocker>
- <path, shell, or UX quirk>
```
