# Runtime Hardening Walkthrough

This example shows a maintainer-first flow for inspecting the current OpenKit runtime, verifying contract health, creating a lightweight artifact draft, and confirming the repository still reports honest status.

## 1. Inspect runtime status

Run:

```bash
node .opencode/workflow-state.js status
```

Look for:

- active profile
- registry path
- install-manifest path
- current mode, stage, and owner

## 2. Run doctor before changing anything

Run:

```bash
node .opencode/workflow-state.js doctor
```

Look for:

- runtime files exist and are readable
- contract-consistency checks pass
- summary ends with `0 error`

If `doctor` reports errors, fix those first before trusting any new workflow action.

## 3. Inspect current workflow state directly

Run:

```bash
node .opencode/workflow-state.js show
```

Use this when you need the raw state JSON instead of the condensed `status` output.

## 4. Create a quick-task card when traceability helps

If the active work item is in `quick` mode and the `task_card` slot is still empty, run:

```bash
node .opencode/workflow-state.js scaffold-artifact task_card copy-fix
```

Expected behavior:

- creates `docs/tasks/YYYY-MM-DD-copy-fix.md`
- links the new relative path into `artifacts.task_card`
- fails safely if the task is not in `quick` mode or if `task_card` is already linked

## 5. Create a plan draft only from the full planning stage

If the active work item is in `full` mode, is currently at `full_plan`, and already has a linked architecture artifact, run:

```bash
node .opencode/workflow-state.js scaffold-artifact plan runtime-hardening
```

Expected behavior:

- creates `docs/plans/YYYY-MM-DD-runtime-hardening.md`
- links the new relative path into `artifacts.plan`
- uses the linked architecture artifact in the scaffolded frontmatter
- fails safely if the mode, stage, or architecture prerequisite is wrong

## 6. Re-run verification after the scaffold

Run:

```bash
node .opencode/workflow-state.js doctor
node --test ".opencode/tests/*.test.js"
```

This confirms the runtime surface still passes diagnostics and the checked-in Node test suite still passes after the change.

## Notes

- `scaffold-artifact` is intentionally narrow; it does not generate briefs, specs, architecture docs, QA reports, or ADRs.
- The command links repo-relative paths into workflow state, even when invoked from another cwd with `--state`.
- If the JSON helper used by `hooks/session-start` is unavailable, startup still emits a degraded runtime status block rather than failing the whole session.
