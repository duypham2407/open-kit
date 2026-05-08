// tests/runtime/state/transaction-log.test.js
//
// Tests for TransactionLog — append-only, file-based audit trail of all
// workflow state changes.  Each test uses a temp file that is cleaned up
// in afterEach so the tests are fully isolated.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TransactionLog } from '../../../src/runtime/state/transaction-log.js';

describe('TransactionLog', () => {
  const testLogPath = path.join(process.cwd(), 'test-transactions.log');
  let log;

  beforeEach(() => {
    log = new TransactionLog(testLogPath);
  });

  afterEach(() => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  // ── Construction ────────────────────────────────────────────────────────────

  it('accepts a logPath constructor argument', () => {
    assert.equal(log.logPath, testLogPath);
  });

  // ── append ──────────────────────────────────────────────────────────────────

  it('appends a transaction to the log file', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'test123',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm' },
      after: { stage: 'quick_plan' },
      metadata: {},
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    const lines = content.trim().split('\n');

    assert.equal(lines.length, 1);

    const entry = JSON.parse(lines[0]);
    assert.equal(entry.operation, 'advanceStage');
    assert.equal(entry.workItemId, 'test123');
    assert.ok(entry.timestamp, 'entry has a timestamp');
  });

  it('writes entry with all required fields', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'abc123',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm', owner: 'quick-agent' },
      after: { stage: 'quick_plan', owner: 'quick-agent' },
      metadata: { reason: 'gate met' },
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    const entry = JSON.parse(content.trim());

    assert.equal(entry.operation, 'advanceStage');
    assert.equal(entry.workItemId, 'abc123');
    assert.equal(entry.caller, 'tool.advance-stage');
    assert.deepEqual(entry.before, { stage: 'quick_brainstorm', owner: 'quick-agent' });
    assert.deepEqual(entry.after, { stage: 'quick_plan', owner: 'quick-agent' });
    assert.deepEqual(entry.metadata, { reason: 'gate met' });
    assert.ok(entry.timestamp, 'entry has a timestamp');
  });

  it('timestamps entries as ISO-8601 strings', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'abc123',
      caller: 'tool.advance-stage',
      before: {},
      after: {},
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    const entry = JSON.parse(content.trim());

    assert.match(
      entry.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
  });

  it('uses empty object as default metadata', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'abc123',
      caller: 'tool.advance-stage',
      before: {},
      after: {},
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    const entry = JSON.parse(content.trim());

    assert.deepEqual(entry.metadata, {});
  });

  it('accumulates multiple entries as separate JSONL lines', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'item1',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm' },
      after: { stage: 'quick_plan' },
    });

    log.append({
      operation: 'setApproval',
      workItemId: 'item1',
      caller: 'tool.set-approval',
      before: {},
      after: {},
    });

    const content = fs.readFileSync(testLogPath, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 2);

    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);
    assert.equal(first.operation, 'advanceStage');
    assert.equal(second.operation, 'setApproval');
  });

  it('returns the written entry from append()', () => {
    const result = log.append({
      operation: 'advanceStage',
      workItemId: 'abc123',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm' },
      after: { stage: 'quick_plan' },
    });

    assert.equal(result.operation, 'advanceStage');
    assert.equal(result.workItemId, 'abc123');
    assert.ok(result.timestamp);
  });

  // ── query ────────────────────────────────────────────────────────────────────

  it('query() returns all entries when called without arguments', () => {
    log.append({ operation: 'advanceStage', workItemId: 'item1', caller: 'a', before: {}, after: {} });
    log.append({ operation: 'setApproval', workItemId: 'item2', caller: 'b', before: {}, after: {} });

    const results = log.query();
    assert.equal(results.length, 2);
  });

  it('query() returns empty array when log file does not exist', () => {
    // Use a fresh log pointing at a non-existent file (don't call append first)
    const emptyLog = new TransactionLog(testLogPath + '.empty');
    try {
      const results = emptyLog.query();
      assert.deepEqual(results, []);
    } finally {
      if (fs.existsSync(testLogPath + '.empty')) {
        fs.unlinkSync(testLogPath + '.empty');
      }
    }
  });

  it('queries transactions by workItemId', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'item1',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm' },
      after: { stage: 'quick_plan' },
    });

    log.append({
      operation: 'setApproval',
      workItemId: 'item2',
      caller: 'tool.set-approval',
      before: {},
      after: {},
    });

    const results = log.query({ workItemId: 'item1' });

    assert.equal(results.length, 1);
    assert.equal(results[0].workItemId, 'item1');
    assert.equal(results[0].operation, 'advanceStage');
  });

  it('queries transactions by operation', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'item1',
      caller: 'tool.advance-stage',
      before: {},
      after: {},
    });

    log.append({
      operation: 'setApproval',
      workItemId: 'item1',
      caller: 'tool.set-approval',
      before: {},
      after: {},
    });

    const results = log.query({ operation: 'setApproval' });

    assert.equal(results.length, 1);
    assert.equal(results[0].operation, 'setApproval');
  });

  it('queries transactions by caller', () => {
    log.append({ operation: 'advanceStage', workItemId: 'item1', caller: 'tool.advance-stage', before: {}, after: {} });
    log.append({ operation: 'setApproval', workItemId: 'item1', caller: 'tool.set-approval', before: {}, after: {} });
    log.append({ operation: 'advanceStage', workItemId: 'item2', caller: 'tool.advance-stage', before: {}, after: {} });

    const results = log.query({ caller: 'tool.advance-stage' });

    assert.equal(results.length, 2);
    assert.ok(results.every(e => e.caller === 'tool.advance-stage'));
  });

  it('applies multiple filters as AND conditions', () => {
    log.append({ operation: 'advanceStage', workItemId: 'item1', caller: 'tool.advance-stage', before: {}, after: {} });
    log.append({ operation: 'setApproval', workItemId: 'item1', caller: 'tool.set-approval', before: {}, after: {} });
    log.append({ operation: 'advanceStage', workItemId: 'item2', caller: 'tool.advance-stage', before: {}, after: {} });

    const results = log.query({ workItemId: 'item1', operation: 'advanceStage' });

    assert.equal(results.length, 1);
    assert.equal(results[0].workItemId, 'item1');
    assert.equal(results[0].operation, 'advanceStage');
  });

  it('returns empty array when no entries match the filter', () => {
    log.append({ operation: 'advanceStage', workItemId: 'item1', caller: 'tool.advance-stage', before: {}, after: {} });

    const result = log.query({ workItemId: 'non-existent' });
    assert.deepEqual(result, []);
  });

  // ── getHistory ───────────────────────────────────────────────────────────────

  it('gets full history for a work item', () => {
    log.append({
      operation: 'advanceStage',
      workItemId: 'item1',
      caller: 'tool.advance-stage',
      before: { stage: 'quick_brainstorm' },
      after: { stage: 'quick_plan' },
    });

    log.append({
      operation: 'setApproval',
      workItemId: 'item1',
      caller: 'tool.set-approval',
      before: {},
      after: {},
    });

    log.append({
      operation: 'advanceStage',
      workItemId: 'item2',
      caller: 'tool.advance-stage',
      before: {},
      after: {},
    });

    const history = log.getHistory('item1');

    assert.equal(history.length, 2);
    assert.equal(history[0].operation, 'advanceStage');
    assert.equal(history[1].operation, 'setApproval');
  });

  it('getHistory() returns entries in insertion order', () => {
    log.append({ operation: 'op1', workItemId: 'item1', caller: 'c', before: {}, after: {} });
    log.append({ operation: 'op2', workItemId: 'item1', caller: 'c', before: {}, after: {} });
    log.append({ operation: 'op3', workItemId: 'item1', caller: 'c', before: {}, after: {} });

    const history = log.getHistory('item1');

    assert.equal(history[0].operation, 'op1');
    assert.equal(history[1].operation, 'op2');
    assert.equal(history[2].operation, 'op3');
  });

  it('getHistory() returns empty array when no entries for that work item', () => {
    log.append({ operation: 'advanceStage', workItemId: 'other', caller: 'c', before: {}, after: {} });

    const history = log.getHistory('item1');
    assert.deepEqual(history, []);
  });

  // ── replayTo ─────────────────────────────────────────────────────────────────

  it('replayTo() returns entries up to and including the given timestamp', () => {
    // Manually construct entries by appending in sequence, capturing timestamps
    log.append({ operation: 'op1', workItemId: 'item1', caller: 'c', before: {}, after: {} });
    log.append({ operation: 'op2', workItemId: 'item1', caller: 'c', before: {}, after: {} });
    log.append({ operation: 'op3', workItemId: 'item1', caller: 'c', before: {}, after: {} });

    const all = log.getHistory('item1');
    assert.equal(all.length, 3);

    // Replay up to the timestamp of the second entry — should return first two
    const cutoff = all[1].timestamp;
    const replayed = log.replayTo('item1', cutoff);

    assert.ok(replayed.length >= 2, 'should return at least two entries');
    assert.equal(replayed[0].operation, 'op1');
    assert.equal(replayed[1].operation, 'op2');
  });

  it('replayTo() returns empty array when cutoff is before all entries', () => {
    log.append({ operation: 'op1', workItemId: 'item1', caller: 'c', before: {}, after: {} });

    const result = log.replayTo('item1', '1970-01-01T00:00:00.000Z');
    assert.deepEqual(result, []);
  });
});
