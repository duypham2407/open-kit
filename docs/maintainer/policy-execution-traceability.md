# Policy To Execution Traceability

Use this document when you need to prove where a governance rule lives in docs, runtime, and tests.

## Verification Before Completion

- docs: `src/skills/verification-before-completion/SKILL.md`, `src/context/core/project-config.md`, `src/context/core/workflow-state-schema.md`
- runtime: `src/openkit-runtime/lib/runtime-guidance.js`, `src/openkit-runtime/lib/workflow-state-controller.js`
- tests: `src/openkit-runtime/tests/workflow-state-controller.test.js`, `src/tests/runtime/governance-enforcement.test.js`

## Issue Lifecycle And Escalation

- docs: `src/context/core/workflow-state-schema.md`, `src/context/core/session-resume.md`, `src/context/core/project-config.md`
- runtime: `src/openkit-runtime/lib/workflow-state-controller.js`
- tests: `src/openkit-runtime/tests/workflow-state-controller.test.js`

## Task Board Boundary

- docs: `src/context/core/workflow.md`, `docs/maintainer/parallel-execution-matrix.md`
- runtime: `src/openkit-runtime/lib/workflow-state-controller.js`, `src/openkit-runtime/lib/task-board-rules.js`
- tests: `src/openkit-runtime/tests/workflow-state-controller.test.js`, `src/openkit-runtime/tests/workflow-contract-consistency.test.js`

## Runtime Capability And Validation Surface Labels

- docs: `src/context/core/runtime-surfaces.md`, `src/context/core/project-config.md`, `docs/operator/supported-surfaces.md`, `docs/maintainer/command-matrix.md`, `docs/maintainer/test-matrix.md`
- runtime: `src/runtime/capability-registry.js`, `src/runtime/create-runtime-interface.js`, `src/runtime/create-tools.js`, `src/global/doctor.js`, `src/openkit-runtime/lib/runtime-summary.js`
- tests: `src/tests/runtime/capability-registry.test.js`, `src/tests/runtime/runtime-bootstrap.test.js`, `src/tests/global/doctor.test.js`, `src/openkit-runtime/tests/workflow-state-cli.test.js`

## Conservative Orchestration Visibility

- docs: `src/context/core/workflow.md`, `src/context/core/session-resume.md`, `src/context/core/issue-routing.md`, `docs/maintainer/conditional-parallel-execution-note.md`, `docs/maintainer/parallel-execution-matrix.md`
- runtime: `src/openkit-runtime/lib/workflow-state-controller.js`, `src/openkit-runtime/workflow-state.js`, `src/openkit-runtime/lib/runtime-summary.js`
- tests: `src/openkit-runtime/tests/task-board-rules.test.js`, `src/openkit-runtime/tests/parallel-execution-runtime.test.js`, `src/openkit-runtime/tests/migration-lifecycle.test.js`, `src/openkit-runtime/tests/workflow-state-cli.test.js`

## Release And Definition-Of-Done Layer

- docs: `src/context/core/workflow-state-schema.md`, `src/context/core/project-config.md`, `docs/maintainer/command-matrix.md`
- runtime: `src/openkit-runtime/lib/workflow-state-controller.js`, `src/openkit-runtime/workflow-state.js`
- tests: `src/openkit-runtime/tests/workflow-state-controller.test.js`, `src/openkit-runtime/tests/workflow-state-cli.test.js`

## Release Candidate Governance

- docs: `src/context/core/workflow-state-schema.md`, `src/context/core/project-config.md`, `docs/operations/runbooks/release-workflow-smoke-tests.md`
- runtime: `src/openkit-runtime/lib/release-store.js`, `src/openkit-runtime/lib/workflow-state-controller.js`, `src/openkit-runtime/workflow-state.js`
- tests: `src/openkit-runtime/tests/workflow-state-controller.test.js`, `src/openkit-runtime/tests/workflow-state-cli.test.js`, `src/tests/runtime/governance-enforcement.test.js`
