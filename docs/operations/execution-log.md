# Execution Log Guidance

Long-running work should keep a lightweight execution log in the relevant artifact or companion notes.

For runtime or workflow maintenance, include command evidence when it materially changes confidence in the kit's state. Typical examples include `node .opencode/workflow-state.js status`, `node .opencode/workflow-state.js doctor`, and `node .opencode/workflow-state.js validate`.

Recommended fields:

- timestamp
- actor
- action
- artifact changed
- result
