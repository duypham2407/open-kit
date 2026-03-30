---
description: "Run a refactoring-focused workflow with explicit validation expectations."
---

# Command: `/refactor`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to separate command ergonomics from workflow-state truth.
- Use this command when structural change is central and the task still needs explicit verification and traceability.
- Prefer the safer editing and structured inspection runtime tools before broad file mutation when the refactor spans multiple files.
