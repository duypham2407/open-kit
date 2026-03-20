# Project Configuration & Tooling Standards

This file defines the current execution reality for the repository. Agents must use documented commands when they exist and explicitly report when they do not.

## Current State

- There is no repo-native build command for generated application code yet.
- There is no repo-native lint command for generated application code yet.
- There is no repo-native test command for generated application code yet.
- There is no single canonical package manager or language toolchain for future applications yet.

## Commands That Do Exist

- Session hook configuration lives in `hooks/hooks.json`.
- The session-start hook script lives in `hooks/session-start`.
- The OpenCode kit manifest lives in `.opencode/opencode.json`.
- The persisted workflow state lives in `.opencode/workflow-state.json`.

## Future Update Rule

When this repository adopts a real application stack, update both this file and `AGENTS.md` with the exact commands before expecting agents to run them.

## Execution Rules For Agents

1. Use documented commands only.
2. If a command is missing, say so explicitly in the report.
3. Do not substitute guessed commands from a preferred stack.
4. Do not run destructive commands unless the user explicitly requests them.
