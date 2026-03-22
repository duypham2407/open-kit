# Full Delivery Parallel-Agent Walkthrough

This example shows one realistic full-delivery feature moving through the implemented task-aware runtime.

Use it as a maintainer/runtime example only. The authoritative contract still lives in `context/core/workflow.md`, `context/core/session-resume.md`, and the checked-in workflow-state CLI help.

## Scenario

- feature request: improve runtime diagnostics and resume visibility for active delivery work
- lane choice: `Full Delivery`
- reason: the work touches runtime behavior, session resume, operator docs, and QA expectations across multiple surfaces
- safety note: quick mode is not used because the change is feature-sized and benefits from explicit artifact and task ownership

## 1. Feature-level intake and planning

The `Master Orchestrator` starts or selects the feature work item:

```bash
node .opencode/workflow-state.js start-task full FEATURE-700 parallel-runtime-rollout "Feature-sized parallel runtime rollout"
```

During `full_plan`, the `Tech Lead Agent` finishes the implementation plan and creates a bounded execution board for non-overlapping tasks such as:

- `TASK-700-A` implementation diagnostics
- `TASK-700-B` resume-hint QA coverage
- `TASK-700-C` docs and operator guidance

The runtime keeps feature-stage ownership at the feature level while letting the task board carry task-local owners.

## 2. Task board setup

The operator or orchestrator inspects the managed work item layer:

```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item feature-700
```

Once the task board exists, the operator can inspect it:

```bash
node .opencode/workflow-state.js list-tasks feature-700
node .opencode/workflow-state.js validate-work-item-board feature-700
```

Important guardrails:

- this task board belongs only to the full-delivery work item
- quick mode still has no task board
- feature-stage ownership remains `FullstackAgent` in `full_implementation` and `QAAgent` in `full_qa`

## 3. Implementation task claims

One developer claims a task:

```bash
node .opencode/workflow-state.js claim-task feature-700 TASK-700-A FullstackAgent-A TechLeadAgent
node .opencode/workflow-state.js set-task-status feature-700 TASK-700-A in_progress
```

Another task is reassigned before work starts:

```bash
node .opencode/workflow-state.js reassign-task feature-700 TASK-700-C FullstackAgent-B TechLeadAgent
node .opencode/workflow-state.js set-task-status feature-700 TASK-700-C in_progress
```

What this means operationally:

- the feature remains in `full_implementation`
- `MasterOrchestrator` still owns feature routing decisions
- each task owner changes only the task they own
- no one uses task commands as permission to advance the feature to `full_qa`

## 4. QA assignment and handoff

When implementation evidence is ready, the runtime can record task-level QA ownership:

```bash
node .opencode/workflow-state.js assign-qa-owner feature-700 TASK-700-A QAAgent-A TechLeadAgent
node .opencode/workflow-state.js set-task-status feature-700 TASK-700-A qa_ready
node .opencode/workflow-state.js set-task-status feature-700 TASK-700-A qa_in_progress
```

The `QA Agent` validates task-scoped evidence but still reports through feature-level QA:

- task-local evidence stays tied to `TASK-700-A`
- feature-level findings still route through `MasterOrchestrator`
- a pure implementation bug may stay local to the task board
- a design flaw or requirement gap sends the feature back to `full_architecture` or `full_spec`

## 5. Resume behavior in a later session

On a fresh session, the checked-in hook and CLI can surface task-aware context:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

In the implemented runtime, operators may now see:

- the active work item id
- a task-board summary such as total, ready, and active tasks
- active task details when work is already in progress

Even then, the runtime stays conservative:

- `doctor` is still the required confidence check before relying on task-aware parallel support
- the active repo-root `.opencode/workflow-state.json` is only the compatibility mirror for the active work item
- the per-item backing files under `.opencode/work-items/` remain the managed source of task-aware execution state

## 6. Why this is still bounded

This runtime does support task-aware full-delivery coordination, but only in the limited ways the current commands and validations enforce.

- It supports one active mirrored work item at a time.
- It supports full-delivery execution task boards.
- It supports task claiming, reassignment, QA assignment, and task-status transitions.
- It does not make quick mode heavier.
- It does not prove arbitrary multi-agent concurrency is safe beyond those explicit guardrails.
