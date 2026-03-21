# Operations

This directory defines lightweight operational guidance for execution logs, decision logs, review history, and runtime verification.

Use these docs when you need to understand or support OpenKit as an operating kit instead of only reading the workflow contract.

The current operations surface includes the checked-in registry and install-manifest metadata layer. Treat that layer as local repository observability, not as a remote package-management system.

Operational references in this directory:

- `workflow-state-smoke-tests.md`: lightweight checks for the workflow-state CLI and session-start behavior
- `execution-log.md`: how to record meaningful execution events for longer-running work
- `decision-log.md`: how to capture durable non-ADR decisions
- `review-history.md`: how to record review outcomes that change direction or require follow-up
- `reference-absorption-notes.md`: OpenKit-native capture of the last high-value ideas preserved from upstream reference repos

Current runtime commands worth knowing:

- `node .opencode/workflow-state.js status` prints the current runtime summary for the checked-in state file or a supplied `--state` path.
- `node .opencode/workflow-state.js doctor` checks whether the expected runtime files are present, readable, and still aligned with the checked-in workflow contract; it exits non-zero when required checks fail.
- `node .opencode/workflow-state.js profiles` lists the named profiles from `registry.json` and marks the repository default profile.
- `node .opencode/workflow-state.js show-profile <name>` prints the profile's default status and referenced component categories.
- `node .opencode/workflow-state.js sync-install-manifest <name>` rewrites `.opencode/install-manifest.json` so its recorded active profile matches a named checked-in profile.
- `node .opencode/workflow-state.js validate` checks state-shape validity but does not replace the broader diagnostics from `doctor`.
- `node .opencode/workflow-state.js scaffold-artifact <task_card|plan> <slug>` creates a narrow repo-native draft from a checked-in template and links it into workflow state when the runtime preconditions are satisfied.

## Operator Checklist

### 1. Inspect current runtime status

Run:

```bash
node .opencode/workflow-state.js status
```

Check:

- active profile
- registry and install-manifest paths
- current mode, stage, and owner

### 2. Run doctor before trusting the runtime

Run:

```bash
node .opencode/workflow-state.js doctor
```

Check:

- runtime files are present and readable
- contract-consistency checks pass
- summary ends with `0 error`

### 3. Inspect profiles before changing local metadata

Run:

```bash
node .opencode/workflow-state.js profiles
node .opencode/workflow-state.js show-profile openkit-core
```

Check:

- the default profile is marked with `*`
- the component categories match what you expect to inspect or restore

### 4. Sync the install manifest only when needed

Run:

```bash
node .opencode/workflow-state.js sync-install-manifest openkit-core
```

Use this only to realign local metadata with a checked-in profile name. It does not fetch or install anything.

### 5. Scaffold a narrow artifact draft only when workflow state allows it

Run one of:

```bash
node .opencode/workflow-state.js scaffold-artifact task_card copy-fix
node .opencode/workflow-state.js scaffold-artifact plan runtime-hardening
```

Check:

- `task_card` only runs in `quick` mode
- `plan` only runs in `full` mode at `full_plan` with a linked architecture artifact
- the command links a repo-relative path into workflow state

Session-start behavior:

- `hooks/session-start` prints a runtime status block at session start so a maintainer can see the kit name, version, entry agent, state file, and help commands quickly.
- When resumable workflow context exists, the same hook prints a mode-aware resume hint that points maintainers back to `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, `.opencode/workflow-state.json`, and `context/core/session-resume.md`.
- If the JSON helper used by the hook is unavailable, startup degrades gracefully: the runtime status block still prints, but manifest-derived details or resume hints may be reduced until the helper works again.

Current extension mechanics:

- The registry is the source of truth for what component categories and named profiles exist.
- The install manifest is the source of truth for which profile is currently recorded as installed in this repository.
- Adding a new agent, skill, command, or anchor doc is not operationally complete until the new surface is registered in `registry.json` and any relevant top-level manifest pointers stay accurate.
- Changing the install manifest alone does not create or remove files; it only updates the recorded local metadata.

Current-state guardrails:

- These docs describe repository runtime support only. They do not imply application build, lint, or test tooling.
- Keep examples and operational notes aligned with the live `Quick Task` + `Full Delivery` contract and the current `quick` / `full` workflow-state enums.
- Keep profile/install-manifest language aligned with the live CLI verbs: `profiles`, `show-profile`, and `sync-install-manifest`.
- Keep scaffold guidance aligned with the live CLI verb `scaffold-artifact` and its current narrow support for `task_card` and `plan` only.
