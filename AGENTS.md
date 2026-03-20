# Repository Agent Guide

## Purpose

This repository is currently a minimal documentation-first workspace.
Its near-term goal is to become an OpenCode kit shaped by two influences:

- OpenAgents Control as a reference for agent orchestration concepts
- superpowers as a reference for agent workflow discipline and reusable skills

Treat that direction as a planned target, not as an already implemented stack.

## Current State

This repository implements the **OpenKit AI Software Factory**, a framework that orchestrates AI agents into a 7-role software development team.

The kit is structured into several core directories:
- `agents/`: Definitions for the 7 team roles (Master, PM, BA, Architect, Tech Lead, Fullstack, QA) plus helper subagents such as `code-reviewer.md`.
- `skills/`: Composable workflow procedures (TDD, brainstorming, planning, debugging).
- `commands/`: User-facing triggers (`/brainstorm`, `/write-plan`, `/execute-plan`).
- `context/`: Shared intelligence (`navigation.md`, `core/code-quality.md`, `core/workflow.md`).
- `hooks/`: Session bootstrap integration (`session-start`).
- `.opencode/`: Configuration for the OpenCode environment.
- `docs/templates/`: Source-of-truth templates for workflow artifacts.
- `docs/examples/`: End-to-end golden path examples.
- `docs/governance/`: Naming, severity, ADR, and definition-of-done policy.
- `docs/operations/`: Observability and execution logging guidance.

- The original workflow vision is at `docs/ai_software_factory_agents.md`.
- `.opencode/opencode.json` is now present as the runtime manifest for this kit.
- `.opencode/workflow-state.json` is now present as the persisted workflow state file.
- No repo-native build command is currently defined for application code.
- No repo-native lint command is currently defined for application code.
- No repo-native test command is currently defined for application code.
- No `.cursorrules` file was found.
- No `.cursor/rules/` directory was found.
- No `.github/copilot-instructions.md` file was found.

Do not assume package managers, frameworks, CI workflows, test runners, or deployment tooling that are not explicitly added to the repository.

## Planned Direction

The kit foundation is now established. The next phase is to use this team to build an actual application source tree, proving the effectiveness of the:

- explicit orchestration and handoff points between the 7 agent roles
- reusable instructions in the `skills/` directory
- stronger validation loops (Fullstack ↔ QA) before work is considered complete

Until application code lands, test runners and build tooling remain targets rather than current capabilities.

## Source Of Truth Files

Use the following order when deciding what is authoritative:

1. Direct user instructions in the current session
2. Root `AGENTS.md`
3. `context/core/workflow.md` for the current workflow contract
4. `docs/ai_software_factory_agents.md` for original workflow intent and background
5. `docs/superpowers/specs/2026-03-20-openkit-operating-system-design.md` for the current operating-system direction
6. Repository files that actually exist in the working tree

If guidance conflicts with repository state, trust the repository state and update documentation instead of inventing missing pieces.

## Repo Navigation Guidance

- Start by reading `AGENTS.md`, then `context/navigation.md`, then the specific document or code file you need to change.
- Treat `docs/` as the current center of gravity for repository knowledge.
- Verify file existence before referencing paths in plans or instructions.
- Prefer small, targeted edits over broad speculative restructuring.
- When new top-level areas are introduced, add them to this guide.
- If a task is resumable, read `.opencode/workflow-state.json` before proposing next actions.

Because the repository is still minimal, agents should explain assumptions plainly and avoid acting as if hidden infrastructure exists.

## Build, Lint, And Test Commands

Current state:

- No repository-native build command is currently defined for application code.
- No repository-native lint command is currently defined for application code.
- No repository-native test command is currently defined for application code.
- No single canonical package manager or language toolchain has been established for future generated applications.
- Node.js is now a documented runtime dependency for the workflow-state utility only, not for future application code by default.

Rules for agents:

- Do not claim that `npm`, `pnpm`, `bun`, `yarn`, `pytest`, `cargo`, `go test`, or similar commands are available unless supporting files are added.
- When introducing tooling in the future, document the actual command in this file and in `context/core/project-config.md` at the same time.
- If validation is not possible because tooling does not exist yet, say so explicitly in your report.

Future patterns to adopt once tooling exists:

- JavaScript example only: `pnpm build`
- JavaScript example only: `pnpm lint`
- JavaScript example only: `pnpm test`
- Python example only: `pytest`
- Rust example only: `cargo test`

These are illustrative patterns, not current repository commands.

## Workflow Artifacts And State

The operating system layer is file-backed and should stay explicit.

- Runtime manifest: `.opencode/opencode.json`
- Persisted workflow state: `.opencode/workflow-state.json`
- Workflow-state CLI: `node .opencode/workflow-state.js ...`
- Artifact templates: `docs/templates/`
- Golden path examples: `docs/examples/`

Required artifact outputs by stage:

- PM -> `docs/briefs/YYYY-MM-DD-<feature>.md`
- BA -> `docs/specs/YYYY-MM-DD-<feature>.md`
- Architect -> `docs/architecture/YYYY-MM-DD-<feature>.md`
- Tech Lead -> `docs/plans/YYYY-MM-DD-<feature>.md`
- QA -> `docs/qa/YYYY-MM-DD-<feature>.md`
- Architect decisions -> `docs/adr/YYYY-MM-DD-<decision>.md`

## Single-Test Guidance

There is no current repo-native single-test command because no test toolchain is defined yet.

When a test framework is added, document exact single-test commands here. Until then, future maintainers may use patterns like these as references only:

- JavaScript example only: `pnpm test -- --runInBand path/to/test`
- JavaScript example only: `pnpm vitest path/to/test`
- Python example only: `pytest path/to/test.py -k name`
- Rust example only: `cargo test test_name`

Label any such command as an example until the repository adopts that toolchain.

## Code Style And Engineering Standards

These standards are intentionally conservative so they are useful before a full codebase exists.

- **Imports:** Import only what a file uses. Prefer explicit imports over wildcard imports. Keep import groups stable and easy to scan. Remove unused imports in the same change that introduces them.
- **Formatting:** Follow the configured formatter or linter once one exists. Before that, favor readable defaults: consistent indentation and predictable line wrapping. Do not reformat unrelated files just because you touched the repository.
- **Type discipline:** Prefer explicit types, schemas, or contracts when the language supports them. Avoid broad `any`-style escapes unless the surrounding codebase already relies on them and the reason is documented. Make nullability, optional fields, and error cases explicit.
- **Naming:** Use descriptive names that reflect domain intent. Avoid abbreviations unless they are already standard in the repository or ecosystem. Match existing naming patterns before introducing new ones.
- **Function and file scope:** Keep files focused on one primary responsibility. Keep functions small enough that intent is obvious without heavy commentary. Split large or mixed-responsibility work into smaller units when that reduces ambiguity.
- **Error handling:** Fail loudly enough that the next agent can diagnose the issue. Do not swallow errors without recording why that is safe. Return or raise structured errors when the surrounding stack supports it.
- **Tests:** Add or update tests when behavior changes and a test framework exists. If no test framework exists yet, describe the missing validation path in your report. Prefer tests that validate behavior and acceptance criteria rather than implementation trivia.
- **Documentation updates:** Update relevant docs when commands, workflows, assumptions, or architecture change. Keep `AGENTS.md` aligned with the real repository state. Do not leave future agents to infer important decisions from code alone.
- **Avoid hidden assumptions:** State assumptions directly when requirements or tooling are incomplete. Do not claim integrations, services, folders, or automation that are not present. Prefer factual wording over aspirational wording in current-state sections.

## Workflow Expectations

Adapt the workflow in `docs/ai_software_factory_agents.md` to the repository's current scale.

- Plan before coding. Even small changes should have a clear objective, affected files, and validation path.
- Keep responsibilities explicit. Separate product thinking, requirements clarification, design, implementation, and QA feedback when the work is complex enough to benefit.
- Use feedback loops. Implementation is not complete until validation has run or the lack of validation tooling has been called out clearly.
- Do not skip review or validation because a task looks simple.
- Route issues by type: requirement gaps need clarification, design issues need design changes, and bugs need implementation fixes.
- Do not create commits unless the user explicitly asks for them, even if agent-level instructions mention frequent commit opportunities.

In a minimal repository, one agent may perform several roles. Preserve the role boundaries conceptually even when one worker executes multiple steps.

## Cursor And Copilot Rules Status

Current known status:

- `.cursorrules` is absent.
- `.cursor/rules/` is absent.
- `.github/copilot-instructions.md` is absent.

Do not claim editor-specific rule coverage until those files are added.

## Maintenance Instructions

- Update this file when new tooling, directories, workflows, or rule files are introduced.
- Replace example commands with actual commands as soon as the repository adopts a concrete stack.
- Keep the distinction between current state and planned direction obvious.
- Prefer small factual updates over long narrative rewrites.
- If another document becomes authoritative for workflow, name it explicitly here.

## Working Agreement For Future Contributors

- Be accurate first.
- Be explicit about what exists today.
- Be clear about what is planned but not yet implemented.
- Leave the repository easier for the next agent to understand.
