---
description: "Interactively switch the active global agent model profile for this OpenKit session only."
---

# Command: `/switch-profiles`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching runtime code or profile-related files.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to keep the `in_session`, `runtime_tooling`, `compatibility_runtime`, and `global_cli` surfaces separate.

Use `/switch-profiles` when an active `openkit run` session should change to an existing global agent model profile without leaving the session.

OpenCode custom slash command files are prompt templates. True native executable slash command support is not currently documented, so this command may be agent-mediated. For a direct executable picker in an active OpenKit runtime session, run `openkit switch-profiles` or `openkit switch`.

## Behavior

- Opens an interactive list of existing global profiles from `OPENCODE_HOME/openkit/agent-model-profiles.json`.
- Applies the selected profile to current workspace/session state only.
- Requires a valid `OPENKIT_RUNTIME_SESSION_ID`; the direct CLI fails closed outside an active OpenKit runtime session.
- Writes the active session selection under the managed workspace runtime root (`.opencode/active-agent-model-profile.json` inside the workspace runtime state), not to the global profile store.
- Keeps the global default profile unchanged.
- Does not edit, create, delete, or set defaults for global profiles.
- Does not intentionally affect other running sessions.

## In-session path

Prefer running the command with no arguments:

```text
/switch-profiles
```

For direct execution, use the CLI picker:

```text
openkit switch-profiles
openkit switch
```

The repository wrapper used by compatibility paths remains `node .opencode/switch-profiles.js`, but slash command templates should not claim unsupported native execution frontmatter or guaranteed automatic wrapper execution.

Direct profile-name arguments such as `/switch-profiles profile2` are intentionally out of scope for this feature. If arguments are provided, the command should explain that interactive selection is required and leave session state unchanged.

## Empty, cancel, and failure handling

- If no global profiles exist, report that no profiles are available and leave session state unchanged.
- If the user cancels the prompt, leave session state unchanged.
- If the selected profile disappears after the list is shown, report the missing profile and leave session state unchanged.
- If applying the profile is unsafe or fails, report the failure and leave the previous session selection intact.

## Validation surfaces

- Treat `/switch-profiles` evidence as `in_session` evidence for current-session profile switching when invoked from an active OpenCode session.
- Treat `openkit switch-profiles` and `openkit switch` evidence as `global_cli` entrypoint evidence that mutates only current-session runtime state.
- Treat profile store creation, editing, deletion, and launch-default behavior as `global_cli` evidence from `openkit profiles`.
- Treat runtime state inspection for the active profile as `compatibility_runtime` or `runtime_tooling`, depending on whether it comes from workflow-state/runtime tools.
- Do not report `/switch-profiles`, `openkit profiles`, or OpenKit runtime checks as `target_project_app` validation. Target-project application validation is unavailable unless the target project declares its own build, lint, test, smoke, or regression command.

## Limitations

The runtime support refreshes OpenKit runtime model-resolution read models and persisted session selection for subsequent OpenKit runtime resolution paths in the current session. It cannot retroactively change prompts, model choices, or background work that were already dispatched before the switch.
