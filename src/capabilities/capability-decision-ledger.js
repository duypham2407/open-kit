import fs from 'node:fs';
import path from 'node:path';

export const CAPABILITY_DECISION_LEDGER_SCHEMA = 'openkit/capability-decision-ledger@1';
export const CAPABILITY_DECISION_ENTRY_SCHEMA = 'openkit/capability-decision@1';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|authorization|auth|cookie|key|env|payload|header|storage|commandOutput|stdout|stderr)/i;
const SECRET_VALUE_PATTERN = /\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g;
const ASSIGNMENT_PATTERN = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY|COOKIE|AUTH|CREDENTIAL)[A-Z0-9_]*)=([^\s,;]+)/gi;
const ALLOWED_KEY_STATES = new Set(['present_redacted', 'missing', 'needs_key', 'not_configured', 'unavailable', 'unknown']);

function nowIso() {
  return new Date().toISOString();
}

function boundedLimit(value, fallback = DEFAULT_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function redactString(value) {
  return String(value)
    .replace(ASSIGNMENT_PATTERN, '$1=[REDACTED]')
    .replace(SECRET_VALUE_PATTERN, '[REDACTED]');
}

export function sanitizeCapabilityDecision(value, key = '') {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    if (/keyState$/i.test(key)) {
      return ALLOWED_KEY_STATES.has(value) ? value : 'present_redacted';
    }
    return redactString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_LIMIT).map((entry) => sanitizeCapabilityDecision(entry, key));
  }
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(entryKey) && !/keyState$/i.test(entryKey)) {
        sanitized[entryKey] = '[REDACTED]';
        continue;
      }
      if (/keyState$/i.test(entryKey) && entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)) {
        sanitized[entryKey] = Object.fromEntries(Object.entries(entryValue).map(([stateKey, stateValue]) => [
          stateKey,
          ALLOWED_KEY_STATES.has(stateValue) ? stateValue : 'present_redacted',
        ]));
        continue;
      }
      sanitized[entryKey] = sanitizeCapabilityDecision(entryValue, entryKey);
    }
    return sanitized;
  }
  return null;
}

function normalizeCapability(capability = {}) {
  return sanitizeCapabilityDecision({
    id: capability.id ?? capability.capabilityId ?? null,
    family: capability.family ?? null,
    ownership: capability.ownership ?? null,
    state: capability.state ?? null,
    surface: capability.surface ?? capability.validationSurface ?? null,
  });
}

function normalizeFreshness(freshness = {}) {
  return sanitizeCapabilityDecision({
    state: freshness?.state ?? 'unknown',
    source: freshness?.source ?? 'read_model',
    checkedAt: freshness?.checkedAt ?? null,
  });
}

function normalizeEntry(input = {}, sequence = 0) {
  const timestamp = input.timestamp ?? nowIso();
  const capability = normalizeCapability(input.capability ?? input.node ?? {});
  const actionType = input.actionType ?? 'rank';
  const safeIdPart = `${timestamp.replace(/[^0-9A-Za-z]/g, '')}_${sequence}`;
  return sanitizeCapabilityDecision({
    schema: CAPABILITY_DECISION_ENTRY_SCHEMA,
    id: input.id ?? `capdec_${safeIdPart}`,
    timestamp,
    featureId: input.featureId ?? 'FEATURE-953',
    workflow: input.workflow ?? {},
    capability,
    actionType,
    outcome: input.outcome ?? actionType,
    reason: input.reason ?? null,
    caveats: asList(input.caveats),
    freshness: normalizeFreshness(input.freshness),
    policyGate: input.policyGate ?? null,
    validationSurface: input.validationSurface ?? capability.surface ?? 'runtime_tooling',
    evidenceRefs: asList(input.evidenceRefs),
    artifactRefs: asList(input.artifactRefs),
  });
}

function readLedgerFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function writeLedgerFile(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify({ schema: CAPABILITY_DECISION_LEDGER_SCHEMA, version: 1, entries }, null, 2)}\n`, { mode: 0o600 });
}

export class CapabilityDecisionLedger {
  constructor({ runtimeRoot = null, mode = 'read-write', maxEntries = 500 } = {}) {
    this.maxEntries = maxEntries;
    this.mode = mode;
    this.filePath = runtimeRoot ? path.join(runtimeRoot, 'capability-decision-ledger.json') : null;
    this.memoryEntries = [];
    this.persistence = this.filePath && mode !== 'read-only' ? 'file' : 'memory';
  }

  append(input = {}) {
    const currentEntries = this.list({ limit: this.maxEntries }).entries;
    const entry = normalizeEntry(input, currentEntries.length + 1);
    const entries = [...currentEntries, entry].slice(-this.maxEntries);
    if (this.persistence === 'file') {
      try {
        writeLedgerFile(this.filePath, entries);
      } catch {
        this.persistence = 'memory_degraded';
        this.memoryEntries = entries;
      }
    } else {
      this.memoryEntries = entries;
    }
    return entry;
  }

  list({ limit = DEFAULT_LIMIT, actionType = null, capabilityId = null } = {}) {
    const sourceEntries = this.persistence === 'file' ? readLedgerFile(this.filePath) : this.memoryEntries;
    let entries = sourceEntries;
    if (actionType) {
      entries = entries.filter((entry) => entry.actionType === actionType);
    }
    if (capabilityId) {
      entries = entries.filter((entry) => entry.capability?.id === capabilityId);
    }
    return {
      schema: CAPABILITY_DECISION_LEDGER_SCHEMA,
      status: 'ok',
      validationSurface: 'runtime_tooling',
      persistence: this.persistence,
      caveats: this.persistence === 'file' ? [] : ['Capability decision ledger is not persisted for this manager instance.'],
      entries: entries.slice(-boundedLimit(limit)),
      total: entries.length,
    };
  }

  get(id) {
    const entry = this.list({ limit: this.maxEntries }).entries.find((candidate) => candidate.id === id) ?? null;
    return {
      schema: CAPABILITY_DECISION_LEDGER_SCHEMA,
      status: entry ? 'ok' : 'unavailable',
      validationSurface: 'runtime_tooling',
      persistence: this.persistence,
      entry,
    };
  }
}
