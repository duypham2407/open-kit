---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-953
feature_slug: runtime-backed-init-deep
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Runtime-Backed `/init-deep`

OpenKit should promote `/init-deep` from a prompt-only command surface into a real runtime-backed command that analyzes the active repository and refreshes a project-owned root `AGENTS.md` while preserving the OpenKit workflow overlay under `.opencode/openkit/AGENTS.md`.

## Goal

- Make `/init-deep` a concrete runtime capability instead of a markdown-only instruction surface.
- Keep root `AGENTS.md` project-owned, commit-safe, and centered on the current repository rather than the managed OpenKit shim.
- Preserve OpenKit workflow law, path-model clarity, and compatibility guidance without reintroducing root-level symlink ownership.

## Target Users

- **Operator:** wants a dependable command that can bootstrap repository guidance without hand-writing `AGENTS.md` from scratch.
- **Product Lead:** needs a consistent project brief surface before scope and solution work starts in unfamiliar repositories.
- **Solution Lead / Fullstack Agent:** need a factual project-first agent guide that still points to canonical OpenKit workflow docs.
- **Maintainer:** needs deterministic runtime behavior and tests, not just agent prompt interpretation.

## Problem Statement

Today `/init-deep` is listed as a builtin runtime command but behaves only as a prompt-template markdown file. That makes it non-deterministic, hard to test, and too dependent on model interpretation. Separately, root `AGENTS.md` used to be runtime-managed and symlink-shaped, which conflicted with the need for a commit-safe project briefing document. OpenKit now preserves root `AGENTS.md` as project-owned, but it still lacks a real runtime command that can generate or refresh that document from repository facts.

## In Scope

- Add runtime-backed command infrastructure sufficient for `/init-deep` to execute through checked-in code.
- Register `/init-deep` as a runtime-backed command while keeping its markdown contract available as the human-facing instruction surface.
- Analyze current project signals such as `README.md`, `package.json`, key directories, and validation scripts.
- Generate or refresh root `AGENTS.md` with project-first content plus an OpenKit workflow overlay.
- Preserve `.opencode/openkit/AGENTS.md` as the OpenKit-managed compatibility guidance surface.
- Expose enough runtime metadata to inspect that `/init-deep` is now runtime-backed.
- Add tests and docs that keep the new behavior explicit.

## Out of Scope

- Converting every slash command into a runtime-backed command.
- Replacing lane orchestration with direct command-side workflow mutation.
- Auto-running `/init-deep` during `openkit run`.
- Designing a full repository-domain inference system or semantic summarizer.
- Writing target-project business/domain knowledge that is absent from repository signals.
- Reintroducing root `AGENTS.md` symlink creation or runtime ownership.

## Users And User Journeys

1. **As an operator, I want `/init-deep` to create a usable root `AGENTS.md` from current repository facts, so that the repo gets a project-first agent briefing I can commit.**
2. **As a maintainer, I want `/init-deep` to run through tested runtime code, so that behavior is inspectable and not left to prompt drift.**
3. **As a Solution Lead, I want generated `AGENTS.md` output to preserve OpenKit workflow overlay guidance, so that project context does not erase source-of-truth workflow rules.**
4. **As a Fullstack Agent, I want the runtime foundation to advertise which commands are actually runtime-backed, so that I can distinguish command metadata from executable handlers.**

## Main Flows

- **Runtime-backed refresh:** runtime foundation boots, `/init-deep` resolves to a checked-in handler, the handler inspects repository signals, and root `AGENTS.md` is written with project-first content plus OpenKit overlay guidance.
- **Project-owned root guide:** after refresh, root `AGENTS.md` exists as a normal file in the project root and can be committed to git.
- **Compatibility fallback:** when root `AGENTS.md` is absent, runtime context injection can still use `.opencode/openkit/AGENTS.md` as compatibility guidance.
- **Inspection:** runtime metadata exposes that `/init-deep` is runtime-backed so maintainers and tests can verify the distinction.

## Product And Business Rules

### Runtime Command Reality

- `/init-deep` must remain listed as a builtin command surface, but it must also have a real checked-in runtime handler.
- Runtime-backed command behavior must be inspectable through runtime metadata or direct execution in tests.
- Unknown commands must continue to fail honestly rather than pretending every command has a runtime executor.

### Root `AGENTS.md` Ownership

- Root `AGENTS.md` must remain project-owned and commit-safe.
- `openkit run` must not recreate root `AGENTS.md` as a managed shim or symlink.
- `.opencode/openkit/AGENTS.md` remains the OpenKit-managed compatibility surface and must not be overwritten by the project-owned guide.

### Project Analysis And Output

- `/init-deep` should analyze factual repository signals only, such as `README.md`, package metadata, known directories, and declared scripts.
- If validation commands are not declared, the output must say they are unavailable rather than inventing them.
- The generated root `AGENTS.md` must describe the project first, then preserve an explicit OpenKit workflow overlay section.
- The generated content must not claim target-project app validation from OpenKit runtime checks.

### Workflow And Role Boundaries

- This feature must not let `Master Orchestrator` author scope or solution artifacts outside the normal full-lane ownership model.
- Runtime-backed `/init-deep` is a repository-guidance helper, not a workflow-lane override or approval shortcut.
- OpenKit path-model distinctions must stay explicit in generated output and docs.

## Acceptance Criteria Matrix

### Runtime-Backed Command Exists

- **Given** the runtime foundation boots successfully, **when** command metadata is inspected, **then** `/init-deep` is marked as runtime-backed rather than markdown-only metadata.
- **Given** a caller invokes the runtime command executor for `/init-deep`, **when** the command is known, **then** the executor returns a structured success result and writes the expected root `AGENTS.md` output.
- **Given** a caller invokes an unknown runtime-backed command name, **when** no handler exists, **then** the executor returns an honest unknown-command result.

### Root Guide Becomes Project-Owned Output

- **Given** a repository with no root `AGENTS.md`, **when** `/init-deep` runs, **then** it creates a normal root file rather than a symlink or runtime shim.
- **Given** the generated root `AGENTS.md`, **when** it is read, **then** it contains project-first sections derived from repository signals and an explicit OpenKit workflow overlay section.
- **Given** `.opencode/openkit/AGENTS.md` exists, **when** `/init-deep` runs, **then** the compatibility guide remains separate from the root generated guide.

### Validation And Honesty Stay Explicit

- **Given** the repository has no native build, lint, or test scripts, **when** `/init-deep` generates root `AGENTS.md`, **then** it records those validation paths as unavailable.
- **Given** package metadata and readme signals exist, **when** `/init-deep` generates root `AGENTS.md`, **then** those signals appear factually without inventing unsupported frameworks or CI flows.
- **Given** runtime or docs reference the new behavior, **when** validation runs, **then** runtime-backed command behavior is labeled `runtime_tooling` and docs do not present it as target-project app validation.

## Edge Cases

- Repository has `README.md` but no `package.json`.
- Repository has `package.json` but no `README.md` heading.
- Repository has no build/lint/test scripts.
- Repository already has `.opencode/openkit/AGENTS.md` but no root `AGENTS.md`.
- Repository uses `pnpm`, `yarn`, `bun`, or `npm` lockfile signals.
- Unknown runtime command name is passed to the executor.

## Error And Failure Cases

- `/init-deep` remains listed as builtin but still has no handler.
- Root `AGENTS.md` is regenerated as a symlink or runtime-owned shim.
- Generated content omits OpenKit workflow overlay guidance.
- Generated content invents app validation commands or unsupported stack details.
- Runtime metadata cannot distinguish runtime-backed commands from markdown-only commands.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate runtime command executor behavior, handler registration, `/init-deep` execution, structured results, and generated `AGENTS.md` output. |
| `documentation` | Validate docs and command markdown describe project-owned root guidance, OpenKit compatibility guidance, and runtime-backed `/init-deep` behavior accurately. |
| `compatibility_runtime` | Validate fallback behavior still uses `.opencode/openkit/AGENTS.md` when root `AGENTS.md` is absent. |
| `target_project_app` | Unavailable unless a target repository defines real app-native commands; `/init-deep` output must not claim otherwise. |

## Open Questions And Assumptions

- Assumption: a lightweight runtime-backed command framework for one command is enough for this feature and does not require a general slash-command execution engine yet.
- Assumption: root `AGENTS.md` generation can start from repository signals plus conservative fallback text, then be refined manually by maintainers.
- Risk: generated project summaries may be too generic if repository metadata is sparse; output must acknowledge incompleteness rather than hallucinate.
- Risk: future commands may want runtime-backed handlers too, so the handler/executor structure should not block incremental expansion.

## Handoff Notes For Solution Lead

- Keep the runtime-backed command architecture narrow: enough for `/init-deep`, not a speculative general command platform rewrite.
- Preserve the separation between markdown command contracts and runtime command handlers.
- Keep root `AGENTS.md` generation conservative and factual.
- Ensure tests prove both metadata-level and execution-level behavior.
- Sync docs and current-state guidance where command reality changes.

## Success Signal

- OpenKit can execute `/init-deep` through checked-in runtime code, produce a commit-safe project-owned root `AGENTS.md`, preserve OpenKit compatibility guidance separately, and prove the behavior through automated tests and runtime metadata.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the runtime command, ownership, boundaries, acceptance criteria, risks, validation surfaces, and handoff focus required for Solution Lead design.
