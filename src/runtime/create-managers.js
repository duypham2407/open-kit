import { createWorkItemBridge } from './background/work-item-bridge.js';
import { BackgroundManager } from './managers/background-manager.js';
import { ActionModelStateManager } from './managers/action-model-state-manager.js';
import { AgentProfileSwitchManager } from './managers/agent-profile-switch-manager.js';
import { ConcurrencyManager } from './managers/concurrency-manager.js';
import { ContinuationStateManager } from './managers/continuation-state-manager.js';
import { DelegationSupervisor } from './managers/delegation-supervisor.js';
import { createConfigHandler } from './managers/config-handler.js';
import { NotificationManager } from './managers/notification-manager.js';
import { PersistentBackgroundStore } from './managers/persistent-background-store.js';
import { SessionStateManager } from './managers/session-state-manager.js';
import { SkillMcpManager } from './managers/skill-mcp-manager.js';
import { CapabilityRegistryManager } from './managers/capability-registry-manager.js';
import { McpHealthManager } from './managers/mcp-health-manager.js';
import { SyntaxIndexManager } from './managers/syntax-index-manager.js';
import { ProjectGraphManager } from './managers/project-graph-manager.js';
import { SessionMemoryManager } from './managers/session-memory-manager.js';
import { SupervisorDialogueManager } from './managers/supervisor-dialogue-manager.js';
import { TmuxSessionManager } from './managers/tmux-session-manager.js';
import { ToolMetadataStore } from './managers/tool-metadata-store.js';
import { EmbeddingIndexer } from './analysis/embedding-indexer.js';
import { createEmbeddingProvider, NoOpEmbeddingProvider } from './analysis/embedding-provider.js';
import { FileWatcher } from './analysis/file-watcher.js';
import { resolveRuntimeRoot } from './runtime-root.js';
import { createWorkflowKernelAdapter } from './workflow-kernel.js';

function createManagerList({
  configHandler,
  backgroundManager,
  skillMcpManager,
  capabilityRegistryManager,
  mcpHealthManager,
  syntaxIndexManager,
  projectGraphManager,
  sessionMemoryManager,
  supervisorDialogueManager,
  embeddingIndexer,
  notificationManager,
  tmuxSessionManager,
  delegationSupervisor,
  continuationStateManager,
  fileWatcher,
}) {
  const supervisorDescription = supervisorDialogueManager?.describe?.() ?? null;
  const supervisorConfigured = supervisorDescription?.adapter?.configured === true;
  const supervisorAvailability = supervisorDescription?.enabled === true && supervisorConfigured ? 'available' : 'not_configured';

  return [
    {
      id: 'manager.config-handler',
      name: 'Config Handler',
      description: 'Keeps runtime config metadata and source information available to the launcher and doctor.',
      enabled: true,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.background',
      name: 'Background Manager',
      description: 'Background task coordinator tied to workflow-state execution surfaces.',
      enabled: backgroundManager.enabled,
      lifecycle: 'foundation',
      dispose() {
        backgroundManager.dispose();
      },
    },
    {
      id: 'manager.skill-mcp',
      name: 'Skill MCP Manager',
      description: 'Runtime registry for built-in and skill-provided MCP surfaces.',
      enabled: true,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.capability-registry',
      name: 'Capability Registry Manager',
      description: 'Joins bundled/custom MCP and skill catalogs with local configuration, key presence, and health status.',
      enabled: capabilityRegistryManager !== null,
      lifecycle: 'active',
      dispose() {},
    },
    {
      id: 'manager.mcp-health',
      name: 'MCP Health Manager',
      description: 'Read-only health checker for bundled and OpenKit-managed custom MCP entries.',
      enabled: mcpHealthManager !== null,
      lifecycle: 'active',
      dispose() {},
    },
    {
      id: 'manager.syntax-index',
      name: 'Syntax Index Manager',
      description: 'Tree-sitter-backed syntax parsing cache for structure-aware AI context building.',
      enabled: syntaxIndexManager !== null,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.project-graph',
      name: 'Project Graph Manager',
      description: 'SQLite-backed import graph and symbol index for cross-file dependency analysis.',
      enabled: projectGraphManager?.available === true,
      lifecycle: 'foundation',
      dispose() {
        projectGraphManager?.dispose?.();
      },
    },
    {
      id: 'manager.session-memory',
      name: 'Session Memory Manager',
      description: 'Tracks file touches during sessions and provides semantic search over the project graph.',
      enabled: sessionMemoryManager?.available === true,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.supervisor-dialogue',
      name: 'Supervisor Dialogue Manager',
      description: 'Event-driven OpenClaw supervisor dialogue bridge with OpenKit-only authority boundaries.',
      enabled: supervisorDialogueManager?.enabled === true,
      availability: supervisorAvailability,
      validation_surface: 'runtime_tooling',
      lifecycle: 'foundation',
      dispose() {
        supervisorDialogueManager?.dispose?.();
      },
    },
    {
      id: 'manager.embedding-indexer',
      name: 'Embedding Indexer',
      description: 'Config-driven embedding generation pipeline for semantic code search.',
      enabled: embeddingIndexer?.available === true,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.delegation-supervisor',
      name: 'Delegation Supervisor',
      description: 'Task-board-aware delegated execution planner for full-delivery work.',
      enabled: delegationSupervisor !== null,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.continuation-state',
      name: 'Continuation State Manager',
      description: 'File-backed continuation controller for handoff, stop, and bounded resume state.',
      enabled: true,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.notifications',
      name: 'Notification Manager',
      description: 'Task and runtime notification dispatcher.',
      enabled: notificationManager.enabled,
      lifecycle: 'foundation',
      dispose() {},
    },
    {
      id: 'manager.tmux',
      name: 'Tmux Session Manager',
      description: 'Tmux-based visual runtime integration for delegated work.',
      enabled: tmuxSessionManager.enabled,
      lifecycle: 'foundation',
      dispose() {
        tmuxSessionManager.cleanup();
      },
    },
    {
      id: 'manager.file-watcher',
      name: 'File Watcher',
      description: 'Watches project source files for changes and triggers incremental re-indexing.',
      enabled: fileWatcher !== null,
      lifecycle: 'foundation',
      dispose() {
        fileWatcher?.stop();
      },
    },
  ];
}

export function createManagers({ config, capabilityIndex, projectRoot, configResult, mode = 'read-write', specialists = [], env = process.env }) {
  const runtimeRoot = resolveRuntimeRoot({ projectRoot, env });
  const concurrencyManager = new ConcurrencyManager({
    providerConcurrency: config?.backgroundTask?.providerConcurrency,
    modelConcurrency: config?.backgroundTask?.modelConcurrency,
  });
  const workflowKernel = createWorkflowKernelAdapter({ projectRoot, env });
  const configHandler = createConfigHandler({ configResult });
  const notificationManager = new NotificationManager({
    enabled: config?.notifications?.enabled === true,
  });
  const tmuxSessionManager = new TmuxSessionManager({
    enabled: config?.tmux?.enabled === true,
    layout: config?.tmux?.layout,
  });
  const mcpHealthManager = new McpHealthManager({ env });
  const skillMcpManager = new SkillMcpManager({ mcpHealthManager });
  const capabilityRegistryManager = new CapabilityRegistryManager({ mcpHealthManager, skillMcpManager });
  const syntaxIndexManager = new SyntaxIndexManager({ projectRoot });
  const projectGraphManager = new ProjectGraphManager({ projectRoot, runtimeRoot, syntaxIndexManager, mode });

  // Embedding provider — needed for both writing and reading embeddings.
  // Embedding indexer — write-side only; skipped in read-only mode.
  let embeddingProvider = null;
  let embeddingIndexer = null;
  if (config?.embedding?.enabled === true && projectGraphManager.available) {
    try {
      embeddingProvider = createEmbeddingProvider(config.embedding, { env });
      // Only create the write-side indexer when not in read-only mode
      if (mode !== 'read-only') {
        embeddingIndexer = new EmbeddingIndexer({
          projectGraphManager,
          embeddingProvider,
          batchSize: config.embedding.batchSize ?? 20,
        });
      }
    } catch {
      // Provider creation failed (e.g. missing baseUrl for custom) — degrade gracefully
      embeddingProvider = null;
      embeddingIndexer = null;
    }
  }

  // Re-create sessionMemoryManager with the embedding provider when available
  const sessionMemoryManager = new SessionMemoryManager({ projectGraphManager, embeddingProvider });
  const supervisorDialogueManager = new SupervisorDialogueManager({ runtimeRoot, config, mode });

  // Wire automatic per-file embedding generation: when a file is indexed,
  // immediately queue embedding extraction for that file (best-effort).
  if (embeddingIndexer) {
    projectGraphManager.onFileIndexed((filePath) => {
      return embeddingIndexer.indexFileEmbeddings(filePath);
    });
  }

  // File watcher — incremental re-indexing on source file changes.
  // Only active when the graph manager is available and mode is read-write.
  let fileWatcher = null;
  if (projectGraphManager.available && mode !== 'read-only') {
    fileWatcher = new FileWatcher({ projectRoot, projectGraphManager });
    // Start is deferred — the watcher begins watching after bootstrap completes.
    // Callers can invoke fileWatcher.start() when ready.
  }

  const sessionStateManager = new SessionStateManager({ projectRoot, runtimeRoot, mode });
  const continuationStateManager = new ContinuationStateManager({ projectRoot, runtimeRoot, mode });
  const actionModelStateManager = new ActionModelStateManager({ projectRoot, runtimeRoot, mode });
  const agentProfileSwitchManager = new AgentProfileSwitchManager({ projectRoot, runtimeRoot, mode });
  const workItemBridge = createWorkItemBridge({ projectRoot, workflowKernel, actionModelStateManager });
  const toolMetadataStore = new ToolMetadataStore();
  const backgroundManager = new BackgroundManager({
    enabled: config?.backgroundTask?.enabled === true,
    concurrencyManager,
    workItemBridge,
    persistentStore: new PersistentBackgroundStore({ projectRoot, runtimeRoot, mode }),
  });
  const delegationSupervisor = new DelegationSupervisor({
    workflowKernel,
    backgroundManager,
    specialists,
    concurrencyManager,
    actionModelStateManager,
  });
  const managerList = createManagerList({
    configHandler,
    backgroundManager,
    skillMcpManager,
    capabilityRegistryManager,
    mcpHealthManager,
    syntaxIndexManager,
    projectGraphManager,
    sessionMemoryManager,
    supervisorDialogueManager,
    embeddingIndexer,
    delegationSupervisor,
    continuationStateManager,
    notificationManager,
    tmuxSessionManager,
    fileWatcher,
  }).map((entry) => ({
    ...entry,
    capabilityStatus: capabilityIndex['capability.manager-layer']?.status ?? 'missing',
  }));

  return {
    managerList,
    managers: Object.fromEntries(managerList.map((manager) => [manager.id, manager])),
    configHandler,
    backgroundManager,
    skillMcpManager,
    capabilityRegistryManager,
    mcpHealthManager,
    syntaxIndexManager,
    projectGraphManager,
    sessionMemoryManager,
    supervisorDialogueManager,
    embeddingIndexer,
    delegationSupervisor,
    continuationStateManager,
    notificationManager,
    tmuxSessionManager,
    fileWatcher,
    sessionStateManager,
    actionModelStateManager,
    agentProfileSwitchManager,
    toolMetadataStore,
    concurrencyManager,
    workItemBridge,
    workflowKernel,
    disposeManagers() {
      for (const manager of managerList) {
        manager.dispose?.();
      }
    },
  };
}
