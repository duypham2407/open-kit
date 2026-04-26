import { spawn } from 'node:child_process';

const FAILURE_STATUS_ALIASES = new Set(['error', 'failed', 'failure', 'unavailable']);

function createUnavailableResult({ transport, error, reason }) {
  return {
    status: 'unavailable',
    transport,
    error: error ?? reason,
    reason: reason ?? error,
  };
}

function clampTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs)) {
    return 10_000;
  }
  return Math.max(250, Math.min(120_000, Math.trunc(timeoutMs)));
}

function normalizeConfig(config = {}) {
  const openclaw = config?.supervisorDialogue?.openclaw ?? config?.openclaw ?? {};
  return {
    enabled: config?.supervisorDialogue?.enabled === true,
    transport: openclaw.transport ?? (openclaw.url ? 'http' : openclaw.command ? 'command' : 'unconfigured'),
    url: openclaw.url ?? null,
    command: openclaw.command ?? null,
    args: Array.isArray(openclaw.args) ? openclaw.args : [],
    timeoutMs: clampTimeout(openclaw.timeoutMs ?? openclaw.timeout ?? 10_000),
    env: openclaw.env && typeof openclaw.env === 'object' ? openclaw.env : {},
  };
}

function deliverCommand(settings, payload) {
  if (!settings.command) {
    return Promise.resolve(createUnavailableResult({ transport: 'command', reason: 'OpenClaw command transport is missing command.' }));
  }

  return new Promise((resolve) => {
    const child = spawn(settings.command, settings.args, {
      env: { ...process.env, ...settings.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ status: 'timeout', transport: 'command', error: `OpenClaw command timed out after ${settings.timeoutMs}ms.` });
    }, settings.timeoutMs);

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => finish(createUnavailableResult({ transport: 'command', error: error.message })));
    child.on('close', (code) => {
      if (code !== 0) {
        finish({ status: 'degraded', transport: 'command', exitCode: code, error: stderr.trim() || 'OpenClaw command failed.' });
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        finish({ status: 'ok', transport: 'command', result: {} });
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          finish({ status: 'invalid_response', transport: 'command', error: 'OpenClaw command response must be a JSON object.', result: parsed });
          return;
        }
        finish({ status: parsed.status ?? 'ok', transport: 'command', result: parsed });
      } catch {
        finish({ status: 'invalid_response', transport: 'command', error: 'OpenClaw command returned invalid JSON.', raw: trimmed });
      }
    });
    child.stdin.write(`${JSON.stringify(payload)}\n`);
    child.stdin.end();
  });
}

async function deliverHttp(settings, payload) {
  if (!settings.url) {
    return createUnavailableResult({ transport: 'http', reason: 'OpenClaw HTTP transport is missing URL.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    const result = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      return { status: 'degraded', transport: 'http', httpStatus: response.status, error: typeof result === 'string' ? result : JSON.stringify(result) };
    }
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      return { status: 'invalid_response', transport: 'http', error: 'OpenClaw HTTP response must be a JSON object.', result };
    }
    return { status: result.status ?? 'ok', transport: 'http', result };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { status: 'timeout', transport: 'http', error: error.message };
    }
    return createUnavailableResult({ transport: 'http', error: error.message });
  } finally {
    clearTimeout(timer);
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeInboundMessages(result) {
  return [
    ...toArray(result?.inbound),
    ...toArray(result?.messages),
    ...toArray(result?.acknowledgements),
    ...toArray(result?.acks),
    ...toArray(result?.proposals),
    ...toArray(result?.concerns),
    ...toArray(result?.attention),
  ];
}

function normalizeDeliveryResult(transportResult, eventCount) {
  const result = transportResult?.result && typeof transportResult.result === 'object' && !Array.isArray(transportResult.result)
    ? transportResult.result
    : null;
  const baseStatus = transportResult.status ?? result?.status ?? 'degraded';
  const delivered = Number.isInteger(result?.delivered)
    ? Math.max(0, Math.min(eventCount, result.delivered))
    : baseStatus === 'ok'
      ? eventCount
      : 0;
  const status = baseStatus === 'ok' && delivered < eventCount ? 'partial_delivery' : baseStatus;
  const inboundMessages = normalizeInboundMessages(result);
  return {
    ...transportResult,
    status,
    delivered,
    failed: Math.max(0, eventCount - delivered),
    inboundMessages,
    response: result,
    error: transportResult.error ?? result?.error ?? result?.reason ?? null,
  };
}

export class OpenClawAdapter {
  constructor({ config = {} } = {}) {
    this.settings = normalizeConfig(config);
  }

  get configured() {
    return this.settings.enabled && (this.settings.transport === 'http' || this.settings.transport === 'command');
  }

  describe() {
    return {
      provider: 'openclaw',
      enabled: this.settings.enabled,
      configured: this.configured,
      transport: this.settings.transport,
    };
  }

  async deliverEvents({ workItemId, session, events }) {
    if (!this.settings.enabled) {
      return { status: 'disabled', delivered: 0, transport: this.settings.transport, reason: 'Supervisor dialogue is disabled.' };
    }
    if (!this.configured) {
      return { status: 'unconfigured', delivered: 0, transport: this.settings.transport, reason: 'No OpenClaw transport configured.' };
    }

    const payload = {
      schema: 'openkit/openclaw-supervisor-delivery@1',
      work_item_id: workItemId,
      session,
      events,
    };
    const result = this.settings.transport === 'http'
      ? await deliverHttp(this.settings, payload)
      : await deliverCommand(this.settings, payload);
    const normalized = normalizeDeliveryResult(result, events.length);
    if (FAILURE_STATUS_ALIASES.has(normalized.status)) {
      return { ...normalized, status: normalized.status === 'unavailable' ? 'unavailable' : 'degraded' };
    }
    return normalized;
  }
}
