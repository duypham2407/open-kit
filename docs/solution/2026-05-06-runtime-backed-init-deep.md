---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-953
feature_slug: runtime-backed-init-deep
work_item_id: feature-953
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
mode: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Runtime-Backed `/init-deep`

## Baseline Summary

- Root `AGENTS.md` is now project-owned and no longer created as a managed shim by `openkit run`.
- `.opencode/openkit/AGENTS.md` remains the OpenKit-managed compatibility guidance surface.
- Runtime command loading currently exposes command metadata only; there is no execution path for command handlers.
- `/init-deep` exists as builtin command metadata plus markdown contract, but not as runtime-executed code.

## Target Outcome

- Runtime foundation exposes a narrow command executor with a registered handler for `/init-deep`.
- `/init-deep` analyzes factual repository signals and writes a project-first root `AGENTS.md` with an explicit OpenKit workflow overlay.
- Runtime metadata clearly marks `/init-deep` as runtime-backed.
- Context injection fallback to `.opencode/openkit/AGENTS.md` still works when root `AGENTS.md` is absent.

## Preserved Invariants

- Root `AGENTS.md` stays project-owned and commit-safe.
- `.opencode/openkit/AGENTS.md` stays OpenKit-managed compatibility guidance.
- `openkit run` does not recreate root `AGENTS.md` as a shim.
- Validation honesty remains explicit: missing build/lint/test commands stay unavailable.
- Markdown command files remain the human-facing command contracts even when a runtime handler exists.

## Architecture Changes

### 1. Narrow Runtime Command Handler Layer

- Add `src/runtime/commands/handlers/init-deep.js` as the checked-in handler for `/init-deep`.
- Add `src/runtime/commands/command-handlers.js` to register runtime-backed handlers.
- Add `src/runtime/commands/command-executor.js` to execute handlers by command name and return structured results.
- Keep this layer intentionally narrow: it is a runtime-backed command seam, not a full slash-command engine.

### 2. Runtime Metadata Enrichment

- Extend builtin command metadata to record whether a builtin command has a handler.
- Extend loaded command metadata with `runtimeBacked` so tests and tooling can inspect which commands are executable.
- Surface `runtimeCommands` in the runtime interface as the inspectable list of registered runtime-backed handlers.

### 3. `/init-deep` Repository Analysis And Output

- Read `README.md` heading when present.
- Read `package.json` name, description, and scripts when present.
- Detect lightweight package-manager signals from lockfiles.
- Inspect key directories such as `src`, `tests`, `docs`, `commands`, `agents`, `skills`, `context`, and `.opencode`.
- Generate root `AGENTS.md` with sections for project identity, repository signals, important directories, validation commands, working rules, and an OpenKit workflow overlay.
- If repo signals are sparse, emit conservative placeholder wording instead of fabricated specifics.

## Implementation Slices

### [ ] Slice 1: Add runtime command handler infrastructure

- **Files**: `src/runtime/commands/command-executor.js`, `src/runtime/commands/command-handlers.js`, `src/runtime/commands/index.js`, `src/runtime/index.js`, `src/runtime/create-runtime-interface.js`, `src/runtime/commands/builtin-commands.js`, `src/runtime/commands/command-loader.js`.
- **Goal**: expose a narrow executor and runtime metadata for runtime-backed commands.
- **Validation**: `node --test tests/runtime/runtime-bootstrap.test.js tests/runtime/runtime-platform.test.js`.

### [ ] Slice 2: Implement runtime-backed `/init-deep`

- **Files**: `src/runtime/commands/handlers/init-deep.js`, `commands/init-deep.md`.
- **Goal**: analyze repository signals and write a project-first root `AGENTS.md` with OpenKit overlay guidance.
- **Validation**: focused runtime tests for `/init-deep` handler behavior and generated output.

### [ ] Slice 3: Sync docs and current-state guidance

- **Files**: `README.md`, `docs/operator/README.md`, `docs/operations/runbooks/openkit-daily-usage.md`, `docs/kit-internals/01-system-overview.md`, `AGENTS.md`, `context/core/project-config.md` if command reality needs explicit current-state wording.
- **Goal**: document `/init-deep` as runtime-backed, clarify root `AGENTS.md` ownership, and keep path/validation semantics honest.
- **Validation**: `node --test tests/runtime/governance-enforcement.test.js tests/runtime/registry-metadata.test.js`.

### [ ] Slice 4: Cover runtime behavior with tests

- **Files**: `tests/runtime/runtime-platform.test.js`, `tests/runtime/runtime-bootstrap.test.js`, optionally `tests/cli/openkit-cli.test.js` only if command-reality expectations need updates.
- **Goal**: prove executor registration, unknown-command handling, handler execution, generated output, and metadata visibility.
- **Validation**: `node --test tests/runtime/runtime-platform.test.js tests/runtime/runtime-bootstrap.test.js tests/cli/openkit-cli.test.js`.

## Dependency Graph And Parallelization

- `parallel_mode`: `none`.
- Reason: the command executor, handler metadata, docs, and tests all touch the same command reality and should stay aligned in one sequence.
- Order: Slice 1 -> Slice 2 -> Slice 3 -> Slice 4.

## Rollback And Checkpoints

- If the executor layer introduces instability, remove runtime-backed command registration and keep markdown-only behavior.
- If `/init-deep` output is too aggressive or hallucinatory, narrow generation to fewer repository signals and more explicit placeholders.
- Before code review, confirm root `AGENTS.md` generation does not reintroduce shim ownership or symlink behavior.

## Validation Plan

1. `node --test tests/runtime/runtime-bootstrap.test.js`
2. `node --test tests/runtime/runtime-platform.test.js`
3. `node --test tests/cli/openkit-cli.test.js`
4. `node --test tests/runtime/governance-enforcement.test.js tests/runtime/registry-metadata.test.js`

Target-project app validation remains unavailable for this feature because the change is OpenKit runtime/documentation behavior, not target-project application code.

## Review Focus Points

- Runtime-backed command architecture stays intentionally narrow.
- `/init-deep` output is factual and conservative.
- Root `AGENTS.md` remains project-owned.
- Compatibility fallback to `.opencode/openkit/AGENTS.md` remains intact.
- Runtime metadata clearly distinguishes runtime-backed commands from markdown-only command metadata.

## QA Focus Points

- Verify `/init-deep` handler writes a normal root file and returns structured success output.
- Verify missing build/lint/test scripts are reported as unavailable in generated content.
- Verify project signals from `README.md`, `package.json`, and directories appear in output without unsupported claims.
- Verify unknown runtime command execution returns a structured non-success result.
- Verify docs and current-state guidance match shipped runtime behavior.

## Handoff Readiness

- `approach`: pass — narrow runtime-backed command seam plus factual `AGENTS.md` generation.
- `boundaries`: pass — command infrastructure, handler, docs, and tests are named explicitly.
- `execution`: pass — sequential slices keep command reality synchronized.
- `validation`: pass — runtime, CLI, and governance checks cover behavior and docs.
- `risk`: pass — rollback and review focus target command drift, output hallucination, and ownership regressions.
