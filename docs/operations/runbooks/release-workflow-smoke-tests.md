# Release Workflow Smoke Tests

Use this runbook to smoke-test the release candidate workflow layered over the existing work-item runtime.

## Core Flow

```bash
node .opencode/workflow-state.js create-release-candidate rc-001 "Spring-candidate"
node .opencode/workflow-state.js add-release-work-item rc-001 feature-001
node .opencode/workflow-state.js draft-release-notes rc-001
node .opencode/workflow-state.js validate-release-notes rc-001
node .opencode/workflow-state.js set-release-approval rc-001 qa_to_release approved QAAgent 2026-03-22 "QA passed"
node .opencode/workflow-state.js set-release-approval rc-001 release_to_ship approved ReleaseManager 2026-03-22 "Ship approved"
node .opencode/workflow-state.js record-rollback-plan rc-001 "Rollback-to-previous-tag" ReleaseManager "critical-regression"
node .opencode/workflow-state.js check-release-gates rc-001
node .opencode/workflow-state.js release-dashboard
```

Expected:

- release notes validate successfully
- release gates return success when included work items are closeable and approvals exist
- release dashboard reports at least one release candidate

## Hotfix Flow

```bash
node .opencode/workflow-state.js create-release-candidate rc-hotfix "Hotfix-release"
node .opencode/workflow-state.js start-hotfix rc-hotfix quick TASK-901 hotfix-login "Hotfix-login-issue"
node .opencode/workflow-state.js show-release-candidate rc-hotfix
node .opencode/workflow-state.js validate-hotfix task-901
```

Expected:

- the created work item appears under `hotfix work items`
- hotfix validation reports readiness truthfully based on the linked work item
