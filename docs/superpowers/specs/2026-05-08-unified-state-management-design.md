# Unified State Management Architecture for OpenKit

**Date:** 2026-05-08
**Status:** Design Complete, Ready for Implementation
**Problem:** OpenKit workflow blocking - agents loop infinitely asking questions, never complete tasks
**Solution:** Unified state management layer as single source of truth

---

## Executive Summary

OpenKit currently suffers from severe workflow blocking issues where agents continuously ask questions in a 5-second loop pattern without ever completing tasks. Root cause analysis identified 8 critical architectural bugs, with the most severe being that `tool.advance-stage` does not persist state transitions to disk, causing agents to repeatedly re-read stale state and restart from the beginning.

This design proposes a **Unified State Management Architecture** with a single state manager as the only code path for reading/writing workflow state. This eliminates dual gate systems, inconsistent state machines, and disconnected write paths that currently prevent workflow progression.

**Impact:**
- Eliminates all 8 identified root causes
- Enables reliable workflow progression across all lanes (quick, migration, full)
- Provides audit trail and debugging capabilities
- Maintains backward compatibility with existing state files

**Effort:** 3-4 weeks implementation + testing

---

## Problem Analysis

### Symptom
Agents run for ~5 seconds, ask a question, run for ~5 seconds, ask a different question, never completing tasks. Manual intervention does not help. The pattern appears random with no fixed question type.

### Root Causes Identified

**Severity 1 (Causes infinite loop directly):**

1. **`tool.advance-stage` never persists state transitions** (`src/runtime/tools/workflow/advance-stage.js` line 128-144)
   - Only writes audit log via `recordVerificationEvidence()`
   - Always returns `{ success: true }` but never updates `src/openkit-runtime/workflow-state.json`
   - Agent believes stage advanced but disk state remains unchanged
   - Next read returns old stage → agent restarts from beginning

2. **Gate flags never persisted** (`src/runtime/workflow/gate-requirements.js`)
   - `recordGateMet()` returns new object but has no write-back path
   - Gates checked by `gate-requirements.js` use `state.gates.*` namespace
   - CLI controller checks `state.approvals.*` namespace
   - Neither system can satisfy the other's gate conditions

**Severity 2 (Prevents recovery):**

3. **No `advanceStage` method on `workflowKernel` adapter** (`src/runtime/workflow-kernel.js`)
   - MCP tools call `workflowKernel` but it only exposes evidence recording
   - Real `advanceStage` implementation exists in `workflow-state-controller.js` line 3820
   - No code path connects MCP tools to real controller function

4. **Dual incompatible approval systems**
   - CLI system: `state.approvals.*` (managed by workflow-state-controller.js)
   - MCP system: `state.gates.*` (checked by gate-requirements.js)
   - Both check their own namespace, neither writes to the other's namespace
   - Result: approval in one system invisible to the other

5. **Inconsistent state machines**
   - `state-machine.js`: allows backward transitions (e.g., `quick_plan` → `quick_brainstorm`)
   - `workflow-state-rules.js`: only allows linear forward transitions via `getNextStage()`
   - Two FSM implementations contradict each other

**Severity 3 (Amplifies the loop):**

6. **Quick brainstorm mandates explicit user confirmation** (`src/agents/quick-agent.md` lines 132-163)
   - `quick_brainstorm` requires explicit user confirmation before advancing to `quick_plan`
   - Confirmation never persists due to bug #1
   - Agent re-reads stale state and asks for confirmation again
   - Creates observed "asks question, runs 5 seconds, asks different question" loop

7. **Master Orchestrator "dispatch" has no runtime agent-switching**
   - Both `master-orchestrator.md` and `quick-agent.md` have `mode: primary`
   - OpenCode loads one agent at session start
   - No mechanism to switch active agent mid-session
   - "Dispatch" calls `tool.advance-stage` but active LLM context doesn't change

8. **Context overload from required pre-reads**
   - Quick Agent must read 6+ context files before starting
   - Master Orchestrator reads 7-10 context files
   - Combined with codebase reading, context window fills quickly
   - Truncation erases prior confirmations and stage advances

### Critical Files Involved
- `src/runtime/tools/workflow/advance-stage.js` (broken write)
- `src/runtime/workflow-kernel.js` (missing `advanceStage` method)
- `src/runtime/workflow/gate-requirements.js` (ephemeral gate state)
- `src/openkit-runtime/lib/workflow-state-controller.js` (real advance logic, disconnected)
- `src/openkit-runtime/lib/workflow-state-rules.js` (linear FSM vs bidirectional FSM)
- `src/agents/quick-agent.md` (mandatory re-confirmation loop)

---

## Solution: Unified State Management Architecture

### Core Principle
Create a **single state manager** as the only code path for reading/writing workflow state. All consumers (MCP tools, CLI commands, agents, runtime managers) must go through this layer.

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSUMERS LAYER                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ MCP Tools│  │ CLI Cmds │  │  Agents  │  │ Managers │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
        ┌─────────────────▼─────────────────────────────────┐
        │       UNIFIED STATE MANAGEMENT LAYER              │
        │                                                   │
        │  • Single state writer (WorkflowStateManager)    │
        │  • FSM validation (single transition rules)      │
        │  • Unified gate registry                         │
        │  • Transaction log                               │
        │  • State versioning                              │
        │  • Event emitter (for observers)                 │
        └───────────────────┬───────────────────────────────┘
                            │
        ┌───────────────────▼───────────────────────────────┐
        │              PERSISTENCE LAYER                    │
        │                                                   │
        │  • workflow-state.json (compatibility mirror)    │
        │  • work-items/<id>/state.json (per-item store)   │
        │  • state-transitions.log (audit trail)           │
        └───────────────────────────────────────────────────┘
```

---

## Component Design

### 1. WorkflowStateManager
**Location:** `src/runtime/state/workflow-state-manager.js`

**Responsibilities:**
- Read/write workflow state from disk
- Enforce atomic transactions
- Validate all mutations through TransitionEngine
- Emit events for state changes
- Manage state versioning and migrations

**API:**
```javascript
class WorkflowStateManager {
  // State readers
  getCurrentState()
  getWorkItem(workItemId)
  getStage()
  getOwner()
  getMode()

  // State writers (all validated and transactional)
  advanceStage(targetStage, newOwner, metadata)
  setApproval(gateName, approved, approver, metadata)
  recordIssue(issue)
  resolveIssue(issueId, resolution)
  recordEvidence(evidence)

  // Transaction management
  beginTransaction()
  commitTransaction()
  rollbackTransaction()

  // Events
  on(event, handler)
  emit(event, data)
}
```

**State file structure:**
- Primary: `src/openkit-runtime/work-items/<work-item-id>/state.json`
- Mirror: `src/openkit-runtime/workflow-state.json` (compatibility, read-only for external tools)
- Audit: `src/openkit-runtime/work-items/<work-item-id>/state-transitions.log`

---

### 2. Unified Gate Registry
**Location:** `src/runtime/state/gate-registry.js`

**Purpose:** Single definition of all gates across all lanes, eliminating dual `state.gates.*` vs `state.approvals.*` systems.

**Unified gate definitions:**
```javascript
const UNIFIED_GATES = {
  // Quick lane gates
  'quick.understanding_confirmed': {
    stage: 'quick_brainstorm',
    targetStage: 'quick_plan',
    authority: 'user',
    type: 'confirmation',
    description: 'User confirms understanding of task'
  },
  'quick.plan_confirmed': {
    stage: 'quick_plan',
    targetStage: 'quick_implement',
    authority: 'user',
    type: 'confirmation',
    description: 'User approves execution plan'
  },
  'quick.verified': {
    stage: 'quick_test',
    targetStage: 'quick_done',
    authority: 'quick-agent',
    type: 'approval',
    description: 'Quick Agent verifies tests pass'
  },

  // Full lane gates
  'full.product_to_solution': {
    stage: 'full_product',
    targetStage: 'full_solution',
    authority: 'user',
    type: 'approval',
    description: 'User approves scope package'
  },
  'full.solution_to_implementation': {
    stage: 'full_solution',
    targetStage: 'full_implementation',
    authority: 'user',
    type: 'approval',
    description: 'User approves solution package'
  },
  'full.code_review_passed': {
    stage: 'full_code_review',
    targetStage: 'full_qa',
    authority: 'code-reviewer',
    type: 'approval',
    description: 'Code Reviewer approves implementation'
  },
  'full.qa_passed': {
    stage: 'full_qa',
    targetStage: 'full_done',
    authority: 'qa-agent',
    type: 'approval',
    description: 'QA Agent verifies acceptance criteria'
  },

  // Migration lane gates
  'migration.baseline_verified': {
    stage: 'migration_baseline',
    targetStage: 'migration_strategy',
    authority: 'solution-lead-agent',
    type: 'approval',
    description: 'Baseline evidence collected'
  },
  'migration.strategy_approved': {
    stage: 'migration_strategy',
    targetStage: 'migration_upgrade',
    authority: 'user',
    type: 'approval',
    description: 'User approves migration strategy'
  },
  'migration.code_review_passed': {
    stage: 'migration_code_review',
    targetStage: 'migration_verify',
    authority: 'code-reviewer',
    type: 'approval',
    description: 'Code Reviewer approves migration changes'
  },
  'migration.parity_verified': {
    stage: 'migration_verify',
    targetStage: 'migration_done',
    authority: 'qa-agent',
    type: 'approval',
    description: 'Parity verification complete'
  }
};
```

**Migration from old systems:**
- `state.approvals.quick_verified` → `quick.verified`
- `state.gates.user_understanding_confirmed` → `quick.understanding_confirmed`
- `state.gates.user_plan_confirmed` → `quick.plan_confirmed`
- `state.approvals.product_to_solution` → `full.product_to_solution`

**API:**
```javascript
class GateRegistry {
  getGate(gateName)
  isGateMet(state, gateName)
  getRequiredGates(fromStage, toStage)
  canTransition(state, fromStage, toStage)
  recordGateMet(state, gateName, approver, metadata)
}
```

---

### 3. State Transition Engine
**Location:** `src/runtime/state/transition-engine.js`

**Purpose:** Single FSM definition for all lanes, replacing conflicting `state-machine.js` and `workflow-state-rules.js`.

**Transition rules (unified):**
```javascript
const TRANSITION_RULES = {
  quick: {
    quick_intake: ['quick_brainstorm'],
    quick_brainstorm: ['quick_plan'],  // only forward
    quick_plan: ['quick_implement', 'quick_brainstorm'],  // can go back
    quick_implement: ['quick_test', 'quick_plan'],  // can go back
    quick_test: ['quick_done', 'quick_implement'],  // can go back
    quick_done: []  // terminal
  },

  full: {
    full_intake: ['full_product'],
    full_product: ['full_solution'],
    full_solution: ['full_implementation', 'full_product'],
    full_implementation: ['full_code_review', 'full_solution'],
    full_code_review: ['full_qa', 'full_implementation'],
    full_qa: ['full_done', 'full_implementation'],
    full_done: []
  },

  migration: {
    migration_intake: ['migration_baseline'],
    migration_baseline: ['migration_strategy'],
    migration_strategy: ['migration_upgrade', 'migration_baseline'],
    migration_upgrade: ['migration_code_review', 'migration_strategy'],
    migration_code_review: ['migration_verify', 'migration_upgrade'],
    migration_verify: ['migration_done', 'migration_upgrade'],
    migration_done: []
  }
};
```

**API:**
```javascript
class TransitionEngine {
  validateTransition(mode, fromStage, toStage)
  getNextStages(mode, currentStage)
  isTerminalStage(mode, stage)
  isBackwardTransition(mode, fromStage, toStage)
  getTransitionPath(mode, fromStage, toStage)  // for multi-hop
}
```

---

### 4. Transaction Log
**Location:** `src/runtime/state/transaction-log.js`

**Purpose:** Append-only audit trail of all state changes for debugging and rollback.

**Log format (JSONL):**
```jsonl
{"timestamp":"2026-05-08T10:23:45.123Z","operation":"advanceStage","caller":"tool.advance-stage","workItemId":"abc123","before":{"stage":"quick_brainstorm","owner":"quick-agent"},"after":{"stage":"quick_plan","owner":"quick-agent"},"metadata":{}}
{"timestamp":"2026-05-08T10:24:10.456Z","operation":"setApproval","caller":"tool.set-approval","workItemId":"abc123","gateName":"quick.plan_confirmed","approved":true,"approver":"user","metadata":{}}
```

**API:**
```javascript
class TransactionLog {
  append(operation, before, after, caller, metadata)
  query(filters)  // filter by workItemId, operation, timestamp range
  getHistory(workItemId)
  replayTo(workItemId, timestamp)  // for debugging
}
```

---

### 5. Adapter Refactoring

**workflow-kernel.js changes:**
```javascript
// OLD (broken)
recordVerificationEvidence(evidence) { ... }  // only writes evidence, not state

// NEW (wired to manager)
advanceStage(targetStage, newOwner, metadata) {
  return this.stateManager.advanceStage(targetStage, newOwner, metadata);
}

setApproval(gateName, approved, approver, metadata) {
  return this.stateManager.setApproval(gateName, approved, approver, metadata);
}

recordEvidence(evidence) {
  return this.stateManager.recordEvidence(evidence);
}
```

**workflow-state-controller.js changes:**
```javascript
// Refactor to pure data access + delegation
class WorkflowStateController {
  constructor() {
    this.stateManager = new WorkflowStateManager(...);
  }

  // Read operations (no change needed)
  showState() { ... }
  getWorkItem() { ... }

  // Write operations (delegate to manager)
  advanceStage(stage) {
    return this.stateManager.advanceStage(stage, ...);
  }

  setApproval(gateName) {
    return this.stateManager.setApproval(gateName, ...);
  }
}
```

**MCP tool refactoring (example: advance-stage.js):**
```javascript
// OLD
function updateWorkflowState(workflowKernel, currentState, targetStage, newOwner, transition) {
  workflowKernel.recordVerificationEvidence({ ... });  // WRONG
  return { success: true };  // LIES
}

// NEW
async function updateWorkflowState(stateManager, currentState, targetStage, newOwner, transition) {
  const result = await stateManager.advanceStage(targetStage, newOwner, {
    transition,
    caller: 'tool.advance-stage'
  });

  if (!result.success) {
    return { success: false, reason: result.error };
  }

  return { success: true, newState: result.state };
}
```

---

## Data Flow

### Stage Advance Flow

```
Agent calls tool.advance-stage(targetStage)
    ↓
MCP tool handler validates inputs
    ↓
Calls stateManager.advanceStage(targetStage, newOwner, metadata)
    ↓
StateManager begins transaction
    ↓
TransitionEngine.validateTransition(mode, currentStage, targetStage)
    ├─ Invalid? → rollback, return error
    └─ Valid? → continue
    ↓
GateRegistry.canTransition(state, currentStage, targetStage)
    ├─ Gates not met? → rollback, return blocked with gate list
    └─ Gates met? → continue
    ↓
Update state in memory
    ↓
TransactionLog.append(operation, before, after)
    ↓
Write state to disk (.opencode/work-items/<id>/state.json)
    ↓
Write compatibility mirror (.opencode/workflow-state.json)
    ↓
StateManager commits transaction
    ↓
StateManager emits 'stage-advanced' event
    ↓
Return success to caller
```

### Approval Flow

```
Agent/User sets approval via tool.set-approval(gateName)
    ↓
MCP tool handler validates gate exists
    ↓
Calls stateManager.setApproval(gateName, true, approver, metadata)
    ↓
StateManager begins transaction
    ↓
GateRegistry.getGate(gateName)
    ├─ Unknown gate? → rollback, return error
    └─ Known gate? → continue
    ↓
Validate approver has authority for this gate
    ├─ No authority? → rollback, return error
    └─ Has authority? → continue
    ↓
Update gates map in state
    ↓
TransactionLog.append(operation, before, after)
    ↓
Write state to disk
    ↓
StateManager commits transaction
    ↓
StateManager emits 'gate-met' event
    ↓
Return success to caller
```

### Error Recovery Flow

```
Invalid operation detected
    ↓
StateManager.rollbackTransaction()
    ↓
Restore previous state from transaction snapshot
    ↓
TransactionLog.append(operation: 'rollback', reason)
    ↓
Return error to caller with:
    - Error code
    - Human-readable message
    - Current state snapshot
    - Valid next actions
```

---

## State Schema Migration

### Existing State Schema
```json
{
  "mode": "quick",
  "stage": "quick_brainstorm",
  "owner": "quick-agent",
  "approvals": {
    "quick_verified": false
  },
  "gates": {
    "user_understanding_confirmed": false,
    "user_plan_confirmed": false
  }
}
```

### New Unified Schema
```json
{
  "version": "2.0.0",
  "mode": "quick",
  "stage": "quick_brainstorm",
  "owner": "quick-agent",
  "gates": {
    "quick.understanding_confirmed": false,
    "quick.plan_confirmed": false,
    "quick.verified": false
  },
  "metadata": {
    "created_at": "2026-05-08T10:00:00Z",
    "updated_at": "2026-05-08T10:23:45Z",
    "state_version": 5
  }
}
```

### Auto-Migration Strategy
```javascript
function migrateState(oldState) {
  if (oldState.version === '2.0.0') return oldState;

  const newState = {
    version: '2.0.0',
    mode: oldState.mode,
    stage: oldState.stage,
    owner: oldState.owner,
    gates: {},
    metadata: {
      created_at: oldState.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_version: 1,
      migrated_from: oldState.version || '1.0.0'
    }
  };

  // Migrate old approvals
  if (oldState.approvals) {
    for (const [key, value] of Object.entries(oldState.approvals)) {
      const newKey = APPROVAL_MIGRATION_MAP[key];
      if (newKey) newState.gates[newKey] = value;
    }
  }

  // Migrate old gates
  if (oldState.gates) {
    for (const [key, value] of Object.entries(oldState.gates)) {
      const newKey = GATE_MIGRATION_MAP[key];
      if (newKey) newState.gates[newKey] = value;
    }
  }

  return newState;
}
```

**Migration maps:**
```javascript
const APPROVAL_MIGRATION_MAP = {
  'quick_verified': 'quick.verified',
  'product_to_solution': 'full.product_to_solution',
  'solution_to_implementation': 'full.solution_to_implementation',
  'code_review_passed': 'full.code_review_passed',
  'qa_passed': 'full.qa_passed',
  // migration lane
  'baseline_verified': 'migration.baseline_verified',
  'strategy_approved': 'migration.strategy_approved',
  'migration_code_review_passed': 'migration.code_review_passed',
  'parity_verified': 'migration.parity_verified'
};

const GATE_MIGRATION_MAP = {
  'user_understanding_confirmed': 'quick.understanding_confirmed',
  'user_plan_confirmed': 'quick.plan_confirmed'
};
```

---

## Migration Strategy

### Phase 1: Add New System Alongside Old (No Breaking Changes)
**Duration:** Week 1

- Deploy WorkflowStateManager, GateRegistry, TransitionEngine, TransactionLog
- Wire them up but keep old code paths active
- Log all operations through both systems
- Compare outputs for consistency
- No behavior changes visible to users

### Phase 2: Switch MCP Tools to New System
**Duration:** Week 2, Days 1-3

- Refactor `tool.advance-stage`, `tool.set-approval`, `tool.workflow-state`
- MCP tools now write through WorkflowStateManager
- Keep CLI using old controller for now
- Monitor for issues, compare behavior

### Phase 3: Switch CLI to New System
**Duration:** Week 2, Days 4-5

- Refactor workflow-state-controller.js to delegate to manager
- Remove old write code paths
- Keep CLI command interface unchanged
- All writes now go through unified layer

### Phase 4: Cleanup
**Duration:** Week 3, Days 1-2

- Remove old state-machine.js, workflow-state-rules.js duplicates
- Remove old gate-requirements.js
- Consolidate documentation
- Remove compatibility logging

---

## Error Handling

### Error Types

**StateTransitionError:**
- Invalid transition (e.g., `quick_done` → `quick_brainstorm` when not allowed)
- Includes: current stage, attempted target, valid next stages

**GateNotMetError:**
- Transition blocked by unmet gates
- Includes: required gates, their current status, who can approve

**InsufficientAuthorityError:**
- Caller tries to approve a gate they don't have authority for
- Includes: gate name, required authority, caller identity

**StateCorruptionError:**
- State file is corrupted or inconsistent
- Includes: corruption type, last known good state, recovery options

### Error Response Format
```javascript
{
  success: false,
  error: {
    type: 'GateNotMetError',
    message: 'Cannot advance from quick_brainstorm to quick_plan: required gates not met',
    currentStage: 'quick_brainstorm',
    targetStage: 'quick_plan',
    blockedBy: [
      {
        gate: 'quick.understanding_confirmed',
        met: false,
        authority: 'user',
        description: 'User confirms understanding of task'
      }
    ],
    validNextStages: ['quick_brainstorm'],  // can stay in current
    recommendations: [
      'Have user confirm understanding via tool.set-approval',
      'Or return to brainstorm to clarify requirements'
    ]
  }
}
```

---

## Observability & Debugging

### Transaction Log Queries
```bash
# Show all state changes for a work item
node .opencode/workflow-state.js log-query --work-item abc123

# Show all failed transitions
node .opencode/workflow-state.js log-query --operation advanceStage --status failed

# Replay state to a specific timestamp (read-only)
node .opencode/workflow-state.js replay abc123 2026-05-08T10:20:00Z
```

### Real-Time Monitoring
```javascript
// In agents or debugging tools
stateManager.on('stage-advanced', (data) => {
  console.log(`Stage transition: ${data.from} → ${data.to} by ${data.caller}`);
});

stateManager.on('gate-met', (data) => {
  console.log(`Gate met: ${data.gateName} by ${data.approver}`);
});

stateManager.on('error', (error) => {
  console.error(`State error: ${error.type} - ${error.message}`);
});
```

### Health Checks
```javascript
// Check state consistency
const health = stateManager.healthCheck();
// Returns: {
//   healthy: true|false,
//   issues: [...],
//   recommendations: [...]
// }
```

---

## Testing Strategy

### Unit Tests

**WorkflowStateManager tests:**
- State reads/writes
- Transaction rollback
- Event emission
- Concurrent access (locking)
- Migration from old schema

**GateRegistry tests:**
- Gate lookups
- `canTransition` for all lanes
- Migration from old gate names
- Authority validation

**TransitionEngine tests:**
- All valid transitions
- Rejection of invalid transitions
- Backward transitions
- Terminal stage detection
- Multi-hop path finding

**TransactionLog tests:**
- Append and query
- Log rotation (if large)
- Replay functionality

### Integration Tests

**End-to-end workflow tests:**
```javascript
test('Quick lane full cycle with new state manager', async () => {
  const manager = new WorkflowStateManager(testConfig);

  // Start work item
  await manager.advanceStage('quick_brainstorm', 'quick-agent');
  assert.equal(manager.getStage(), 'quick_brainstorm');

  // Try to advance without gate met - should fail
  const result1 = await manager.advanceStage('quick_plan', 'quick-agent');
  assert.equal(result1.success, false);
  assert.include(result1.error.message, 'quick.understanding_confirmed');

  // Set gate
  await manager.setApproval('quick.understanding_confirmed', true, 'user');

  // Now advance should succeed
  const result2 = await manager.advanceStage('quick_plan', 'quick-agent');
  assert.equal(result2.success, true);
  assert.equal(manager.getStage(), 'quick_plan');
});
```

**MCP tool integration tests:**
```javascript
test('tool.advance-stage writes to disk', async () => {
  const toolHandler = require('.../advance-stage.js');
  const initialState = readStateFromDisk();

  // Set required gate first
  await toolHandler.setApproval({
    gateName: 'quick.understanding_confirmed',
    approved: true,
    approver: 'user'
  });

  // Call advance tool
  const result = await toolHandler.execute({
    targetStage: 'quick_plan',
    workItemId: 'test123'
  });

  assert.equal(result.status, 'ok');

  // Verify disk write
  const newState = readStateFromDisk();
  assert.equal(newState.stage, 'quick_plan');
  assert.notEqual(initialState.updated_at, newState.updated_at);
});
```

**Backward compatibility tests:**
```javascript
test('Old state files auto-migrate on read', async () => {
  // Write old format state
  writeStateFile({
    mode: 'quick',
    stage: 'quick_plan',
    approvals: { quick_verified: false },
    gates: { user_understanding_confirmed: true }
  });

  // Read through new manager
  const manager = new WorkflowStateManager(testConfig);
  const state = manager.getCurrentState();

  // Check migration
  assert.equal(state.version, '2.0.0');
  assert.equal(state.gates['quick.understanding_confirmed'], true);
  assert.equal(state.gates['quick.verified'], false);
});
```

### Regression Tests for Root Causes

**Bug #1: Stage advance persists to disk**
```javascript
test('Stage advance persists to disk (regression for bug #1)', async () => {
  const manager = new WorkflowStateManager(testConfig);

  await manager.setApproval('quick.understanding_confirmed', true, 'user');
  const result = await manager.advanceStage('quick_plan', 'quick-agent');
  assert.equal(result.success, true);

  // Kill and recreate manager (simulates session restart)
  const manager2 = new WorkflowStateManager(testConfig);

  // Stage should still be quick_plan
  assert.equal(manager2.getStage(), 'quick_plan');
});
```

**Bug #2: Gates set through MCP tools readable by CLI**
```javascript
test('Gates set via MCP tools readable by CLI (regression for bug #2)', async () => {
  // Set gate via MCP tool
  const toolResult = await setApprovalTool.execute({
    gateName: 'quick.understanding_confirmed',
    approved: true,
    approver: 'user'
  });
  assert.equal(toolResult.status, 'ok');

  // Read via CLI
  const cliController = new WorkflowStateController();
  const state = cliController.showState();

  assert.equal(state.gates['quick.understanding_confirmed'], true);
});
```

**Bug #3: workflowKernel exposes advanceStage**
```javascript
test('workflowKernel.advanceStage exists and works (regression for bug #3)', async () => {
  const kernel = new WorkflowKernel(testConfig);

  // Should not throw
  assert.isFunction(kernel.advanceStage);

  await kernel.setApproval('quick.understanding_confirmed', true, 'user');
  const result = await kernel.advanceStage('quick_plan', 'quick-agent');
  assert.equal(result.success, true);
});
```

---

## Rollout Plan

### Week 1: Foundation
- **Day 1:** Implement WorkflowStateManager core (read, write, transactions)
- **Day 2:** Implement state versioning and migration logic
- **Day 3:** Implement GateRegistry with migration maps
- **Day 4:** Implement TransitionEngine with unified FSM
- **Day 5:** Implement TransactionLog with append/query

### Week 2: Integration
- **Day 1:** Wire WorkflowStateManager into workflow-kernel (add methods)
- **Day 2:** Refactor tool.advance-stage to use manager
- **Day 3:** Refactor tool.set-approval to use manager
- **Day 4:** Refactor workflow-state-controller.js to delegate
- **Day 5:** Update all other MCP tools that touch state

### Week 3: Testing & Hardening
- **Day 1:** Unit tests for all new components
- **Day 2:** Integration tests for end-to-end workflows
- **Day 3:** Regression tests for all 8 root causes
- **Day 4:** Add observability (events, health checks, CLI commands)
- **Day 5:** Performance testing & optimization

### Week 4: Documentation & Release
- **Day 1:** Update workflow.md, approval-gates.md with new gate names
- **Day 2:** Update AGENTS.md with new tool behavior
- **Day 3:** Write migration guide for any custom integrations
- **Day 4:** Final testing & bug fixes
- **Day 5:** Release preparation & deployment

---

## Success Criteria

### Must Have (P0)
- ✅ `tool.advance-stage` writes state to disk and persists across sessions
- ✅ `tool.set-approval` sets gates that are readable by CLI and MCP tools
- ✅ No infinite loops: agents can complete quick tasks end-to-end
- ✅ All 8 root causes eliminated:
  1. Stage transitions persist to disk
  2. Gate flags persist to disk
  3. `workflowKernel.advanceStage()` method exists and works
  4. Single unified gate system (no dual approvals/gates namespaces)
  5. Single FSM (no conflicting state machines)
  6. Quick brainstorm confirmation loop fixed
  7. Agent dispatch clarified (out of scope for this design, but state management fixes make it observable)
  8. Context overload mitigated by reliable state persistence
- ✅ Backward compatibility: old state files auto-migrate
- ✅ All existing workflows (quick, migration, full) work with new system

### Should Have (P1)
- ✅ Transaction log provides audit trail
- ✅ Clear error messages for invalid transitions and gate blocks
- ✅ CLI commands for debugging (log queries, state replay)
- ✅ Comprehensive test coverage (>80% for new components)
- ✅ Documentation updated

### Nice to Have (P2)
- ✅ Real-time event monitoring API
- ✅ Performance optimization (caching, lazy loading)
- ✅ Rollback capability for emergency recovery
- ✅ Health check API for runtime monitoring
- ✅ Metrics collection (transition counts, error rates)

---

## Risk Mitigation

### Risk 1: Breaking existing workflows during migration
**Likelihood:** Medium
**Impact:** High

**Mitigation:**
- Phase migration (add new system alongside old)
- Extensive integration tests before switching
- Feature flag to enable/disable new system
- Easy rollback path if issues detected
- Gradual rollout: MCP tools first, then CLI

### Risk 2: State corruption during transition
**Likelihood:** Low
**Impact:** High

**Mitigation:**
- Atomic transactions with rollback
- Transaction log for debugging
- State versioning with migrations
- Backup old state files before migration
- Health checks detect corruption early

### Risk 3: Performance degradation from additional layers
**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**
- Benchmark before/after
- Cache frequently accessed state in memory
- Lazy load transaction logs
- Optimize disk I/O (batch writes if needed)
- Profile hot paths and optimize

### Risk 4: Incomplete gate migration mapping
**Likelihood:** Low
**Impact:** Medium

**Mitigation:**
- Comprehensive mapping table covering all known gates
- Tests for all known gates
- Warning logs for unmapped gates (don't fail silently)
- Gradual rollout to catch edge cases
- Documentation of migration mapping

### Risk 5: Agents still loop despite state fixes
**Likelihood:** Low
**Impact:** High

**Mitigation:**
- Root causes 1-5 directly address the loop
- Integration tests specifically validate no-loop behavior
- Transaction log makes any remaining loops observable
- If loops persist, they'll be debuggable now (unlike before)

---

## Success Metrics

### Immediate (Week 1-2 after deployment)
- Zero infinite loop reports from users
- All workflow stages advance correctly in test suite
- Gate approval system works bidirectionally (MCP ↔ CLI)
- State persists across session restarts

### Short-term (Month 1)
- Quick lane completes tasks end-to-end without manual intervention
- Migration lane completes migrations end-to-end
- Full lane completes features end-to-end
- Transaction log provides actionable debugging info for any issues

### Long-term (Month 2-3)
- No state-related bug reports
- Agents can self-recover from edge cases using clear error messages
- Development velocity increases (less debugging, more features)
- OpenKit becomes reliable enough for production use

---

## Follow-up Work (Out of Scope)

These are related issues identified during analysis but not addressed by this design:

1. **Agent dispatch mechanism** - No runtime agent-switching exists; Master Orchestrator "dispatch" is semantic only
2. **Context overload** - Required pre-read files cause context window exhaustion
3. **Agent role confusion** - Both master-orchestrator and quick-agent have `mode: primary`
4. **Defensive recovery** - Loop detection, circuit breakers, auto-escalation for stuck workflows

These should be addressed in separate designs after state management is stable.

---

## Conclusion

This unified state management architecture eliminates all 8 root causes of workflow blocking by establishing a single source of truth for state management. The design preserves backward compatibility while providing audit trails, clear error messages, and debugging capabilities.

Implementation is estimated at 3-4 weeks with phased rollout to minimize risk. Success metrics focus on eliminating infinite loops and enabling end-to-end task completion across all workflow lanes.

The architecture is designed for long-term maintainability: single code path, clear boundaries, comprehensive testing, and observable behavior.

---

## References

**Root cause analysis:**
- Explore agent findings from initial analysis session

**Files requiring changes:**
- `src/runtime/state/workflow-state-manager.js` (new)
- `src/runtime/state/gate-registry.js` (new)
- `src/runtime/state/transition-engine.js` (new)
- `src/runtime/state/transaction-log.js` (new)
- `src/runtime/workflow-kernel.js` (modify)
- `src/runtime/tools/workflow/advance-stage.js` (modify)
- `src/runtime/tools/workflow/set-approval.js` (modify)
- `src/openkit-runtime/lib/workflow-state-controller.js` (refactor)

**Documentation requiring updates:**
- `src/context/core/workflow.md`
- `src/context/core/approval-gates.md`
- `src/context/core/workflow-state-schema.md`
- `AGENTS.md`

**Tests requiring creation:**
- `src/tests/runtime/state/workflow-state-manager.test.js`
- `src/tests/runtime/state/gate-registry.test.js`
- `src/tests/runtime/state/transition-engine.test.js`
- `src/tests/runtime/state/transaction-log.test.js`
- `src/tests/integration/workflow-state-persistence.test.js`
- `src/tests/regression/root-cause-*.test.js` (8 tests, one per root cause)
