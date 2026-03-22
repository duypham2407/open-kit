# Examples

This directory contains end-to-end examples that show how OpenKit is expected to operate.

Examples are organized by audience and function. Use them as non-authoritative walkthroughs and samples, not as substitutes for current repository state.

Current layout:

- `docs/examples/operator/`: operator-first onboarding and wrapper-path examples
- `docs/examples/maintainer/`: lower-level runtime inspection and maintainer walkthroughs
- `docs/examples/workflow-samples/`: sample artifacts and lane illustrations

- Start with `docs/examples/operator/README.md` if you want the operator-first wrapper path.
- Use `docs/examples/operator/2026-03-22-openkit-wrapper-install-and-run.md` as the primary first-run example.
- Use `docs/examples/maintainer/README.md` for runtime inspection and task-aware maintainer walkthroughs.
- Use `docs/examples/workflow-samples/README.md` for sample workflow artifacts and lane illustrations.
- Use `docs/operations/README.md` when you need executable runbooks or durable operational records instead of examples.
- When behavior differs, prefer live docs such as `README.md`, `docs/operator/README.md`, `docs/maintainer/README.md`, `context/core/workflow.md`, and current CLI help.

What examples currently cover:

- the supported wrapper path for install, doctor, and run
- the live `Quick Task+` quick-lane semantics and `Full Delivery` lane split
- workflow-state stage progression and approval expectations
- resumable-session guidance based on `.opencode/workflow-state.json`
- current runtime commands where relevant, including `node .opencode/workflow-state.js status` and `node .opencode/workflow-state.js doctor`
- current runtime hardening flow, including `doctor`, resume hints, and `scaffold-artifact`
- active work-item mirroring and bounded full-delivery task-board coordination
- command selection and operator wayfinding around `/task`, `/quick-task`, `/delivery`, `/brainstorm`, `/write-plan`, and `/execute-plan`

Operator note:

- Start daily use from `README.md` for the concise operator path and command-selection matrix.
- Treat `docs/examples/operator/2026-03-22-openkit-wrapper-install-and-run.md` as the primary first-run example.
- Use `docs/examples/workflow-samples/` to see what a Quick Task or Full Delivery run looks like in practice.
- Treat examples under `docs/examples/maintainer/` and `node .opencode/workflow-state.js ...` examples as lower-level repository/runtime internals, not as the preferred wrapper onboarding path.
- Do not read examples as proof of live parallel execution support unless the checked-in runtime docs and command surface say so
- Do not read examples as proof of unrestricted concurrency; task-aware parallel support is limited to the exact work-item and task-board behaviors the runtime currently validates
- When no app-native build, lint, or test tooling exists, examples should show honest validation notes rather than invented automation

Current note:

- existing examples illustrate the live quick lane with Quick Task+ semantics plus the `Full Delivery` lane
- quick mode still has no task board in examples because the live runtime does not add one
- examples should be updated in the same change whenever the live quick-stage sequence, quick evidence expectations, or runtime bootstrap behavior changes
