# Review History Guidance

Record meaningful review outcomes when a plan, architecture, or QA report changes direction.

Also use review history when observability or extension changes uncover mismatches between docs, the registry, the install manifest, and the live workflow-state command surface.

Useful review-history cases for this repository:

- a docs review finds that `README.md`, operations guidance, and CLI output no longer agree on profile/install-manifest behavior
- a change adds a new agent, skill, command, or anchor doc but the registry or manifest pointers were not updated consistently
- a smoke-test pass or manual runtime review confirms a command-surface change and records follow-up cleanup work

Recommended fields:

- reviewer
- review type
- status
- key findings
- follow-up action

Helpful optional fields for this repository:

- commands reviewed
- registry or manifest files checked
- related decision log or ADR
