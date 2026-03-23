---
artifact_type: implementation_plan
version: 1
status: draft
feature_id: FEATURE-005
feature_slug: openkit-global-install-runtime
source_architecture: docs/architecture/2026-03-23-openkit-global-install-runtime.md
owner: TechLeadAgent
approval_gate: tech_lead_to_fullstack
---

# Implementation Plan: OpenKit Global Install Runtime

## Goal

- Convert OpenKit from a repository-local checked-in runtime into a globally installed OpenCode kit that can be enabled with one install command and used across many repositories without copying the kit into each project.

## Dependencies

- Current repository runtime contract in `AGENTS.md`, `context/core/workflow.md`, `context/core/lane-selection.md`, and `context/core/project-config.md`.
- Current repository-local runtime surfaces under `.opencode/`, `agents/`, `skills/`, `commands/`, `context/`, `hooks/`, and `docs/`.
- Install-bundle authoring source under `assets/install-bundle/opencode/`.
- Existing workflow-state runtime tests under `.opencode/tests/`.
- OpenCode global config and profile integration behavior must be confirmed during implementation because the repository does not yet contain a shipped global wrapper path.

## Non-Goals

- Do not redesign quick, migration, or full lane semantics.
- Do not move project output artifacts such as plans, architecture docs, QA docs, or ADRs into global storage.
- Do not assume a remote plugin marketplace or managed package registry unless implementation adds it explicitly.

## Target UX

- Fresh machine install:
  - `npx openkit@latest install-global`
  - `npx openkit@latest doctor`
- Day-to-day usage in any repo:
  - `opencode --profile openkit`
- Existing repo should not need checked-in `agents/`, `skills/`, `commands/`, or `.opencode/` surfaces just to use the kit.

## Proposed Runtime Shape

### Global kit location
- `~/.config/opencode/kits/openkit/` on macOS/Linux
- platform-equivalent OpenCode config root on other systems

### Global workspace state
- `~/.config/opencode/workspaces/<workspace-id>/openkit/`
- contains workflow state, work-item backing store, logs, cache, and per-project install/runtime metadata

### Project-local output only
- workflow-created deliverables still land in the project, such as `docs/plans/`, `docs/architecture/`, `docs/qa/`, and `docs/adr/`

## Tasks

### [ ] Task 1: Define global install architecture and compatibility contract
- Files: `AGENTS.md`, `README.md`, `context/core/project-config.md`, `docs/operations/README.md`, `docs/operations/runbooks/openkit-daily-usage.md`, `context/core/session-resume.md`
- Goal: document the new truth that OpenKit kit code and workspace state move to global OpenCode storage while project artifacts remain local.
- Validation: docs are internally consistent; no file still claims the repository-local checked-in runtime is the only live path once the new architecture lands.
- Notes:
  - explicitly document global install directories and the split between global kit, global workspace state, and project-local artifacts
  - keep a compatibility note for existing repository-local runtime during migration

### [ ] Task 2: Introduce a global OpenKit CLI surface
- Files: new installer/runtime package area, package metadata, launcher scripts, possible `bin/` entrypoints, global manifest templates
- Goal: add product-level commands `install-global`, `doctor`, and `run` that operate without requiring the user to clone this repository into every project.
- Validation: local CLI smoke tests cover install, doctor, help output, and run-command argument handling.
- Notes:
  - `install-global` should install or refresh the global bundle and register the `openkit` profile
  - `doctor` should validate both global install health and current-workspace health
  - `run` should launch OpenCode with the installed `openkit` profile or equivalent resolved config

### [ ] Task 3: Build a managed global bundle from authoring sources
- Files: `assets/install-bundle/opencode/`, new bundle-build script or packaging logic, global manifest/version files
- Goal: create a versioned bundle output that can be installed globally without copying the whole authoring repository into a project.
- Validation: generated bundle contains the expected managed sources and matches the command/agent/skill/context surfaces required by `doctor`.
- Notes:
  - treat `assets/install-bundle/opencode/` as the install source of truth
  - emit a manifest of managed files for later upgrade and uninstall safety

### [ ] Task 4: Replace repository-local bootstrap assumptions with global workspace bootstrap
- Files: workflow-state bootstrap utilities, session-start integration, workspace discovery logic, global state path helpers
- Goal: make first use in a project create or locate workspace state in the global store instead of assuming `.opencode/workflow-state.json` already exists in the project.
- Validation: opening a fresh repo produces a valid empty workspace state with no active work item; `doctor` reports this as healthy.
- Notes:
  - install state must be separate from active workflow state
  - no fake active work item should be created during install
  - workspace id should resolve deterministically from git root or absolute project path

### [ ] Task 5: Migrate workflow-state runtime to support global workspace storage
- Files: workflow-state controller/store modules, path resolution helpers, runtime manifest lookup, tests under `.opencode/tests/`
- Goal: move active state, work items, and backing-store logic from repo-local `.opencode/` assumptions into a workspace-aware global storage layer.
- Validation: all existing runtime semantics still pass under the new store; tests cover workspace bootstrap, state reads/writes, mirror behavior, task boards, and routing profile validation.
- Notes:
  - preserve lane semantics, routing profile checks, artifact signatures, and task-board restrictions
  - keep project artifact path emission relative to the active project root

### [ ] Task 6: Add compatibility adoption path for existing repository-local installs
- Files: installer/adoption logic, migration docs, doctor rules, possible state migration utilities
- Goal: allow existing OpenKit repositories to adopt the new global model without losing work-item state or artifact references.
- Validation: migration tests cover adopting a checked-in `.opencode/` runtime into the global store and preserving active work-item continuity.
- Notes:
  - provide an explicit adoption mode rather than silently overwriting checked-in runtime surfaces
  - keep rollback straightforward by preserving a backup or export path for old state

### [ ] Task 7: Register and validate the OpenCode profile integration
- Files: global profile config templates, launcher wiring, doctor/profile checks
- Goal: make `opencode --profile openkit` a supported path after global installation.
- Validation: profile registration can be inspected; doctor confirms registration; run-path smoke tests succeed.
- Notes:
  - do not assume OpenCode plugin APIs that are not proven; verify the real profile/config surface during implementation
  - if OpenCode profile registration is partial, provide a deterministic fallback run path with clear docs

### [ ] Task 8: Harden doctor, upgrade, and uninstall safety
- Files: global doctor checks, install metadata, managed-file manifest, version markers, upgrade planning docs
- Goal: ensure the global kit can be inspected, upgraded, and eventually removed safely.
- Validation: tests cover reinstall, idempotent install, version refresh, stale global workspace detection, and managed-file integrity.
- Notes:
  - doctor should distinguish global install health from active workspace health
  - upgrade must preserve workspace state and project artifacts
  - uninstall can remain a later command, but managed file tracking must be introduced now

## Validation Strategy

- Unit and integration tests for installer, bundle generation, workspace bootstrap, state store migration, and profile registration.
- Runtime parity tests proving quick, migration, and full semantics remain unchanged after state-store relocation.
- Fresh-machine smoke path:
  - install globally
  - run doctor successfully
  - open a fresh repo
  - start a quick task
  - confirm state lands in global workspace storage and artifacts still emit into the project when requested
- Existing-repo adoption smoke path:
  - adopt a repository that already contains repository-local OpenKit surfaces
  - preserve state and artifact references

## Risks

- OpenCode global profile integration details may differ from the current assumptions and require adapter logic.
- Moving state out of the repository can break existing tests, docs, and resume flows if path resolution is incomplete.
- Backward compatibility with repository-local `.opencode/` installs can become messy without a clear adoption contract.
- Users may expect project-local visibility into state; doctor and docs must explain where global state now lives.

## Rollback Notes

- Keep the current repository-local runtime path operational until the global path is proven and documented.
- Implement global install behind an additive compatibility layer first, then switch docs and defaults only after validation passes.
- Preserve export or backup capability for any repository-local state migrated into global workspace storage.

## Acceptance Criteria

- A user on a fresh machine can install OpenKit globally with one command and validate it with one doctor command.
- A user can enter any project and start using OpenKit without copying the kit into that project.
- Global workspace state is created automatically and remains isolated per project.
- Project-local workflow artifacts still emit into the active repository.
- Lane selection, routing profile validation, artifact signatures, migration behavior, and full-delivery task-board rules remain intact.
- Existing repository-local OpenKit projects have a documented and tested adoption path.
