# Examples

This directory contains end-to-end examples that show how OpenKit is expected to operate.

- Start with `docs/examples/2026-03-20-openkit-sample-workflow.md`
- For runtime inspection and bootstrap behavior, also see `docs/examples/2026-03-21-runtime-hardening-walkthrough.md`
- Full-delivery sample artifacts live under `docs/examples/golden-path/`
- Quick-task sample artifacts live under `docs/examples/quick-task/`
- Use examples as behavioral references, not as substitutes for current repository state

What examples currently cover:

- the live `Quick Task+` quick-lane semantics and `Full Delivery` lane split
- workflow-state stage progression and approval expectations
- resumable-session guidance based on `.opencode/workflow-state.json`
- current runtime commands where relevant, including `node .opencode/workflow-state.js status` and `node .opencode/workflow-state.js doctor`
- current runtime hardening flow, including `doctor`, resume hints, and `scaffold-artifact`

Current note:

- existing examples illustrate the live quick lane with Quick Task+ semantics plus the `Full Delivery` lane
- examples should be updated in the same change whenever the live quick-stage sequence, quick evidence expectations, or runtime bootstrap behavior changes
