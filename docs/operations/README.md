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
- `node .opencode/workflow-state.js doctor` checks whether the expected runtime files are present and exits non-zero when required checks fail.
- `node .opencode/workflow-state.js profiles` lists the named profiles from `registry.json` and marks the repository default profile.
- `node .opencode/workflow-state.js show-profile <name>` prints the profile's default status and referenced component categories.
- `node .opencode/workflow-state.js sync-install-manifest <name>` rewrites `.opencode/install-manifest.json` so its recorded active profile matches a named checked-in profile.
- `node .opencode/workflow-state.js validate` checks state-shape validity but does not replace the broader diagnostics from `doctor`.

Operational inspection flow:

- Use `status` to confirm the active profile, runtime metadata paths, and current workflow state in one place.
- Use `doctor` to confirm that the registry, install manifest, workflow state, CLI, and hook files exist and are readable.
- Use `profiles` and `show-profile` before changing the install manifest so you can inspect the checked-in profile names and intended component scope.
- Use `sync-install-manifest` when the local install manifest should be brought back in line with a named checked-in active profile after metadata changes.

Session-start behavior:

- `hooks/session-start` prints a runtime status block at session start so a maintainer can see the kit name, version, entry agent, state file, and help commands quickly.
- When resumable workflow context exists, the same hook prints a mode-aware resume hint that points maintainers back to `AGENTS.md`, `context/navigation.md`, `.opencode/workflow-state.json`, and `context/core/session-resume.md`.

Current extension mechanics:

- The registry is the source of truth for what component categories and named profiles exist.
- The install manifest is the source of truth for which profile is currently recorded as installed in this repository.
- Adding a new agent, skill, command, or anchor doc is not operationally complete until the new surface is registered in `registry.json` and any relevant top-level manifest pointers stay accurate.
- Changing the install manifest alone does not create or remove files; it only updates the recorded local metadata.

Current-state guardrails:

- These docs describe repository runtime support only. They do not imply application build, lint, or test tooling.
- Keep examples and operational notes aligned with the live `Quick Task` + `Full Delivery` contract and the current `quick` / `full` workflow-state enums.
- Keep profile/install-manifest language aligned with the live CLI verbs: `profiles`, `show-profile`, and `sync-install-manifest`.
