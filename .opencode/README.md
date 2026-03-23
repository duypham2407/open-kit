# .opencode Runtime Internals

This directory is the checked-in repository-local OpenKit runtime layer.

It remains live in this repository today.

For phase-1 navigation, treat this file as a local runtime boundary note, not as a replacement for the audience index layers in `README.md`, `docs/operator/README.md`, or `docs/maintainer/README.md`.

What lives here:

- `.opencode/opencode.json`: the current repository-local runtime manifest
- `.opencode/workflow-state.json`: the active compatibility mirror
- `.opencode/work-items/`: per-item backing store
- `.opencode/workflow-state.js`: lower-level runtime utility CLI
- `.opencode/lib/`: runtime internals
- `.opencode/tests/`: runtime regression tests

Related routing layers outside this directory:

- `README.md`: top-level repository boundary and current docs layout
- `docs/operator/README.md`: operator-facing routing for the live surfaces
- `docs/maintainer/README.md`: maintainer-facing routing for canonical docs and internals
- `docs/operations/README.md`: operational support routing for runbooks and internal records

What this directory is not:

- not the preferred top-level onboarding surface for everyday OpenKit usage now that the global install path exists
- not proof that end users should install the kit into each repository
- not a separate product from the repository itself

When the global OpenKit install exists elsewhere, the intended product path is:

- `openkit install-global`
- `openkit doctor`
- `openkit run`
- `openkit upgrade`
- `openkit uninstall`

In this repository, `.opencode/` is still the concrete checked-in runtime that powers the lower-level workflow-state path and supports maintainer/runtime inspection.

Authority guardrail:

- `.opencode/` remains the live runtime layer
- `context/core/workflow.md` remains the canonical workflow-semantics document
- the phase-1 audience directories remain index layers only and do not relocate canonical runtime or workflow sources
