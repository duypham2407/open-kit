# OpenKit — AI Software Factory

OpenKit is a framework that turns your AI coding assistant (like OpenCode) into a structured, 7-role software development team. It enforces workflow discipline, Test-Driven Development (TDD), and systematic problem-solving using composable skills.

## The 7-Role Team

The kit defines 7 distinct agent roles, managed by a Central Orchestrator:

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
- `core/code-quality.md`: The repo's coding standards.
- `core/workflow.md`: The rules of engagement between agents.

## Installation

This kit is designed to work natively with OpenCode.

1. Ensure the `.opencode/opencode.json` is present in your project root.
2. The `hooks/session-start` script runs automatically on session start, loading the `using-skills` meta-skill into the agent's context.

## Usage

You can trigger specific workflows using the following commands:
- `/brainstorm` — Start the design phase with the PM/Architect.
- `/write-plan` — Convert a Spec and Architecture into an Implementation Plan.
- `/execute-plan` — Start building the plan using TDD.

Just type your request in normal language, and the Master Orchestrator will guide you through the pipeline.
