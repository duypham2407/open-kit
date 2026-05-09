import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  formatSessionTag,
  appendSessionTag,
  readSessionContext,
  resolveBaseDir,
  buildStatusLine,
  extractUpstreamInput,
} from '../../assets/statusline-session.js';

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-statusline-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// formatSessionTag — pure formatter, the spec-anchored contract
// ---------------------------------------------------------------------------

describe('formatSessionTag (pure)', () => {
  it('renders the spec example verbatim', () => {
    // Spec §7.4 — exact string the design doc anchors on.
    const tag = formatSessionTag({
      sessionId: 's_8f3a2c',
      lane: 'full',
      stage: 'full_implementation',
    });
    assert.equal(tag, '[s_8f3a2c · full · full_implementation]');
  });

  it('uses the U+00B7 middle dot as separator (not ASCII dot or bullet)', () => {
    const tag = formatSessionTag({ sessionId: 's_aaaaaa', lane: 'quick', stage: 'planning' });
    // Two separators surrounded by single spaces.
    assert.match(tag, / · /);
    // Must not be ASCII period-with-spaces or U+2022 bullet.
    assert.ok(!tag.includes(' . '));
    assert.ok(!tag.includes(' • '));
  });

  it('returns empty string when sessionId is missing', () => {
    assert.equal(formatSessionTag({}), '');
    assert.equal(formatSessionTag({ sessionId: null, lane: 'full', stage: 's' }), '');
    assert.equal(formatSessionTag({ sessionId: '', lane: 'full', stage: 's' }), '');
    assert.equal(formatSessionTag({ sessionId: undefined }), '');
    assert.equal(formatSessionTag(), '');
  });

  it('rejects non-string sessionId', () => {
    assert.equal(formatSessionTag({ sessionId: 123, lane: 'full', stage: 's' }), '');
  });

  it('substitutes "-" for missing lane and stage so shape is stable', () => {
    assert.equal(
      formatSessionTag({ sessionId: 's_abcdef' }),
      '[s_abcdef · - · -]',
    );
    assert.equal(
      formatSessionTag({ sessionId: 's_abcdef', lane: 'full' }),
      '[s_abcdef · full · -]',
    );
    assert.equal(
      formatSessionTag({ sessionId: 's_abcdef', stage: 'planning' }),
      '[s_abcdef · - · planning]',
    );
  });

  it('treats whitespace-only fields as missing', () => {
    assert.equal(
      formatSessionTag({ sessionId: 's_abcdef', lane: '   ', stage: '\t' }),
      '[s_abcdef · - · -]',
    );
  });

  it('coerces non-string lane/stage values to strings', () => {
    // Defensive: meta files are JSON, but if a tooling bug ever produced a
    // numeric stage we still want a sane render rather than `[object Object]`.
    assert.equal(
      formatSessionTag({ sessionId: 's_abcdef', lane: 1, stage: 2 }),
      '[s_abcdef · 1 · 2]',
    );
  });
});

// ---------------------------------------------------------------------------
// appendSessionTag — composition with upstream content
// ---------------------------------------------------------------------------

describe('appendSessionTag', () => {
  it('joins upstream and tag with a single space', () => {
    const out = appendSessionTag('main * | done', {
      sessionId: 's_8f3a2c',
      lane: 'full',
      stage: 'full_implementation',
    });
    assert.equal(out, 'main * | done [s_8f3a2c · full · full_implementation]');
  });

  it('returns just the tag when upstream is empty', () => {
    const out = appendSessionTag('', { sessionId: 's_abcdef', lane: 'quick', stage: 'planning' });
    assert.equal(out, '[s_abcdef · quick · planning]');
  });

  it('returns upstream unchanged when sessionId is missing', () => {
    assert.equal(appendSessionTag('main *', {}), 'main *');
    assert.equal(appendSessionTag('main *', { sessionId: null }), 'main *');
  });

  it('treats non-string upstream as empty', () => {
    const out = appendSessionTag(undefined, { sessionId: 's_abcdef', lane: 'full', stage: 'plan' });
    assert.equal(out, '[s_abcdef · full · plan]');
  });
});

// ---------------------------------------------------------------------------
// readSessionContext — reads meta + per-session/work-item state
// ---------------------------------------------------------------------------

describe('readSessionContext', () => {
  it('reads lane from meta and stage from per-session mirror', () => {
    const sid = 's_8f3a2c';
    writeJson(path.join(tmp, 'sessions', sid, 'meta.json'), {
      schema: 'openkit/session-meta@1',
      session_id: sid,
      work_item_id: 'full-payments-refactor',
      lane: 'full',
    });
    writeJson(path.join(tmp, 'sessions', sid, 'workflow-state.json'), {
      current_stage: 'full_implementation',
    });

    const ctx = readSessionContext(tmp, sid);
    assert.deepEqual(ctx, {
      sessionId: sid,
      lane: 'full',
      stage: 'full_implementation',
      workItemId: 'full-payments-refactor',
    });
  });

  it('falls back to work-item state.json when per-session mirror is absent', () => {
    const sid = 's_aaaaaa';
    writeJson(path.join(tmp, 'sessions', sid, 'meta.json'), {
      session_id: sid,
      work_item_id: 'quick-fix-typo',
      lane: 'quick',
    });
    writeJson(path.join(tmp, 'work-items', 'quick-fix-typo', 'state.json'), {
      current_stage: 'planning',
    });

    const ctx = readSessionContext(tmp, sid);
    assert.equal(ctx.lane, 'quick');
    assert.equal(ctx.stage, 'planning');
    assert.equal(ctx.workItemId, 'quick-fix-typo');
  });

  it('prefers per-session mirror over work-item state when both exist', () => {
    const sid = 's_bbbbbb';
    writeJson(path.join(tmp, 'sessions', sid, 'meta.json'), {
      session_id: sid,
      work_item_id: 'wi-1',
      lane: 'full',
    });
    writeJson(path.join(tmp, 'sessions', sid, 'workflow-state.json'), {
      current_stage: 'session_stage',
    });
    writeJson(path.join(tmp, 'work-items', 'wi-1', 'state.json'), {
      current_stage: 'work_item_stage',
    });

    const ctx = readSessionContext(tmp, sid);
    assert.equal(ctx.stage, 'session_stage');
  });

  it('returns nulls when meta and state files are missing', () => {
    const ctx = readSessionContext(tmp, 's_missing');
    assert.deepEqual(ctx, {
      sessionId: 's_missing',
      lane: null,
      stage: null,
      workItemId: null,
    });
  });

  it('survives malformed JSON without throwing', () => {
    const sid = 's_brkjsn';
    fs.mkdirSync(path.join(tmp, 'sessions', sid), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'sessions', sid, 'meta.json'), '{ this is not json');
    fs.writeFileSync(path.join(tmp, 'sessions', sid, 'workflow-state.json'), 'also bad');

    const ctx = readSessionContext(tmp, sid);
    assert.equal(ctx.lane, null);
    assert.equal(ctx.stage, null);
  });

  it('returns empty context when called without baseDir or sessionId', () => {
    assert.deepEqual(readSessionContext('', 's_abcdef'), {
      sessionId: 's_abcdef',
      lane: null,
      stage: null,
      workItemId: null,
    });
    assert.deepEqual(readSessionContext(tmp, ''), {
      sessionId: null,
      lane: null,
      stage: null,
      workItemId: null,
    });
  });
});

// ---------------------------------------------------------------------------
// resolveBaseDir
// ---------------------------------------------------------------------------

describe('resolveBaseDir', () => {
  it('uses OPENKIT_PROJECT_ROOT when set', () => {
    const out = resolveBaseDir({ env: { OPENKIT_PROJECT_ROOT: '/proj' }, cwd: '/cwd' });
    assert.equal(out, path.join('/proj', '.opencode'));
  });

  it('falls back to cwd when env var is unset', () => {
    const out = resolveBaseDir({ env: {}, cwd: '/cwd' });
    assert.equal(out, path.join('/cwd', '.opencode'));
  });

  it('falls back to process.cwd() when neither is supplied', () => {
    const out = resolveBaseDir({ env: {}, cwd: undefined });
    assert.equal(out, path.join(process.cwd(), '.opencode'));
  });

  it('treats empty OPENKIT_PROJECT_ROOT as unset', () => {
    const out = resolveBaseDir({ env: { OPENKIT_PROJECT_ROOT: '' }, cwd: '/cwd' });
    assert.equal(out, path.join('/cwd', '.opencode'));
  });
});

// ---------------------------------------------------------------------------
// buildStatusLine — end-to-end with fixture base dir
// ---------------------------------------------------------------------------

describe('buildStatusLine', () => {
  it('returns input unchanged when OPENKIT_SESSION_ID is unset', () => {
    const out = buildStatusLine({ env: {}, baseDir: tmp, input: 'main *' });
    assert.equal(out, 'main *');
  });

  it('appends spec tag when env + meta + mirror are present', () => {
    const sid = 's_8f3a2c';
    writeJson(path.join(tmp, 'sessions', sid, 'meta.json'), {
      session_id: sid,
      work_item_id: 'full-payments-refactor',
      lane: 'full',
    });
    writeJson(path.join(tmp, 'sessions', sid, 'workflow-state.json'), {
      current_stage: 'full_implementation',
    });

    const out = buildStatusLine({
      env: { OPENKIT_SESSION_ID: sid },
      baseDir: tmp,
      input: 'main *',
    });
    assert.equal(out, 'main * [s_8f3a2c · full · full_implementation]');
  });

  it('emits tag-only output when input is empty', () => {
    const sid = 's_abcdef';
    writeJson(path.join(tmp, 'sessions', sid, 'meta.json'), { lane: 'quick' });
    writeJson(path.join(tmp, 'sessions', sid, 'workflow-state.json'), { current_stage: 'planning' });

    const out = buildStatusLine({
      env: { OPENKIT_SESSION_ID: sid },
      baseDir: tmp,
      input: '',
    });
    assert.equal(out, '[s_abcdef · quick · planning]');
  });

  it('renders placeholders when meta/state are missing but env is set', () => {
    const out = buildStatusLine({
      env: { OPENKIT_SESSION_ID: 's_unknwn' },
      baseDir: tmp,
      input: 'x',
    });
    assert.equal(out, 'x [s_unknwn · - · -]');
  });

  it('never throws on malformed fixtures', () => {
    const sid = 's_brkjsn';
    fs.mkdirSync(path.join(tmp, 'sessions', sid), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'sessions', sid, 'meta.json'), 'not-json');
    const out = buildStatusLine({
      env: { OPENKIT_SESSION_ID: sid },
      baseDir: tmp,
      input: 'main',
    });
    // Falls back to placeholders; importantly, no throw.
    assert.equal(out, 'main [s_brkjsn · - · -]');
  });

  it('honours OPENKIT_PROJECT_ROOT to derive baseDir when none is supplied', () => {
    const sid = 's_root00';
    writeJson(path.join(tmp, '.opencode', 'sessions', sid, 'meta.json'), { lane: 'full' });
    writeJson(path.join(tmp, '.opencode', 'sessions', sid, 'workflow-state.json'), {
      current_stage: 'plan',
    });
    const out = buildStatusLine({
      env: { OPENKIT_SESSION_ID: sid, OPENKIT_PROJECT_ROOT: tmp },
      input: 'up',
    });
    assert.equal(out, 'up [s_root00 · full · plan]');
  });
});

// ---------------------------------------------------------------------------
// extractUpstreamInput — stdin payload parser
// ---------------------------------------------------------------------------

describe('extractUpstreamInput', () => {
  it('returns empty string for empty / whitespace input', () => {
    assert.equal(extractUpstreamInput(''), '');
    assert.equal(extractUpstreamInput('   \n  '), '');
    assert.equal(extractUpstreamInput(undefined), '');
  });

  it('extracts statusline field from JSON payload', () => {
    assert.equal(
      extractUpstreamInput('{"statusline":"main *"}'),
      'main *',
    );
  });

  it('extracts input field from JSON payload as alternative key', () => {
    assert.equal(
      extractUpstreamInput('{"input":"branch info"}'),
      'branch info',
    );
  });

  it('returns string payload directly when JSON wraps a bare string', () => {
    assert.equal(extractUpstreamInput('"hello"'), 'hello');
  });

  it('returns empty string for JSON without recognised fields', () => {
    assert.equal(extractUpstreamInput('{"unrelated":true}'), '');
  });

  it('returns the raw text when payload is not JSON', () => {
    assert.equal(extractUpstreamInput('plain text'), 'plain text');
  });

  it('returns the raw payload when JSON parsing fails on a brace-prefixed string', () => {
    // Defensive: malformed JSON shouldn't lose the entire upstream signal.
    assert.equal(extractUpstreamInput('{not really json'), '{not really json');
  });
});
