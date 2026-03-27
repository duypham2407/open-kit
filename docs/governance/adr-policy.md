# ADR Policy

Create an ADR when a decision changes architecture boundaries, technology choices, or long-term operational behavior.

For the profile/install-manifest layer, create an ADR when a change does any of the following:

- changes the meaning or schema of `registry.json` or `.opencode/install-manifest.json`
- changes the long-term semantics of profile selection, profile composition, or install-manifest ownership
- adds, removes, or renames workflow-state CLI commands that operators rely on for runtime inspection or manifest management
- changes session-start or runtime diagnostics in a way that materially affects how maintainers inspect or resume the kit
- changes scaffold-artifact semantics beyond the current narrow `task_card`/`scope_package`/`solution_package` scope, or changes the required workflow-state prerequisites for scaffolded artifacts
- introduces a new extension policy that changes how agents, skills, commands, hooks, artifacts, or anchor docs must be registered

A lighter decision log is usually enough when the change only:

- adds a new registry entry for an already-established component type
- adds a new profile that only recombines existing component categories without changing command or schema behavior
- clarifies operator-facing docs, smoke tests, or examples to match existing runtime behavior
- updates naming, descriptions, or local guidance without changing the runtime contract
- tightens scaffold command guardrails, tests, or docs without expanding the supported artifact kinds or changing workflow-state meaning

## Minimum ADR Content

- Context
- Decision
- Consequences
- Alternatives considered
