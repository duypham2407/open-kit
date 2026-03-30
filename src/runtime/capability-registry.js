const DEFAULT_RUNTIME_CAPABILITIES = [
  {
    id: 'capability.runtime-bootstrap',
    category: 'foundation',
    description: 'Bootstraps runtime config, managers, tools, hooks, and interface metadata.',
    status: 'active',
    enabledByDefault: true,
  },
  {
    id: 'capability.runtime-config-layering',
    category: 'foundation',
    description: 'Loads project and user runtime config with additive merge behavior.',
    status: 'active',
    enabledByDefault: true,
  },
  {
    id: 'capability.capability-registry',
    category: 'foundation',
    description: 'Publishes runtime capability metadata and feature-gated availability.',
    status: 'active',
    enabledByDefault: true,
  },
  {
    id: 'capability.runtime-diagnostics',
    category: 'foundation',
    description: 'Reports runtime foundation health and capability inventory.',
    status: 'active',
    enabledByDefault: true,
    featureFlag: 'capabilityDiagnostics',
  },
  {
    id: 'capability.manager-layer',
    category: 'runtime',
    description: 'Creates lifecycle-managed runtime managers for background, notifications, tmux, and MCP.',
    status: 'foundation',
    enabledByDefault: true,
    featureFlag: 'managers',
  },
  {
    id: 'capability.tool-registry',
    category: 'runtime',
    description: 'Registers workflow-aware runtime tools and execution adapters.',
    status: 'foundation',
    enabledByDefault: true,
    featureFlag: 'tools',
  },
  {
    id: 'capability.hook-registry',
    category: 'runtime',
    description: 'Registers runtime hooks for session summary, validation, and future guardrails.',
    status: 'foundation',
    enabledByDefault: true,
    featureFlag: 'hooks',
  },
  {
    id: 'capability.mcp-platform',
    category: 'runtime',
    description: 'Built-in and skill-embedded MCP support.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.background-execution',
    category: 'runtime',
    description: 'Background task runtime with workflow-state bridge and concurrency control.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.category-routing',
    category: 'runtime',
    description: 'Execution categories that are distinct from workflow modes.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.specialist-agents',
    category: 'runtime',
    description: 'Read-only and execution helper specialists layered under workflow ownership.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.recovery-stack',
    category: 'runtime',
    description: 'Recovery flows for context, tool results, malformed JSON, and runtime fallbacks.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.session-tooling',
    category: 'runtime',
    description: 'Session history, search, and resume analysis tools.',
    status: 'active',
    enabledByDefault: true,
  },
  {
    id: 'capability.continuation-control',
    category: 'runtime',
    description: 'File-backed continuation status, stop, start, and handoff controls.',
    status: 'active',
    enabledByDefault: true,
  },
  {
    id: 'capability.browser-automation',
    category: 'runtime',
    description: 'Browser verification planning with provider diagnostics.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.safer-editing',
    category: 'runtime',
    description: 'Anchor-safe edit preview and guarded replacement planning.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.ast-tooling',
    category: 'runtime',
    description: 'Structured JSON and JSONC search and replacement previews.',
    status: 'foundation',
    enabledByDefault: true,
  },
  {
    id: 'capability.lsp-tooling',
    category: 'runtime',
    description: 'Heuristic symbol and diagnostics tooling when a full LSP server is unavailable.',
    status: 'foundation',
    enabledByDefault: true,
  },
];

function isCapabilityEnabled(capability, config) {
  const disabled = new Set(config?.disabled?.capabilities ?? []);
  if (disabled.has(capability.id)) {
    return false;
  }

  if (capability.featureFlag) {
    return config?.runtime?.featureFlags?.[capability.featureFlag] !== false;
  }

  return capability.enabledByDefault !== false;
}

export function listRuntimeCapabilities({ config } = {}) {
  return DEFAULT_RUNTIME_CAPABILITIES.map((capability) => ({
    ...capability,
    enabled: isCapabilityEnabled(capability, config),
  })).filter((capability) => capability.enabled);
}

export function getRuntimeCapability(capabilityId, { config } = {}) {
  return listRuntimeCapabilities({ config }).find((capability) => capability.id === capabilityId) ?? null;
}

export function createCapabilityIndex({ config } = {}) {
  return Object.fromEntries(
    listRuntimeCapabilities({ config }).map((capability) => [capability.id, capability])
  );
}

export function summarizeRuntimeCapabilities(capabilities) {
  const summary = {
    total: 0,
    active: 0,
    foundation: 0,
    planned: 0,
  };

  for (const capability of capabilities ?? []) {
    summary.total += 1;
    if (capability.status === 'active') {
      summary.active += 1;
    }
    if (capability.status === 'foundation') {
      summary.foundation += 1;
    }
    if (capability.status === 'planned') {
      summary.planned += 1;
    }
  }

  return summary;
}
