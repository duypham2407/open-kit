---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-944
feature_slug: harden-syntax-outline-path-resolution
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Harden Syntax Outline Path Resolution

OpenKit should make `tool.syntax-outline` resolve valid project files consistently from both project-relative paths and absolute paths under the active project/repository root, while keeping managed workspace/runtime-state boundaries explicit and continuing to reject real missing files or paths outside allowed roots.

## Goal

- Stop valid project files from being reported as `degraded`, `invalid-path`, or `missing-file` because `tool.syntax-outline` anchored resolution to the wrong root or confused project source paths with managed workspace/runtime-state paths.
- Let Code Reviewer, QA Agent, Fullstack Agent, and Solution Lead rely on structural inspection before falling back to manual file reads.
- Preserve honest failure behavior: real missing files stay missing, outside-root paths stay rejected, unsupported parse/language behavior stays clearly labeled as parse/tool capability status rather than path-resolution failure.

## Target Users

- **Code Reviewer:** needs structural outlines for changed source files during scope compliance and code-quality review.
- **QA Agent:** needs dependable structural inspection when validating runtime tooling behavior and closure evidence.
- **Fullstack Agent:** needs `tool.syntax-outline` to accept paths copied from implementation artifacts, diagnostics, diffs, or runtime tool output.
- **Solution Lead:** needs predictable syntax tooling while designing validation and implementation slices for OpenKit runtime changes.

## Problem Statement

After FEATURE-941 and FEATURE-942, Code Review and QA repeatedly saw `tool.syntax-outline` return degraded `invalid-path` or `missing-file` results for files that existed in the repository. Those false path failures forced manual reads and weakened confidence in the structural-inspection workflow that OpenKit asks agents to prefer. The next hardening step is to make syntax-outline path resolution reliable for valid files under the active project/repository root without broadening parser scope, hiding real missing files, or allowing path traversal outside approved source boundaries.

## In Scope

- Harden `tool.syntax-outline` path resolution for:
  - project-relative paths such as `src/runtime/...` and `./src/runtime/...`;
  - normalized project-relative paths containing safe `.` segments or redundant separators;
  - absolute paths that resolve under the active project/repository root.
- Make the active project/repository source root distinct from:
  - global OpenKit kit/config roots;
  - managed workspace runtime-state roots;
  - compatibility mirrors such as `.opencode/openkit/` when they are not the requested project source path.
- Ensure valid existing files under the active project/repository root are not reported as `invalid-path` or `missing-file` solely because of root-selection or normalization errors.
- Preserve rejection for outside-root paths, unsafe traversal, directories, and real missing files.
- Improve syntax-outline diagnostic/evidence quality so failure summaries distinguish path resolution, missing file, outside-root rejection, unsupported language, parse failure, and unavailable/degraded runtime tooling.
- Include `syntax-context` and `syntax-locate` only if they already share the same path resolver and can receive the fix without expanding scope or changing their feature behavior.

## Out of Scope

- Redesigning parsing, tree-sitter integration, AST extraction, semantic search, import graph, or project graph indexing.
- Adding broad language support or changing unsupported-language semantics.
- Fixing unrelated `syntax-context` or `syntax-locate` behavior beyond adopting the same shared path resolver if that is the narrowest safe change.
- Adding unrelated FEATURE-943 scan-tool work, scan evidence pipeline changes, Semgrep changes, or security/quality rule changes.
- Treating managed runtime-state paths or global kit paths as source roots by default.
- Masking real missing files by silently falling back to other roots until any same-named file is found.
- Allowing paths outside approved roots through `..`, symlinks, environment expansion, drive-letter tricks, or compatibility-root confusion.
- Adding or claiming target-project application build, lint, test, smoke, or regression commands that the target project does not define.

## Users And User Journeys

1. **As a Code Reviewer, I want to request `tool.syntax-outline` for changed files using either repository-relative paths or absolute paths, so that I can inspect code structure before reading full files manually.**
2. **As a QA Agent, I want syntax-outline to report real path failures separately from parser/tool limitations, so that QA evidence can classify failures accurately.**
3. **As a Fullstack Agent, I want paths copied from diagnostics, artifacts, and source-tree references to resolve consistently, so that implementation work can use OpenKit structural tools without avoidable fallback reads.**
4. **As a Solution Lead, I want source roots and managed runtime-state roots to remain explicit, so that the solution can validate the correct project files without weakening OpenKit path-safety boundaries.**

## Main Flows

- **Project-relative source file:** agent requests `tool.syntax-outline` for a file path relative to the active project/repository root; the tool resolves it under that root and returns an outline or an honest non-path parser/tool status.
- **Absolute source file:** agent requests `tool.syntax-outline` for an absolute path that is inside the active project/repository root; the tool accepts it and returns the same path-resolution outcome as the equivalent project-relative path.
- **Compatibility/runtime-state boundary:** agent requests a path that could be confused with managed OpenCode workspace state, global kit state, or project source; the tool uses the explicit source root contract rather than guessing across roots.
- **Invalid or missing path:** agent requests a missing file or outside-root path; the tool rejects or reports missing with enough detail to show the failure is real and not a root-resolution false negative.

## Product And Business Rules

### Path Normalization

- Project-relative and absolute paths that point to the same file under the active project/repository root must resolve to the same canonical source file for syntax-outline purposes.
- Safe normalization may collapse `.` segments and redundant separators before existence checks.
- `..` segments are allowed only when the final canonical path remains inside an approved source root; traversal that escapes an approved root must be rejected.
- File existence must be checked after normalization against the correct source root, not against an incidental working directory, managed workspace state directory, or global kit root.
- The same requested path must not produce different path-resolution outcomes solely because the caller is in Code Review, QA, Solution, or Fullstack context.

### Allowed Roots And Boundary Behavior

- The default allowed source root is the active target project/repository root for the session. For this work item, that repository root is `/Users/duypham/Code/open-kit`.
- Project-local compatibility paths such as `.opencode/openkit/...` are valid only when they are physically inside the active project/repository root and are the requested path; they must not cause fallback into OpenCode home workspace state by inference.
- Managed workspace runtime-state roots and global kit/config roots must remain separate from project source roots. They must not be used as fallback bases for a project-relative syntax-outline request.
- Absolute paths outside the allowed source root must be rejected even if the file exists.
- Symlinked paths must not allow reads outside approved roots after canonical resolution.

### Rejection And Missing-File Behavior

- Real missing files must still report a missing-file outcome.
- Outside-root paths must be rejected with an explicit outside-root or invalid-path reason.
- Directories must not be treated as files with empty outlines.
- Unsupported file extensions or parser limitations must be reported as unsupported/degraded syntax tooling outcomes, not as invalid-path or missing-file outcomes when the file exists.
- The tool must not silently substitute a different file with the same basename from another root.

### Evidence Quality

- Syntax-outline success or failure evidence should identify the requested path, the accepted/resolved source path when safe to disclose, and the reason category for failure.
- Evidence must use the `runtime_tooling` validation-surface label for direct syntax-outline behavior.
- If evidence is stored or read through workflow state, it must be labeled `compatibility_runtime` and must not be confused with direct syntax-tool execution.
- Reports must distinguish direct tool behavior from manual fallback reads used only because the tool is unavailable or fails.
- OpenKit runtime/tooling evidence must not be described as target-project application build, lint, or test validation.

### Compatibility Path-Model Clarity

- The feature must preserve OpenKit's path model: global kit/config root, managed workspace runtime-state root, project compatibility shim, and project source root are separate concepts.
- Documentation or diagnostics touched by this work must describe current behavior factually and must not collapse these roots into one path.
- The fix should make valid source-file structural inspection dependable without giving agents permission to bypass root safety or treat every existing filesystem path as inspectable.

## Acceptance Criteria Matrix

### Valid Project Paths Resolve

- **Given** an existing supported source file under the active project/repository root is requested using a project-relative path, **when** `tool.syntax-outline` runs, **then** the tool does not return `invalid-path` or `missing-file` because of path resolution.
- **Given** the same existing source file is requested using an absolute path under the active project/repository root, **when** `tool.syntax-outline` runs, **then** the path-resolution result matches the project-relative request.
- **Given** a project-relative request uses safe `./` prefixes, `.` segments, or redundant separators, **when** normalization resolves the path inside the active source root, **then** the tool checks the normalized target file rather than failing before existence checks.
- **Given** a file exists under `.opencode/openkit/...` inside the active project/repository root, **when** that exact project-local path is requested, **then** the tool treats it as a project-local file and does not confuse it with an OpenCode home workspace mirror.

### Boundaries And Rejections Stay Safe

- **Given** a requested absolute path points outside the active project/repository root, **when** `tool.syntax-outline` runs, **then** the request is rejected rather than read.
- **Given** a requested project-relative path uses `..` traversal that resolves outside the active source root, **when** `tool.syntax-outline` runs, **then** the request is rejected rather than normalized into an allowed read.
- **Given** a requested path points to a real directory, **when** `tool.syntax-outline` runs, **then** the tool reports that the target is not a file rather than returning an empty successful outline.
- **Given** a requested file does not exist under the allowed source root, **when** `tool.syntax-outline` runs, **then** the tool reports a real missing-file outcome and does not search unrelated roots for a replacement.
- **Given** a symlinked path resolves outside approved roots, **when** `tool.syntax-outline` runs, **then** the tool rejects it as outside the allowed boundary.

### Status And Evidence Are Honest

- **Given** a requested file exists but its language or extension is unsupported, **when** `tool.syntax-outline` runs, **then** the outcome is labeled as unsupported/degraded syntax tooling rather than `invalid-path` or `missing-file`.
- **Given** a parser error occurs for an existing allowed file, **when** `tool.syntax-outline` reports failure, **then** the failure reason identifies parse/tool capability rather than path resolution.
- **Given** Code Reviewer or QA records syntax-outline evidence, **when** the evidence is summarized, **then** it includes the requested path, resolved path or safe root category, direct/substitute/manual distinction where applicable, and the correct validation-surface label.
- **Given** a manual read is used after syntax-outline fails, **when** evidence is reported, **then** the report states that manual read was fallback evidence and does not claim syntax-outline succeeded.

### Scope Boundaries Are Preserved

- **Given** `syntax-context` or `syntax-locate` do not share the syntax-outline path resolver, **when** this feature is implemented, **then** their unrelated behavior is not changed as part of this scope.
- **Given** `syntax-context` or `syntax-locate` do share the same path resolver, **when** the resolver is hardened, **then** any inherited path-resolution improvement must preserve their existing non-path behavior and remain covered by narrow validation.
- **Given** no target-project app-native build, lint, or test command is defined, **when** validation is reported, **then** target-project application validation is marked unavailable rather than replaced by OpenKit runtime-tooling checks.
- **Given** FEATURE-943 scan-tool work is unrelated to path resolution, **when** downstream solution and implementation are planned, **then** scan-tool changes are excluded unless separately routed.

## Edge Cases

- Paths copied with leading `./`, duplicate slashes, trailing whitespace, or mixed relative path forms.
- Project-relative paths that include `.opencode/openkit/...` as project-local compatibility files.
- Absolute paths inside the project root versus similarly named absolute paths in the global kit root or OpenCode workspace state root.
- Requests made while the process current working directory is not the active project/repository root.
- Paths containing `..` that normalize inside the root versus paths that escape the root.
- Symlinks inside the repository that point outside the repository.
- Existing files with unsupported extensions, unsupported tree-sitter languages, or parse errors.
- Directory paths, missing files, deleted files between resolution and read, and files with permission errors.
- Case-sensitivity differences across filesystems where a path differs only by case.

## Error And Failure Cases

- Valid existing files under the active project/repository root still return `invalid-path` or `missing-file` due to root confusion.
- Absolute and project-relative references to the same file produce contradictory path-resolution outcomes.
- The resolver falls back from project source into managed workspace runtime state or global kit roots and reads an unintended file.
- Outside-root traversal, symlink escape, or absolute outside-root paths are accepted.
- Real missing files are hidden by searching alternate roots for same-named files.
- Unsupported-language or parse failures are reported as path failures.
- Review/QA evidence claims syntax-outline succeeded when the evidence actually came from manual read fallback.
- OpenKit runtime/tooling checks are reported as target-project application validation.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate direct `tool.syntax-outline` behavior for project-relative paths, absolute in-root paths, safe normalization, real missing files, outside-root rejection, directory rejection, unsupported-language distinction, parser-failure distinction where feasible, and no false `invalid-path`/`missing-file` for existing allowed files. |
| `compatibility_runtime` | If workflow evidence is recorded or inspected, validate stored evidence preserves direct/substitute/manual distinctions, correct reason categories, artifact references, and `compatibility_runtime` labels without claiming direct tool execution. |
| `documentation` | If operator, maintainer, runtime-surface, or tool docs are updated, validate they describe the project root vs global kit root vs managed workspace/runtime-state root model accurately and do not claim unrelated parser, scan, or app-validation capabilities. |
| `global_cli` / package verification | If packaging or global install surfaces are touched, validate the shipped/global OpenKit package includes the hardened syntax-outline path behavior and does not drift from the checked-in authoring runtime. |
| `target_project_app` | Unavailable unless a target project defines real app-native build, lint, test, smoke, or regression commands; syntax-outline/runtime validation must not be reported as target application validation. |

## Open Questions And Assumptions

- Assumption: the primary defect is path resolution/root selection, not parser coverage or syntax-outline output richness.
- Assumption: the active source root for this work item is `/Users/duypham/Code/open-kit`; downstream design should still keep root derivation environment-aware rather than hard-coding that path.
- Assumption: `syntax-context` and `syntax-locate` are out of scope unless they share the resolver and inherit a narrow path-resolution fix without behavior redesign.
- Risk: global OpenKit sessions and checked-in authoring sessions may derive roots differently; Solution Lead should make root-source selection explicit in validation.
- Risk: canonicalizing symlinks or compatibility mirror paths can accidentally broaden or over-restrict access if allowed roots are not stated clearly.
- Open question for Solution Lead: determine the exact test harness and representative fixture files that prove valid project-relative and absolute in-root requests without introducing target-project app validation claims.

## Handoff Notes For Solution Lead

- Keep the solution centered on syntax-outline path resolution and root-boundary behavior; do not design parser, scan-tool, semantic-search, or broad syntax-tool rewrites.
- Define the accepted root source(s), root precedence, and rejection behavior before implementation so Fullstack can validate both positive and negative path cases.
- Include negative validation for outside-root traversal, symlink escape, real missing files, and managed workspace/global kit root confusion.
- Include positive validation for at least one existing project file via both project-relative and absolute in-root paths.
- Preserve validation-surface labeling: direct syntax-tool behavior is `runtime_tooling`; stored workflow evidence is `compatibility_runtime`; target-project app validation remains unavailable unless real app-native commands exist.
- If package/global install surfaces are touched, include package verification to prevent checked-in/runtime behavior drift.
- Do not include unrelated FEATURE-943 scan-tool work.

## Success Signal

- Code Reviewer and QA can call `tool.syntax-outline` on valid project files using project-relative or absolute in-root paths and receive structural output or an honest non-path tool/parser status, while real missing and outside-root paths remain rejected with clear evidence.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/risks, and Solution Lead handoff notes for `product_to_solution` review.
