---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-944
feature_slug: harden-syntax-outline-path-resolution
source_scope_package: docs/scope/2026-04-26-harden-syntax-outline-path-resolution.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Harden Syntax Outline Path Resolution

## Source Scope And Approval Context

- Upstream scope: `docs/scope/2026-04-26-harden-syntax-outline-path-resolution.md`.
- Current lane/stage: `full` / `full_solution` for work item `feature-944`.
- Approval context: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact.
- Scope preservation: this solution is limited to syntax tool path resolution/root-boundary hardening. It does not redesign parsing, add language support, alter import graph/semantic search behavior, or include FEATURE-943 scan-tool work.

## Chosen Approach

Add a canonical project-file path resolver and use it in `SyntaxIndexManager.readFile`, then harden the runtime/MCP project-root bootstrap so syntax tools receive the active source root instead of a managed workspace, global kit root, or unresolved `{cwd}` placeholder.

This is enough because `tool.syntax-outline`, `tool.syntax-context`, and `tool.syntax-locate` already funnel single-file reads through `SyntaxIndexManager.readFile`. The main failure mode is root/path resolution before parsing, not outline extraction. The parser should stay unchanged except for narrow error/result wrapping when a parser runtime failure occurs for an existing allowed file.

## Root Cause Hypothesis

- Current syntax tools call `SyntaxIndexManager.readFile`, which uses `resolveProjectPath(this.projectRoot, filePath)` and `isInsideProjectRoot(this.projectRoot, resolvedPath)` from `src/runtime/tools/shared/project-file-utils.js`.
- Those helpers perform lexical `path.resolve`/`path.normalize` checks only. They do not canonicalize the source root or target path, do not reject symlink escapes after realpath resolution, and do not distinguish directories from files.
- The active MCP/runtime context can pass an incorrect source root. During solution investigation, direct `tool.syntax-outline` calls for existing files under `/Users/duypham/Code/open-kit/...` returned `invalid-path`, while workflow-state/runtime context showed a project root shaped like `/Users/duypham/Code/{cwd}`. That strongly suggests an unresolved `{cwd}` placeholder or wrong current-working-directory base can reach runtime bootstrap and make all real repository files appear outside root.
- Existing tests cover a relative success path, unsupported language, `../outside.js`, and a missing file. They do not cover absolute in-root paths, safe `./`/`.` normalization, managed workspace/global root confusion, literal `{cwd}` root inputs, directories, or symlink escape.

## Dependencies

- No new npm dependency is required.
- Existing runtime dependencies remain sufficient: Node.js 18+, `web-tree-sitter`, `tree-sitter-javascript`, and `tree-sitter-typescript`.
- Existing environment variables remain the source of runtime context: `OPENKIT_PROJECT_ROOT`, `OPENKIT_REPOSITORY_ROOT`, `OPENKIT_WORKFLOW_STATE`, `OPENKIT_KIT_ROOT`, and `OPENCODE_HOME`.
- `OPENKIT_WORKFLOW_STATE` and `OPENKIT_KIT_ROOT` are never allowed source roots for syntax file reads; they are runtime-state/config roots only.
- Target-project app validation remains unavailable unless a separate target project defines app-native build/lint/test commands. OpenKit syntax-tool validation is `runtime_tooling`, not `target_project_app`.

## Impacted Surfaces And Exact File Targets

### Primary runtime path resolution

- `src/runtime/tools/shared/project-file-utils.js`
  - Add a canonical file resolver for project-scoped file reads.
  - Preserve existing helpers for other tools unless a narrow additive update is safe.
- `src/runtime/managers/syntax-index-manager.js`
  - Use the canonical resolver in `readFile`.
  - Return clearer path, file-kind, unsupported-language, read, and parse/tool statuses.
- `src/runtime/tools/wrap-tool-execution.js`
  - Update failure classification only if a new non-success status such as `not-file` is introduced; otherwise keep status names that already match failure classification.

### Syntax tool wrappers sharing the resolver

- `src/runtime/tools/syntax/syntax-outline.js`
- `src/runtime/tools/syntax/syntax-context.js`
- `src/runtime/tools/syntax/syntax-locate.js`

These wrappers should remain behaviorally thin. They likely need no direct logic changes because all three share `SyntaxIndexManager.readFile`. Include them in review only to confirm inherited path-resolution behavior is consistent and no unrelated context/locate feature behavior changed.

### Runtime bootstrap and MCP source-root handling

- `src/runtime/index.js`
  - Normalize the active source root once before constructing managers/tools.
- `src/runtime/create-managers.js`
  - Only change if the normalized root or root metadata must be passed into `SyntaxIndexManager`.
- `src/mcp-server/index.js`
  - Harden MCP project-root argument/env parsing, especially literal or path-embedded `{cwd}` placeholder values.
- `src/global/paths.js`
  - Reuse or extend project-root detection only if needed; keep managed workspace root detection separate.
- `src/global/materialize.js`
- `src/capabilities/mcp-catalog.js`
- `.opencode/opencode.json`
  - Touch only if tests prove config-generated `{cwd}` entries must change. Preferred first fix is to make the MCP server robust to the existing placeholder contract rather than broad profile churn.

### Tests

- `tests/runtime/syntax-path-resolution.test.js` (preferred new focused test file)
- `tests/runtime/runtime-platform.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/mcp-server/mcp-server.test.js`
- `tests/global/doctor.test.js` or `tests/cli/run-options.test.js` only if global launch/root env handling changes
- `tests/install/materialize.test.js` only if generated OpenCode config or package materialization changes

## Boundaries And Components

- The active source root for syntax file reads is the runtime `projectRoot` after source-root normalization. In global/worktree sessions this is the launch root: the repository root for normal launches or the selected managed worktree path for worktree launches.
- `OPENKIT_REPOSITORY_ROOT` is lineage/diagnostic context. Do not use it as a fallback for file reads when `OPENKIT_PROJECT_ROOT` is valid, because that would make worktree sessions read stale repository files.
- `OPENKIT_WORKFLOW_STATE` derives `runtimeRoot` for state/database storage and must not become an allowed syntax source root.
- `OPENKIT_KIT_ROOT` points to the global OpenKit kit/config root and must not become an allowed syntax source root for project-relative requests.
- Project-local compatibility paths such as `.opencode/openkit/...` are valid only when requested as files physically inside the active source root. The resolver must not infer a matching OpenCode-home workspace mirror.
- `syntax-context` and `syntax-locate` are in scope only through the shared resolver. Do not change node-selection semantics, locate traversal, output shape beyond additive path metadata, or parser language support.

## Path Normalization Design

Implement one canonical resolver for file reads, preferably in `src/runtime/tools/shared/project-file-utils.js`:

```js
resolveProjectFilePath(projectRoot, requestedPath, {
  allowDirectory: false,
  canonicalize: true,
  cwd: process.cwd(),
} = {})
```

Recommended result shape:

```js
{
  status: 'ok' | 'invalid-path' | 'missing-file' | 'not-file' | 'read-error',
  reason: null | 'empty-path' | 'outside-root' | 'symlink-outside-root' | 'directory' | 'non-regular-file' | 'file-disappeared' | 'permission-denied',
  requestedPath: string,
  normalizedInput: string,
  projectRoot: string,
  canonicalProjectRoot: string,
  resolvedPath: string | null,
  canonicalPath: string | null,
  relativePath: string | null,
  kind: 'file' | 'directory' | 'other' | 'missing' | null,
}
```

Design rules:

1. **Root canonicalization**
   - Resolve and realpath the source root once: `canonicalProjectRoot = fs.realpathSync.native(projectRoot)` when it exists; otherwise fall back to `path.resolve(projectRoot)` with an internal diagnostic.
   - Normalize the runtime `projectRoot` before constructing `SyntaxIndexManager` so every syntax tool sees the same root.
2. **Requested path normalization**
   - Preserve `requestedPath` exactly for diagnostics.
   - Use `requestedPath.trim()` for the normalized input so copied paths with trailing whitespace do not create false missing-file results. If trimming yields empty input, return `invalid-path` with `reason: 'empty-path'`.
   - Collapse safe `.` segments and redundant separators through `path.resolve`/`path.normalize`.
3. **Relative paths**
   - Resolve relative and `./` paths against `canonicalProjectRoot`, not `process.cwd()`, `runtimeRoot`, `OPENKIT_KIT_ROOT`, or the OpenCode workspace state path.
   - Allow `..` only when the final resolved/canonical path remains inside `canonicalProjectRoot`.
4. **Absolute paths**
   - Accept absolute paths only when the normalized/canonical target remains inside `canonicalProjectRoot`.
   - Reject absolute paths outside the source root even if the file exists.
5. **Missing paths**
   - Check lexical inside-root status before existence so `../outside.js` and absolute outside-root paths are rejected as outside-root rather than reported missing.
   - If the normalized target is inside root but does not exist, return `missing-file`; do not search the repository root, managed workspace root, global kit root, or same basenames elsewhere.
6. **Symlinks**
   - For existing targets, use `fs.realpathSync.native(target)` before final boundary checks.
   - Reject any symlink whose canonical target escapes `canonicalProjectRoot` with `status: 'invalid-path'` and `reason: 'symlink-outside-root'`.
   - Accept symlinks only when their canonical target remains inside the active source root.
7. **Directories and non-regular files**
   - Use `fs.statSync`/`lstatSync` to distinguish regular files, directories, and other filesystem nodes.
   - Return `not-file` with `reason: 'directory'` for directories, not an empty successful outline.
   - If `not-file` is added, update `wrapToolExecution` failure classification so it is not logged as a successful invocation.
8. **Case sensitivity**
   - Do not add custom case-folding. Let the host filesystem and `realpath` decide whether a differently cased path exists.

## Runtime Project-Root Normalization Design

Add or reuse a small root-normalization helper before runtime managers are created. A new focused module such as `src/runtime/project-root.js` is acceptable if it keeps root derivation separate from file-level path resolution.

Recommended behavior:

- Input precedence:
  1. explicit CLI `--project-root` value from `src/mcp-server/index.js` when provided and usable;
  2. `env.OPENKIT_PROJECT_ROOT` when provided and usable;
  3. `env.OPENKIT_REPOSITORY_ROOT` only when the explicit/project root is missing, unresolved placeholder-only, or unusable and repository root exists;
  4. `detectProjectRoot(process.cwd())` fallback.
- Placeholder handling:
  - Treat raw `{cwd}` as `process.cwd()`.
  - Treat any path containing a literal `{cwd}` segment as an unresolved placeholder and use `process.cwd()` rather than resolving a fake `/.../{cwd}` directory.
  - After placeholder expansion, call the existing project-root detector so a child current-working-directory can still resolve to the repository root when `.git` or `package.json` is above it.
- Managed/global boundary:
  - Never derive source root from `OPENKIT_WORKFLOW_STATE` or `OPENKIT_KIT_ROOT`.
  - If current working directory is the global kit root or managed workspace runtime root, prefer a valid `OPENKIT_PROJECT_ROOT`/`OPENKIT_REPOSITORY_ROOT`; otherwise report a clear root-resolution problem rather than silently reading kit/runtime-state files.
- Diagnostics:
  - Runtime summaries or syntax path errors should identify the root source category when useful (`env.OPENKIT_PROJECT_ROOT`, `env.OPENKIT_REPOSITORY_ROOT`, `cwd`, `placeholder-expanded`) without exposing unrelated roots as fallback read locations.

## Error And Result Semantics

Keep syntax tool result statuses honest and additive. Do not convert parser/tool limitations into path failures.

| Scenario | Recommended status | Required details |
| --- | --- | --- |
| Empty or non-string path | `invalid-path` | `reason: 'empty-path'`, `requestedPath` |
| Relative traversal resolves outside root | `invalid-path` | `reason: 'outside-root'`, no alternate-root search |
| Absolute path outside root | `invalid-path` | `reason: 'outside-root'`, no file read |
| Symlink canonical target outside root | `invalid-path` | `reason: 'symlink-outside-root'`, no file read |
| Inside-root path does not exist | `missing-file` | normalized `resolvedPath`, `requestedPath`, `reason: 'file-disappeared'` only if race after stat |
| Existing directory | `not-file` | `reason: 'directory'`, `kind: 'directory'` |
| Existing unsupported extension/language | `unsupported-language` | file exists, allowed root, `language: null`, not `invalid-path` |
| Existing allowed file but read permission/race failure | `read-error` or `missing-file` for race | include `reason`, do not throw raw fs errors through MCP |
| Parser runtime unavailable or grammar load fails | `parser-unavailable` or `degraded` | `reason`, `validationSurface: 'runtime_tooling'`, not path failure |
| Parser throws on existing allowed file | `parse-error` | `reason`, `language`, not path failure |
| Successful parse | `ok` | existing outline fields plus safe path metadata |

Recommended syntax result additions:

```js
{
  status,
  filePath,              // preserve existing consumer field; resolved/canonical allowed path when safe
  requestedPath,
  resolvedPath,
  relativePath,
  language,
  validationSurface: 'runtime_tooling',
  reason,
  pathResolution: { /* compact resolver result without unrelated roots */ }
}
```

## Recommended Path

- Execute sequentially.
- Start with failing tests that reproduce the known false `invalid-path` behavior for existing files and the missing negative cases.
- Then implement the shared file resolver and wire it through `SyntaxIndexManager.readFile`.
- Then harden root normalization for MCP/runtime bootstrap so valid files are compared against the active source root.
- Finish with direct runtime tool invocation, package verification, and workflow-state evidence.

## Implementation Slices

### [ ] Slice 1: Path-resolution regression harness

- **Files**:
  - `tests/runtime/syntax-path-resolution.test.js` (create)
  - `tests/runtime/runtime-platform.test.js`
  - `tests/mcp-server/mcp-server.test.js` if MCP root parsing is exported/tested here
- **Goal**: capture the approved positive and negative path behavior before changing resolver code.
- **Dependencies**: approved Product Lead scope only.
- **Test-first expectations**:
  - Add failing tests proving an existing supported file resolves through:
    - `src/sample.js`
    - `./src/sample.js`
    - `src/./sample.js`
    - an absolute path under `projectRoot`
    - a normalized path such as `src/nested/../sample.js`
  - Add failing tests for:
    - unsupported but existing file (`notes.txt` or `README.md`) returns `unsupported-language`;
    - missing inside-root file returns `missing-file`;
    - real directory returns `not-file` or the selected explicit non-file status;
    - relative traversal outside root returns `invalid-path` with outside-root reason;
    - absolute outside-root existing file is rejected;
    - symlink inside root pointing outside root is rejected when symlink creation is supported by the OS.
  - Add a regression for literal `{cwd}` root handling, preferably by testing the new root-normalization helper with a fake cwd and by bootstrapping runtime with an unresolved placeholder if feasible.
- **Validation Command**:
  - `node --test "tests/runtime/syntax-path-resolution.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"` if MCP parsing/root tests are added there
- **Details**:
  - Use temp project roots with explicit fixture files. Do not depend on the developer's checked-out absolute path except for a final runtime smoke.
  - Keep symlink tests skippable or guarded only when the OS/filesystem refuses symlink creation.

### [ ] Slice 2: Canonical project-file resolver and syntax manager adoption

- **Files**:
  - `src/runtime/tools/shared/project-file-utils.js`
  - `src/runtime/managers/syntax-index-manager.js`
  - `src/runtime/tools/wrap-tool-execution.js` only if `not-file` or another new failure status is introduced
  - `tests/runtime/syntax-path-resolution.test.js`
- **Goal**: make syntax single-file reads resolve project-relative and absolute in-root paths consistently while preserving safe rejection and clear statuses.
- **Dependencies**: Slice 1 failing tests.
- **Validation Command**:
  - `node --test "tests/runtime/syntax-path-resolution.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
- **Details**:
  - Prefer an additive helper such as `resolveProjectFilePath` rather than changing the semantics of `resolveProjectPath` for every existing tool at once.
  - `SyntaxIndexManager.readFile` should call the new helper before language resolution.
  - Keep `unsupported-language` after file existence and root validation.
  - Wrap parser initialization/read/parse failures into explicit non-path statuses without changing parser output or adding language support.
  - Keep `getOutline`, `getContext`, and `locateType` behavior unchanged after `parsed.status === 'parsed'`.

### [ ] Slice 3: Runtime/MCP active source-root normalization

- **Files**:
  - `src/runtime/project-root.js` (create if a new helper is clearer than extending existing modules)
  - `src/runtime/index.js`
  - `src/runtime/create-managers.js` only if constructor plumbing changes
  - `src/mcp-server/index.js`
  - `src/global/paths.js` only if existing `detectProjectRoot` must be adjusted/reused
  - `src/global/materialize.js`, `src/capabilities/mcp-catalog.js`, `.opencode/opencode.json` only if generated/static MCP config must change after tests
  - `tests/runtime/runtime-bootstrap.test.js`
  - `tests/mcp-server/mcp-server.test.js`
  - `tests/global/doctor.test.js` or `tests/cli/run-options.test.js` if global launch env behavior changes
- **Goal**: prevent literal placeholders, managed workspace roots, or global kit roots from becoming the syntax source root.
- **Dependencies**: Slice 2 resolver contract.
- **Validation Command**:
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `node --test "tests/global/doctor.test.js"` or `node --test "tests/cli/run-options.test.js"` only if those surfaces are touched
- **Details**:
  - Normalize `projectRoot` before creating managers/tools so syntax, AST, graph, and external tool surfaces at least agree on source-root identity. Do not change runtime-state root derivation.
  - Treat `{cwd}` placeholder leaks as root-normalization issues and resolve them to detected project root from `process.cwd()` rather than a fake `{cwd}` path.
  - Preserve worktree behavior: if `OPENKIT_PROJECT_ROOT` is a valid managed worktree source root, do not fall back to `OPENKIT_REPOSITORY_ROOT`.
  - Keep global kit and managed workspace paths available only as diagnostics/runtime-state paths, never fallback read roots.

### [ ] Slice 4: Integration validation, package verification, and evidence closeout

- **Files**:
  - `package.json` (read-only unless scripts genuinely change)
  - `docs/solution/2026-04-26-harden-syntax-outline-path-resolution.md`
  - `.opencode/workflow-state.json` / managed active work-item state via CLI or `tool.evidence-capture` only
- **Goal**: prove the hardened syntax path behavior end-to-end and record evidence with correct validation-surface labels before Code Review.
- **Dependencies**: Slices 1-3 complete.
- **Validation Command**:
  - `node --test "tests/runtime/syntax-path-resolution.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `npm run verify:runtime-foundation`
  - `npm run verify:install-bundle` if packaging/global config/materialization surfaces changed
  - `npm run verify:all` for final OpenKit integration when the environment can run it
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js status --short`
- **Runtime tool invocation checks**:
  - `tool.syntax-outline({ filePath: 'src/runtime/tools/syntax/syntax-outline.js' })` returns `ok` or an honest non-path parser/tool status, not `invalid-path`/`missing-file`.
  - `tool.syntax-outline({ filePath: '/Users/duypham/Code/open-kit/src/runtime/tools/syntax/syntax-outline.js' })` has the same path-resolution outcome as the project-relative request in this work item.
  - `tool.syntax-outline({ filePath: './src/runtime/tools/syntax/./syntax-outline.js' })` normalizes safely.
  - `tool.syntax-outline({ filePath: 'README.md' })` or another existing unsupported file returns `unsupported-language`, not `invalid-path`/`missing-file`.
  - Missing, directory, outside-root, and symlink-escape requests return the expected failure categories.
- **Evidence expectations**:
  - Record direct syntax-tool behavior as `runtime_tooling` evidence.
  - Record stored workflow evidence as `compatibility_runtime` evidence.
  - Mark `target_project_app` validation unavailable; do not replace it with OpenKit runtime tests.

## Dependency Graph

Critical path:

1. `TASK-F944-PATH-TESTS`
2. `TASK-F944-RESOLVER`
3. `TASK-F944-BOOTSTRAP`
4. `TASK-F944-INTEGRATION`

Why this order:

- The resolver contract must be pinned by tests before implementation.
- Runtime/MCP root normalization depends on the resolver's expected inside/outside-root semantics.
- Direct runtime tool invocation is meaningful only after both file-level and root-level fixes are present.

## Parallelization Assessment

- parallel_mode: `none`
- why: the work changes one shared source-root/path contract used by all syntax tools. Parallel edits across resolver, bootstrap, and tests would risk inconsistent status names, root precedence, or evidence labels.
- safe_parallel_zones: []
- sequential_constraints:
  - `TASK-F944-PATH-TESTS -> TASK-F944-RESOLVER -> TASK-F944-BOOTSTRAP -> TASK-F944-INTEGRATION`
- integration_checkpoint: after `TASK-F944-BOOTSTRAP`, run both relative and absolute in-root `tool.syntax-outline` calls against `src/runtime/tools/syntax/syntax-outline.js` before final package/evidence validation.
- max_active_execution_tracks: 1

## Validation Matrix

The acceptance-to-validation matrix below is the validation matrix for this solution package.

## Acceptance-To-Validation Matrix

| Acceptance target | Implementation proof | Validation path |
| --- | --- | --- |
| Existing supported relative project file does not false-fail path resolution | `resolveProjectFilePath` resolves relative path under canonical source root; `SyntaxIndexManager.readFile` parses or returns non-path parser/tool status | `node --test "tests/runtime/syntax-path-resolution.test.js"`; direct `tool.syntax-outline` relative invocation |
| Existing supported absolute in-root file matches relative request | Absolute path stays inside canonical root and returns same path-resolution category as relative request | `node --test "tests/runtime/syntax-path-resolution.test.js"`; direct absolute `tool.syntax-outline` invocation |
| `./`, `.`, redundant separators, safe `..` normalize inside root | Resolver normalizes before existence/read checks and records requested vs resolved path | `node --test "tests/runtime/syntax-path-resolution.test.js"` |
| Project-local `.opencode/openkit/...` is not confused with workspace mirror | Single-file resolver accepts exact project-local path only if physically inside source root and does not search OpenCode home workspace | Add focused fixture if a supported JS file is created under `.opencode/openkit/`; otherwise verify resolver unit with project-local compatibility path |
| Absolute outside-root and traversal escape rejected | Resolver checks lexical and canonical boundaries before read | `node --test "tests/runtime/syntax-path-resolution.test.js"` |
| Symlink escape rejected | Existing symlink is realpathed and canonical target must remain inside root | `node --test "tests/runtime/syntax-path-resolution.test.js"` with guarded symlink fixture |
| Directory is not treated as empty outline | Resolver returns `not-file` or selected explicit non-file status | `node --test "tests/runtime/syntax-path-resolution.test.js"` |
| Real missing file remains missing | Missing inside-root path returns `missing-file`; no alternate-root search | `node --test "tests/runtime/syntax-path-resolution.test.js"`; existing runtime-platform missing-file test |
| Unsupported existing file is not path failure | File existence/root check happens before language support check; unsupported extension returns `unsupported-language` | `node --test "tests/runtime/runtime-platform.test.js"`; focused unsupported fixture |
| Parser/tool failure is not path failure | Parser init/read/parse failures are caught as `parser-unavailable`, `parse-error`, `read-error`, or degraded tool status | Unit coverage where feasible; code review verifies no raw parser error becomes `invalid-path` |
| Runtime source root stays separate from managed/global roots | Bootstrap/root helper expands `{cwd}`, preserves valid worktree root, and does not derive source root from workflow-state or kit roots | `node --test "tests/runtime/runtime-bootstrap.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"`; global tests if touched |
| Validation-surface labels are honest | Evidence says direct syntax behavior is `runtime_tooling`, stored evidence is `compatibility_runtime`, app validation unavailable | `node .opencode/workflow-state.js validate`; recorded evidence review |

## Validation Plan

Run the strongest targeted OpenKit runtime/tooling validation first, then broader package checks:

1. `node --test "tests/runtime/syntax-path-resolution.test.js"`
2. `node --test "tests/runtime/runtime-platform.test.js"`
3. `node --test "tests/runtime/runtime-bootstrap.test.js"`
4. `node --test "tests/mcp-server/mcp-server.test.js"`
5. If global launch/materialization changed: `node --test "tests/global/doctor.test.js"`, `node --test "tests/cli/run-options.test.js"`, and/or `node --test "tests/install/materialize.test.js"` as applicable.
6. `npm run verify:runtime-foundation`
7. `npm run verify:install-bundle` if package/global config/materialization surfaces changed.
8. `npm run verify:all` for final OpenKit package/runtime regression if the environment supports all required tooling.
9. Direct in-session runtime tool checks for relative, absolute, unsupported, missing, directory, outside-root, and symlink cases.
10. `node .opencode/workflow-state.js validate`
11. Record verification evidence through `tool.evidence-capture` or `node .opencode/workflow-state.js record-verification-evidence ...` with validation-surface details.

Target-project application validation is unavailable for this feature unless a separate target project defines app-native commands. OpenKit runtime/package tests must not be reported as `target_project_app` validation.

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide an evidence note showing:

- The new focused path-resolution tests fail before the fix and pass after the fix.
- Relative and absolute in-root syntax-outline calls for `src/runtime/tools/syntax/syntax-outline.js` no longer return false `invalid-path` or `missing-file`.
- Unsupported existing files return `unsupported-language`.
- Missing, outside-root, directory, and symlink-escape cases remain rejected with explicit reasons.
- Runtime root diagnostics no longer show an unresolved `{cwd}` source root for this repository session.
- `syntax-context` and `syntax-locate` inherited only the shared path-resolution fix and did not receive unrelated behavior changes.
- Package/global validation either passed or exact environmental blockers were recorded.

## Task Board Recommendation

Create a full-delivery task board for `feature-944` only if the active runtime requires board-backed implementation coordination. Keep it sequential with `parallel_mode: none`.

Recommended tasks:

| Task id | Title | Kind | Depends on | Primary artifact refs | Validation |
| --- | --- | --- | --- | --- | --- |
| `TASK-F944-PATH-TESTS` | Add syntax path-resolution regression tests | `implementation` | none | `tests/runtime/syntax-path-resolution.test.js`, `tests/runtime/runtime-platform.test.js` | `node --test "tests/runtime/syntax-path-resolution.test.js"` red first |
| `TASK-F944-RESOLVER` | Add canonical project-file resolver and wire syntax manager | `implementation` | `TASK-F944-PATH-TESTS` | `src/runtime/tools/shared/project-file-utils.js`, `src/runtime/managers/syntax-index-manager.js`, `src/runtime/tools/wrap-tool-execution.js` if needed | `node --test "tests/runtime/syntax-path-resolution.test.js"`; `node --test "tests/runtime/runtime-platform.test.js"` |
| `TASK-F944-BOOTSTRAP` | Normalize runtime/MCP active source root | `implementation` | `TASK-F944-RESOLVER` | `src/runtime/index.js`, `src/runtime/project-root.js`, `src/mcp-server/index.js`, global/config files only if touched | `node --test "tests/runtime/runtime-bootstrap.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"` |
| `TASK-F944-INTEGRATION` | Run runtime/package validation and record evidence | `verification` | `TASK-F944-BOOTSTRAP` | workflow-state evidence via CLI/tool, package/global validation artifacts | targeted tests; `npm run verify:runtime-foundation`; `npm run verify:all` if feasible; `node .opencode/workflow-state.js validate` |

Recommended task-board commands, if a board is created by the runtime owner:

```sh
node .opencode/workflow-state.js set-parallelization none "FEATURE-944 changes the shared syntax path/root contract; execute sequentially to keep resolver semantics, bootstrap root derivation, and evidence labels aligned." "After TASK-F944-BOOTSTRAP, run relative and absolute tool.syntax-outline checks against src/runtime/tools/syntax/syntax-outline.js before final package and workflow-state evidence validation." 1
node .opencode/workflow-state.js create-task feature-944 TASK-F944-PATH-TESTS "Add syntax path-resolution regression tests" implementation
node .opencode/workflow-state.js create-task feature-944 TASK-F944-RESOLVER "Add canonical project-file resolver and wire syntax manager" implementation
node .opencode/workflow-state.js create-task feature-944 TASK-F944-BOOTSTRAP "Normalize runtime and MCP active source root" implementation
node .opencode/workflow-state.js create-task feature-944 TASK-F944-INTEGRATION "Run syntax runtime validation and record evidence" verification
```

Current `create-task` CLI support is minimal and may not encode every dependency or artifact ref above. With `parallel_mode: none`, runtime coordination should keep only one active task at a time, and this solution package remains the authoritative dependency/artifact plan unless a richer board mutation path is used.

## Risks And Trade-offs

- **Shared helper blast radius:** Changing existing `resolveProjectPath` globally could alter AST, codemod, scan, edit, and LSP behavior. Preferred mitigation is an additive syntax/file-read helper first, then optional later adoption by other tools only with separate tests.
- **Root fallback overreach:** Falling back from a valid worktree `OPENKIT_PROJECT_ROOT` to `OPENKIT_REPOSITORY_ROOT` would inspect the wrong source tree. Only use repository root as recovery when project root is absent/unusable/placeholder-leaked.
- **Symlink behavior:** Canonical realpath checks can reject symlink workflows that previously worked if they point outside root. This is intentional per scope; document the reason in result metadata.
- **Placeholder ambiguity:** If `{cwd}` is expanded by OpenCode in some environments and leaked literally in others, tests must cover both exact placeholder and already-expanded normal path cases.
- **Parser unavailable testability:** Simulating web-tree-sitter runtime failure may require narrow dependency injection or a result-factory unit test. Do not redesign parser loading just to force a test; code review should verify parser failures do not masquerade as path failures.
- **Package verification environment:** `npm run verify:all` may depend on local native modules/tooling. If it cannot run, record the exact blocker and run all targeted commands that are available.

## Rollback Notes

- Roll back resolver and syntax manager changes together. Partial rollback can leave tests expecting statuses that runtime no longer returns.
- Roll back runtime/MCP root-normalization changes together with their tests if placeholder handling causes launch regressions.
- If generated/global config files are changed, rerun the matching sync/materialization verification before and after rollback.
- Do not roll back by allowing global kit, managed workspace, or workflow-state roots as fallback source roots.
- Do not roll back by suppressing `invalid-path` or `missing-file` statuses; real missing/outside-root failures must remain visible.
- Do not hand-edit workflow-state JSON for evidence rollback. Use `.opencode/workflow-state.js` or runtime evidence tools.

## Reviewer Focus Points

- Confirm `tool.syntax-outline` no longer reports false `invalid-path`/`missing-file` for existing files under the active source root via relative or absolute paths.
- Confirm outside-root absolute paths, traversal escape, and symlink escape are rejected before read.
- Confirm unsupported existing files are `unsupported-language`, not path failures.
- Confirm directories are not successful empty outlines.
- Confirm root normalization handles `{cwd}` without reading from managed workspace/global kit roots.
- Confirm `OPENKIT_WORKFLOW_STATE` affects runtime-state root only and does not expand allowed file-read roots.
- Confirm worktree sessions keep the worktree as active source root instead of falling back to original repository root.
- Confirm `syntax-context` and `syntax-locate` changed only through the shared resolver.
- Confirm validation evidence labels OpenKit syntax checks as `runtime_tooling`/`compatibility_runtime`, not `target_project_app`.

## QA Focus Points

- Exercise direct `tool.syntax-outline` calls in the active session using both relative and absolute in-root paths.
- Verify unsupported, missing, directory, outside-root, and symlink-escape outcomes with clear reason categories.
- Verify runtime summaries or workflow-state evidence no longer show an unresolved `{cwd}` source root for this repository.
- Verify package/global validation evidence if any launch/materialization files changed.
- Verify target-project app validation remains explicitly unavailable.

## Fullstack Handoff

- Implement in the slice order above and use TDD for runtime/path behavior changes.
- Do not broaden parser coverage, AST extraction, import graph indexing, semantic search, scan tooling, or workflow lane semantics.
- Prefer additive resolver/root helpers over broad mutation of existing shared helpers unless tests prove a broader change is safe.
- Record direct runtime tool evidence and workflow-state evidence before requesting Code Review.
- Do not create commits unless explicitly requested by the user.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: the package provides a single recommended technical path, concrete impacted surfaces, path normalization/error semantics, sequential slices, direct runtime/package/workflow-state validation, conservative task-board guidance, rollback notes, and explicit constraints preserving the approved FEATURE-944 scope.
