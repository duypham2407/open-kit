# Surface Contract

Use this document to decide which OpenKit surface to use for a given goal.

## The Three Live Surfaces

### 1. Product Surface

- audience: everyday operators
- primary commands: `openkit run`, `openkit doctor`, `openkit onboard`, `openkit upgrade`, `openkit uninstall`
- use it for: launching OpenCode, checking global readiness, and managing the installed kit
- default path: `npm install -g @duypham93/openkit` -> `openkit doctor` -> `openkit run` -> `/task`

### 2. In-Session Workflow Surface

- audience: operators inside OpenCode
- primary commands: `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-solution`, `/execute-solution`, `/configure-agent-models`
- use it for: choosing the lane, moving work through the workflow, and invoking the mode-aware team
- default path: start with `/task` unless the lane is already obvious

### 3. Compatibility And Maintainer Runtime Surface

- audience: maintainers, runtime debugging, workflow-state inspection
- primary commands: `node .opencode/workflow-state.js status`, `doctor`, `show`, `resume-summary`, `validate`, and work-item/task-board commands
- use it for: inspecting or repairing workflow runtime state, validating task boards, checking compatibility mirror alignment, and maintainer diagnostics
- note: this is a supported compatibility surface, not the preferred onboarding path for normal operators

## Which Surface To Use

| Goal | Preferred surface | Command |
| --- | --- | --- |
| install and launch OpenKit | product surface | `openkit run` |
| check machine or workspace readiness | product surface | `openkit doctor` |
| get a dry onboarding summary | product surface | `openkit onboard` |
| choose the correct lane | in-session workflow surface | `/task` |
| force a known lane | in-session workflow surface | `/quick-task`, `/migrate`, `/delivery` |
| inspect active workflow state | compatibility runtime surface | `node .opencode/workflow-state.js status` |
| get a human-readable resume snapshot | compatibility runtime surface | `node .opencode/workflow-state.js resume-summary` |
| inspect raw linked state | compatibility runtime surface | `node .opencode/workflow-state.js show` |
| validate workflow runtime integrity | compatibility runtime surface | `node .opencode/workflow-state.js doctor` |

## Boundary Rules

- prefer the global product surface for daily work
- prefer slash commands once OpenCode is running
- prefer the low-level runtime CLI only when you need raw state inspection, maintainer diagnostics, or work-item/task-board operations
- keep the path model explicit: global kit root for managed kit/config, workspace state root for active runtime state, project `.opencode/` for compatibility shim behavior
- do not treat the checked-in `.opencode/` runtime as proof that every project should vendor OpenKit locally
- do not treat `openkit doctor` and `node .opencode/workflow-state.js doctor` as substitutes; they answer different questions

## Doctor Split

- `openkit doctor`: global install and workspace readiness
- `node .opencode/workflow-state.js doctor`: workflow runtime health, compatibility mirror alignment, and task-board validity

## Resume Split

- `openkit doctor`: tells you whether the workspace is ready to launch
- `node .opencode/workflow-state.js resume-summary`: tells you what is in progress and what to do next once workflow state already exists
