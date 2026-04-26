import {
  listPendingSupervisorEvents,
  markSupervisorEventsDelivered,
  readSupervisorDialogueStore,
  recordSupervisorEventDeliveryAttempt,
  updateSupervisorSession,
} from '../../../.opencode/lib/supervisor-dialogue-store.js';

const FAILURE_STATUSES = new Set(['timeout', 'invalid_response', 'unavailable', 'degraded', 'error']);

function deliveryError(delivery) {
  return delivery.error ?? delivery.reason ?? delivery.last_delivery_error ?? null;
}

function attemptDetails(delivery) {
  return {
    transport: delivery.transport ?? null,
    status: delivery.status,
    httpStatus: delivery.httpStatus ?? null,
    exitCode: delivery.exitCode ?? null,
  };
}

export class OutboundSupervisorDispatcher {
  constructor({ runtimeRoot, adapter, limit = 50 } = {}) {
    this.runtimeRoot = runtimeRoot;
    this.adapter = adapter;
    this.limit = limit;
  }

  async dispatchPending(workItemId) {
    const store = readSupervisorDialogueStore(this.runtimeRoot, workItemId);
    const events = listPendingSupervisorEvents(this.runtimeRoot, workItemId, this.limit);
    if (events.length === 0) {
      return { status: 'idle', delivered: 0, pending: 0 };
    }

    const delivery = await this.adapter.deliverEvents({
      workItemId,
      session: store.session,
      events,
    });

    const deliveredCount = Math.max(0, Math.min(Number(delivery.delivered) || 0, events.length));
    if (delivery.status === 'ok' && deliveredCount === events.length) {
      const lastSeq = events[events.length - 1].event_seq;
      markSupervisorEventsDelivered(this.runtimeRoot, workItemId, lastSeq);
      return { ...delivery, delivered: deliveredCount, pending: 0, lastDeliveredSeq: lastSeq };
    }

    if (delivery.status === 'disabled') {
      for (const event of events) {
        recordSupervisorEventDeliveryAttempt(this.runtimeRoot, workItemId, event.event_seq, {
          delivery_status: 'skipped',
          error: delivery.reason ?? 'Supervisor dialogue is disabled.',
          details: attemptDetails(delivery),
        });
      }
      return { ...delivery, delivered: 0, pending: 0, lastDeliveredSeq: store.checkpoint.last_delivered_outbound_seq };
    }

    if (delivery.status === 'partial_delivery' || deliveredCount > 0) {
      for (const [index, event] of events.entries()) {
        recordSupervisorEventDeliveryAttempt(this.runtimeRoot, workItemId, event.event_seq, {
          delivery_status: index < deliveredCount ? 'delivered' : 'failed',
          error: index < deliveredCount ? null : deliveryError(delivery) ?? 'OpenClaw delivery partially completed.',
          details: attemptDetails(delivery),
        });
      }
      return {
        ...delivery,
        status: deliveredCount === events.length ? 'ok' : 'partial_delivery',
        delivered: deliveredCount,
        pending: events.length - deliveredCount,
        lastDeliveredSeq: deliveredCount > 0 ? events[deliveredCount - 1].event_seq : store.checkpoint.last_delivered_outbound_seq,
      };
    }

    if (FAILURE_STATUSES.has(delivery.status) || delivery.status === 'unconfigured') {
      for (const event of events) {
        recordSupervisorEventDeliveryAttempt(this.runtimeRoot, workItemId, event.event_seq, {
          delivery_status: 'failed',
          error: deliveryError(delivery) ?? `OpenClaw delivery failed with status '${delivery.status}'.`,
          details: attemptDetails(delivery),
        });
      }
    }

    updateSupervisorSession(this.runtimeRoot, workItemId, {
      transport_health: delivery.status === 'disabled' ? 'disabled' : 'degraded',
      degraded_mode: true,
    });

    return {
      ...delivery,
      delivered: deliveredCount,
      pending: events.length,
      lastDeliveredSeq: store.checkpoint.last_delivered_outbound_seq,
    };
  }
}
