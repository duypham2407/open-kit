---
description: "Analyze the current project deeply and refresh project-first AGENTS guidance without losing OpenKit workflow rules."
---

# Command: `/init-deep`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when exploring repository code or runtime surfaces.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` to keep repository setup and workflow setup separate.

## Purpose

Use this command to analyze the current repository deeply, then scaffold or refresh repository guidance surfaces with a project-first `AGENTS.md` while preserving OpenKit workflow semantics.

Execution priority:

- Treat `/init-deep` as a repository-analysis command, not as a lane-selection command.
- Do not ask the user to choose between `Quick Task`, `Migration`, or `Full Delivery` before running `/init-deep`.
- Do not reroute `/init-deep` through `/task` or any lane chooser just because the repository documents three runtime modes.
- Only stop to ask for clarification when a hard blocker prevents repository analysis, such as a missing project root, unreadable runtime state, or multiple plausible repository roots.

Runtime note:

- `/init-deep` is now backed by a checked-in runtime handler for deterministic repository analysis and root `AGENTS.md` refresh behavior.
- Keep this markdown file as the human-facing contract for what the runtime-backed command must preserve.
- To execute `/init-deep` deterministically in the active session, first call `tool.command-runner` with `{ command: '/init-deep' }` and use that structured result as the authoritative runtime execution outcome.

## Required analysis

- Invoke `tool.command-runner` with `{ command: '/init-deep' }` as the first execution step before any workflow interpretation or completion claim; do not treat the slash-command markdown surface alone as proof that the runtime-backed command ran.
- Inspect the current repository purpose, active code paths, key directories, stack markers, validation commands, and architectural conventions before editing guidance files.
- Distinguish current reality from planned or historical direction; do not present roadmap notes as active project facts.
- Treat the repository root `AGENTS.md` as the project-owned briefing document that should be safe to commit to git.
- Treat `.opencode/openkit/AGENTS.md` as the managed OpenKit compatibility surface for kit-owned workflow guidance.

## Rejection behavior

- Do not reject `/init-deep` because lane choice is ambiguous; ambiguity about workflow mode is not a blocker for repository analysis.
- If the active session already has workflow state, read it as context only; do not require the user to reconfirm mode just to refresh repository guidance.
- If deeper workflow work is needed after `/init-deep`, that handoff happens after repository analysis and `AGENTS.md` refresh, not before.

## AGENTS.md update contract

- Update root `AGENTS.md` so it describes the current project first: purpose, stack, important directories, validation commands, conventions, and constraints.
- Preserve or refresh the OpenKit overlay in root `AGENTS.md`: source-of-truth order, workflow lane semantics, path-model cautions, and workflow safety rules.
- Do not replace a project-specific root `AGENTS.md` with a kit-only document.
- When useful project-specific guidance already exists, preserve it explicitly instead of silently discarding it.
- Do not convert root `AGENTS.md` into a symlink target or runtime-only shim.
- If project facts are missing, record the uncertainty explicitly instead of inventing details.

## Output expectations

- Keep workflow lane semantics unchanged.
- Keep the distinction explicit between project-owned guidance and OpenKit-managed compatibility surfaces.
- Prefer targeted updates over wholesale rewrites when the existing project guidance is already useful.
