# OpenKit

## 1. Hero

OpenKit is an AI software factory for OpenCode.

It helps OpenCode behave more like a real software team instead of a single chat session:

- route work through the right delivery mode
- split responsibilities across specialized agents
- keep workflow state, approvals, issues, and evidence explicit
- reduce hallucinated completion claims through runtime checks and verification gates

If you remember one command after launch, remember this: start with `/task`.

## 2. Why OpenKit

OpenKit exists to solve common failure modes in AI-assisted software work:

- everything gets treated like the same kind of task
- agents jump into code without enough planning or validation
- completion is declared without enough evidence
- context is lost between sessions
- multi-step work has no shared state, no ownership, and no audit trail

It addresses that with:

- explicit modes for different kinds of work
- role-based handoffs between agents
- file-backed workflow state and per-item storage
- approvals, issue routing, and verification evidence
- operator and maintainer tooling for diagnostics, resume, and governance

## 3. Core Modes

OpenKit has 3 workflow modes.

### Quick

- for bounded, low-risk work
- keeps planning and verification lightweight
- uses the `quick_*` stages
- does not use a task board

### Migration

- for upgrades, migrations, dependency modernization, and compatibility fixes
- preserves behavior first, then migrates safely in stages
- uses the `migration_*` stages
- validates through baseline, parity, and compatibility evidence

### Full

- for feature work and higher-risk changes
- uses product, spec, architecture, planning, implementation, QA, and review handoffs
- uses the `full_*` stages
- can use a task board when the approved plan allows it

## 4. How It Works

```text
User request
   |
   v
/task
   |
   v
Master Orchestrator chooses mode
   |
   +--> Quick ------> bounded implementation -> QA Lite -> done
   |
   +--> Migration --> baseline -> strategy -> upgrade -> code review -> verify -> done
    |
   +--> Full -------> Product Lead -> Solution Lead -> Fullstack -> Code Reviewer -> QA -> done
   |
   v
Workflow state, approvals, issues, and evidence stored in .opencode/
```

At runtime, OpenKit keeps the process explicit through:

- `.opencode/workflow-state.json` as the active compatibility mirror
- `.opencode/work-items/` as the per-item store
- `node .opencode/workflow-state.js ...` for runtime inspection and operations

## 5. Example Flow

Example: you ask OpenKit to add a new feature.

1. You launch OpenKit and start with `/task add export support to the dashboard`.
2. `Master Orchestrator` inspects the request and chooses `Full` mode.
3. `Product Lead` defines the problem, scope, and acceptance expectations.
4. `Solution Lead` defines the technical direction, sequencing, and validation strategy.
5. `Fullstack Agent` implements the approved work and records verification evidence.
6. `Code Reviewer` checks scope compliance first and code quality second.
7. `QA Agent` validates runtime behavior, routes any issues, and the workflow only closes when the gates are satisfied.

For a narrow bugfix, the same entrypoint may route to `Quick`.
For a framework upgrade, it may route to `Migration`.

## 6. Quick Start

### Install

```bash
npm install -g @duypham93/openkit
```

### Verify setup

```bash
openkit doctor
```

### Launch OpenCode with OpenKit

```bash
openkit run
```

### Start work

Inside OpenCode:

```text
/task <your request>
```

Use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious.

If workflow state already exists, these are the fastest runtime views:

```bash
node .opencode/workflow-state.js ops-summary
node .opencode/workflow-state.js resume-summary
node .opencode/workflow-state.js status --short
```

## 7. Concepts

### Orchestrator

`Master Orchestrator` is the delivery router.

It chooses the mode, manages handoffs, tracks feedback loops, and keeps work moving through the right workflow.

### Agents

OpenKit currently ships active orchestration and delivery roles plus compatibility split-role views:

1. **Master Orchestrator**: chooses the mode, routes handoffs, and manages feedback loops
2. **Product Lead**: defines scope, business rules, and acceptance criteria for full delivery
3. **Solution Lead**: defines technical direction, migration strategy, sequencing, and validation expectations
4. **Fullstack Agent**: implements, debugs, and verifies approved work
5. **Code Reviewer**: performs independent scope-compliance and code-quality review before QA
6. **QA Agent**: validates implementation evidence and classifies issues

### Workflow State

Workflow state is the shared runtime memory of the system.

It tracks things like:

- current mode and stage
- current owner
- linked artifacts
- approvals
- issues and issue lifecycle
- verification evidence
- readiness, closeout, and release-level signals

### Approvals And Evidence

OpenKit separates:

- stage readiness
- definition of done
- release readiness

Approvals alone are not enough for closure-sensitive stages. Verification evidence must also be inspectable in workflow state.

## 8. Advanced

### Product vs Compatibility Surfaces

OpenKit has 3 main surfaces:

- product path: `openkit run`, `openkit doctor`, `openkit upgrade`, `openkit uninstall`
- in-session path: `/task`, `/quick-task`, `/migrate`, `/delivery`
- compatibility runtime path: `node .opencode/workflow-state.js ...`

Use the product path for daily use. Use the lower-level runtime CLI for inspection, diagnostics, and maintainer workflows.

### Useful Runtime Commands

Some high-value runtime commands:

- `node .opencode/workflow-state.js resume-summary`
- `node .opencode/workflow-state.js workflow-metrics`
- `node .opencode/workflow-state.js show-dod`
- `node .opencode/workflow-state.js release-readiness`
- `node .opencode/workflow-state.js release-dashboard`
- `node .opencode/workflow-state.js policy-trace`

### Release Workflow

OpenKit now supports release-level governance through:

- release candidates
- release notes drafting and validation
- release gates
- rollback plans
- release-linked hotfixes

### Where To Go Next

- operator path: `docs/operator/README.md`
- surface selection: `docs/operator/surface-contract.md`
- maintainer path: `docs/maintainer/README.md`
- command map: `docs/maintainer/command-matrix.md`
- workflow contract: `context/core/workflow.md`
- runtime command reality: `context/core/project-config.md`
- session resume: `context/core/session-resume.md`
- workflow-state schema: `context/core/workflow-state-schema.md`
- operations runbooks: `docs/operations/README.md`
