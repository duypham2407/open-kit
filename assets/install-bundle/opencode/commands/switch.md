---
description: "Inspect or switch between configured runtime agent model profiles."
---

# Command: `/switch`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching runtime code or profile-related files.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to keep profile switching explicit and separate from workflow-state authority.
- Use this command to list, inspect, toggle, set, or clear manual profile selection for an agent with 2 configured profiles.
- Prefer this when the same model family is available through multiple providers and you want a fast manual switch.
- In-session path, prefer the short syntax while `openkit run` is active:
- `node .opencode/profile-switch.js list`
- `node .opencode/profile-switch.js specialist.oracle`
- `node .opencode/profile-switch.js specialist.oracle 1`
- `node .opencode/profile-switch.js specialist.oracle t`
- `node .opencode/profile-switch.js specialist.oracle c`
- Long flags still work if you want explicit form.
- Current limitation: this updates OpenKit-managed live selection state for the current workspace, but it only affects runtime paths that re-read selection state during the session. It does not rewrite already-emitted prompts or retroactively change work already dispatched before the switch.
