# Surface Contract

Use this document to decide which OpenKit surface to use for a given goal.

## The Three Live Surfaces

### 1. Product Surface (`global_cli`)

- audience: everyday operators
- validation label: `global_cli`
- primary commands: `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, `openkit uninstall`
- capability configuration: `openkit configure mcp ...` for bundled MCP discovery, local-only key storage, scope materialization, and MCP readiness checks
- optional helper: `openkit onboard` for a dry onboarding summary before launch
- use it for: launching OpenCode, checking global readiness, and managing the installed kit
- default path: `npm install -g @duypham93/openkit` -> `openkit doctor` -> `openkit run` -> `/task`
- note: `openkit install` and `openkit install-global` are manual/compatibility setup helpers, not the preferred product onboarding path

### 2. In-Session Workflow Surface (`in_session`)

- audience: operators inside OpenCode
- validation label: `in_session`
- primary commands: `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-solution`, `/execute-solution`, `/configure-agent-models`
- use it for: choosing the lane, moving work through the workflow, and invoking the mode-aware team
- default path: start with `/task` unless the lane is already obvious

### 3. Compatibility And Maintainer Runtime Surface (`compatibility_runtime`)

- audience: maintainers, runtime debugging, workflow-state inspection
- validation label: `compatibility_runtime`
- primary commands: `node .opencode/workflow-state.js status`, `doctor`, `show`, `resume-summary`, `validate`, and work-item/task-board commands
- use it for: inspecting or repairing workflow runtime state, validating task boards, checking compatibility mirror alignment, and maintainer diagnostics
- note: this is a supported compatibility surface, not the preferred onboarding path for normal operators

## Which Surface To Use

| Goal | Preferred surface | Command |
| --- | --- | --- |
| install OpenKit | product surface | `npm install -g @duypham93/openkit` |
| launch OpenKit | product surface | `openkit run` |
| check machine or workspace readiness | product surface | `openkit doctor` |
| get a dry onboarding summary | product surface | `openkit onboard` |
| refresh or remove the global kit | product surface | `openkit upgrade`, `openkit uninstall` |
| inspect or configure bundled MCPs | product surface | `openkit configure mcp list`, `doctor`, `enable`, `disable`, `set-key`, `unset-key`, `test` |
| choose the correct lane | in-session workflow surface | `/task` |
| force a known lane | in-session workflow surface | `/quick-task`, `/migrate`, `/delivery` |
| inspect active workflow state | compatibility runtime surface | `node .opencode/workflow-state.js status` |
| get a human-readable resume snapshot | compatibility runtime surface | `node .opencode/workflow-state.js resume-summary` |
| inspect raw linked state | compatibility runtime surface | `node .opencode/workflow-state.js show` |
| validate workflow runtime integrity | compatibility runtime surface | `node .opencode/workflow-state.js doctor` |

## Boundary Rules

- prefer the global product surface for daily work
- use `openkit configure mcp ...` for MCP catalog/configuration work and keep examples placeholder-only; raw secrets belong only in the local OpenKit secret store and runtime process environment
- use `openkit upgrade` and `openkit uninstall` for product lifecycle maintenance; do not switch to repository-local workflow-state commands for install, launch, upgrade, or uninstall work
- prefer slash commands once OpenCode is running
- prefer the low-level runtime CLI only when you need raw state inspection, maintainer diagnostics, or work-item/task-board operations
- keep `openkit install` and `openkit install-global` only as manual/compatibility setup helpers when they are intentionally needed; they are not the preferred onboarding path
- keep the path model explicit: global kit root for managed kit/config, workspace state root for active runtime state, project `.opencode/` for compatibility shim behavior
- do not treat the checked-in `.opencode/` runtime as proof that every project should vendor OpenKit locally
- do not treat `openkit doctor` and `node .opencode/workflow-state.js doctor` as substitutes; they answer different questions
- do not treat OpenKit runtime validation as target-project application validation; app build, lint, or test evidence exists only when the target project declares those commands
- label completion evidence by surface: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or `target_project_app`

## Lane And Artifact Answers

| Lane | Primary artifact expectation | Optional or bounded coordination |
| --- | --- | --- |
| Quick Task | confirmed understanding, selected option, execution plan, and verification evidence in workflow communication | optional `docs/tasks/...` task card; no task board |
| Migration | migration solution package plus baseline, preserved invariants, rollback, compatibility, and parity evidence | optional migration report or strategy-enabled slice board; not a full-delivery task board |
| Full Delivery | Product Lead scope package before Solution Lead solution package; implementation evidence before review; QA report before done | full-only task board when approved by solution package; no unrestricted parallelism |

## Honest Validation Rule

- `global_cli` evidence proves global install, launch, doctor, upgrade, uninstall, and related product lifecycle behavior.
- `in_session` evidence proves slash-command routing, lane choice, stage ownership, and handoff behavior.
- `compatibility_runtime` evidence proves workflow-state integrity, compatibility mirror alignment, work-item state, task-board state, issues, approvals, and verification records.
- `target_project_app` evidence exists only when the target project declares an actual build, lint, test, smoke, or regression command. If those commands are absent, say app-native validation is unavailable and record manual or artifact-based evidence separately.

## Permission Rule

- The command permission policy source of truth is `assets/default-command-permission-policy.json`. Global kit/profile materialization projects it into the OpenKit-managed OpenCode configs used by `openkit run`; `.opencode/opencode.json` is an authoring/compatibility projection.
- OpenKit's desired behavior is default allow for routine non-dangerous commands. Recommended routine examples include `openkit doctor`, `openkit onboard`, `openkit configure-agent-models --list`, `/task`, `/quick-task`, `/migrate`, `/delivery`, `node .opencode/workflow-state.js status`, `resume-summary`, `show`, `doctor`, `validate`, `git status`, `git log`, `git diff`, and standard edit/write flows.
- Policy-listed dangerous commands must require explicit confirmation first. This covers deletion (`rm`, `rmdir`, `unlink`), destructive git/discard/force-push commands, publish/release/deploy commands, database destructive forms, and privileged/system-impacting commands represented in the policy.
- Treat deletion and destructive git/release operations as confirmation-required even when the target looks generated or disposable; OpenKit's agent git/release safety protocol remains binding regardless of the permission map.
- OpenCode default-allow plus exception support is currently unverified, so OpenKit reports the effective policy support as `degraded` and does not guarantee prompt-free execution when upstream still prompts.
- If OpenCode offers `Always Allow` at prompt time, that remembered decision is expected to be stored by OpenCode. OpenKit does not layer its own extra persistence for command approvals and does not implement prompt-broker or auto-confirm behavior.

## Doctor Split

- `openkit doctor`: global install and workspace readiness
- `node .opencode/workflow-state.js doctor`: workflow runtime health, compatibility mirror alignment, and task-board validity

## Resume Split

- `openkit doctor`: tells you whether the workspace is ready to launch
- `node .opencode/workflow-state.js resume-summary`: tells you what is in progress and what to do next once workflow state already exists
