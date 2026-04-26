# Context Navigation — Open Kit

This file is the entry point for context discovery after reading `AGENTS.md`. Use it to locate relevant standards and workflow guides.

Use it to distinguish between live workflow contract docs and background/historical artifacts.

Use it to keep the global-kit migration story honest: the preferred operator path is now the globally installed OpenKit kit, while this repository still keeps the checked-in `.opencode/` runtime as the authoring and compatibility surface.

Preferred operator path (`global_cli`): `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall`. In-session workflow commands (`in_session`) choose and execute the lane after launch. Manual provisioning or workflow-state commands (`compatibility_runtime`) are compatibility/diagnostic surfaces, not the default onboarding path.

Audience index layers outside `context/`:

- `README.md` is the concise top-level repository entrypoint
- `docs/operator/README.md` is the operator-facing index layer
- `docs/maintainer/README.md` is the maintainer-facing index layer
- `docs/kit-internals/README.md` is the consolidated maintainer deep-map for runtime and integration internals
- in phase 1, those files route readers to canonical docs; they do not replace canonical docs

Repository policies outside `context/` that agents should also consult when relevant:

- `docs/operator/README.md`: operator routing across live surfaces
- `docs/maintainer/README.md`: maintainer routing across canonical and support surfaces
- `docs/kit-internals/README.md`: multi-level system map for runtime, tools, hooks, skills, MCPs, and code intelligence internals
- `docs/governance/`: naming, severity, ADR, and done criteria
- `docs/operations/`: runbook guidance and durable operational-record policy

## Structure

```
context/
├── navigation.md          ← You are here
├── core/
│   ├── approval-gates.md  ← Approval recording rules
│   ├── active-contract.json ← Machine-readable active roles/stages/gates
│   ├── code-quality.md    ← Coding standards (all agents)
│   ├── code-review-output-schema.json ← Code review output contract
│   ├── issue-routing.md   ← QA classification and routing
│   ├── lane-selection.md   ← Lane routing tie-breakers
│   ├── prompt-contracts.md ← Shared prompt/runtime path contract
│   ├── project-config.md  ← Current command reality
│   ├── qa-output-schema.json ← QA output contract
│   ├── runtime-surfaces.md ← Product vs compatibility runtime surfaces
│   ├── session-resume.md  ← New-session resume protocol
│   ├── tool-substitution-rules.md ← Tool enforcement substitution map
│   ├── workflow-state-schema.md ← Canonical workflow-state fields and enums
│   └── workflow.md        ← Hard-split Quick Task and Full Delivery contract
```

Most historical roadmap and archive docs were intentionally pruned from the working tree during cleanup. If you need older rationale, use git history rather than expecting archived background docs to remain present.

Migration-contract references for the global kit and checked-in compatibility runtime should stay aligned across:

- `README.md`
- `AGENTS.md`
- `context/core/project-config.md`
- `registry.json`
- `.opencode/install-manifest.json`
- `.opencode/opencode.json`

Use `context/core/workflow.md` when you need the current live workflow semantics, and use the companion core docs only for their local operational details. Use git history only when historical rationale matters more than current repository behavior.

## Phase-1 Authority Rule

- `README.md`, `docs/operator/README.md`, and `docs/maintainer/README.md` are navigation layers
- canonical workflow semantics still live in `context/core/workflow.md`
- canonical operational details still live in the relevant `context/core/` files
- governance and operations policies remain canonical in their existing `docs/governance/` and `docs/operations/` locations
- artifact-specific guidance remains canonical in the artifact directories that already own those docs

## Discovery Rules

| Task type | Load first |
|-----------|-----------|
| Any implementation | `core/code-quality.md` |
| Understanding team workflow | `core/workflow.md` |
| Choosing the correct lane | `core/lane-selection.md` |
| Understanding product vs compatibility surfaces | `core/runtime-surfaces.md` |
| Recording approvals | `core/approval-gates.md` |
| Routing QA issues | `core/issue-routing.md` |
| Resuming a session | `core/session-resume.md` |
| Updating workflow state | `core/workflow-state-schema.md` |
| Applying governance policy | `../docs/governance/` |
| Understanding tool enforcement | `core/tool-substitution-rules.md` |
| Recording operational history | `../docs/operations/` |
| Daily operator wayfinding | `../docs/operator/README.md` |
| Maintainer wayfinding | `../docs/maintainer/README.md` |
| Understanding the assembled runtime internals | `../docs/kit-internals/README.md` |
| Starting a new feature | `core/workflow.md` |
| Comparing lane examples and tie-breakers | `core/workflow.md` |
| Running migration baseline or verify checks | `../docs/templates/migration-baseline-checklist.md` and `../docs/templates/migration-verify-checklist.md` |
| Running one-file migration tracking | `../docs/templates/migration-report-template.md` |

## Current Vs Future Reading Rule

- `context/core/workflow.md` is the canonical live workflow-semantics document
- `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, `context/core/project-config.md`, and `context/core/workflow-state-schema.md` define local operational details and must stay aligned with `context/core/workflow.md`
- older roadmap rationale may no longer be present in the working tree; use git history when historical intent matters more than current behavior
- do not treat `Quick Task+` as a live third mode; current runtime terms remain `Quick Task`, `Migration`, `Full Delivery`, `quick`, `migration`, and `full`
- do not describe the checked-in `.opencode/` runtime as the preferred end-user install path now that the global kit exists
- do not describe the new audience index layers as canonical replacements for the docs they route to
- do not invent target-project app build/lint/test commands; label missing app-native validation as unavailable
- keep Quick Task, Migration, and Full Delivery artifact expectations lane-aware: quick task cards are optional, migration artifacts are baseline/parity oriented, and full delivery requires Product Lead scope before Solution Lead solution
- use the shared capability vocabulary (`available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, `not_configured`) and validation surface labels (`global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, `target_project_app`) when updating runtime or operator docs

## Priority

- **Critical**: `core/code-quality.md` before any code generation
- **High**: `core/workflow.md` before any agent delegation
- **High**: `core/session-resume.md` before continuing an in-flight feature
- **High**: `core/runtime-surfaces.md` before explaining operator vs maintainer command choices
- **Medium**: `../docs/operator/README.md` and `../docs/maintainer/README.md` for audience-specific routing
- **Medium**: Task-specific context discovered through agent instructions
