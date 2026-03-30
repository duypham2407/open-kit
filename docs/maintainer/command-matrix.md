# Command Matrix

Use this matrix when you are unsure which OpenKit command surface owns a task.

## Operator And Maintainer Matrix

| Goal | Audience | Preferred command |
| --- | --- | --- |
| launch OpenCode with OpenKit | operator | `openkit run` |
| inspect install and workspace readiness | operator | `openkit doctor` |
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

## Decision Rules

- if the task is about launching, onboarding, install health, or global kit lifecycle, use `openkit ...`
- if the task is about choosing or driving a workflow lane inside OpenCode, use slash commands
- if the task is about workflow-state internals, compatibility mirrors, task boards, or maintainer diagnostics, use `node .opencode/workflow-state.js ...`

## Common Confusions

- `openkit doctor` is not a replacement for `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js show` is not the preferred first command for operators
- `/task` chooses the lane; it does not replace install or launch commands
- `/browser-verify`, `/start-work`, `/handoff`, `/stop-continuation`, and `/refactor` are runtime/product ergonomics; they do not mutate workflow approvals or completion state by themselves
