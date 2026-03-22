# .opencode Runtime Internals

This directory is the checked-in repository-local OpenKit runtime layer.

It remains live in this repository today.

What lives here:

- `.opencode/opencode.json`: the current repository-local runtime manifest
- `.opencode/workflow-state.json`: the active compatibility mirror
- `.opencode/work-items/`: per-item backing store
- `.opencode/workflow-state.js`: lower-level runtime utility CLI
- `.opencode/lib/`: runtime internals
- `.opencode/tests/`: runtime regression tests

What this directory is not:

- not the preferred top-level onboarding surface for future wrapper installs
- not proof that the managed wrapper migration is complete
- not a separate product from the repository itself

When a real OpenKit wrapper install exists elsewhere, the intended product path is:

- `openkit init`
- `openkit install`
- `openkit doctor`
- `openkit run`

In this repository, `.opencode/` is still the concrete checked-in runtime that powers the lower-level workflow-state path and supports maintainer/runtime inspection.
