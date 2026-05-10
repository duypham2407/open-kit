import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  CHECKPOINT_SCHEMA,
  EVENT_SCHEMA,
  SESSION_SCHEMA,
  appendSupervisorEvent,
  buildSupervisorEventsForTaskBoardChange,
  buildSupervisorEventsForStateChange,
  ensureSupervisorDialogueStore,
  listPendingSupervisorEvents,
  markSupervisorEventsDelivered,
  readSupervisorDialogueStore,
  recordInboundSupervisorMessage,
  recordSupervisorEventDeliveryAttempt,
  summarizeSupervisorDialogue,
} from '../lib/supervisor-dialogue-store.js'

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-supervisor-store-'))
}

test('ensureSupervisorDialogueStore creates session and checkpoint schemas', () => {
  const root = makeTempDir()
  const store = ensureSupervisorDialogueStore(root, 'feature-937')

  assert.equal(store.session.schema, SESSION_SCHEMA)
  assert.equal(store.session.work_item_id, 'feature-937')
  assert.equal(store.session.provider, 'openclaw')
  assert.equal(store.session.delivery_mode, 'watch')
  assert.equal(store.session.degraded_mode, true)
  assert.equal(store.checkpoint.schema, CHECKPOINT_SCHEMA)
  assert.deepEqual(store.checkpoint.dedupe_message_ids, [])
})

test('appendSupervisorEvent stores schema event and pending delivery cursor', () => {
  const root = makeTempDir()
  const event = appendSupervisorEvent(root, 'feature-937', {
    event_type: 'stage_changed',
    summary: 'Stage changed.',
    state_cursor: { stage: 'full_qa' },
    details: { from: 'full_code_review', to: 'full_qa' },
  })

  assert.equal(event.schema, EVENT_SCHEMA)
  assert.equal(event.origin, 'openkit')
  assert.equal(event.event_seq, 1)
  assert.equal(event.work_item_id, 'feature-937')
  assert.equal(event.delivery_status, 'pending')
  assert.equal(event.delivered_at, null)
  assert.equal(event.last_delivery_attempt_at, null)
  assert.equal(event.last_delivery_error, null)
  assert.deepEqual(event.delivery_attempts, [])

  const pending = listPendingSupervisorEvents(root, 'feature-937')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].event_type, 'stage_changed')

  markSupervisorEventsDelivered(root, 'feature-937', 1)
  assert.equal(listPendingSupervisorEvents(root, 'feature-937').length, 0)

  const store = readSupervisorDialogueStore(root, 'feature-937')
  assert.equal(store.outbound_events[0].delivery_status, 'delivered')
  assert.match(store.outbound_events[0].delivered_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(store.outbound_events[0].last_delivery_attempt_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(store.outbound_events[0].last_delivery_error, null)
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1)
  assert.equal(store.outbound_events[0].delivery_attempts[0].delivery_status, 'delivered')
})

test('recordSupervisorEventDeliveryAttempt preserves failed and skipped delivery visibility', () => {
  const root = makeTempDir()
  const failed = appendSupervisorEvent(root, 'feature-940', {
    event_type: 'verification_signal',
    summary: 'Verification recorded.',
  })
  const skipped = appendSupervisorEvent(root, 'feature-940', {
    event_type: 'supervisor_health_changed',
    summary: 'Supervisor disabled.',
  })

  recordSupervisorEventDeliveryAttempt(root, 'feature-940', failed.event_seq, {
    delivery_status: 'failed',
    error: 'OpenClaw timed out.',
  })
  recordSupervisorEventDeliveryAttempt(root, 'feature-940', skipped.event_seq, {
    delivery_status: 'skipped',
    error: 'Supervisor dialogue is disabled.',
  })

  const store = readSupervisorDialogueStore(root, 'feature-940')
  assert.equal(store.outbound_events[0].delivery_status, 'failed')
  assert.equal(store.outbound_events[0].last_delivery_error, 'OpenClaw timed out.')
  assert.equal(store.outbound_events[0].delivery_attempts.length, 1)
  assert.equal(store.outbound_events[1].delivery_status, 'skipped')
  assert.equal(store.outbound_events[1].last_delivery_error, 'Supervisor dialogue is disabled.')
  assert.equal(store.outbound_events[1].delivery_attempts.length, 1)

  const pending = listPendingSupervisorEvents(root, 'feature-940')
  assert.deepEqual(pending.map((event) => event.event_seq), [failed.event_seq])

  const summary = summarizeSupervisorDialogue(root, 'feature-940')
  assert.deepEqual(summary.counts.outbound_delivery_statuses, {
    pending: 0,
    delivered: 0,
    failed: 1,
    skipped: 1,
  })
})

test('recordInboundSupervisorMessage dedupes message ids and proposal keys', () => {
  const root = makeTempDir()
  const first = recordInboundSupervisorMessage(
    root,
    'feature-937',
    {
      message_id: 'msg-1',
      type: 'suggestion',
      intent: 'suggestion',
      target: 'tests/runtime/openclaw-supervisor-dialogue.test.js',
      subject: 'degraded mode coverage',
      body: 'Consider more tests.',
    },
    { disposition: 'recorded_suggestion', reason: 'safe', details: {} },
  )
  const duplicateMessage = recordInboundSupervisorMessage(
    root,
    'feature-937',
    {
      message_id: 'msg-1',
      type: 'suggestion',
      intent: 'suggestion',
      target: 'tests/runtime/openclaw-supervisor-dialogue.test.js',
      subject: 'another subject',
      body: 'Repeat.',
    },
    { disposition: 'recorded_suggestion', reason: 'safe', details: {} },
  )
  const duplicateProposal = recordInboundSupervisorMessage(
    root,
    'feature-937',
    {
      message_id: 'msg-2',
      type: 'suggestion',
      intent: 'suggestion',
      target: 'tests/runtime/openclaw-supervisor-dialogue.test.js',
      subject: 'degraded mode coverage',
      body: 'Different wording for the same proposed test coverage.',
    },
    { disposition: 'recorded_suggestion', reason: 'safe', details: {} },
  )

  assert.equal(first.adjudication.disposition, 'recorded_suggestion')
  assert.equal(first.adjudication.actionable, false)
  assert.equal(first.adjudication.duplicate_of, null)
  assert.equal(first.message.schema, 'openkit/supervisor-inbound-message@1')
  assert.equal(first.message.origin, 'openclaw')
  assert.equal(duplicateMessage.adjudication.disposition, 'duplicate_ignored')
  assert.equal(duplicateMessage.adjudication.reason, 'duplicate_message_id')
  assert.equal(duplicateMessage.adjudication.actionable, false)
  assert.equal(duplicateMessage.adjudication.duplicate_of, 'msg-1')
  assert.equal(duplicateProposal.adjudication.disposition, 'duplicate_ignored')
  assert.equal(duplicateProposal.adjudication.reason, 'duplicate_proposal_key')
  assert.equal(duplicateProposal.adjudication.actionable, false)
  assert.equal(duplicateProposal.adjudication.duplicate_of, 'msg-1')

  const store = readSupervisorDialogueStore(root, 'feature-937')
  assert.deepEqual(store.checkpoint.dedupe_message_ids, ['msg-1', 'msg-2'])
  assert.equal(store.checkpoint.dedupe_proposal_keys.length, 2)
  assert.equal(new Set(store.checkpoint.dedupe_proposal_keys).size, 2)
  assert.equal(store.inbound_messages.length, 3)
  assert.equal(store.adjudications.length, 3)
  assert.equal(store.dedupe_records.length, 2)
  assert.deepEqual(
    store.dedupe_records.map((record) => record.reason),
    ['duplicate_message_id', 'duplicate_proposal_key'],
  )
})

test('recordInboundSupervisorMessage rejects invalid minimum-information messages', () => {
  const root = makeTempDir()
  const invalid = recordInboundSupervisorMessage(
    root,
    'feature-940',
    { message_id: 'invalid-1', type: 'message', body: 'Please look at this.' },
    { disposition: 'recorded_suggestion', reason: 'safe', details: {} },
  )

  assert.equal(invalid.adjudication.disposition, 'invalid_rejected')
  assert.equal(invalid.adjudication.actionable, false)
  assert.equal(invalid.adjudication.authority_boundary, 'openkit_only_mutates_state_and_executes_code')
  assert.deepEqual(invalid.adjudication.details.missing_fields, ['intent', 'target'])

  const store = readSupervisorDialogueStore(root, 'feature-940')
  assert.equal(store.inbound_messages.length, 1)
  assert.equal(store.adjudications.length, 1)
  assert.equal(store.outbound_events.length, 0)
})

test('authority-boundary and acknowledgement records remain advisory and do not enqueue outbound events', () => {
  const root = makeTempDir()
  const rejected = recordInboundSupervisorMessage(
    root,
    'feature-940',
    {
      message_id: 'unsafe-1',
      type: 'request',
      intent: 'approve',
      target: 'qa_to_done',
      body: 'Approve qa_to_done now.',
    },
    { disposition: 'rejected_authority_boundary', reason: 'OpenClaw cannot approve gates.', details: { gate: 'qa_to_done' } },
  )
  const acknowledged = recordInboundSupervisorMessage(
    root,
    'feature-940',
    {
      message_id: 'ack-1',
      type: 'ack',
      intent: 'acknowledge',
      target: 'evt-feature-940-1',
      body: 'Event received.',
    },
    { disposition: 'acknowledged', reason: 'OpenClaw acknowledgement recorded.', details: {} },
  )

  assert.equal(rejected.adjudication.disposition, 'rejected_authority_boundary')
  assert.equal(rejected.adjudication.actionable, false)
  assert.equal(rejected.adjudication.authority_boundary, 'openkit_only_mutates_state_and_executes_code')
  assert.equal(acknowledged.adjudication.disposition, 'acknowledged')
  assert.equal(acknowledged.adjudication.actionable, false)
  assert.equal(acknowledged.adjudication.authority_boundary, 'openkit_only_mutates_state_and_executes_code')

  const store = readSupervisorDialogueStore(root, 'feature-940')
  assert.equal(store.outbound_events.length, 0)
  assert.equal(listPendingSupervisorEvents(root, 'feature-940').length, 0)
})

test('summarizeSupervisorDialogue reports pending and attention state', () => {
  const root = makeTempDir()
  appendSupervisorEvent(root, 'feature-937', {
    event_type: 'work_item_blocked',
    summary: 'Blocked.',
  })
  recordInboundSupervisorMessage(
    root,
    'feature-937',
    { message_id: 'attention-1', type: 'attention', intent: 'attention', target: 'work_item', body: 'Needs human review.' },
    { disposition: 'attention_required', reason: 'attention', details: {} },
  )

  const summary = summarizeSupervisorDialogue(root, 'feature-937')
  assert.equal(summary.present, true)
  assert.equal(summary.counts.pending_outbound_events, 1)
  assert.equal(summary.session.attention_required, true)
  assert.equal(summary.last_adjudication.disposition, 'attention_required')
})

test('buildSupervisorEventsForStateChange maps authority mutations to supervisor events', () => {
  const previousState = {
    current_stage: 'full_code_review',
    current_owner: 'CodeReviewer',
    status: 'in_progress',
    approvals: { code_review_to_qa: { status: 'pending' } },
    verification_evidence: [],
    issues: [],
  }
  const nextState = {
    current_stage: 'full_qa',
    current_owner: 'QAAgent',
    status: 'blocked',
    updated_at: '2026-04-25T00:00:00.000Z',
    approvals: { code_review_to_qa: { status: 'approved', approved_by: 'MasterOrchestrator' } },
    verification_evidence: [{ id: 'ev-1', scope: 'full_code_review' }],
    issues: [{ issue_id: 'issue-1', severity: 'high', current_status: 'open' }],
  }

  const events = buildSupervisorEventsForStateChange(previousState, nextState)
  assert.deepEqual(
    events.map((event) => event.event_type),
    ['stage_changed', 'approval_changed', 'verification_signal', 'issue_or_blocker_signal', 'work_item_blocked', 'human_attention_needed'],
  )
})

test('buildSupervisorEventsForStateChange maps issue status, unblock, pause, and resume signals', () => {
  const baseApproval = { status: 'approved' }
  const previousState = {
    current_stage: 'full_implementation',
    current_owner: 'FullstackAgent',
    status: 'blocked',
    approvals: { solution_to_fullstack: baseApproval },
    verification_evidence: [],
    issues: [{ issue_id: 'issue-1', severity: 'high', current_status: 'open' }],
  }
  const nextState = {
    ...previousState,
    status: 'in_progress',
    updated_at: '2026-04-25T00:00:00.000Z',
    issues: [{ issue_id: 'issue-1', severity: 'high', current_status: 'resolved' }],
  }

  assert.deepEqual(
    buildSupervisorEventsForStateChange(previousState, nextState).map((event) => event.event_type),
    ['issue_status_changed', 'work_item_unblocked'],
  )

  assert.deepEqual(
    buildSupervisorEventsForStateChange(
      { ...previousState, status: 'in_progress' },
      { ...nextState, status: 'paused', issues: previousState.issues },
    ).map((event) => event.event_type),
    ['work_item_paused', 'human_attention_needed'],
  )

  assert.deepEqual(
    buildSupervisorEventsForStateChange(
      { ...previousState, status: 'paused' },
      { ...nextState, status: 'in_progress', issues: previousState.issues },
    ).map((event) => event.event_type),
    ['work_item_resumed'],
  )
})

test('buildSupervisorEventsForTaskBoardChange maps task status and blocker signals', () => {
  const previousBoard = {
    tasks: [
      {
        task_id: 'TASK-1',
        title: 'Task one',
        status: 'ready',
        blocked_by: ['BLOCKER-1'],
        primary_owner: null,
        qa_owner: null,
      },
    ],
  }
  const nextBoard = {
    tasks: [
      {
        task_id: 'TASK-1',
        title: 'Task one',
        status: 'claimed',
        blocked_by: [],
        primary_owner: 'Dev-A',
        qa_owner: null,
      },
    ],
  }

  const events = buildSupervisorEventsForTaskBoardChange(
    { current_stage: 'full_implementation', status: 'in_progress', updated_at: '2026-04-25T00:00:00.000Z' },
    previousBoard,
    nextBoard,
  )

  assert.deepEqual(events.map((event) => event.event_type), ['task_status_changed', 'task_unblocked'])
  assert.equal(events[0].details.task_id, 'TASK-1')
  assert.equal(events[0].details.previous_status, 'ready')
  assert.equal(events[0].details.status, 'claimed')
})
