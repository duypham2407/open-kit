---
description: "Summarize the current workflow, state, and evidence for handoff to a new session."
---

# Command: `/handoff`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code. Prefer kit intelligence tools before basic built-in tools or OS commands.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to keep handoff summaries aligned with explicit workflow-state surfaces.
- Use this command to create a structured handoff summary without inventing missing state.
- Include the remaining actions, evidence state, and any continuation stop condition that the next session must honor.
