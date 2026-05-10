import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuditLogTool } from '../../runtime/tools/workflow/audit-log.js';

function createMockKernel(state) {
  return {
    showState() {
      return { state };
    },
  };
}

function createMockLogger(entries = []) {
  return {
    getEntries({ limit } = {}) {
      return limit ? entries.slice(0, limit) : entries;
    },
  };
}

// ── No workflow state ───────────────────────────────────────────────────

test('audit returns empty summary when no state or logger', () => {
  const tool = createAuditLogTool({ workflowKernel: null, invocationLogger: null });
  const result = tool.execute();
  assert.ok(result.timestamp);
  assert.equal(result.summary.totalInvocations, 0);
  assert.equal(result.summary.blockedCalls, 0);
  assert.equal(result.summary.stageTransitions, 0);
  assert.ok(result.loggerStatus);
});

test('audit surfaces structured workflow state errors without currentState', () => {
  const error = { reason: 'controller_exception', code: 'ERR_BAD_STATE', message: 'bad workflow json' };
  const tool = createAuditLogTool({
    workflowKernel: { showState: () => ({ statePath: null, state: null, error }) },
    invocationLogger: null,
  });

  const result = tool.execute();

  assert.deepEqual(result.workflowStateError, error);
  assert.equal(Object.hasOwn(result, 'currentState'), false);
});

// ── With invocation logger ──────────────────────────────────────────────

test('audit counts total invocations from logger', () => {
  const entries = [
    { timestamp: '2026-01-01T00:01:00Z', toolId: 'tool.hashline-edit', role: 'FullstackAgent', blocked: false },
    { timestamp: '2026-01-01T00:02:00Z', toolId: 'tool.workflow-state', role: 'MasterOrchestrator', blocked: false },
    { timestamp: '2026-01-01T00:03:00Z', toolId: 'tool.hashline-edit', role: 'MasterOrchestrator', blocked: true, blockedBy: 'role-permission', reason: 'blocked' },
  ];

  const tool = createAuditLogTool({
    workflowKernel: null,
    invocationLogger: createMockLogger(entries),
  });

  const result = tool.execute();
  assert.equal(result.summary.totalInvocations, 3);
  assert.equal(result.summary.blockedCalls, 1);
  assert.equal(result.summary.violationsByRole.MasterOrchestrator, 1);
});

test('audit recent events include all entries', () => {
  const entries = [
    { timestamp: '2026-01-01T00:01:00Z', toolId: 'tool.hashline-edit', role: 'FullstackAgent', blocked: false },
    { timestamp: '2026-01-01T00:02:00Z', toolId: 'tool.hashline-edit', role: 'MasterOrchestrator', blocked: true, blockedBy: 'role-permission', reason: 'not allowed' },
  ];

  const tool = createAuditLogTool({
    workflowKernel: null,
    invocationLogger: createMockLogger(entries),
  });

  const result = tool.execute();
  assert.equal(result.recentEvents.length, 2);

  const blockedEvent = result.recentEvents.find((e) => e.status === 'blocked');
  assert.ok(blockedEvent);
  assert.equal(blockedEvent.toolId, 'tool.hashline-edit');
  assert.equal(blockedEvent.role, 'MasterOrchestrator');
  assert.equal(blockedEvent.blockedBy, 'role-permission');
});

// ── With workflow state ─────────────────────────────────────────────────

test('audit includes current state info', () => {
  const tool = createAuditLogTool({
    workflowKernel: createMockKernel({
      mode: 'full',
      current_stage: 'full_implementation',
      current_owner: 'FullstackAgent',
      verification_evidence: [],
    }),
    invocationLogger: null,
  });

  const result = tool.execute();
  assert.equal(result.currentState.mode, 'full');
  assert.equal(result.currentState.stage, 'full_implementation');
  assert.equal(result.currentState.owner, 'FullstackAgent');
});

test('audit counts evidence items from state', () => {
  const tool = createAuditLogTool({
    workflowKernel: createMockKernel({
      mode: 'full',
      current_stage: 'full_implementation',
      current_owner: 'FullstackAgent',
      verification_evidence: [
        { type: 'stage_transition', transition: { from: 'full_solution', to: 'full_implementation', timestamp: '2026-01-01T00:00:00Z', previousOwner: 'SolutionLead', newOwner: 'FullstackAgent' } },
        { type: 'test_result', data: { passed: true } },
      ],
    }),
    invocationLogger: null,
  });

  const result = tool.execute();
  assert.equal(result.summary.evidenceItems, 2);
  assert.equal(result.summary.stageTransitions, 1);
});

test('audit includes transition events from evidence', () => {
  const tool = createAuditLogTool({
    workflowKernel: createMockKernel({
      mode: 'full',
      current_stage: 'full_implementation',
      current_owner: 'FullstackAgent',
      verification_evidence: [
        {
          type: 'stage_transition',
          transition: {
            from: 'full_solution',
            to: 'full_implementation',
            timestamp: '2026-01-01T00:05:00Z',
            previousOwner: 'SolutionLead',
            newOwner: 'FullstackAgent',
          },
        },
      ],
    }),
    invocationLogger: null,
  });

  const result = tool.execute();
  const transition = result.recentEvents.find((e) => e.status === 'transition');
  assert.ok(transition);
  assert.equal(transition.from, 'full_solution');
  assert.equal(transition.to, 'full_implementation');
  assert.equal(transition.newOwner, 'FullstackAgent');
});

// ── Filter ──────────────────────────────────────────────────────────────

test('audit filter by status=blocked', () => {
  const entries = [
    { timestamp: '2026-01-01T00:01:00Z', toolId: 'tool.hashline-edit', role: 'FullstackAgent', blocked: false },
    { timestamp: '2026-01-01T00:02:00Z', toolId: 'tool.hashline-edit', role: 'MasterOrchestrator', blocked: true, reason: 'blocked' },
  ];

  const tool = createAuditLogTool({
    workflowKernel: null,
    invocationLogger: createMockLogger(entries),
  });

  const result = tool.execute({ filter: 'blocked' });
  assert.equal(result.recentEvents.length, 1);
  assert.equal(result.recentEvents[0].status, 'blocked');
});

test('audit filter by role', () => {
  const entries = [
    { timestamp: '2026-01-01T00:01:00Z', toolId: 'tool.hashline-edit', role: 'FullstackAgent', blocked: false },
    { timestamp: '2026-01-01T00:02:00Z', toolId: 'tool.workflow-state', role: 'MasterOrchestrator', blocked: false },
  ];

  const tool = createAuditLogTool({
    workflowKernel: null,
    invocationLogger: createMockLogger(entries),
  });

  const result = tool.execute({ filter: 'MasterOrchestrator' });
  assert.equal(result.recentEvents.length, 1);
  assert.equal(result.recentEvents[0].role, 'MasterOrchestrator');
});

// ── Limit ───────────────────────────────────────────────────────────────

test('audit respects limit parameter', () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({
    timestamp: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`,
    toolId: 'tool.hashline-edit',
    role: 'FullstackAgent',
    blocked: false,
  }));

  const tool = createAuditLogTool({
    workflowKernel: null,
    invocationLogger: createMockLogger(entries),
  });

  const result = tool.execute({ limit: 10 });
  assert.ok(result.recentEvents.length <= 10);
});

// ── Tool metadata ───────────────────────────────────────────────────────

test('audit tool has correct id and family', () => {
  const tool = createAuditLogTool({ workflowKernel: null, invocationLogger: null });
  assert.equal(tool.id, 'tool.workflow-audit');
  assert.equal(tool.family, 'workflow');
});
