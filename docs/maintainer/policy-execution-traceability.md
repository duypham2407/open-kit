# Policy To Execution Traceability

Use this document when you need to prove where a governance rule lives in docs, runtime, and tests.

## Verification Before Completion

- docs: `skills/verification-before-completion/SKILL.md`, `context/core/project-config.md`, `context/core/workflow-state-schema.md`
- runtime: `.opencode/lib/runtime-guidance.js`, `.opencode/lib/workflow-state-controller.js`
- tests: `.opencode/tests/workflow-state-controller.test.js`, `tests/runtime/governance-enforcement.test.js`

## Issue Lifecycle And Escalation

- docs: `context/core/workflow-state-schema.md`, `context/core/session-resume.md`, `context/core/project-config.md`
- runtime: `.opencode/lib/workflow-state-controller.js`
- tests: `.opencode/tests/workflow-state-controller.test.js`

## Task Board Boundary

- docs: `context/core/workflow.md`, `docs/maintainer/parallel-execution-matrix.md`
- runtime: `.opencode/lib/workflow-state-controller.js`, `.opencode/lib/task-board-rules.js`
- tests: `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-contract-consistency.test.js`

## Release And Definition-Of-Done Layer

- docs: `context/core/workflow-state-schema.md`, `context/core/project-config.md`, `docs/maintainer/command-matrix.md`
- runtime: `.opencode/lib/workflow-state-controller.js`, `.opencode/workflow-state.js`
- tests: `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-state-cli.test.js`

## Release Candidate Governance

- docs: `context/core/workflow-state-schema.md`, `context/core/project-config.md`, `docs/operations/runbooks/release-workflow-smoke-tests.md`
- runtime: `.opencode/lib/release-store.js`, `.opencode/lib/workflow-state-controller.js`, `.opencode/workflow-state.js`
- tests: `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-state-cli.test.js`, `tests/runtime/governance-enforcement.test.js`
