# Prompt Contracts

Use this file to keep shared prompt rules stable across agent and command instruction files.

## Shared Runtime Path Contract

- In globally installed OpenKit sessions, treat `.opencode/openkit/` as the repo-local compatibility surface for OpenKit-owned docs, templates, and workflow tools.
- Read canonical OpenKit docs from `.opencode/openkit/...`, not from repo-root `context/`, repo-root `AGENTS.md`, or repo-root `.opencode/`.
- Use `.opencode/openkit/workflow-state.json` for resumable workflow state in global mode.
- Use `node .opencode/openkit/workflow-state.js <command>` for workflow-state checks in global mode.
- Use the target repository only for application code, project-native validation paths, and project-local docs.

## Shared Guidance Rules

- `context/core/workflow.md` remains the canonical workflow-semantics document.
- `context/core/project-config.md` remains the maintained command-reality document.
- `context/core/session-resume.md` remains the resumable-work guidance document.
- `context/core/runtime-surfaces.md` explains which OpenKit surface should answer which kind of question.
- Do not restate lane law, approval law, or runtime-surface law in every agent or command file when a reference is enough.

## Shared Verification Rule

- Use the strongest real verification path available.
- Do not invent application build, lint, or test commands.
- `openkit doctor` and `node .opencode/workflow-state.js doctor` validate OpenKit surfaces, not arbitrary target application behavior.
