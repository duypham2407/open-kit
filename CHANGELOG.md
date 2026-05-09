# Changelog

All notable changes to OpenKit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** `/task` command removed. Users now pick a lane explicitly: `/quick-task`, `/delivery`, or `/migrate`.
- **BREAKING:** `/brainstorm` command removed. Brainstorm is now stage 0 of each lane, owned by the first specialist agent (Quick Agent for quick, Product Lead for full, Solution Lead for migration).
- FSM: `quick_brainstorm` stage removed; brainstorm folded into `quick_plan`.
- `*_intake` stages are now MasterOrchestrator-owned and ephemeral. MO bootstraps state, advances immediately, never blocks for user input.
- Master Orchestrator is now purely procedural: bootstraps state via `tool.bootstrap-workflow` on the first command, dispatches the specialist, routes between stages. MO no longer classifies lanes — the user picks the lane via command choice.

### Added

- `tool.bootstrap-workflow` MCP tool. Creates `workflow-state.json` for a fresh lane; handles archive/conflict on existing workflows.
- `bootstrap` subcommand in `.opencode/workflow-state.js` CLI for shell-friendly bootstrap.
- `kernel.bootstrapWorkflow()` and `kernel.canWriteState()` exposed on the workflow-kernel adapter.
- Brainstorm storage: quick lane writes a 50-100 word summary inline to `state.brainstorm`; full and migration lanes capture brainstorm in scope/migration plan files as Appendix A (discovery notes) and Appendix B (decisions).
- Lane re-check escalation: first specialist agent can ask MO to switch lanes during brainstorm; MO confirms with user before switching.

### Fixed

- "No workflow" error class on fresh global installs. `workflow-state.json` is now created on the first command, not lazily.
- `workspace-shim.js` no longer crashes on dangling symlink when the workspace state file does not yet exist; the mirror is created on the next shim run after MO bootstrap.
- `workflow-kernel.js` `defaultStatePath` always resolves to a writable path, allowing bootstrap to write state on a fresh project.

## [0.5.0] - 2026-05-08

### 🎉 Major Release: Unified State Management Architecture

This release fixes the critical infinite loop bug and implements a production-ready unified state management system.

### Fixed

- **CRITICAL:** `tool.advance-stage` now persists state transitions to disk (Root Cause #1)
  - Agents no longer loop infinitely asking the same questions
  - State survives across tool calls and sessions
  - Workflow progression works correctly
- Session-start hook test assertion updated for new output format
- Runtime platform tests handle null state gracefully during transition period

### Added

**Phase 1: Foundation Layer (197 tests)**
- State Schema v2.0.0 with automatic migration from legacy schemas
- Custom error types: `StateTransitionError`, `GateNotMetError`, `InsufficientAuthorityError`, `StateCorruptionError`
- Unified Transition Engine (FSM) for all 3 workflow lanes (quick, full, migration)
- Unified Gate Registry with 11 gates across all lanes
- Transaction Log with append-only JSONL audit trail

**Phase 2: WorkflowStateManager (83 tests)**
- Single source of truth for all workflow state operations
- Atomic disk writes with write-to-temp-then-rename pattern
- Transaction support with snapshot/rollback
- Dual persistence: primary state + compatibility mirror
- Event emission: `'stage-advanced'`, `'gate-met'`
- Comprehensive error handling for disk I/O failures

**Phase 3: Integration (81 tests)**
- `workflow-kernel.js` delegates to WorkflowStateManager
- `workflow-state-controller.js` syncs to v2 state
- `tool.advance-stage` persists state via WorkflowStateManager
- `tool.set-approval` for unified gate management (24 tests)
- `tool.workflow-state` for state inspection (24 tests)

**MCP Tools:**
- `tool.set-approval` - Set workflow gate approvals
- `tool.workflow-state` - Query workflow state for inspection

**Test Coverage:**
- Phase 1 Foundation: 91 tests
- Phase 2 State Manager: 83 tests
- Phase 3 Integration: 81 tests (23 kernel + 24 set-approval + 24 workflow-state + 10 controller)
- **Total: 255 tests passing, 0 failures**

### Changed

- `workflow-kernel.js` now accepts optional `stateManager` parameter
- `workflow-kernel.js` API expanded with 6 new delegation methods:
  - `advanceStage(targetStage, newOwner, metadata)`
  - `setApproval(gateName, approved, approver, metadata)`
  - `getState()` / `getWorkItem(workItemId)`
  - `recordIssue(issue)` / `resolveIssue(issueId, resolution)`
  - `recordEvidence(evidence)`
- `tool.workflow-state` refactored to use WorkflowStateManager API
- `tool.advance-stage` bridges legacy evidence to new gate system

### Implementation Details

**State Persistence:**
- Primary: `.opencode/work-items/<workItemId>/state.json`
- Mirror: `.opencode/workflow-state.json` (backward compatibility)
- V2 State: `.opencode/v2/work-items/<workItemId>/state.json` (transition)
- Audit Log: `.opencode/work-items/<workItemId>/state-transitions.log`

**Atomic Writes:**
- All state mutations use write-to-temp-then-rename pattern
- Prevents corrupt state files from interrupted writes
- Comprehensive error handling for disk I/O failures

**Root Causes Fixed:**
1. ✅ `tool.advance-stage` never persists state transitions - **FIXED**
2. ⚠️ Dual gate systems (`.approvals.*` vs `.gates.*`) - Partially fixed
3. ✅ No `advanceStage` method on workflow-kernel - **FIXED**
4. ⚠️ Dual approval systems - Partially fixed
5. ✅ Inconsistent state machines - **FIXED** (TransitionEngine)
6. ✅ File writes without validation - **FIXED**
7. ⏳ Master Orchestrator dispatch - Future work
8. ⏳ Context overload - Future work

### Documentation

- Design Spec: `docs/superpowers/specs/2026-05-08-unified-state-management-design.md`
- Implementation Plan: `docs/superpowers/plans/2026-05-08-unified-state-management.md`
- Completion Summary: `docs/superpowers/IMPLEMENTATION-COMPLETE-2026-05-08.md`

### Breaking Changes

None. This release maintains backward compatibility:
- Legacy state files auto-migrate to v2.0.0 schema
- Compatibility mirror maintains old format
- All CLI commands work unchanged
- Existing MCP tools continue to function

### Migration Guide

No migration required. The system automatically:
1. Detects legacy state files
2. Migrates to v2.0.0 schema
3. Maintains compatibility mirror
4. Preserves all existing data

### Known Issues

- During transition period, `workflowKernel` may not have `stateManager` initialized in some contexts
- V2 state writes to separate path (`.opencode/v2/`) to avoid schema conflicts
- Full CLI migration to v2 schema planned for next release

### Performance

- Transaction log: Append-only JSONL (< 1ms per write)
- State reads: Lazy loading with in-memory cache
- Atomic writes: ~2-5ms per state mutation (temp write + rename)

### Security

- Defensive copies prevent external state mutation
- State files created with secure permissions
- Transaction log provides full audit trail
- No secrets or credentials in state files

### Next Steps (Future Releases)

**Phase 4: Full CLI Migration**
- Migrate CLI to read from v2 state exclusively
- Deprecate legacy state paths
- Remove dual-write code

**Phase 5: Testing & Hardening**
- End-to-end workflow tests for all 3 lanes
- Regression tests for all 8 root causes
- Performance benchmarks
- Load testing

---

## [0.4.0] - Previous Release

See git history for previous changes.

[0.5.0]: https://github.com/duypham93/openkit/compare/v0.4.0...v0.5.0
