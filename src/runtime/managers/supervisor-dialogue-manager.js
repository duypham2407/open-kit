import {
  ensureSupervisorDialogueStore,
  recordInboundSupervisorMessage,
  summarizeSupervisorDialogue,
} from '../../../.opencode/lib/supervisor-dialogue-store.js';
import { OpenClawAdapter } from '../supervisor/openclaw-adapter.js';
import { OutboundSupervisorDispatcher } from '../supervisor/outbound-dispatcher.js';
import { adjudicateInboundMessage } from '../supervisor/inbound-adjudicator.js';
import { normalizeOpenClawMessage } from '../supervisor/message-normalizer.js';

export class SupervisorDialogueManager {
  constructor({ runtimeRoot, config = {}, mode = 'read-write' } = {}) {
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.adapter = new OpenClawAdapter({ config });
    this.dispatcher = new OutboundSupervisorDispatcher({ runtimeRoot, adapter: this.adapter });
    this.enabled = config?.supervisorDialogue?.enabled === true;
  }

  describe() {
    return {
      enabled: this.enabled,
      mode: this.mode,
      adapter: this.adapter.describe(),
    };
  }

  ensureSession(workItemId) {
    if (this.mode === 'read-only') {
      return null;
    }
    return ensureSupervisorDialogueStore(this.runtimeRoot, workItemId);
  }

  summarize(workItemId) {
    return summarizeSupervisorDialogue(this.runtimeRoot, workItemId);
  }

  async dispatchPending(workItemId) {
    if (this.mode === 'read-only') {
      const summary = this.summarize(workItemId);
      return {
        status: 'read_only',
        delivered: 0,
        pending: summary.counts.pending_outbound_events,
        reason: 'Read-only runtime mode does not dispatch outbound supervisor events.',
      };
    }
    this.ensureSession(workItemId);
    const result = await this.dispatcher.dispatchPending(workItemId);
    const inboundMessages = Array.isArray(result.inboundMessages) ? result.inboundMessages : [];
    const inboundResults = inboundMessages.map((message) => this.receiveInbound(workItemId, message));
    return {
      ...result,
      inboundProcessed: inboundResults.length,
      inboundResults,
    };
  }

  receiveInbound(workItemId, input) {
    if (this.mode === 'read-only') {
      return {
        status: 'read_only',
        message: null,
        adjudication: null,
        reason: 'Read-only runtime mode does not write supervisor dialogue records.',
      };
    }
    this.ensureSession(workItemId);
    const message = normalizeOpenClawMessage(input);
    const adjudication = adjudicateInboundMessage(message);
    return recordInboundSupervisorMessage(this.runtimeRoot, workItemId, message, adjudication);
  }

  dispose() {}
}
