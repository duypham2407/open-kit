import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

import { resolveWorkItemPaths } from "./work-item-store.js"

const SESSION_SCHEMA = "openkit/supervisor-session@1"
const CHECKPOINT_SCHEMA = "openkit/supervisor-checkpoint@1"
const EVENT_SCHEMA = "openkit/supervisor-event@1"
const STORE_SCHEMA = "openkit/supervisor-dialogue-store@1"
const INBOUND_MESSAGE_SCHEMA = "openkit/supervisor-inbound-message@1"
const DELIVERY_STATE_SCHEMA = "openkit/supervisor-delivery-state@1"
const DEDUPE_RECORD_SCHEMA = "openkit/supervisor-dedupe-record@1"
const MAX_DEDUPE_ENTRIES = 100
const DELIVERY_STATUSES = new Set(["pending", "delivered", "failed", "skipped"])
const RETRYABLE_DELIVERY_STATUSES = new Set(["pending", "failed"])
const PROPOSAL_TYPES = new Set(["proposal", "suggestion", "request"])
const ACK_TYPES = new Set(["ack", "acknowledge", "acknowledgement"])

function timestamp() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16)
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function normalizeDeliveryStatus(value, fallback = "pending") {
  return DELIVERY_STATUSES.has(value) ? value : fallback
}

function getMessageIntent(message) {
  return normalizeToken(message?.intent ?? message?.action ?? message?.type)
}

function getMessageType(message) {
  return normalizeToken(message?.type ?? message?.kind ?? message?.message_type)
}

function getMessageTarget(message) {
  return normalizeText(message?.target ?? message?.workflow_target ?? message?.path)
}

function getMessageBody(message) {
  return normalizeText(message?.body ?? message?.summary ?? message?.message ?? message?.text)
}

function getMessageSubject(message) {
  return normalizeText(message?.subject ?? message?.action_subject ?? message?.details?.subject ?? message?.raw?.subject)
}

function isAcknowledgementMessage(message) {
  return ACK_TYPES.has(getMessageType(message)) || ACK_TYPES.has(getMessageIntent(message))
}

function isProposalLikeMessage(message) {
  if (isAcknowledgementMessage(message)) {
    return false
  }

  return PROPOSAL_TYPES.has(getMessageType(message)) || PROPOSAL_TYPES.has(getMessageIntent(message))
}

function deriveProposalKey(message) {
  if (!isProposalLikeMessage(message)) {
    return null
  }

  const target = normalizeToken(getMessageTarget(message))
  const intent = normalizeToken(getMessageIntent(message) || getMessageType(message))
  const subject = normalizeToken(getMessageSubject(message))
  if (!target || !intent) {
    return null
  }

  return `proposal:${hashValue(`${target}:${intent}:${subject}`)}`
}

function findMissingInboundFields(message) {
  const missing = []
  if (!normalizeToken(message?.intent ?? message?.action)) {
    missing.push("intent")
  }
  if (!getMessageTarget(message)) {
    missing.push("target")
  }
  if (!getMessageBody(message)) {
    missing.push("body")
  }
  return missing
}

function getSupervisorStorePath(root, workItemId) {
  return path.join(resolveWorkItemPaths(root, workItemId).workItemDir, "supervisor-dialogue.json")
}

function createEmptySession(workItemId) {
  const now = timestamp()
  return {
    schema: SESSION_SCHEMA,
    work_item_id: workItemId,
    session_id: `supervisor-${workItemId}-${hashValue(`${workItemId}:${now}`)}`,
    session_sequence: 1,
    status: "attached",
    attached_work_item_id: workItemId,
    provider: "openclaw",
    transport_health: "unconfigured",
    delivery_mode: "watch",
    degraded_mode: true,
    attention_required: false,
    timestamps: {
      created_at: now,
      updated_at: now,
      attached_at: now,
      detached_at: null,
    },
    last_detach_reason: null,
  }
}

function createEmptyCheckpoint() {
  return {
    schema: CHECKPOINT_SCHEMA,
    last_outbound_event_seq: 0,
    last_delivered_outbound_seq: 0,
    last_inbound_message_seq: 0,
    last_processed_inbound_seq: 0,
    dedupe_message_ids: [],
    dedupe_proposal_keys: [],
    updated_at: timestamp(),
  }
}

function createEmptyStore(workItemId) {
  return {
    schema: STORE_SCHEMA,
    session: createEmptySession(workItemId),
    checkpoint: createEmptyCheckpoint(),
    outbound_events: [],
    inbound_messages: [],
    adjudications: [],
    dedupe_records: [],
    delivery_records: [],
  }
}

function normalizeDeliveryAttempt(attempt, fallbackStatus = "pending", fallbackAttemptedAt = null) {
  const status = normalizeDeliveryStatus(attempt?.delivery_status ?? attempt?.status, fallbackStatus)
  return {
    attempted_at: attempt?.attempted_at ?? attempt?.created_at ?? fallbackAttemptedAt ?? timestamp(),
    delivery_status: status,
    error: attempt?.error ?? attempt?.last_delivery_error ?? null,
    details: attempt?.details ?? {},
  }
}

function normalizeOutboundEvent(event, workItemId, fallbackSeq, deliveredCursor) {
  const eventSeq = Number(event?.event_seq) || fallbackSeq
  const fallbackStatus = eventSeq <= deliveredCursor ? "delivered" : "pending"
  const deliveryStatus = normalizeDeliveryStatus(event?.delivery_status, fallbackStatus)
  const createdAt = event?.created_at ?? timestamp()
  const attempts = Array.isArray(event?.delivery_attempts)
    ? event.delivery_attempts.map((attempt) => normalizeDeliveryAttempt(attempt, deliveryStatus, event?.last_delivery_attempt_at ?? createdAt))
    : []
  const lastAttempt = attempts[attempts.length - 1] ?? null
  const deliveredAt = event?.delivered_at ?? (deliveryStatus === "delivered" ? lastAttempt?.attempted_at ?? createdAt : null)
  return {
    schema: EVENT_SCHEMA,
    origin: "openkit",
    event_type: event?.event_type,
    state_cursor: event?.state_cursor ?? null,
    summary: event?.summary,
    details: event?.details ?? {},
    event_id: event?.event_id ?? `evt-${workItemId}-${eventSeq}-${hashValue(`${event?.event_type ?? "event"}:${createdAt}`)}`,
    event_seq: eventSeq,
    work_item_id: workItemId,
    created_at: createdAt,
    delivery_status: deliveryStatus,
    delivered_at: deliveredAt,
    last_delivery_attempt_at: event?.last_delivery_attempt_at ?? lastAttempt?.attempted_at ?? null,
    last_delivery_error: event?.last_delivery_error ?? lastAttempt?.error ?? null,
    delivery_attempts: attempts,
  }
}

function normalizeInboundMessageRecord(message, workItemId, fallbackSeq) {
  const messageSeq = Number(message?.message_seq) || fallbackSeq
  const createdAt = message?.created_at ?? message?.received_at ?? timestamp()
  return {
    ...message,
    schema: INBOUND_MESSAGE_SCHEMA,
    origin: "openclaw",
    message_id: message?.message_id ?? `msg-${workItemId}-${messageSeq}-${hashValue(createdAt)}`,
    message_seq: messageSeq,
    work_item_id: workItemId,
    type: getMessageType(message) || "message",
    intent: getMessageIntent(message) || null,
    target: getMessageTarget(message) || null,
    body: getMessageBody(message),
    severity: normalizeToken(message?.severity ?? "info") || "info",
    created_at: createdAt,
    received_at: message?.received_at ?? createdAt,
    proposal_key: message?.proposal_key ?? deriveProposalKey(message),
    raw: message?.raw ?? { ...message },
  }
}

function normalizeAdjudicationRecord(adjudication, fallbackMessage = {}) {
  return {
    ...adjudication,
    message_id: adjudication?.message_id ?? fallbackMessage.message_id ?? null,
    message_seq: adjudication?.message_seq ?? fallbackMessage.message_seq ?? null,
    proposal_key: adjudication?.proposal_key ?? fallbackMessage.proposal_key ?? null,
    disposition: adjudication?.disposition ?? "recorded_suggestion",
    actionable: false,
    reason: adjudication?.reason ?? null,
    authority_boundary: "openkit_only_mutates_state_and_executes_code",
    duplicate_of: adjudication?.duplicate_of ?? null,
    created_at: adjudication?.created_at ?? timestamp(),
    details: adjudication?.details ?? {},
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeStore(root, workItemId, store) {
  const storePath = getSupervisorStorePath(root, workItemId)
  fs.mkdirSync(path.dirname(storePath), { recursive: true })
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8")
  return store
}

function normalizeStore(root, workItemId) {
  const existing = readJsonIfExists(getSupervisorStorePath(root, workItemId))
  const base = existing && typeof existing === "object" ? existing : createEmptyStore(workItemId)
  const checkpoint = {
    ...createEmptyCheckpoint(),
    ...(base.checkpoint ?? {}),
    schema: CHECKPOINT_SCHEMA,
    dedupe_message_ids: Array.isArray(base.checkpoint?.dedupe_message_ids) ? base.checkpoint.dedupe_message_ids : [],
    dedupe_proposal_keys: Array.isArray(base.checkpoint?.dedupe_proposal_keys) ? base.checkpoint.dedupe_proposal_keys : [],
  }
  const outboundEvents = Array.isArray(base.outbound_events)
    ? base.outbound_events.map((event, index) => normalizeOutboundEvent(event, workItemId, index + 1, checkpoint.last_delivered_outbound_seq))
    : []
  const inboundMessages = Array.isArray(base.inbound_messages)
    ? base.inbound_messages.map((message, index) => normalizeInboundMessageRecord(message, workItemId, index + 1))
    : []
  const adjudications = Array.isArray(base.adjudications)
    ? base.adjudications.map((adjudication, index) => normalizeAdjudicationRecord(adjudication, inboundMessages[index] ?? {}))
    : []
  const store = {
    schema: base.schema ?? STORE_SCHEMA,
    session: {
      ...createEmptySession(workItemId),
      ...(base.session ?? {}),
      schema: SESSION_SCHEMA,
      work_item_id: workItemId,
      attached_work_item_id: base.session?.attached_work_item_id ?? workItemId,
      provider: "openclaw",
      delivery_mode: "watch",
      timestamps: {
        ...createEmptySession(workItemId).timestamps,
        ...(base.session?.timestamps ?? {}),
      },
    },
    checkpoint: {
      ...checkpoint,
      last_outbound_event_seq: Math.max(checkpoint.last_outbound_event_seq, ...outboundEvents.map((event) => event.event_seq), 0),
      last_inbound_message_seq: Math.max(checkpoint.last_inbound_message_seq, ...inboundMessages.map((message) => message.message_seq), 0),
      last_processed_inbound_seq: Math.max(checkpoint.last_processed_inbound_seq, ...adjudications.filter((entry) => entry.disposition !== "duplicate_ignored").map((entry) => Number(entry.message_seq) || 0), 0),
    },
    outbound_events: outboundEvents,
    inbound_messages: inboundMessages,
    adjudications,
    dedupe_records: Array.isArray(base.dedupe_records) ? base.dedupe_records : [],
    delivery_records: Array.isArray(base.delivery_records) ? base.delivery_records : [],
  }

  return store
}

function readSupervisorDialogueStore(root, workItemId) {
  return normalizeStore(root, workItemId)
}

function ensureSupervisorDialogueStore(root, workItemId) {
  return writeStore(root, workItemId, normalizeStore(root, workItemId))
}

function updateSupervisorSession(root, workItemId, updates = {}) {
  const store = normalizeStore(root, workItemId)
  const now = timestamp()
  store.session = {
    ...store.session,
    ...updates,
    schema: SESSION_SCHEMA,
    work_item_id: workItemId,
    provider: "openclaw",
    delivery_mode: "watch",
    timestamps: {
      ...(store.session.timestamps ?? {}),
      ...(updates.timestamps ?? {}),
      updated_at: now,
    },
  }
  return writeStore(root, workItemId, store)
}

function appendSupervisorEvent(root, workItemId, event) {
  const store = normalizeStore(root, workItemId)
  const eventSeq = store.checkpoint.last_outbound_event_seq + 1
  const createdAt = timestamp()
  const nextEvent = {
    schema: EVENT_SCHEMA,
    origin: "openkit",
    event_type: event.event_type,
    state_cursor: event.state_cursor ?? null,
    summary: event.summary,
    details: event.details ?? {},
    event_id: event.event_id ?? `evt-${workItemId}-${eventSeq}-${hashValue(`${event.event_type}:${createdAt}`)}`,
    event_seq: eventSeq,
    work_item_id: workItemId,
    created_at: createdAt,
    delivery_status: normalizeDeliveryStatus(event.delivery_status, "pending"),
    delivered_at: event.delivered_at ?? null,
    last_delivery_attempt_at: event.last_delivery_attempt_at ?? null,
    last_delivery_error: event.last_delivery_error ?? null,
    delivery_attempts: Array.isArray(event.delivery_attempts) ? event.delivery_attempts : [],
  }

  store.outbound_events.push(nextEvent)
  store.checkpoint.last_outbound_event_seq = eventSeq
  store.checkpoint.updated_at = createdAt
  store.session.timestamps.updated_at = createdAt
  writeStore(root, workItemId, store)
  return nextEvent
}

function appendSupervisorEvents(root, workItemId, events = []) {
  return events.map((event) => appendSupervisorEvent(root, workItemId, event))
}

function recordSupervisorAppendFailure(root, workItemId, error, events = []) {
  let store
  try {
    store = normalizeStore(root, workItemId)
  } catch (_parseError) {
    store = createEmptyStore(workItemId)
  }

  const now = timestamp()
  const message = error instanceof Error ? error.message : String(error)
  store.session = {
    ...store.session,
    transport_health: "degraded",
    degraded_mode: true,
    attention_required: true,
    last_detach_reason: `Supervisor append failed: ${message}`,
    last_append_error: message,
    timestamps: {
      ...(store.session.timestamps ?? {}),
      updated_at: now,
    },
  }
  store.checkpoint.updated_at = now
  store.delivery_records.push({
    schema: DELIVERY_STATE_SCHEMA,
    event_id: null,
    event_seq: null,
    work_item_id: workItemId,
    delivery_status: "failed",
    attempted_at: now,
    error: message,
    details: {
      phase: "append_supervisor_event",
      event_count: Array.isArray(events) ? events.length : 0,
      event_types: Array.isArray(events) ? events.map((event) => event.event_type).filter(Boolean) : [],
    },
  })

  return writeStore(root, workItemId, store)
}

function listPendingSupervisorEvents(root, workItemId, limit = 50) {
  const store = normalizeStore(root, workItemId)
  return store.outbound_events
    .filter((event) => RETRYABLE_DELIVERY_STATUSES.has(normalizeDeliveryStatus(event.delivery_status)))
    .slice(0, Math.max(1, limit))
}

function createDeliveryAttempt(event, attempt) {
  const now = timestamp()
  const deliveryStatus = normalizeDeliveryStatus(attempt.delivery_status ?? attempt.status)
  return {
    attempted_at: attempt.attempted_at ?? now,
    delivery_status: deliveryStatus,
    error: deliveryStatus === "delivered" ? null : attempt.error ?? attempt.last_delivery_error ?? null,
    details: attempt.details ?? {},
    attempt_seq: (event.delivery_attempts?.length ?? 0) + 1,
  }
}

function applyDeliveryAttempt(event, attemptInput) {
  const attempt = createDeliveryAttempt(event, attemptInput)
  event.delivery_attempts = [...(event.delivery_attempts ?? []), attempt]
  event.delivery_status = attempt.delivery_status
  event.last_delivery_attempt_at = attempt.attempted_at
  event.last_delivery_error = attempt.error
  event.delivered_at = attempt.delivery_status === "delivered" ? attempt.attempted_at : null
  return attempt
}

function refreshLastDeliveredCursor(store) {
  const deliveredSeqs = store.outbound_events
    .filter((event) => event.delivery_status === "delivered")
    .map((event) => Number(event.event_seq) || 0)
  store.checkpoint.last_delivered_outbound_seq = Math.max(0, ...deliveredSeqs)
}

function recordSupervisorEventDeliveryAttempt(root, workItemId, eventSeqOrId, attempt = {}) {
  const store = normalizeStore(root, workItemId)
  const event = store.outbound_events.find((candidate) =>
    candidate.event_seq === Number(eventSeqOrId) || candidate.event_id === eventSeqOrId,
  )

  if (!event) {
    throw new Error(`Supervisor event '${eventSeqOrId}' was not found for '${workItemId}'`)
  }

  const deliveryAttempt = applyDeliveryAttempt(event, attempt)
  const deliveryRecord = {
    schema: DELIVERY_STATE_SCHEMA,
    event_id: event.event_id,
    event_seq: event.event_seq,
    work_item_id: workItemId,
    delivery_status: event.delivery_status,
    attempted_at: deliveryAttempt.attempted_at,
    error: deliveryAttempt.error,
    details: deliveryAttempt.details,
  }
  store.delivery_records.push(deliveryRecord)
  refreshLastDeliveredCursor(store)
  store.checkpoint.updated_at = deliveryAttempt.attempted_at
  store.session.transport_health = event.delivery_status === "delivered" ? "healthy" : event.delivery_status === "skipped" ? "disabled" : "degraded"
  store.session.degraded_mode = event.delivery_status !== "delivered"
  store.session.timestamps.updated_at = deliveryAttempt.attempted_at
  writeStore(root, workItemId, store)
  return { event, delivery_record: deliveryRecord }
}

function markSupervisorEventsDelivered(root, workItemId, deliveredSeq) {
  const store = normalizeStore(root, workItemId)
  const nextSeq = Math.max(store.checkpoint.last_delivered_outbound_seq, Number(deliveredSeq) || 0)
  const deliveredAt = timestamp()
  const boundedSeq = Math.min(nextSeq, store.checkpoint.last_outbound_event_seq)
  for (const event of store.outbound_events) {
    if (event.event_seq <= boundedSeq && RETRYABLE_DELIVERY_STATUSES.has(event.delivery_status)) {
      const deliveryAttempt = applyDeliveryAttempt(event, { delivery_status: "delivered", attempted_at: deliveredAt })
      store.delivery_records.push({
        schema: DELIVERY_STATE_SCHEMA,
        event_id: event.event_id,
        event_seq: event.event_seq,
        work_item_id: workItemId,
        delivery_status: event.delivery_status,
        attempted_at: deliveryAttempt.attempted_at,
        error: deliveryAttempt.error,
        details: deliveryAttempt.details,
      })
    }
  }
  refreshLastDeliveredCursor(store)
  store.checkpoint.updated_at = deliveredAt
  store.session.transport_health = "healthy"
  store.session.degraded_mode = false
  store.session.timestamps.updated_at = store.checkpoint.updated_at
  return writeStore(root, workItemId, store)
}

function rememberDedupe(values, value) {
  if (!value || values.includes(value)) {
    return values
  }
  return [...values, value].slice(-MAX_DEDUPE_ENTRIES)
}

function recordInboundSupervisorMessage(root, workItemId, message, adjudication) {
  const store = normalizeStore(root, workItemId)
  const now = timestamp()
  const messageSeq = store.checkpoint.last_inbound_message_seq + 1
  const messageId = message.message_id ?? `msg-${workItemId}-${messageSeq}-${hashValue(now)}`
  const normalizedMessageInput = normalizeInboundMessageRecord({ ...message, message_id: messageId, message_seq: messageSeq, received_at: now }, workItemId, messageSeq)
  const proposalKey = deriveProposalKey(normalizedMessageInput)
  const duplicateMessageRecord = store.inbound_messages.find((entry) => entry.message_id === messageId)
  const duplicateProposalRecord = proposalKey ? store.inbound_messages.find((entry) => entry.proposal_key === proposalKey) : null
  const missingFields = findMissingInboundFields(message)
  const duplicateMessage = Boolean(duplicateMessageRecord)
  const duplicateProposal = proposalKey ? store.checkpoint.dedupe_proposal_keys.includes(proposalKey) : false
  const invalid = missingFields.length > 0 && adjudication.disposition !== "rejected_authority_boundary"
  const disposition = duplicateMessage || duplicateProposal
    ? "duplicate_ignored"
    : invalid
      ? "invalid_rejected"
      : adjudication.disposition
  const inboundRecord = {
    ...normalizedMessageInput,
    message_id: messageId,
    message_seq: messageSeq,
    work_item_id: workItemId,
    received_at: now,
    proposal_key: proposalKey,
  }
  const adjudicationRecord = {
    message_id: messageId,
    message_seq: messageSeq,
    proposal_key: proposalKey,
    disposition,
    actionable: false,
    reason: duplicateMessage
      ? "duplicate_message_id"
      : duplicateProposal
        ? "duplicate_proposal_key"
        : invalid
          ? "missing_minimum_inbound_information"
          : adjudication.reason,
    authority_boundary: "openkit_only_mutates_state_and_executes_code",
    duplicate_of: duplicateMessage
      ? duplicateMessageRecord.message_id
      : duplicateProposal
        ? duplicateProposalRecord?.message_id ?? null
        : null,
    created_at: now,
    details: invalid
      ? { ...(adjudication.details ?? {}), missing_fields: missingFields }
      : adjudication.details ?? {},
  }

  store.inbound_messages.push(inboundRecord)
  store.adjudications.push(adjudicationRecord)
  if (disposition === "duplicate_ignored") {
    store.dedupe_records.push({
      schema: DEDUPE_RECORD_SCHEMA,
      work_item_id: workItemId,
      message_id: messageId,
      message_seq: messageSeq,
      proposal_key: proposalKey,
      duplicate_of: adjudicationRecord.duplicate_of,
      reason: adjudicationRecord.reason,
      created_at: now,
      actionable: false,
    })
  }
  store.checkpoint.last_inbound_message_seq = messageSeq
  if (disposition !== "duplicate_ignored") {
    store.checkpoint.last_processed_inbound_seq = messageSeq
  }
  store.checkpoint.dedupe_message_ids = rememberDedupe(store.checkpoint.dedupe_message_ids, messageId)
  store.checkpoint.dedupe_proposal_keys = proposalKey
    ? rememberDedupe(store.checkpoint.dedupe_proposal_keys, proposalKey)
    : store.checkpoint.dedupe_proposal_keys
  store.checkpoint.updated_at = now
  store.session.attention_required = store.session.attention_required || disposition === "attention_required"
  store.session.timestamps.updated_at = now
  writeStore(root, workItemId, store)

  return { message: inboundRecord, adjudication: adjudicationRecord }
}

function summarizeSupervisorDialogue(root, workItemId) {
  const store = normalizeStore(root, workItemId)
  const pendingOutbound = store.outbound_events.filter((event) => RETRYABLE_DELIVERY_STATUSES.has(event.delivery_status)).length
  const outboundDeliveryStatuses = {
    pending: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
  }
  for (const event of store.outbound_events) {
    outboundDeliveryStatuses[normalizeDeliveryStatus(event.delivery_status)] += 1
  }
  const lastAdjudication = store.adjudications[store.adjudications.length - 1] ?? null

  return {
    present: fs.existsSync(getSupervisorStorePath(root, workItemId)),
    storePath: getSupervisorStorePath(root, workItemId),
    session: store.session,
    checkpoint: store.checkpoint,
    counts: {
      outbound_events: store.outbound_events.length,
      pending_outbound_events: pendingOutbound,
      outbound_delivery_statuses: outboundDeliveryStatuses,
      inbound_messages: store.inbound_messages.length,
      adjudications: store.adjudications.length,
      dedupe_records: store.dedupe_records.length,
      delivery_records: store.delivery_records.length,
    },
    last_adjudication: lastAdjudication,
  }
}

function buildSupervisorEventsForStateChange(previousState, nextState) {
  const events = []
  const cursor = {
    stage: nextState.current_stage,
    status: nextState.status,
    updated_at: nextState.updated_at ?? null,
  }

  if (previousState.current_stage !== nextState.current_stage) {
    events.push({
      event_type: "stage_changed",
      state_cursor: cursor,
      summary: `OpenKit stage changed from ${previousState.current_stage} to ${nextState.current_stage}.`,
      details: { from: previousState.current_stage, to: nextState.current_stage, owner: nextState.current_owner },
    })
  }

  for (const [gate, approval] of Object.entries(nextState.approvals ?? {})) {
    const previous = previousState.approvals?.[gate]
    if (previous && JSON.stringify(previous) !== JSON.stringify(approval)) {
      events.push({
        event_type: "approval_changed",
        state_cursor: cursor,
        summary: `OpenKit approval '${gate}' changed to ${approval.status}.`,
        details: { gate, previous_status: previous.status, status: approval.status, approved_by: approval.approved_by },
      })
    }
  }

  if ((nextState.verification_evidence?.length ?? 0) > (previousState.verification_evidence?.length ?? 0)) {
    const added = nextState.verification_evidence.slice(previousState.verification_evidence.length)
    events.push({
      event_type: "verification_signal",
      state_cursor: cursor,
      summary: `OpenKit recorded ${added.length} verification evidence item(s).`,
      details: { evidence_ids: added.map((entry) => entry.id), scopes: added.map((entry) => entry.scope) },
    })
  }

  if ((nextState.issues?.length ?? 0) > (previousState.issues?.length ?? 0)) {
    const added = nextState.issues.slice(previousState.issues.length)
    events.push({
      event_type: "issue_or_blocker_signal",
      state_cursor: cursor,
      summary: `OpenKit recorded ${added.length} issue or blocker signal(s).`,
      details: { issue_ids: added.map((entry) => entry.issue_id), severities: added.map((entry) => entry.severity) },
    })
  }

  const previousIssuesById = new Map((previousState.issues ?? []).map((issue) => [issue.issue_id, issue]))
  for (const issue of nextState.issues ?? []) {
    const previousIssue = previousIssuesById.get(issue.issue_id)
    if (previousIssue && previousIssue.current_status !== issue.current_status) {
      events.push({
        event_type: "issue_status_changed",
        state_cursor: cursor,
        summary: `OpenKit issue '${issue.issue_id}' changed from ${previousIssue.current_status} to ${issue.current_status}.`,
        details: {
          issue_id: issue.issue_id,
          previous_status: previousIssue.current_status,
          status: issue.current_status,
          severity: issue.severity,
          rooted_in: issue.rooted_in ?? null,
          recommended_owner: issue.recommended_owner ?? null,
        },
      })
    }
  }

  if (previousState.status !== "blocked" && nextState.status === "blocked") {
    events.push({
      event_type: "work_item_blocked",
      state_cursor: cursor,
      summary: "OpenKit work item is blocked.",
      details: { status: nextState.status, stage: nextState.current_stage },
    })
  }

  if (previousState.status === "blocked" && nextState.status !== "blocked") {
    events.push({
      event_type: "work_item_unblocked",
      state_cursor: cursor,
      summary: "OpenKit work item is no longer blocked.",
      details: { previous_status: previousState.status, status: nextState.status, stage: nextState.current_stage },
    })
  }

  if (previousState.status !== "paused" && nextState.status === "paused") {
    events.push({
      event_type: "work_item_paused",
      state_cursor: cursor,
      summary: "OpenKit work item is paused.",
      details: { status: nextState.status, stage: nextState.current_stage },
    })
  }

  if (previousState.status === "paused" && nextState.status !== "paused") {
    events.push({
      event_type: "work_item_resumed",
      state_cursor: cursor,
      summary: "OpenKit work item resumed.",
      details: { previous_status: previousState.status, status: nextState.status, stage: nextState.current_stage },
    })
  }

  if (events.some((event) => event.event_type === "work_item_blocked" || event.event_type === "work_item_paused")) {
    events.push({
      event_type: "human_attention_needed",
      state_cursor: cursor,
      summary: "OpenKit requires human attention for blocked or paused work.",
      details: { stage: nextState.current_stage, open_issues: (nextState.issues ?? []).filter((issue) => issue.current_status === "open").length },
    })
  }

  return events
}

function indexTasksById(board) {
  return new Map((Array.isArray(board?.tasks) ? board.tasks : []).map((task) => [task.task_id, task]))
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []
}

function uniqueDifference(left, right) {
  const rightSet = new Set(right)
  return [...new Set(left)].filter((entry) => !rightSet.has(entry))
}

function buildSupervisorEventsForTaskBoardChange(state, previousBoard, nextBoard) {
  const events = []
  const cursor = {
    stage: state.current_stage,
    status: state.status,
    updated_at: state.updated_at ?? null,
  }
  const previousTasksById = indexTasksById(previousBoard)

  for (const task of Array.isArray(nextBoard?.tasks) ? nextBoard.tasks : []) {
    const previousTask = previousTasksById.get(task.task_id)
    const previousStatus = previousTask?.status ?? null
    const statusChanged = !previousTask || previousStatus !== task.status

    if (statusChanged) {
      events.push({
        event_type: "task_status_changed",
        state_cursor: cursor,
        summary: previousTask
          ? `OpenKit task '${task.task_id}' changed from ${previousStatus} to ${task.status}.`
          : `OpenKit task '${task.task_id}' entered ${task.status}.`,
        details: {
          task_id: task.task_id,
          title: task.title ?? null,
          previous_status: previousStatus,
          status: task.status,
          primary_owner: task.primary_owner ?? null,
          qa_owner: task.qa_owner ?? null,
          blocked_by: stringArray(task.blocked_by),
        },
      })
    }

    const previousBlockers = stringArray(previousTask?.blocked_by)
    const nextBlockers = stringArray(task.blocked_by)
    const addedBlockers = uniqueDifference(nextBlockers, previousBlockers)
    const removedBlockers = uniqueDifference(previousBlockers, nextBlockers)
    const becameBlocked = previousStatus !== "blocked" && task.status === "blocked"
    const becameUnblocked = previousStatus === "blocked" && task.status !== "blocked"

    if (addedBlockers.length > 0 || becameBlocked) {
      events.push({
        event_type: "task_blocked",
        state_cursor: cursor,
        summary: `OpenKit task '${task.task_id}' is blocked.`,
        details: {
          task_id: task.task_id,
          title: task.title ?? null,
          status: task.status,
          blocked_by_added: addedBlockers,
          blocked_by: nextBlockers,
        },
      })
    }

    if (removedBlockers.length > 0 || becameUnblocked) {
      events.push({
        event_type: "task_unblocked",
        state_cursor: cursor,
        summary: `OpenKit task '${task.task_id}' is no longer blocked.`,
        details: {
          task_id: task.task_id,
          title: task.title ?? null,
          previous_status: previousStatus,
          status: task.status,
          blocked_by_removed: removedBlockers,
          blocked_by: nextBlockers,
        },
      })
    }
  }

  if (events.some((event) => event.event_type === "task_blocked")) {
    events.push({
      event_type: "human_attention_needed",
      state_cursor: cursor,
      summary: "OpenKit requires human attention for blocked task-board work.",
      details: {
        stage: state.current_stage,
        blocked_tasks: (Array.isArray(nextBoard?.tasks) ? nextBoard.tasks : []).filter((task) => task.status === "blocked" || stringArray(task.blocked_by).length > 0).map((task) => task.task_id),
      },
    })
  }

  return events
}

export {
  CHECKPOINT_SCHEMA,
  EVENT_SCHEMA,
  SESSION_SCHEMA,
  appendSupervisorEvent,
  appendSupervisorEvents,
  buildSupervisorEventsForTaskBoardChange,
  buildSupervisorEventsForStateChange,
  ensureSupervisorDialogueStore,
  getSupervisorStorePath,
  listPendingSupervisorEvents,
  markSupervisorEventsDelivered,
  readSupervisorDialogueStore,
  recordInboundSupervisorMessage,
  recordSupervisorAppendFailure,
  recordSupervisorEventDeliveryAttempt,
  summarizeSupervisorDialogue,
  updateSupervisorSession,
}
