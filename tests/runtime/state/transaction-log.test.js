// tests/runtime/state/transaction-log.test.js
//
// Tests for the TransactionLog — append-only in-memory audit trail of all
// workflow state changes.  No real files are created; all storage is in
// JavaScript arrays inside the TransactionLog instance.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionLog } from '../../../src/runtime/state/transaction-log.js';

describe('TransactionLog', () => {
  let log;

  beforeEach(() => {
    log = new TransactionLog();
  });

  // ── Construction ────────────────────────────────────────────────────────────

  it('starts with an empty history', () => {
    assert.equal(log.getHistory().length, 0);
  });

  // ── append ──────────────────────────────────────────────────────────────────

  it('records a stage transition entry', () => {
    log.recordTransition(
      'quick_brainstorm',
      'quick_plan',
      'quick-agent',
      { reason: 'gate met' }
    );

    const history = log.getHistory();
    assert.equal(history.length, 1);

    const entry = history[0];
    assert.equal(entry.type, 'transition');
    assert.equal(entry.actor, 'quick-agent');
    assert.equal(entry.payload.from, 'quick_brainstorm');
    assert.equal(entry.payload.to, 'quick_plan');
    assert.equal(entry.metadata.reason, 'gate met');
    assert.ok(entry.timestamp, 'entry has a timestamp');
  });

  it('records a gate change entry', () => {
    log.recordGateChange(
      'quick.understanding_confirmed',
      true,
      'user',
      { source: 'tool.set-approval' }
    );

    const history = log.getHistory();
    assert.equal(history.length, 1);

    const entry = history[0];
    assert.equal(entry.type, 'gate_change');
    assert.equal(entry.actor, 'user');
    assert.equal(entry.payload.gateName, 'quick.understanding_confirmed');
    assert.equal(entry.payload.newValue, true);
    assert.equal(entry.metadata.source, 'tool.set-approval');
    assert.ok(entry.timestamp, 'entry has a timestamp');
  });

  it('timestamps entries as ISO-8601 strings', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    const [entry] = log.getHistory();
    assert.match(
      entry.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
  });

  it('accumulates multiple entries in insertion order', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    log.recordGateChange('quick.plan_confirmed', true, 'user');
    log.recordTransition('quick_plan', 'quick_implement', 'quick-agent');

    const history = log.getHistory();
    assert.equal(history.length, 3);
    assert.equal(history[0].type, 'transition');
    assert.equal(history[1].type, 'gate_change');
    assert.equal(history[2].type, 'transition');
  });

  // ── getHistory (no filters) ──────────────────────────────────────────────────

  it('getHistory() returns all entries when called without arguments', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'agent-a');
    log.recordTransition('quick_plan', 'quick_implement', 'agent-b');

    assert.equal(log.getHistory().length, 2);
  });

  // ── getHistory (with filters) ────────────────────────────────────────────────

  it('filters entries by type', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    log.recordGateChange('quick.plan_confirmed', true, 'user');
    log.recordTransition('quick_plan', 'quick_implement', 'quick-agent');

    const transitions = log.getHistory({ type: 'transition' });
    assert.equal(transitions.length, 2);
    assert.ok(transitions.every(e => e.type === 'transition'));

    const gateChanges = log.getHistory({ type: 'gate_change' });
    assert.equal(gateChanges.length, 1);
    assert.equal(gateChanges[0].type, 'gate_change');
  });

  it('filters entries by actor', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    log.recordGateChange('quick.plan_confirmed', true, 'user');
    log.recordTransition('quick_plan', 'quick_implement', 'quick-agent');

    const agentEntries = log.getHistory({ actor: 'quick-agent' });
    assert.equal(agentEntries.length, 2);

    const userEntries = log.getHistory({ actor: 'user' });
    assert.equal(userEntries.length, 1);
  });

  it('returns empty array when no entries match the filter', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');

    const result = log.getHistory({ actor: 'non-existent-agent' });
    assert.deepEqual(result, []);
  });

  it('applies multiple filters as AND conditions', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    log.recordGateChange('quick.plan_confirmed', true, 'user');
    log.recordTransition('quick_plan', 'quick_implement', 'other-agent');

    const result = log.getHistory({ type: 'transition', actor: 'quick-agent' });
    assert.equal(result.length, 1);
    assert.equal(result[0].payload.from, 'quick_brainstorm');
  });

  // ── immutability ─────────────────────────────────────────────────────────────

  it('is append-only: returned history cannot mutate the internal log', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');

    const first = log.getHistory();
    first.push({ type: 'injected' });

    // The internal log must not have grown
    assert.equal(log.getHistory().length, 1);
  });

  // ── metadata defaults ────────────────────────────────────────────────────────

  it('uses empty object as default metadata', () => {
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    const [entry] = log.getHistory();
    assert.deepEqual(entry.metadata, {});
  });

  // ── size ─────────────────────────────────────────────────────────────────────

  it('size() returns the number of log entries', () => {
    assert.equal(log.size(), 0);
    log.recordTransition('quick_brainstorm', 'quick_plan', 'quick-agent');
    assert.equal(log.size(), 1);
    log.recordGateChange('quick.plan_confirmed', true, 'user');
    assert.equal(log.size(), 2);
  });
});
