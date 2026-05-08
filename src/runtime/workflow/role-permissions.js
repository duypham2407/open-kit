/**
 * Role Permission Matrix
 *
 * Defines which MCP tools each workflow role is allowed or blocked from using.
 * Consumed by the Role Guard Hook to enforce role boundaries at runtime.
 *
 * Design:
 * - `blocked` patterns are checked first. If a tool matches any blocked pattern, it is rejected.
 * - `allowed` patterns are checked second. If `allowed` contains '*', all non-blocked tools pass.
 * - If `allowed` does not contain '*' and the tool is not explicitly listed, it is rejected.
 * - Pattern matching supports exact match and prefix match (e.g., 'capability-' matches 'tool.capability-health').
 */

const ROLE_PERMISSIONS = {
  MasterOrchestrator: {
    description: 'Workflow controller. Routes, dispatches, records state. NEVER codes or creates application files.',
    allowed: [
      'tool.workflow-state',
      'tool.advance-stage',
      'tool.check-action',
      'tool.runtime-summary',
      'tool.evidence-capture',
      'tool.workflow-audit',
      'tool.capability-',
      'tool.skill-index',
      'tool.skill-mcp-bindings',
      'tool.continuation-',
      'tool.session-',
      'tool.mcp-dispatch',
      'tool.mcp-doctor',
      'tool.profile-switch',
      'tool.session-profile-switch',
    ],
    blocked: [
      'tool.interactive-bash',
      'tool.hashline-edit',
      'tool.codemod-apply',
      'tool.codemod-preview',
      'tool.ast-replace',
      'tool.lsp-rename',
      'tool.typecheck',
      'tool.lint',
      'tool.test-run',
      'tool.browser-verify',
    ],
  },

  QuickAgent: {
    description: 'Single-owner agent for quick-mode work. Owns all quick stages. Can do everything.',
    allowed: ['*'],
    blocked: [],
  },

  ProductLead: {
    description: 'Defines problem, scope, and acceptance criteria. Writes scope docs only.',
    allowed: [
      'tool.workflow-state',
      'tool.advance-stage',
      'tool.check-action',
      'tool.runtime-summary',
      'tool.evidence-capture',
      'tool.capability-',
      'tool.semantic-search',
      'tool.find-symbol',
      'tool.find-dependencies',
      'tool.find-dependents',
      'tool.import-graph',
      'tool.syntax-outline',
      'tool.syntax-context',
      'tool.syntax-locate',
      'tool.look-at',
      'tool.session-',
      'tool.continuation-',
    ],
    blocked: [
      'tool.interactive-bash',
      'tool.hashline-edit',
      'tool.codemod-apply',
      'tool.codemod-preview',
      'tool.ast-replace',
      'tool.lsp-rename',
      'tool.typecheck',
      'tool.lint',
      'tool.test-run',
    ],
  },

  SolutionLead: {
    description: 'Chooses technical approach, defines solution design. Writes solution docs only.',
    allowed: [
      'tool.workflow-state',
      'tool.advance-stage',
      'tool.check-action',
      'tool.runtime-summary',
      'tool.evidence-capture',
      'tool.capability-',
      'tool.semantic-search',
      'tool.find-symbol',
      'tool.find-dependencies',
      'tool.find-dependents',
      'tool.import-graph',
      'tool.syntax-outline',
      'tool.syntax-context',
      'tool.syntax-locate',
      'tool.look-at',
      'tool.ast-grep-search',
      'tool.ast-search',
      'tool.graph-',
      'tool.lsp-diagnostics',
      'tool.lsp-symbols',
      'tool.lsp-goto-definition',
      'tool.lsp-find-references',
      'tool.session-',
      'tool.continuation-',
    ],
    blocked: [
      'tool.interactive-bash',
      'tool.hashline-edit',
      'tool.codemod-apply',
      'tool.ast-replace',
      'tool.lsp-rename',
    ],
  },

  FullstackAgent: {
    description: 'Implements approved work. Can use all tools.',
    allowed: ['*'],
    blocked: [],
  },

  CodeReviewer: {
    description: 'Reviews code for scope compliance and quality. Read-only — cannot modify code.',
    allowed: [
      'tool.workflow-state',
      'tool.advance-stage',
      'tool.check-action',
      'tool.runtime-summary',
      'tool.evidence-capture',
      'tool.capability-',
      'tool.semantic-search',
      'tool.find-symbol',
      'tool.find-dependencies',
      'tool.find-dependents',
      'tool.import-graph',
      'tool.syntax-outline',
      'tool.syntax-context',
      'tool.syntax-locate',
      'tool.look-at',
      'tool.ast-grep-search',
      'tool.ast-search',
      'tool.graph-',
      'tool.lsp-',
      'tool.rule-scan',
      'tool.security-scan',
      'tool.session-',
      'tool.continuation-',
    ],
    blocked: [
      'tool.interactive-bash',
      'tool.hashline-edit',
      'tool.codemod-apply',
      'tool.codemod-preview',
      'tool.ast-replace',
      'tool.lsp-rename',
      'tool.typecheck',
      'tool.lint',
      'tool.test-run',
      'tool.browser-verify',
    ],
  },

  QAAgent: {
    description: 'Verifies behavior and closure evidence. Can run tests and browser checks. Cannot modify code.',
    allowed: [
      'tool.workflow-state',
      'tool.advance-stage',
      'tool.check-action',
      'tool.runtime-summary',
      'tool.evidence-capture',
      'tool.workflow-audit',
      'tool.capability-',
      'tool.semantic-search',
      'tool.find-symbol',
      'tool.syntax-outline',
      'tool.syntax-context',
      'tool.look-at',
      'tool.rule-scan',
      'tool.security-scan',
      'tool.browser-verify',
      'tool.typecheck',
      'tool.lint',
      'tool.test-run',
      'tool.interactive-bash',
      'tool.session-',
      'tool.continuation-',
    ],
    blocked: [
      'tool.hashline-edit',
      'tool.codemod-apply',
      'tool.codemod-preview',
      'tool.ast-replace',
      'tool.lsp-rename',
    ],
  },
};

/**
 * Check if a tool matches a permission pattern.
 * Supports exact match and prefix match (pattern ending in '-').
 */
function matchesPattern(toolId, pattern) {
  if (pattern === '*') return true;
  if (pattern === toolId) return true;
  if (pattern.endsWith('-') && toolId.startsWith(pattern)) return true;
  return false;
}

/**
 * Check if a role is allowed to use a specific tool.
 *
 * @param {string} role - The workflow role (e.g., 'MasterOrchestrator')
 * @param {string} toolId - The tool identifier (e.g., 'tool.hashline-edit')
 * @returns {{ allowed: boolean, reason: string|null, allowedTools: string[], suggestedOwner: string|null }}
 */
export function isToolAllowed(role, toolId) {
  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions) {
    return { allowed: true, reason: null, allowedTools: [], suggestedOwner: null };
  }

  const isBlocked = permissions.blocked.some((pattern) => matchesPattern(toolId, pattern));
  if (isBlocked) {
    return {
      allowed: false,
      reason: getBlockedReason(role, toolId),
      allowedTools: getAllowedTools(role),
      suggestedOwner: suggestOwnerForTool(toolId),
    };
  }

  const hasWildcard = permissions.allowed.includes('*');
  if (hasWildcard) {
    return { allowed: true, reason: null, allowedTools: [], suggestedOwner: null };
  }

  const isExplicitlyAllowed = permissions.allowed.some((pattern) => matchesPattern(toolId, pattern));
  if (isExplicitlyAllowed) {
    return { allowed: true, reason: null, allowedTools: [], suggestedOwner: null };
  }

  return {
    allowed: false,
    reason: getBlockedReason(role, toolId),
    allowedTools: getAllowedTools(role),
    suggestedOwner: suggestOwnerForTool(toolId),
  };
}

/**
 * Get a human-readable reason why a tool is blocked for a role.
 */
export function getBlockedReason(role, toolId) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return null;

  const owner = suggestOwnerForTool(toolId);
  const ownerHint = owner ? ` Dispatch to ${owner} instead.` : '';

  return `${role} is not permitted to use ${toolId}. ${permissions.description}${ownerHint}`;
}

/**
 * Get the list of tools a role is explicitly allowed to use.
 */
export function getAllowedTools(role) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];
  return [...permissions.allowed];
}

/**
 * Suggest the most appropriate owner for a tool based on its category.
 */
export function suggestOwnerForTool(toolId) {
  const codeTools = ['tool.hashline-edit', 'tool.codemod-apply', 'tool.codemod-preview', 'tool.ast-replace', 'tool.lsp-rename'];
  const testTools = ['tool.typecheck', 'tool.lint', 'tool.test-run', 'tool.browser-verify'];
  const scanTools = ['tool.rule-scan', 'tool.security-scan'];

  if (codeTools.some((t) => toolId === t || toolId.startsWith(t))) return 'FullstackAgent';
  if (testTools.some((t) => toolId === t)) return 'QAAgent';
  if (scanTools.some((t) => toolId === t)) return 'CodeReviewer';
  if (toolId === 'tool.interactive-bash') return 'FullstackAgent';

  return null;
}

/**
 * Get all known role names.
 */
export function getKnownRoles() {
  return Object.keys(ROLE_PERMISSIONS);
}

/**
 * Get the permission definition for a role.
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] ?? null;
}
