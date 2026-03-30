# Runtime Layering Principles

## Principle 1: Workflow First

The capability runtime exists to serve the workflow kernel, not replace it.

## Principle 2: Explicit State

If a runtime capability affects delivery state, the effect must be visible through `.opencode/workflow-state.js` or `.opencode/lib/*`.

## Principle 3: Additive Config

Runtime config must be additive over the existing OpenCode config layering and must remain optional.

## Principle 4: Observable Runtime

Every major runtime subsystem should have:

- registry metadata
- doctor visibility
- tests
- maintainer docs

## Principle 5: Mode Safety

`quick`, `migration`, and `full` remain workflow modes. Runtime categories, specialists, and tools may assist execution but cannot redefine those modes.

## Principle 6: Feature Flags First

Large runtime capabilities should ship behind config gates before they become default behavior.
