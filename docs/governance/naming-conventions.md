# Naming Conventions

## Artifact Filenames

- Use `YYYY-MM-DD-<slug>.md`
- Keep slugs lowercase and hyphen-separated
- Reuse the same slug across brief, spec, architecture, plan, and QA artifacts for one feature

## IDs

- Feature IDs use `FEATURE-###`
- ADR IDs use `ADR-###`
- QA issue IDs use `ISSUE-###`

## Registry And Profile Metadata

- Registry schemas use the form `openkit/<surface>@<version>`; current local metadata uses `openkit/component-registry@1` and `openkit/install-manifest@1`
- Registry profile names use lowercase kebab-case such as `openkit-core`
- Registry component IDs use `<category>.<slug>` such as `agent.master-orchestrator` or `command.quick-task`
- Keep registry category names aligned with real checked-in repository surfaces, not planned future surfaces
- Treat registry and install-manifest entries as local metadata describing this repository; do not name them as if they fetch remote packages
