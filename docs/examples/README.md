# Examples

This directory contains end-to-end examples that show how OpenKit is expected to operate.

Use examples to learn the operator flow, but treat the live runtime docs and workflow-state utility as authoritative when behavior differs.

- Start with `docs/examples/2026-03-20-openkit-sample-workflow.md`
- For runtime inspection and bootstrap behavior, also see `docs/examples/2026-03-21-runtime-hardening-walkthrough.md`
- For task-aware full-delivery execution, also see `docs/examples/2026-03-21-full-delivery-parallel-agent-walkthrough.md`
- Full-delivery sample artifacts live under `docs/examples/golden-path/`
- Quick-task sample artifacts live under `docs/examples/quick-task/`
- Use examples as behavioral references, not as substitutes for current repository state

What examples currently cover:

- the live `Quick Task+` quick-lane semantics and `Full Delivery` lane split
- workflow-state stage progression and approval expectations
- resumable-session guidance based on `.opencode/workflow-state.json`
- current runtime commands where relevant, including `node .opencode/workflow-state.js status` and `node .opencode/workflow-state.js doctor`
- current runtime hardening flow, including `doctor`, resume hints, and `scaffold-artifact`
- active work-item mirroring and bounded full-delivery task-board coordination
- command selection and operator wayfinding around `/task`, `/quick-task`, `/delivery`, `/brainstorm`, `/write-plan`, and `/execute-plan`

Operator note:

- Start daily use from `README.md` for the concise operator path and command-selection matrix
- Use examples to see what a Quick Task or Full Delivery run looks like in practice
- Do not read examples as proof of live parallel execution support unless the checked-in runtime docs and command surface say so
- Do not read examples as proof of unrestricted concurrency; task-aware parallel support is limited to the exact work-item and task-board behaviors the runtime currently validates
- When no app-native build, lint, or test tooling exists, examples should show honest validation notes rather than invented automation

Current note:

- existing examples illustrate the live quick lane with Quick Task+ semantics plus the `Full Delivery` lane
- quick mode still has no task board in examples because the live runtime does not add one
- examples should be updated in the same change whenever the live quick-stage sequence, quick evidence expectations, or runtime bootstrap behavior changes
