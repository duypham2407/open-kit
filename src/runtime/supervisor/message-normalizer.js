import crypto from 'node:crypto';

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeType(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'message';
}

function normalizeOptionalType(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || null;
}

function inferIntent(type, raw) {
  const explicitIntent = normalizeOptionalType(raw.intent ?? raw.action);
  if (explicitIntent) {
    return explicitIntent;
  }

  if (type === 'ack' || type === 'acknowledge' || type === 'acknowledgement') {
    return 'acknowledge';
  }
  if (type === 'attention' || type === 'concern') {
    return type;
  }

  return null;
}

function deriveProposalKey(message) {
  if (message.proposal_key) {
    return message.proposal_key;
  }

  if (message.type !== 'proposal' && message.type !== 'suggestion' && message.type !== 'request') {
    return null;
  }

  if (!message.intent || !message.target) {
    return null;
  }

  return `proposal:${stableHash(`${message.target}:${message.intent}:${message.subject ?? ''}`)}`;
}

export function normalizeOpenClawMessage(input = {}) {
  const raw = input && typeof input === 'object' ? input : { body: String(input ?? '') };
  const type = normalizeType(raw.type ?? raw.kind ?? raw.message_type);
  const body = normalizeText(raw.body ?? raw.summary ?? raw.message ?? raw.text);
  const intent = inferIntent(type, raw);
  const target = normalizeOptionalText(raw.target ?? raw.path ?? raw.workflow_target);
  const subject = normalizeOptionalText(raw.subject ?? raw.action_subject ?? raw.details?.subject);
  const createdAt = normalizeText(raw.created_at ?? raw.createdAt) || new Date().toISOString();
  const messageId = normalizeText(raw.message_id ?? raw.id) || `openclaw-${stableHash(`${type}:${intent}:${target}:${body}:${createdAt}`)}`;
  const message = {
    schema: 'openkit/supervisor-inbound-message@1',
    origin: 'openclaw',
    message_id: messageId,
    type,
    intent,
    target,
    subject,
    body,
    severity: normalizeType(raw.severity ?? 'info'),
    created_at: createdAt,
    raw,
  };

  return {
    ...message,
    proposal_key: deriveProposalKey(message),
  };
}
