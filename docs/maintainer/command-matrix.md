# Command Matrix

Use this matrix when you are unsure which OpenKit command surface owns a task.

## Operator And Maintainer Matrix

| Goal | Audience | Preferred command |
| --- | --- | --- |
| install the OpenKit CLI package | operator | `npm install -g @duypham93/openkit` |
| launch OpenCode with OpenKit | operator | `openkit run` |
| inspect install and workspace readiness | operator | `openkit doctor` |
| refresh the managed global kit | operator | `openkit upgrade` |
| remove the managed global kit | operator | `openkit uninstall` |
| preview safest onboarding path | operator | `openkit onboard` |
| choose the workflow lane in-session | operator | `/task` |
| plan browser verification in-session | operator | `/browser-verify` |
| directly enter quick lane | operator | `/quick-task` |
| directly enter migration lane | operator | `/migrate` |
| directly enter full lane | operator | `/delivery` |
| inspect active runtime summary | maintainer | `node .opencode/workflow-state.js status` |
| inspect active runtime summary quickly | maintainer | `node .opencode/workflow-state.js status --short` |
| inspect resumable context in plain language | maintainer | `node .opencode/workflow-state.js resume-summary` |
| inspect resumable context quickly | maintainer | `node .opencode/workflow-state.js resume-summary --short` |
| inspect raw mirrored state | maintainer | `node .opencode/workflow-state.js show` |
| validate workflow runtime integrity | maintainer | `node .opencode/workflow-state.js doctor` |
| validate workflow runtime integrity quickly | maintainer | `node .opencode/workflow-state.js doctor --short` |
| validate mirror/schema/state shape only | maintainer | `node .opencode/workflow-state.js validate` |
| inspect work items | maintainer | `node .opencode/workflow-state.js list-work-items` |
| inspect stale task signals across work items | maintainer | `node .opencode/workflow-state.js task-aging-report` |
| inspect cross-work-item workflow trends | maintainer | `node .opencode/workflow-state.js workflow-analytics` |
| inspect a single compact operational snapshot | maintainer | `node .opencode/workflow-state.js ops-summary` |
| inspect workflow blockers and readiness | maintainer | `node .opencode/workflow-state.js workflow-metrics` |
| inspect whether the current stage can close | maintainer | `node .opencode/workflow-state.js check-stage-readiness` |
| inspect definition-of-done requirements | maintainer | `node .opencode/workflow-state.js show-dod`, `node .opencode/workflow-state.js validate-dod` |
| inspect ship or release readiness | maintainer | `node .opencode/workflow-state.js release-readiness` |
| create and manage release candidates | maintainer | `node .opencode/workflow-state.js create-release-candidate`, `list-release-candidates`, `show-release-candidate` |
| add release-level approvals and rollback planning | maintainer | `node .opencode/workflow-state.js set-release-approval`, `record-rollback-plan` |
| draft and validate release notes | maintainer | `node .opencode/workflow-state.js draft-release-notes`, `validate-release-notes` |
| inspect release-level gates and dashboard | maintainer | `node .opencode/workflow-state.js check-release-gates`, `release-dashboard` |
| start and validate release-linked hotfixes | maintainer | `node .opencode/workflow-state.js start-hotfix`, `validate-hotfix` |
| inspect pending approval bottlenecks | maintainer | `node .opencode/workflow-state.js approval-bottlenecks` |
| inspect repeated QA failure signals | maintainer | `node .opencode/workflow-state.js qa-failure-summary` |
| inspect stale or repeated issues | maintainer | `node .opencode/workflow-state.js issue-aging-report`, `node .opencode/workflow-state.js list-stale-issues` |
| inspect full-delivery task board | maintainer | `node .opencode/workflow-state.js list-tasks <work_item_id>` |
| inspect migration slices | maintainer | `node .opencode/workflow-state.js list-migration-slices <work_item_id>` |
| inspect where policies are enforced | maintainer | `node .opencode/workflow-state.js policy-trace` |

## Preferred Operator Lifecycle

Use this sequence for normal product usage and new operator docs:

1. `npm install -g @duypham93/openkit`
2. `openkit doctor`
3. `openkit run`
4. `openkit upgrade` when the managed global kit should be refreshed
5. `openkit uninstall` when the managed kit should be removed

`openkit install` and `openkit install-global` are valid manual or compatibility setup commands when the CLI exposes them, but they are not the preferred onboarding path.

## Lane And Artifact Matrix

| Lane | Primary artifact expectations | Optional artifacts or coordination |
| --- | --- | --- |
| Quick Task / `quick` | workflow communication records confirmed understanding, selected approach, execution plan, and verification evidence | `docs/tasks/YYYY-MM-DD-<task>.md` task card; no task board |
| Migration / `migration` | migration solution package in `docs/solution/`, baseline evidence, preserved invariants, compatibility, rollback, and parity evidence | migration report; strategy-enabled migration slice board |
| Full Delivery / `full` | Product Lead scope package in `docs/scope/` before Solution Lead solution package in `docs/solution/`, then implementation evidence, code review, and QA report in `docs/qa/` | ADRs; full-only task board when an approved solution allows it |

## Decision Rules

- if the task is about launching, onboarding, install health, or global kit lifecycle, use `openkit ...`
- if the task is about choosing or driving a workflow lane inside OpenCode, use slash commands
- if the task is about workflow-state internals, compatibility mirrors, task boards, or maintainer diagnostics, use `node .opencode/workflow-state.js ...`
- mark commands as current only when they exist in `package.json`, `bin/openkit.js`, `.opencode/workflow-state.js`, or checked-in runtime command surfaces
- label future commands as illustrative or planned until implemented
- record evidence with the appropriate surface label: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or `target_project_app`

## Common Confusions

- `openkit doctor` is not a replacement for `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js show` is not the preferred first command for operators
- `/task` chooses the lane; it does not replace install or launch commands
- `/browser-verify`, `/start-work`, `/handoff`, `/stop-continuation`, and `/refactor` are runtime/product ergonomics; they do not mutate workflow approvals or completion state by themselves
- `openkit install` and `openkit install-global` are manual or compatibility setup paths, not the preferred operator onboarding path
- OpenKit runtime commands do not prove target-project app build, lint, or test behavior unless that project declares the relevant commands
- missing target-project build, lint, or test commands should be recorded as unavailable `target_project_app` validation, not replaced by `openkit doctor` or workflow-state checks
- `resume-summary --json` is the compatibility-runtime read model to inspect validation surface labels, diagnostic command labels, active work item, linked artifacts, issue telemetry, and verification readiness without parsing raw state manually

## Capability Status Vocabulary

Use these labels when documenting command or tool reality:

| State | Meaning |
| --- | --- |
| `available` | Implemented and ready in the current environment. |
| `unavailable` | Not usable in the current environment. |
| `degraded` | Running with fallback behavior or reduced scope/accuracy. |
| `preview` | Early or partial surface with visible limitations. |
| `compatibility_only` | Maintainer or compatibility surface, not the preferred operator product path. |
| `not_configured` | Implemented but missing required local configuration/provider settings. |

## Command-Reality Rule

When adding a command to this matrix, verify it exists in `src/cli/index.js`, `.opencode/workflow-state.js`, checked-in command markdown, or package scripts before marking it current. If a command is only a future example, label it illustrative instead of adding it to the current matrix.
