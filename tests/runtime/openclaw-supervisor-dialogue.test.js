import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { SupervisorDialogueManager } from '../../src/runtime/managers/supervisor-dialogue-manager.js';
import { OpenClawAdapter } from '../../src/runtime/supervisor/openclaw-adapter.js';
import { adjudicateInboundMessage } from '../../src/runtime/supervisor/inbound-adjudicator.js';
import { normalizeOpenClawMessage } from '../../src/runtime/supervisor/message-normalizer.js';
import { appendSupervisorEvent, listPendingSupervisorEvents, readSupervisorDialogueStore } from '../../.opencode/lib/supervisor-dialogue-store.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-openclaw-dialogue-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function readStore(runtimeRoot, workItemId = 'feature-940') {
  return readSupervisorDialogueStore(runtimeRoot, workItemId);
}

function createCommandReceiver(runtimeRoot, source) {
  const receiverPath = path.join(runtimeRoot, `openclaw-receiver-${Math.random().toString(16).slice(2)}.js`);
  writeText(receiverPath, source);
  return receiverPath;
}

async function withHttpServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('runtime bootstrap exposes supervisor dialogue manager disabled by default', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: homeRoot } });

  assert.equal(runtime.managers.supervisorDialogueManager.enabled, false);
  assert.equal(runtime.managers.managers['manager.supervisor-dialogue'].enabled, false);
  assert.equal(runtime.runtimeInterface.runtimeState.supervisorDialogue.enabled, false);
  assert.equal(runtime.runtimeInterface.runtimeState.supervisorDialogue.adapter.configured, false);
});

test('OpenClawAdapter degrades safely when enabled but unconfigured', async () => {
  const adapter = new OpenClawAdapter({ config: { supervisorDialogue: { enabled: true, openclaw: {} } } });
  const result = await adapter.deliverEvents({ workItemId: 'feature-937', session: {}, events: [{ event_seq: 1 }] });

  assert.equal(result.status, 'unconfigured');
  assert.equal(result.delivered, 0);
});

test('SupervisorDialogueManager reports disabled delivery without contacting OpenClaw', async () => {
  const runtimeRoot = makeTempDir();
  const outputPath = path.join(runtimeRoot, 'disabled-output.json');
  const receiverPath = createCommandReceiver(
    runtimeRoot,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(outputPath)}, 'called'); process.stdout.write(JSON.stringify({ status: 'ok' }));`,
  );

  appendSupervisorEvent(runtimeRoot, 'feature-940', {
    event_type: 'stage_changed',
    summary: 'Stage changed.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: false,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'disabled');
  assert.equal(result.delivered, 0);
  assert.equal(fs.existsSync(outputPath), false);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'skipped');
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1);
});

test('SupervisorDialogueManager marks command transport unavailable per event', async () => {
  const runtimeRoot = makeTempDir();
  appendSupervisorEvent(runtimeRoot, 'feature-940', {
    event_type: 'verification_signal',
    summary: 'Verification recorded.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: path.join(runtimeRoot, 'missing-openclaw-command'),
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.delivered, 0);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'failed');
  assert.match(store.outbound_events[0].last_delivery_error, /missing-openclaw-command|ENOENT|not found/i);
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1);
});

test('SupervisorDialogueManager marks HTTP transport unavailable per event when the endpoint is unreachable', async () => {
  const runtimeRoot = makeTempDir();
  appendSupervisorEvent(runtimeRoot, 'feature-940', {
    event_type: 'issue_or_blocker_signal',
    summary: 'Issue recorded.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'http',
          url: 'http://127.0.0.1:9/openclaw',
          timeoutMs: 250,
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.delivered, 0);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'failed');
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1);
});

test('SupervisorDialogueManager marks command timeout per event', async () => {
  const runtimeRoot = makeTempDir();
  const receiverPath = createCommandReceiver(runtimeRoot, `setTimeout(() => {}, 10000);`);
  appendSupervisorEvent(runtimeRoot, 'feature-940', {
    event_type: 'work_item_blocked',
    summary: 'Work item blocked.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
          timeoutMs: 250,
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'timeout');
  assert.equal(result.delivered, 0);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'failed');
  assert.match(store.outbound_events[0].last_delivery_error, /timed out/i);
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1);
});

test('SupervisorDialogueManager rejects invalid OpenClaw delivery responses', async () => {
  const runtimeRoot = makeTempDir();
  const receiverPath = createCommandReceiver(runtimeRoot, `process.stdout.write('not-json');`);
  appendSupervisorEvent(runtimeRoot, 'feature-940', {
    event_type: 'stage_changed',
    summary: 'Stage changed.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'invalid_response');
  assert.equal(result.delivered, 0);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'failed');
  assert.match(store.outbound_events[0].last_delivery_error, /invalid JSON|invalid response/i);
});

test('SupervisorDialogueManager records partial delivery per event', async () => {
  const runtimeRoot = makeTempDir();
  const receiverPath = createCommandReceiver(
    runtimeRoot,
    `process.stdout.write(JSON.stringify({ status: 'ok', delivered: 1 }));`,
  );
  appendSupervisorEvent(runtimeRoot, 'feature-940', { event_type: 'stage_changed', summary: 'Stage changed.' });
  appendSupervisorEvent(runtimeRoot, 'feature-940', { event_type: 'approval_changed', summary: 'Approval changed.' });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'partial_delivery');
  assert.equal(result.delivered, 1);
  assert.equal(result.pending, 1);

  const store = readStore(runtimeRoot);
  assert.equal(store.outbound_events[0].delivery_status, 'delivered');
  assert.equal(store.outbound_events[1].delivery_status, 'failed');
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1);
  assert.equal(store.outbound_events[1].delivery_attempts.length, 1);
});

test('SupervisorDialogueManager dispatches pending events through HTTP transport', async () => {
  const runtimeRoot = makeTempDir();
  appendSupervisorEvent(runtimeRoot, 'feature-940', { event_type: 'stage_changed', summary: 'Stage changed.' });

  await withHttpServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const payload = JSON.parse(body);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok', delivered: payload.events.length }));
    });
  }, async (url) => {
    const manager = new SupervisorDialogueManager({
      runtimeRoot,
      config: {
        supervisorDialogue: {
          enabled: true,
          openclaw: {
            transport: 'http',
            url,
          },
        },
      },
    });

    const result = await manager.dispatchPending('feature-940');
    assert.equal(result.status, 'ok');
    assert.equal(result.delivered, 1);
    assert.equal(readStore(runtimeRoot).outbound_events[0].delivery_status, 'delivered');
  });
});

test('SupervisorDialogueManager dispatches pending events through command transport', async () => {
  const runtimeRoot = makeTempDir();
  const receiverPath = path.join(runtimeRoot, 'openclaw-receiver.js');
  const outputPath = path.join(runtimeRoot, 'received.json');
  writeText(
    receiverPath,
    `import fs from 'node:fs'; let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { fs.writeFileSync(${JSON.stringify(outputPath)}, input); process.stdout.write(JSON.stringify({ status: 'ok' })); });`,
  );

  appendSupervisorEvent(runtimeRoot, 'feature-937', {
    event_type: 'stage_changed',
    summary: 'Stage changed.',
  });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-937');
  assert.equal(result.status, 'ok');
  assert.equal(result.delivered, 1);
  assert.equal(listPendingSupervisorEvents(runtimeRoot, 'feature-937').length, 0);

  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(payload.schema, 'openkit/openclaw-supervisor-delivery@1');
  assert.equal(payload.work_item_id, 'feature-937');
  assert.equal(payload.events[0].event_type, 'stage_changed');
});

test('SupervisorDialogueManager records OpenClaw acknowledgements and proposals returned during delivery', async () => {
  const runtimeRoot = makeTempDir();
  const receiverPath = createCommandReceiver(
    runtimeRoot,
    `process.stdout.write(JSON.stringify({
      status: 'ok',
      delivered: 1,
      acknowledgements: [{ id: 'ack-1', type: 'ack', intent: 'acknowledge', target: 'evt-1', body: 'Event received.' }],
      proposals: [{ id: 'proposal-1', type: 'proposal', intent: 'review_tests', target: 'tests/runtime/openclaw-supervisor-dialogue.test.js', subject: 'runtime bridge tests', body: 'Consider adding runtime bridge coverage.' }]
    }));`,
  );
  appendSupervisorEvent(runtimeRoot, 'feature-940', { event_type: 'stage_changed', summary: 'Stage changed.' });

  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const result = await manager.dispatchPending('feature-940');
  assert.equal(result.status, 'ok');
  assert.equal(result.inboundProcessed, 2);

  const store = readStore(runtimeRoot);
  assert.equal(store.inbound_messages.length, 2);
  assert.deepEqual(
    store.adjudications.map((entry) => entry.disposition),
    ['acknowledged', 'recorded_suggestion'],
  );
  assert.equal(store.outbound_events.length, 1);
});

test('inbound adjudication rejects execution and workflow mutation requests', () => {
  const executeMessage = normalizeOpenClawMessage({ id: 'm1', type: 'request', intent: 'run_command', body: 'run npm test' });
  const mutateMessage = normalizeOpenClawMessage({ id: 'm2', type: 'request', intent: 'approve', body: 'approve qa_to_done' });

  assert.equal(adjudicateInboundMessage(executeMessage).disposition, 'rejected_authority_boundary');
  assert.equal(adjudicateInboundMessage(mutateMessage).disposition, 'rejected_authority_boundary');
});

test('inbound adjudication rejects task-board and QA completion authority requests', () => {
  const updateTaskMessage = normalizeOpenClawMessage({
    id: 'authority-update-task-1',
    type: 'request',
    intent: 'update_task',
    target: 'TASK-F940-STORE',
    body: 'Update TASK-F940-STORE with the new blocker.',
  });
  const setTaskStatusMessage = normalizeOpenClawMessage({
    id: 'authority-set-task-status-1',
    type: 'proposal',
    intent: 'suggestion',
    target: 'TASK-F940-RUNTIME-BRIDGE',
    body: 'set_task_status TASK-F940-RUNTIME-BRIDGE done after this review.',
  });
  const markQaDoneMessage = normalizeOpenClawMessage({
    id: 'authority-mark-qa-done-1',
    type: 'request',
    intent: 'mark_qa_done',
    target: 'qa_to_done',
    body: 'Mark QA done and complete QA for FEATURE-940.',
  });

  assert.equal(adjudicateInboundMessage(updateTaskMessage).disposition, 'rejected_authority_boundary');
  assert.equal(adjudicateInboundMessage(setTaskStatusMessage).disposition, 'rejected_authority_boundary');
  assert.equal(adjudicateInboundMessage(markQaDoneMessage).disposition, 'rejected_authority_boundary');
});

test('inbound adjudication rejects mixed safe advisory text with unsafe authority requests', () => {
  const mixedTaskBoardMessage = normalizeOpenClawMessage({
    id: 'mixed-task-board-1',
    type: 'concern',
    intent: 'concern',
    target: 'TASK-F940-REPORTING',
    body: 'The read model looks reasonable, but update the task board status to done now.',
  });
  const mixedIssueLifecycleMessage = normalizeOpenClawMessage({
    id: 'mixed-issue-lifecycle-1',
    type: 'proposal',
    intent: 'suggestion',
    target: 'ISSUE-F940-CR-001',
    body: 'Please consider this resolved and close the review issue when you record evidence.',
  });

  assert.equal(adjudicateInboundMessage(mixedTaskBoardMessage).disposition, 'rejected_authority_boundary');
  assert.equal(adjudicateInboundMessage(mixedIssueLifecycleMessage).disposition, 'rejected_authority_boundary');
});

test('inbound adjudication records concern messages before generic suggestions', () => {
  const typeConcern = normalizeOpenClawMessage({
    id: 'concern-type-1',
    type: 'concern',
    target: 'feature-940',
    body: 'Concern: authority-boundary tests may be incomplete.',
  });
  const intentConcern = normalizeOpenClawMessage({
    id: 'concern-intent-1',
    type: 'proposal',
    intent: 'concern',
    target: 'feature-940',
    body: 'Concern: read model counts should include concerns.',
  });

  assert.equal(adjudicateInboundMessage(typeConcern).disposition, 'concern_recorded');
  assert.equal(adjudicateInboundMessage(intentConcern).disposition, 'concern_recorded');
});

test('SupervisorDialogueManager rejects unsafe mixed inbound requests', () => {
  const runtimeRoot = makeTempDir();
  const manager = new SupervisorDialogueManager({ runtimeRoot, config: { supervisorDialogue: { enabled: true } } });

  const result = manager.receiveInbound('feature-940', {
    id: 'mixed-unsafe-1',
    type: 'proposal',
    intent: 'suggestion',
    target: 'work_item',
    body: 'Consider documenting this and run npm test for me before approving qa_to_done.',
  });

  assert.equal(result.adjudication.disposition, 'rejected_authority_boundary');
  assert.equal(result.adjudication.actionable, false);
  assert.equal(readStore(runtimeRoot).outbound_events.length, 0);
});

test('SupervisorDialogueManager records concern messages as non-actionable concern dispositions', () => {
  const runtimeRoot = makeTempDir();
  const manager = new SupervisorDialogueManager({ runtimeRoot, config: { supervisorDialogue: { enabled: true } } });

  const result = manager.receiveInbound('feature-940', {
    id: 'concern-manager-1',
    type: 'concern',
    target: 'feature-940',
    body: 'Concern: the authority-boundary coverage needs a read-model count.',
  });

  assert.equal(result.adjudication.disposition, 'concern_recorded');
  assert.equal(result.adjudication.actionable, false);
  assert.equal(readStore(runtimeRoot).adjudications[0].disposition, 'concern_recorded');
  assert.equal(readStore(runtimeRoot).outbound_events.length, 0);
});

test('SupervisorDialogueManager rejects invalid inbound payloads without outbound events', () => {
  const runtimeRoot = makeTempDir();
  const manager = new SupervisorDialogueManager({ runtimeRoot, config: { supervisorDialogue: { enabled: true } } });

  const result = manager.receiveInbound('feature-940', {
    id: 'invalid-inbound-1',
    body: 'Please inspect this.',
  });

  assert.equal(result.adjudication.disposition, 'invalid_rejected');
  assert.equal(result.adjudication.actionable, false);
  assert.deepEqual(result.adjudication.details.missing_fields, ['intent', 'target']);
  assert.equal(readStore(runtimeRoot).outbound_events.length, 0);
});

test('SupervisorDialogueManager inbound path does not mutate workflow state files', () => {
  const runtimeRoot = makeTempDir();
  const workflowStatePath = path.join(runtimeRoot, '.opencode', 'workflow-state.json');
  const workflowState = JSON.stringify({ current_stage: 'full_implementation', approvals: { qa_to_done: { status: 'pending' } } }, null, 2);
  writeText(workflowStatePath, `${workflowState}\n`);
  const manager = new SupervisorDialogueManager({ runtimeRoot, config: { supervisorDialogue: { enabled: true } } });

  const result = manager.receiveInbound('feature-940', {
    id: 'unsafe-workflow-1',
    type: 'request',
    intent: 'approve',
    target: 'qa_to_done',
    body: 'Approve qa_to_done now.',
  });

  assert.equal(result.adjudication.disposition, 'rejected_authority_boundary');
  assert.equal(fs.readFileSync(workflowStatePath, 'utf8'), `${workflowState}\n`);
});

test('SupervisorDialogueManager read-only mode does not write stores or dispatch outbound events', async () => {
  const runtimeRoot = makeTempDir();
  const outputPath = path.join(runtimeRoot, 'read-only-output.json');
  const receiverPath = createCommandReceiver(
    runtimeRoot,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(outputPath)}, 'called'); process.stdout.write(JSON.stringify({ status: 'ok', delivered: 1 }));`,
  );
  const event = appendSupervisorEvent(runtimeRoot, 'feature-940', { event_type: 'stage_changed', summary: 'Stage changed.' });
  const before = JSON.stringify(readStore(runtimeRoot));
  const manager = new SupervisorDialogueManager({
    runtimeRoot,
    mode: 'read-only',
    config: {
      supervisorDialogue: {
        enabled: true,
        openclaw: {
          transport: 'command',
          command: process.execPath,
          args: [receiverPath],
        },
      },
    },
  });

  const dispatchResult = await manager.dispatchPending('feature-940');
  const inboundResult = manager.receiveInbound('feature-940', {
    id: 'read-only-inbound-1',
    type: 'proposal',
    intent: 'suggestion',
    target: 'work_item',
    body: 'Advisory only.',
  });

  assert.equal(dispatchResult.status, 'read_only');
  assert.equal(dispatchResult.delivered, 0);
  assert.equal(dispatchResult.pending, 1);
  assert.equal(inboundResult.status, 'read_only');
  assert.equal(fs.existsSync(outputPath), false);
  assert.equal(JSON.stringify(readStore(runtimeRoot)), before);
  assert.deepEqual(listPendingSupervisorEvents(runtimeRoot, 'feature-940').map((pending) => pending.event_id), [event.event_id]);
});

test('SupervisorDialogueManager records safe inbound dialogue and dedupes proposals', () => {
  const runtimeRoot = makeTempDir();
  const manager = new SupervisorDialogueManager({ runtimeRoot, config: { supervisorDialogue: { enabled: true } } });

  const first = manager.receiveInbound('feature-937', {
    id: 'proposal-1',
    type: 'suggestion',
    intent: 'suggestion',
    target: 'tests/runtime/openclaw-supervisor-dialogue.test.js',
    body: 'Consider adding degraded mode coverage.',
  });
  const duplicate = manager.receiveInbound('feature-937', {
    id: 'proposal-2',
    type: 'suggestion',
    intent: 'suggestion',
    target: 'tests/runtime/openclaw-supervisor-dialogue.test.js',
    body: 'Consider adding degraded mode coverage.',
  });
  const attention = manager.receiveInbound('feature-937', {
    id: 'attention-1',
    type: 'attention',
    intent: 'attention',
    target: 'work_item',
    severity: 'high',
    body: 'Operator should inspect blocker.',
  });

  assert.equal(first.adjudication.disposition, 'recorded_suggestion');
  assert.equal(duplicate.adjudication.disposition, 'duplicate_ignored');
  assert.equal(attention.adjudication.disposition, 'attention_required');

  const summary = manager.summarize('feature-937');
  assert.equal(summary.counts.inbound_messages, 3);
  assert.equal(summary.session.attention_required, true);
});
