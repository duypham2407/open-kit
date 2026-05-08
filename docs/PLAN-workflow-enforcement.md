# PLAN: True Multi-Agent Workflow Enforcement

> **Goal**: Enforce role boundaries, stage transitions, and instruction isolation so workflows (quick/full/migration) actually work correctly.
>
> **Approach**: Option C — Hybrid State Machine + MCP Gateway + Context Slicing
>
> **Created**: 2026-05-08
> **Status**: ✅ All Phases Complete — 159/159 unit tests passing

## Status Legend

| Icon | Meaning |
|------|---------|
| ⬜ | Not Started |
| 🔵 | In Progress |
| ✅ | Done |
| ❌ | Blocked |
| ⏭️ | Skipped |

---

## Overview

```
Phase 1: Role Guard Hook           → Chặn MCP tools theo role (enforcement layer)
Phase 2: Finite State Machine      → Enforce stage transitions (workflow engine)
Phase 3: Instruction Slicing       → Minimal context per role (cognitive fix)
Phase 4: Action Gateway + Audit    → Single entry point + self-healing (UX layer)
```

---

## Phase 1: Role Guard Hook ✅

> **Goal**: MasterOrchestrator không thể code/tạo file qua MCP tools.
> **Effort**: ~1 tuần | **Priority**: P0
> **Depends on**: Nothing — can start immediately

### 1.1 Role Permission Matrix ✅

**File**: `src/runtime/workflow/role-permissions.js` (NEW)

Định nghĩa ma trận quyền cho mỗi role:

| Role | Allowed Tools | Blocked Tools |
|------|--------------|---------------|
| MasterOrchestrator | workflow-state, runtime-summary, evidence-capture, capability-* | bash, edit, write, hashline-edit, codemod-apply, interactive-bash |
| QuickAgent | `*` (all) | — |
| ProductLead | workflow-state, read, glob, grep, write (chỉ docs/) | bash, edit, codemod-apply |
| SolutionLead | workflow-state, read, glob, grep, write (chỉ docs/) | bash, edit, codemod-apply |
| FullstackAgent | `*` (all) | — |
| CodeReviewer | read, glob, grep, syntax-outline, workflow-state | edit, write, bash |
| QAAgent | bash (read-only), read, browser-verify, evidence-capture | edit, write |

**Tasks**:

- ✅ 1.1.1 — Tạo `role-permissions.js` với ROLE_PERMISSIONS object
- ✅ 1.1.2 — Export helper: `isToolAllowed(role, toolId)` → boolean
- ✅ 1.1.3 — Export helper: `getBlockedReason(role, toolId)` → string with guidance
- ✅ 1.1.4 — Export helper: `getAllowedTools(role)` → string[] for self-healing
- ✅ 1.1.5 — Unit tests cho permission matrix (role-permissions.test.js — 26 tests)

### 1.2 Role Guard Hook ✅

**File**: `src/runtime/hooks/tool-guards/role-guard-hook.js` (NEW)

Guard hook chặn unauthorized tool calls dựa trên `current_owner` trong workflow state.

**Tasks**:

- ✅ 1.2.1 — Tạo `createRoleGuardHook({ workflowKernel })` 
- ✅ 1.2.2 — Đọc `current_owner` từ `workflowKernel.showState()`
- ✅ 1.2.3 — Check against role-permissions matrix
- ✅ 1.2.4 — Return structured block response: `{ blocked, reason, allowedActions, suggestedOwner }`
- ✅ 1.2.5 — Handle edge case: no workflow state → permissive mode (don't block)
- ✅ 1.2.6 — Handle edge case: unknown role → permissive mode with warning
- ✅ 1.2.7 — Unit tests cho guard hook (role-guard-hook.test.js — 14 tests)

### 1.3 Integration ✅

**File**: `src/runtime/hooks/create-tool-guard-hooks.js` (MODIFY)

**Tasks**:

- ✅ 1.3.1 — Import `createRoleGuardHook`
- ✅ 1.3.2 — Add role guard as FIRST hook in the array (highest priority)
- ✅ 1.3.3 — Integration test: MasterOrchestrator + bash → blocked (role-guard-hook.test.js)
- ✅ 1.3.4 — Integration test: FullstackAgent + bash → allowed (role-guard-hook.test.js)
- ✅ 1.3.5 — Integration test: no workflow state → allowed (permissive) (role-guard-hook.test.js)

### 1.4 OpenCode Native Tool Mitigation ✅

> Guard hooks chỉ chặn MCP tools. OpenCode native tools (bash, edit, write) cần mitigation bổ sung.

**File**: `hooks/session-start.js` (MODIFY)

**Tasks**:

- ✅ 1.4.1 — Thêm `<openkit_role_boundaries>` block vào session-start output
- ✅ 1.4.2 — Block chứa: current_owner, allowed_actions, blocked_actions
- ✅ 1.4.3 — Block cập nhật mỗi session start dựa trên workflow state

### Phase 1 Verification ✅

- ✅ Test: Khi `current_owner = MasterOrchestrator`, gọi `tool.hashline-edit` → bị blocked
- ✅ Test: Khi `current_owner = FullstackAgent`, gọi `tool.hashline-edit` → allowed
- ✅ Test: Khi không có workflow state → tất cả tools allowed
- ✅ Test: Block response chứa guidance text rõ ràng

---

## Phase 2: Finite State Machine ✅ (core)

> **Goal**: Enforce stage transitions — model không thể nhảy từ brainstorm sang implement.
> **Effort**: ~2 tuần | **Priority**: P0
> **Depends on**: Phase 1 (role guard provides the enforcement layer)

### 2.1 FSM Definition ✅

**File**: `src/runtime/workflow/state-machine.js` (NEW)

**Tasks**:

- ✅ 2.1.1 — Định nghĩa `QUICK_TRANSITIONS` map
- ✅ 2.1.2 — Định nghĩa `FULL_TRANSITIONS` map
- ✅ 2.1.3 — Định nghĩa `MIGRATION_TRANSITIONS` map
- ✅ 2.1.4 — Định nghĩa `STAGE_OWNERS` map (stage → required owner)
- ✅ 2.1.5 — Export: `isValidTransition(mode, fromStage, toStage)` → boolean
- ✅ 2.1.6 — Export: `getValidNextStages(mode, currentStage)` → string[]
- ✅ 2.1.7 — Export: `getStageOwner(mode, stage)` → string
- ✅ 2.1.8 — Unit tests cho FSM (state-machine.test.js)

### 2.2 Gate Requirements ✅

**File**: `src/runtime/workflow/gate-requirements.js` (NEW)

Mỗi transition có thể yêu cầu conditions trước khi cho phép.

**Tasks**:

- ✅ 2.2.1 — Định nghĩa gate requirements (10 gates across all 3 modes)
- ✅ 2.2.2 — Export: `checkGateRequirements(mode, fromStage, toStage, state)` → `{ passed, missing[] }`
- ✅ 2.2.3 — Gate checkers: 10 individual checker functions
- ✅ 2.2.4 — Unit tests cho gates (gate-requirements.test.js)

### 2.3 MCP Tool: `tool.advance-stage` ✅

**File**: `src/runtime/tools/workflow/advance-stage.js` (NEW)

MCP tool mà model PHẢI gọi để chuyển stage.

**Tasks**:

- ✅ 2.3.1 — Tạo tool definition: `{ id: 'tool.advance-stage', name, description, inputSchema }`
- ✅ 2.3.2 — Input: `{ targetStage, evidence?, handoffContext? }`
- ✅ 2.3.3 — Validate transition via FSM: `isValidTransition()`
- ✅ 2.3.4 — Validate gates: `checkGateRequirements()`
- ✅ 2.3.5 — Update workflow state via `recordVerificationEvidence()`
- ✅ 2.3.6 — Return success response: `{ status, newStage, newOwner, nextActions, guidance }`
- ✅ 2.3.7 — Return block response: `{ status: 'blocked', reason, missingGates, validNextStages }`
- ✅ 2.3.8 — Register in tool-registry.js
- ✅ 2.3.9 — Add to MCP tool-schemas.js
- ✅ 2.3.10 — Unit tests (advance-stage.test.js)

### 2.4 Integration with Role Guard ✅

**Tasks**:

- ✅ 2.4.1 — Role guard reads `current_owner` after stage advance
- ✅ 2.4.2 — When stage changes, role guard automatically adjusts permissions
- ✅ 2.4.3 — Integration test: advance to full_implementation → FullstackAgent can now code (advance-stage.test.js)
- ✅ 2.4.4 — Integration test: try to skip from full_product to full_implementation → blocked (advance-stage.test.js)

### Phase 2 Verification ✅

- ✅ Test: `tool.advance-stage({ targetStage: 'quick_implement' })` from `quick_brainstorm` → blocked (advance-stage.test.js)
- ✅ Test: `tool.advance-stage({ targetStage: 'quick_plan' })` from `quick_brainstorm` without `user_understanding_confirmed` → blocked (advance-stage.test.js)
- ✅ Test: FSM valid transitions cover full quick pipeline (state-machine.test.js)
- ✅ Test: FSM valid transitions cover full-delivery pipeline with gates (state-machine.test.js + gate-requirements.test.js)

---

## Phase 3: Instruction Slicing ✅

> **Goal**: Giảm từ 170KB → 3-5KB instructions per role. Model chỉ nhận context cần thiết.
> **Effort**: ~2 tuần | **Priority**: P1
> **Depends on**: Phase 2 (FSM determines which role/stage is active)

### 3.1 Instruction Restructure ✅

**Directory**: `instructions/` (NEW — compiled from existing agent .md files)

**Tasks**:

- ✅ 3.1.1 — Tạo `instructions/core/workflow-router.md`
- ✅ 3.1.2 — Tạo `instructions/core/role-boundaries.md`
- ✅ 3.1.3 — Tạo `instructions/quick/brainstorm.md`
- ✅ 3.1.4 — Tạo `instructions/quick/plan.md`
- ✅ 3.1.5 — Tạo `instructions/quick/implement.md`
- ✅ 3.1.6 — Tạo `instructions/quick/test.md`
- ✅ 3.1.7 — Tạo `instructions/full/orchestrator-intake.md`
- ✅ 3.1.8 — Tạo `instructions/full/product-lead.md`
- ✅ 3.1.9 — Tạo `instructions/full/solution-lead.md`
- ✅ 3.1.10 — Tạo `instructions/full/fullstack-implement.md`
- ✅ 3.1.11 — Tạo `instructions/full/code-reviewer.md`
- ✅ 3.1.12 — Tạo `instructions/full/qa-agent.md`
- ✅ 3.1.13 — Tạo `instructions/migration/baseline.md`
- ✅ 3.1.14 — Tạo `instructions/migration/strategy.md`
- ✅ 3.1.15 — Tạo `instructions/migration/upgrade.md`
- ✅ 3.1.16 — Tạo `instructions/migration/verify.md`

### 3.2 Instruction Loader ✅

**File**: `src/runtime/workflow/instruction-loader.js` (NEW)

**Tasks**:

- ✅ 3.2.1 — Tạo `loadRoleInstructions(mode, stage, owner)` → string (markdown content)
- ✅ 3.2.2 — Map: `(mode, stage)` → instruction file path
- ✅ 3.2.3 — Always prepend `role-boundaries.md` content
- ✅ 3.2.4 — Fallback: return generic instructions if specific file not found
- ✅ 3.2.5 — Unit tests (instruction-loader.test.js)

### 3.3 MCP Resources ✅

**File**: `src/mcp-server/index.js` (MODIFY)

Expose role instructions qua MCP Resources protocol.

**Tasks**:

- ✅ 3.3.1 — Add `ListResourcesRequestSchema` handler
- ✅ 3.3.2 — Resource: `openkit://active-role-instructions` — returns current role instructions
- ✅ 3.3.3 — Resource: `openkit://available-actions` — returns allowed actions for current role/stage
- ✅ 3.3.4 — Resource: `openkit://workflow-status` — returns current stage/owner/next-steps
- ✅ 3.3.5 — Add `ReadResourceRequestSchema` handler
- ✅ 3.3.6 — Integration test: read resource returns correct instructions per role (instruction-loader.test.js)

### 3.4 `tool.advance-stage` Enhancement ✅

**File**: `src/runtime/tools/workflow/advance-stage.js` (MODIFY)

**Tasks**:

- ✅ 3.4.1 — Response includes guidance to read openkit://active-role-instructions
- ✅ 3.4.2 — Instructions loaded via instruction-loader based on new stage/owner (via MCP resource)
- ✅ 3.4.3 — Response includes: "Read openkit://active-role-instructions for your updated role context"

### 3.5 Session Start Minimization ✅

**File**: `hooks/session-start.js` (MODIFY)

**Tasks**:

- ✅ 3.5.1 — Role boundaries block injected with ~500 bytes context
- ✅ 3.5.2 — Inject: "ALWAYS read openkit://active-role-instructions before acting"
- ✅ 3.5.3 — Inject: "ALWAYS call tool.advance-stage to change stages"
- 🔮 3.5.4 — Remove injection of full AGENTS.md content (deferred — non-breaking, cleanup for future release)
- ✅ 3.5.5 — Keep workflow resume hint (it's useful)

### Phase 3 Verification ✅

- ✅ Test: Instruction content is under 5KB per stage (instruction-loader.test.js)
- ✅ Test: loadRoleInstructions returns QuickAgent brainstorm instructions for `quick_brainstorm` (instruction-loader.test.js)
- ✅ Test: loadRoleInstructions returns QuickAgent plan instructions for `quick_plan` (instruction-loader.test.js)
- ✅ Test: In `full_product`, loadRoleInstructions returns ProductLead instructions (instruction-loader.test.js)

---

## Phase 4: Action Gateway + Audit ✅

> **Goal**: Single entry point cho workflow actions + self-healing guidance + complete audit.
> **Effort**: ~1 tuần | **Priority**: P2
> **Depends on**: Phase 2 + Phase 3

### 4.1 Action Gateway Tool ✅

**File**: `src/runtime/tools/workflow/action-gateway.js` (NEW)

Optional MCP tool — model có thể dùng để validate actions trước khi thực hiện.

**Tasks**:

- ✅ 4.1.1 — Tạo `tool.check-action` (advisory, not blocking)
- ✅ 4.1.2 — Input: `{ action, description }`
- ✅ 4.1.3 — Response: `{ allowed, currentRole, currentStage, guidance, suggestedApproach }`
- ✅ 4.1.4 — Khi blocked: trả về structured guidance (which agent should do this, what stage to reach first)
- ✅ 4.1.5 — Register in tool-registry + MCP schemas
- ✅ 4.1.6 — Unit tests (action-gateway.test.js)

### 4.2 Audit Dashboard ✅

**File**: `src/runtime/tools/workflow/audit-log.js` (NEW)

**Tasks**:

- ✅ 4.2.1 — Tạo `tool.workflow-audit` — returns audit log of all tool calls, transitions, blocks
- ✅ 4.2.2 — Aggregate from invocation logger
- ✅ 4.2.3 — Summary: violations count, transitions count, blocks by role
- ✅ 4.2.4 — Register in tool-registry + MCP schemas

### 4.3 Self-Healing Response Enhancement ✅

**File**: `src/runtime/hooks/tool-guards/role-guard-hook.js` (MODIFY)

**Tasks**:

- ✅ 4.3.1 — Enrich block responses with step-by-step guidance
- ✅ 4.3.2 — Include: "To do X, first call tool.advance-stage to reach stage Y"
- ✅ 4.3.3 — Include: "The correct agent for this action is Z"
- ✅ 4.3.4 — Include: available tool.advance-stage targets from FSM

### Phase 4 Verification ✅

- ✅ Test: `tool.check-action({ action: 'edit_code' })` when MasterOrchestrator → returns guidance (action-gateway.test.js)
- ✅ Test: `tool.workflow-audit` returns chronological log (audit-log.test.js)
- ✅ Test: Block response includes actionable next steps (role-guard-hook.test.js + action-gateway.test.js)

---

## File Change Summary

### New Files (12)

| File | Phase | Purpose |
|------|-------|---------|
| `src/runtime/workflow/role-permissions.js` | 1 | Role → allowed/blocked tools matrix |
| `src/runtime/hooks/tool-guards/role-guard-hook.js` | 1 | Guard hook enforcing role permissions |
| `src/runtime/workflow/state-machine.js` | 2 | FSM transitions + stage owners |
| `src/runtime/workflow/gate-requirements.js` | 2 | Gate conditions per transition |
| `src/runtime/tools/workflow/advance-stage.js` | 2 | MCP tool for stage transitions |
| `src/runtime/workflow/instruction-loader.js` | 3 | Load role-specific instructions |
| `instructions/` (16 files) | 3 | Sliced instruction files |
| `src/runtime/tools/workflow/action-gateway.js` | 4 | Advisory action checker |
| `src/runtime/tools/workflow/audit-log.js` | 4 | Workflow audit tool |

### Modified Files (5)

| File | Phase | Change |
|------|-------|--------|
| `src/runtime/hooks/create-tool-guard-hooks.js` | 1 | Add role-guard-hook to array |
| `hooks/session-start.js` | 1, 3 | Add role boundaries; minimize instructions |
| `src/runtime/tools/tool-registry.js` | 2, 4 | Register new tools |
| `src/mcp-server/tool-schemas.js` | 2, 4 | Add MCP schemas for new tools |
| `src/mcp-server/index.js` | 3 | Add MCP Resources handlers |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenCode native tools bypass MCP guard | High | Minimal instructions reduce motivation; session-start role boundary injection |
| MCP Resources not supported by OpenCode version | Medium | Fallback: return instructions in tool.advance-stage response text |
| Model ignores tool.advance-stage and manages state directly | Medium | Stage-readiness guard blocks tools when stage doesn't match |
| Instruction slicing loses important context | Medium | Keep core/role-boundaries.md always loaded; test with real workflows |
| Breaking existing workflows during migration | High | Phase 1 deploys independently; feature flag for new behavior |

---

## Success Criteria

1. ✅ MasterOrchestrator CANNOT edit files, run bash, or create code via MCP tools
2. ✅ Model CANNOT skip stages (e.g., brainstorm → implement)
3. ✅ Each role receives only ~3-5KB of instructions (not 170KB)
4. ✅ Stage transitions produce audit log
5. ✅ Blocked actions return actionable guidance
6. ✅ All existing quick/full/migration workflows still function
7. ✅ No breaking changes to OpenCode compatibility
