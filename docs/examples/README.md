# Examples

This directory contains end-to-end examples that show how OpenKit is expected to operate.

- Start with `docs/examples/2026-03-20-openkit-sample-workflow.md`
- Full-delivery sample artifacts live under `docs/examples/golden-path/`
- Quick-task sample artifacts live under `docs/examples/quick-task/`
- Use examples as behavioral references, not as substitutes for current repository state

What examples currently cover:

- the live `Quick Task` and `Full Delivery` lane split
- workflow-state stage progression and approval expectations
- resumable-session guidance based on `.opencode/workflow-state.json`
- current runtime commands where relevant, including `node .opencode/workflow-state.js status` and `node .opencode/workflow-state.js doctor`

Current note:

- existing examples illustrate the live `Quick Task` + `Full Delivery` contract
- follow-on quick-lane changes should update examples only after the underlying contract and runtime behavior land
- `Quick Task+` references remain directional unless the live workflow contract, commands, and runtime state support change together
