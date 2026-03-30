# Runtime Surfaces

Use this file to keep the product path, in-session path, and compatibility runtime path distinct.

## Surface Summary

- product path: `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, `openkit uninstall`
- in-session path: `/task`, `/quick-task`, `/migrate`, `/delivery`, and related workflow commands inside OpenCode
- compatibility runtime path: `node .opencode/workflow-state.js ...` for lower-level state inspection and maintainer diagnostics

## Which Questions Each Surface Answers

- product path: is OpenKit installed, healthy, and ready to launch?
- in-session path: which lane should the work follow and what should the team do next?
- compatibility runtime path: what does the workflow state say right now, and is the runtime internally consistent?

## Path Rule

- in globally installed sessions, OpenKit-owned compatibility files live under `.opencode/openkit/`
- in the checked-in authoring repository, the source files live at repo root and the checked-in runtime lives under `.opencode/`
- workflow-state storage may live under the OpenCode home workspace path while the compatibility surface is mirrored into the project-local `.opencode/openkit/` area

## Doctor Split

- `openkit doctor` checks global install and workspace readiness
- `node .opencode/workflow-state.js doctor` checks runtime files, compatibility mirror alignment, state integrity, and task-board validity

## Resume Split

- `openkit doctor` is the right answer before launch
- `node .opencode/workflow-state.js resume-summary` is the right answer once workflow state already exists and you need the next safe action

## Runtime Depth

- session tooling: runtime session history, targeted session search, and resumability analysis live in the additive runtime layer
- continuation tooling: start, handoff, stop, and status are runtime controls only; they do not approve gates or advance workflow stages
- browser verification: `/browser-verify` and browser-oriented runtime tools plan verification and evidence capture, but they do not declare QA complete
- LSP, AST, and safer-edit tooling are additive execution aids; they must stay honest about degraded or preview-only status when full external dependencies are unavailable
