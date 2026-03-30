---
description: "Stop continuation-style runtime behaviors for the current session."
---

# Command: `/stop-continuation`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to distinguish workflow closure from runtime continuation control.
- Use this command to stop continuation-oriented runtime behavior without mutating workflow state implicitly.
- Record why continuation stopped so the next session can inspect the stop reason before resuming.
