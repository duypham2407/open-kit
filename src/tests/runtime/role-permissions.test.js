import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isToolAllowed,
  getBlockedReason,
  getAllowedTools,
  suggestOwnerForTool,
  getKnownRoles,
  getRolePermissions,
} from '../../runtime/workflow/role-permissions.js';

// ── MasterOrchestrator ──────────────────────────────────────────────────

test('MasterOrchestrator is blocked from hashline-edit', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.hashline-edit');
  assert.equal(result.allowed, false);
  assert.ok(result.reason);
  assert.ok(result.suggestedOwner);
});

test('MasterOrchestrator is blocked from interactive-bash', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.interactive-bash');
  assert.equal(result.allowed, false);
});

test('MasterOrchestrator is blocked from codemod-apply', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.codemod-apply');
  assert.equal(result.allowed, false);
});

test('MasterOrchestrator is allowed workflow-state', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.workflow-state');
  assert.equal(result.allowed, true);
});

test('MasterOrchestrator is allowed advance-stage', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.advance-stage');
  assert.equal(result.allowed, true);
});

test('MasterOrchestrator is allowed capability-inventory (prefix match)', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.capability-inventory');
  assert.equal(result.allowed, true);
});

test('MasterOrchestrator is blocked from unknown tools (no wildcard)', () => {
  const result = isToolAllowed('MasterOrchestrator', 'tool.some-random-tool');
  assert.equal(result.allowed, false);
});

// ── QuickAgent ──────────────────────────────────────────────────────────

test('QuickAgent is allowed everything (wildcard)', () => {
  assert.equal(isToolAllowed('QuickAgent', 'tool.hashline-edit').allowed, true);
  assert.equal(isToolAllowed('QuickAgent', 'tool.interactive-bash').allowed, true);
  assert.equal(isToolAllowed('QuickAgent', 'tool.codemod-apply').allowed, true);
  assert.equal(isToolAllowed('QuickAgent', 'tool.workflow-state').allowed, true);
});

// ── FullstackAgent ──────────────────────────────────────────────────────

test('FullstackAgent is allowed everything (wildcard)', () => {
  assert.equal(isToolAllowed('FullstackAgent', 'tool.hashline-edit').allowed, true);
  assert.equal(isToolAllowed('FullstackAgent', 'tool.interactive-bash').allowed, true);
});

// ── ProductLead ─────────────────────────────────────────────────────────

test('ProductLead is blocked from editing code', () => {
  assert.equal(isToolAllowed('ProductLead', 'tool.hashline-edit').allowed, false);
  assert.equal(isToolAllowed('ProductLead', 'tool.interactive-bash').allowed, false);
  assert.equal(isToolAllowed('ProductLead', 'tool.codemod-apply').allowed, false);
});

test('ProductLead is allowed to search code', () => {
  assert.equal(isToolAllowed('ProductLead', 'tool.semantic-search').allowed, true);
  assert.equal(isToolAllowed('ProductLead', 'tool.find-symbol').allowed, true);
});

// ── SolutionLead ────────────────────────────────────────────────────────

test('SolutionLead is blocked from editing code', () => {
  assert.equal(isToolAllowed('SolutionLead', 'tool.hashline-edit').allowed, false);
  assert.equal(isToolAllowed('SolutionLead', 'tool.interactive-bash').allowed, false);
});

test('SolutionLead is allowed to analyze code', () => {
  assert.equal(isToolAllowed('SolutionLead', 'tool.ast-grep-search').allowed, true);
  assert.equal(isToolAllowed('SolutionLead', 'tool.find-dependencies').allowed, true);
});

// ── CodeReviewer ────────────────────────────────────────────────────────

test('CodeReviewer is blocked from modifying code', () => {
  assert.equal(isToolAllowed('CodeReviewer', 'tool.hashline-edit').allowed, false);
  assert.equal(isToolAllowed('CodeReviewer', 'tool.codemod-apply').allowed, false);
  assert.equal(isToolAllowed('CodeReviewer', 'tool.interactive-bash').allowed, false);
});

test('CodeReviewer is allowed to scan', () => {
  assert.equal(isToolAllowed('CodeReviewer', 'tool.rule-scan').allowed, true);
  assert.equal(isToolAllowed('CodeReviewer', 'tool.security-scan').allowed, true);
});

// ── QAAgent ─────────────────────────────────────────────────────────────

test('QAAgent is blocked from editing code', () => {
  assert.equal(isToolAllowed('QAAgent', 'tool.hashline-edit').allowed, false);
  assert.equal(isToolAllowed('QAAgent', 'tool.codemod-apply').allowed, false);
});

test('QAAgent is allowed to run tests and bash', () => {
  assert.equal(isToolAllowed('QAAgent', 'tool.test-run').allowed, true);
  assert.equal(isToolAllowed('QAAgent', 'tool.interactive-bash').allowed, true);
  assert.equal(isToolAllowed('QAAgent', 'tool.browser-verify').allowed, true);
});

// ── Helper functions ────────────────────────────────────────────────────

test('getBlockedReason returns descriptive message', () => {
  const reason = getBlockedReason('MasterOrchestrator', 'tool.hashline-edit');
  assert.ok(reason);
  assert.ok(reason.includes('MasterOrchestrator'));
  assert.ok(reason.includes('tool.hashline-edit'));
});

test('getAllowedTools returns list for MasterOrchestrator', () => {
  const tools = getAllowedTools('MasterOrchestrator');
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length > 0);
  assert.ok(tools.includes('tool.workflow-state'));
});

test('getAllowedTools returns wildcard for QuickAgent', () => {
  const tools = getAllowedTools('QuickAgent');
  assert.ok(tools.includes('*'));
});

test('suggestOwnerForTool returns FullstackAgent for code tools', () => {
  assert.equal(suggestOwnerForTool('tool.hashline-edit'), 'FullstackAgent');
  assert.equal(suggestOwnerForTool('tool.codemod-apply'), 'FullstackAgent');
});

test('suggestOwnerForTool returns QAAgent for test tools', () => {
  assert.equal(suggestOwnerForTool('tool.test-run'), 'QAAgent');
  assert.equal(suggestOwnerForTool('tool.typecheck'), 'QAAgent');
});

test('suggestOwnerForTool returns CodeReviewer for scan tools', () => {
  assert.equal(suggestOwnerForTool('tool.rule-scan'), 'CodeReviewer');
});

test('getKnownRoles returns all 7 roles', () => {
  const roles = getKnownRoles();
  assert.equal(roles.length, 7);
  assert.ok(roles.includes('MasterOrchestrator'));
  assert.ok(roles.includes('QuickAgent'));
  assert.ok(roles.includes('FullstackAgent'));
});

test('getRolePermissions returns null for unknown role', () => {
  assert.equal(getRolePermissions('UnknownRole'), null);
});

test('unknown role is permissive in isToolAllowed', () => {
  const result = isToolAllowed('UnknownRole', 'tool.anything');
  assert.equal(result.allowed, true);
});
