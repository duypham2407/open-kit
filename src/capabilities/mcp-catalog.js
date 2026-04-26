import { STANDARD_CAPABILITY_STATES } from './status.js';

const CATALOG_VERSION = 1;

function envBinding({ id, envVar, label, mcpId, required = true }) {
  return {
    id,
    envVar,
    required,
    label,
    configureCommand: `openkit configure mcp set-key ${mcpId} --stdin`,
    placeholder: `\${${envVar}}`,
  };
}

function withSchema(entry) {
  return {
    schema: 'openkit/mcp-catalog-entry@1',
    catalogVersion: CATALOG_VERSION,
    scopes: ['openkit', 'global'],
    secretBindings: [],
    dependencyChecks: [],
    skillRefs: [],
    optional: false,
    policy: {},
    docs: {
      setup: 'docs/operator/mcp-configuration.md',
      limitations: [],
    },
    ...entry,
  };
}

const MCP_CATALOG = [
  withSchema({
    id: 'openkit',
    displayName: 'OpenKit',
    description: 'OpenKit-owned MCP server exposing workflow, runtime, graph, audit, and capability tools.',
    category: 'openkit',
    status: 'available',
    lifecycle: 'stable',
    defaultEnabled: { openkit: true, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['node', '{OPENKIT_KIT_ROOT}/bin/openkit-mcp.js'],
      enabled: true,
      environment: {
        OPENKIT_PROJECT_ROOT: '{cwd}',
      },
    },
    dependencyChecks: [{ id: 'node', kind: 'command', command: 'node', required: true }],
    skillRefs: ['skill.using-skills', 'skill.codebase-exploration', 'skill.verification-before-completion'],
    test: { kind: 'runtime-dispatch', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#openkit',
      limitations: [],
    },
  }),
  withSchema({
    id: 'chrome-devtools',
    displayName: 'Chrome DevTools',
    description: 'Browser inspection, debugging, performance, and Lighthouse-oriented verification support.',
    category: 'browser',
    status: 'degraded',
    lifecycle: 'stable',
    defaultEnabled: { openkit: true, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', 'chrome-devtools-mcp@0.21.0'],
      enabled: true,
    },
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.dev-browser', 'skill.browser-automation', 'skill.vercel-react-best-practices'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#chrome-devtools',
      limitations: ['Requires local browser/tooling support at runtime.'],
    },
  }),
  withSchema({
    id: 'playwright',
    displayName: 'Playwright',
    description: 'Browser automation and UI smoke-verification MCP capability.',
    category: 'browser',
    status: 'degraded',
    lifecycle: 'stable',
    defaultEnabled: { openkit: true, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', '@playwright/mcp@latest'],
      enabled: true,
    },
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.browser-automation', 'skill.vercel-react-best-practices'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#playwright',
      limitations: ['Browser binaries may need to be installed separately.'],
    },
  }),
  withSchema({
    id: 'context7',
    displayName: 'Context7',
    description: 'Library documentation and code examples for framework/API usage.',
    category: 'research',
    status: 'not_configured',
    lifecycle: 'stable',
    defaultEnabled: { openkit: false, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', '@upstash/context7-mcp@latest'],
      enabled: true,
      environment: {
        CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}',
      },
    },
    secretBindings: [envBinding({ id: 'context7-api-key', envVar: 'CONTEXT7_API_KEY', label: 'Context7 API key', mcpId: 'context7' })],
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.context7-mcp', 'skill.deep-research'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#context7',
      limitations: ['Requires a local API key configured through the OpenKit secret file.'],
    },
  }),
  withSchema({
    id: 'grep_app',
    displayName: 'grep.app',
    description: 'Public GitHub code-search examples for implementation pattern research.',
    category: 'code-search',
    status: 'not_configured',
    lifecycle: 'stable',
    defaultEnabled: { openkit: false, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', 'grep-app-mcp@latest'],
      enabled: true,
      environment: {
        GREP_APP_API_KEY: '${GREP_APP_API_KEY}',
      },
    },
    secretBindings: [envBinding({ id: 'grep-app-api-key', envVar: 'GREP_APP_API_KEY', label: 'grep.app API key', mcpId: 'grep_app' })],
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.deep-research', 'skill.codebase-exploration'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#grep-app',
      limitations: ['Requires local provider configuration before use.'],
    },
  }),
  withSchema({
    id: 'websearch',
    displayName: 'Web Search',
    description: 'Web search and current-information research capability.',
    category: 'research',
    status: 'not_configured',
    lifecycle: 'stable',
    defaultEnabled: { openkit: false, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', 'websearch-mcp@latest'],
      enabled: true,
      environment: {
        WEBSEARCH_API_KEY: '${WEBSEARCH_API_KEY}',
      },
    },
    secretBindings: [envBinding({ id: 'websearch-api-key', envVar: 'WEBSEARCH_API_KEY', label: 'Web search provider API key', mcpId: 'websearch' })],
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.deep-research'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#websearch',
      limitations: ['Provider/network failures are reported as degraded or unavailable without raw payloads.'],
    },
  }),
  withSchema({
    id: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: 'Structured multi-step reasoning support for complex planning and debugging.',
    category: 'reasoning',
    status: 'preview',
    lifecycle: 'preview',
    defaultEnabled: { openkit: true, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking'],
      enabled: true,
    },
    dependencyChecks: [{ id: 'npx', kind: 'command', command: 'npx', required: true }],
    skillRefs: ['skill.brainstorming', 'skill.systematic-debugging'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#sequential-thinking',
      limitations: ['Preview reasoning aid; not a substitute for workflow approvals or evidence.'],
    },
  }),
  withSchema({
    id: 'git',
    displayName: 'Git (policy-gated)',
    description: 'Policy-gated git capability that preserves OpenKit safety constraints.',
    category: 'source-control',
    status: 'preview',
    lifecycle: 'policy_gated',
    defaultEnabled: { openkit: false, global: false },
    transport: 'builtin',
    profileEntry: null,
    dependencyChecks: [{ id: 'git', kind: 'command', command: 'git', required: true }],
    policy: {
      destructiveOperations: 'blocked',
      requiresExplicitEnable: true,
    },
    skillRefs: ['skill.git-master'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#git-policy-gated',
      limitations: ['Destructive or irreversible git operations remain confirmation-gated and are never silently allowed by this catalog entry.'],
    },
  }),
  withSchema({
    id: 'augment_context_engine',
    displayName: 'Augment Context Engine',
    description: 'Optional dependency-aware code context engine when available in the local runtime.',
    category: 'code-intelligence',
    status: 'unavailable',
    lifecycle: 'optional',
    optional: true,
    defaultEnabled: { openkit: false, global: false },
    transport: 'stdio',
    profileEntry: {
      type: 'local',
      command: ['npx', '-y', 'augment-context-engine-mcp@latest'],
      enabled: true,
    },
    dependencyChecks: [{ id: 'augment-context-engine', kind: 'command', command: 'augment-context-engine', required: false }],
    skillRefs: ['skill.codebase-exploration', 'skill.refactoring'],
    test: { kind: 'dependency-only', timeoutMs: 10000, sanitizedErrorMode: 'summary-only' },
    docs: {
      setup: 'docs/operator/mcp-configuration.md#augment-context-engine',
      limitations: ['Optional dependency; absence must not block install, doctor, or run.'],
    },
  }),
];

export function listMcpCatalogEntries() {
  return MCP_CATALOG.map((entry) => structuredClone(entry));
}

export function getMcpCatalogEntry(id) {
  const normalizedId = String(id ?? '').trim();
  return listMcpCatalogEntries().find((entry) => entry.id === normalizedId) ?? null;
}

export function listMcpCatalogIds() {
  return MCP_CATALOG.map((entry) => entry.id);
}

export function assertMcpCatalogEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('MCP catalog entry must be an object.');
  }
  if (!entry.id || typeof entry.id !== 'string') {
    throw new Error('MCP catalog entry requires string id.');
  }
  if (!STANDARD_CAPABILITY_STATES.includes(entry.status)) {
    throw new Error(`MCP catalog entry '${entry.id}' has unsupported status '${entry.status}'.`);
  }
  return entry;
}
