# OpenKit — AI Software Factory

OpenKit is a workflow kit that turns your AI coding assistant into a mode-aware software team. It combines OpenAgentsControl-style orchestration concepts with superpowers-style workflow discipline using explicit artifacts, approval gates, and resumable workflow state.

## Two Workflow Lanes

OpenKit now uses a hard split between two lanes:

1. **Quick Task**: For narrow, low-risk daily tasks that should move fast.
2. **Full Delivery**: For feature work and higher-risk changes that benefit from the full multi-role team flow.

`MasterOrchestrator` chooses the lane, records the decision in workflow state, and routes the work.

## The 7-Role Team

The full-delivery lane uses 7 distinct team roles:

1. **Master Orchestrator**: Routes work, chooses the lane, and manages feedback loops.
2. **PM Agent**: Defines product goals and priorities.
3. **BA Agent**: Writes detailed specifications and acceptance criteria.
4. **Architect Agent**: Designs system architecture and technology choices.
5. **Tech Lead Agent**: Enforces standards and creates bite-sized implementation plans.
6. **Fullstack Agent**: Implements approved work.
7. **QA Agent**: Validates implementation and classifies issues.

Quick tasks use a smaller contract: `Master -> Fullstack -> QA Lite -> Done`.

## Workflow & Skills

Agents use a library of **Skills** (standard operating procedures) to accomplish their tasks without relying purely on LLM instinct:

- `brainstorming`: Socratic design refinement.
- `writing-specs`: Converting vague ideas into BDD acceptance criteria.
- `writing-plans`: Creating bite-sized, atomic task plans.
- `test-driven-development`: The RED-GREEN-REFACTOR iron law.
- `subagent-driven-development`: Dispatching fresh subagents for execution.
- `systematic-debugging`: A 4-phase root cause analysis process.
- `code-review`: Two-stage review (compliance, then quality).

## Context System

Context is loaded dynamically based on the current phase, anchored by `context/navigation.md`. Critical contexts include:
- `context/core/code-quality.md`: The repo's coding standards.
- `context/core/workflow.md`: The hard-split Quick Task and Full Delivery workflow contract.
- `context/core/approval-gates.md`: Approval recording rules for stage transitions.
- `context/core/issue-routing.md`: QA issue classification and ownership routing.
- `context/core/session-resume.md`: Resume protocol for fresh sessions.

## Installation

This kit is designed to work natively with OpenCode.

1. Ensure `.opencode/opencode.json` is present in the project root.
2. Ensure `.opencode/workflow-state.json` is present so sessions can resume from explicit state.
3. The `hooks/session-start` script runs automatically on session start, loading the `using-skills` meta-skill into the agent's context.

The default manifest currently carries a starter model value inherited from the existing repo setup. Treat that as a default, not as a statement that the kit only supports one model.

## Artifact Model

Artifacts depend on the active lane.

Quick-task artifact:

- `docs/tasks/`: lightweight quick-task cards when traceability beyond workflow state is useful

Full-delivery artifacts:

- `docs/briefs/`: PM product briefs
- `docs/specs/`: BA specs
- `docs/architecture/`: Architect design docs
- `docs/plans/`: Tech Lead implementation plans
- `docs/qa/`: QA reports
- `docs/adr/`: architecture decision records

Templates live in `docs/templates/` and examples live in `docs/examples/`.

## Usage

You can trigger workflows with the following commands:

- `/task` — Default entrypoint; Master chooses `Quick Task` or `Full Delivery`
- `/quick-task` — Explicit quick lane for small, localized work
- `/delivery` — Explicit full-delivery lane for feature work and higher-risk changes
- `/brainstorm` — Full-delivery only; explore product or design direction
- `/write-plan` — Full-delivery only; convert Spec and Architecture into an Implementation Plan
- `/execute-plan` — Full-delivery only; start building the approved plan

You can also type your request in normal language, and `MasterOrchestrator` will choose the appropriate lane.

Helpful wayfinding docs:

- `context/navigation.md` for context discovery
- `docs/examples/README.md` for quick-task and full-delivery walkthroughs
- `docs/briefs/README.md`, `docs/specs/README.md`, `docs/architecture/README.md`, `docs/plans/README.md`, `docs/qa/README.md`, and `docs/adr/README.md` for artifact-specific guidance
- `docs/governance/README.md` and `docs/operations/README.md` for policy and operational support

Workflow-state utility commands:

- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js set-approval <gate> <status> ...`
- `node .opencode/workflow-state.js link-artifact <kind> <path>`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

## Current Validation Reality

This repository does not yet define a repo-native build, lint, or test command for application code. Agents must not invent stack-specific commands unless the repository later adopts them and documents them in `AGENTS.md` and `context/core/project-config.md`.
