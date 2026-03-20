# OpenKit — AI Software Factory

OpenKit is a framework that turns your AI coding assistant (like OpenCode) into a structured, 7-role software development team. It combines OpenAgentsControl-style orchestration concepts with superpowers-style workflow discipline using explicit artifacts, approval gates, and resumable workflow state.

## The 7-Role Team

The kit defines 7 distinct team roles. The Master Orchestrator is one of those roles and also coordinates the rest of the pipeline:

1. **Master Orchestrator**: Routes tasks and classifications.
2. **PM Agent**: Defines product goals and priorities.
3. **BA Agent**: Writes detailed specifications and acceptance criteria.
4. **Architect Agent**: Designs system architecture and technology choices.
5. **Tech Lead Agent**: Enforces standards and creates bite-sized implementation plans.
6. **Fullstack Agent**: Implements the plan using strict TDD.
7. **QA Agent**: Validates implementation against the spec and classifies bugs.

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
- `context/core/workflow.md`: The primary 7-agent workflow.
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

Each major stage produces an artifact under `docs/`:

- `docs/briefs/`: PM product briefs
- `docs/specs/`: BA specs
- `docs/architecture/`: Architect design docs
- `docs/plans/`: Tech Lead implementation plans
- `docs/qa/`: QA reports
- `docs/adr/`: architecture decision records

Templates live in `docs/templates/` and a golden path example lives in `docs/examples/`.

## Usage

You can trigger specific workflows using the following commands:
- `/brainstorm` — Start the design phase with the PM/Architect.
- `/write-plan` — Convert a Spec and Architecture into an Implementation Plan.
- `/execute-plan` — Start building the plan using TDD.

Just type your request in normal language, and the Master Orchestrator will guide you through the pipeline.

Helpful wayfinding docs:

- `context/navigation.md` for context discovery
- `docs/examples/README.md` for the golden path walkthrough
- `docs/briefs/README.md`, `docs/specs/README.md`, `docs/architecture/README.md`, `docs/plans/README.md`, `docs/qa/README.md`, and `docs/adr/README.md` for artifact-specific guidance
- `docs/governance/README.md` and `docs/operations/README.md` for policy and operational support

Workflow-state utility commands:

- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js set-approval <gate> <status> ...`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

## Current Validation Reality

This repository does not yet define a repo-native build, lint, or test command for application code. Agents must not invent stack-specific commands unless the repository later adopts them and documents them in `AGENTS.md` and `context/core/project-config.md`.
