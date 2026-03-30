import { createWorkItemBridge } from './background/work-item-bridge.js';
import { BackgroundManager } from './managers/background-manager.js';
import { ConcurrencyManager } from './managers/concurrency-manager.js';
import { createConfigHandler } from './managers/config-handler.js';
import { NotificationManager } from './managers/notification-manager.js';
import { SessionStateManager } from './managers/session-state-manager.js';
import { SkillMcpManager } from './managers/skill-mcp-manager.js';
import { TmuxSessionManager } from './managers/tmux-session-manager.js';
import { ToolMetadataStore } from './managers/tool-metadata-store.js';

function createManagerList({ configHandler, backgroundManager, skillMcpManager, notificationManager, tmuxSessionManager }) {
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
  ];
}

export function createManagers({ config, capabilityIndex, projectRoot, configResult }) {
  const concurrencyManager = new ConcurrencyManager({
    providerConcurrency: config?.backgroundTask?.providerConcurrency,
    modelConcurrency: config?.backgroundTask?.modelConcurrency,
  });
  const workItemBridge = createWorkItemBridge({ projectRoot });
  const configHandler = createConfigHandler({ configResult });
  const notificationManager = new NotificationManager({
    enabled: config?.notifications?.enabled === true,
  });
  const tmuxSessionManager = new TmuxSessionManager({
    enabled: config?.tmux?.enabled === true,
    layout: config?.tmux?.layout,
  });
  const skillMcpManager = new SkillMcpManager();
  const sessionStateManager = new SessionStateManager({ projectRoot });
  const toolMetadataStore = new ToolMetadataStore();
  const backgroundManager = new BackgroundManager({
    enabled: config?.backgroundTask?.enabled === true,
    concurrencyManager,
    workItemBridge,
  });
  const managerList = createManagerList({
    configHandler,
    backgroundManager,
    skillMcpManager,
    notificationManager,
    tmuxSessionManager,
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
    notificationManager,
    tmuxSessionManager,
    sessionStateManager,
    toolMetadataStore,
    concurrencyManager,
    workItemBridge,
    disposeManagers() {
      for (const manager of managerList) {
        manager.dispose?.();
      }
    },
  };
}
