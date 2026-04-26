export const RUNTIME_CONFIG_SCHEMA = 'openkit/runtime-config@1';

export const PROJECT_RUNTIME_CONFIG_FILES = [
  '.opencode/openkit.runtime.jsonc',
  '.opencode/openkit.runtime.json',
];

export const USER_RUNTIME_CONFIG_FILES = [
  'openkit.runtime.jsonc',
  'openkit.runtime.json',
];

export const DISABLED_RUNTIME_BUCKETS = [
  'agents',
  'capabilities',
  'categories',
  'commands',
  'hooks',
  'mcps',
  'skills',
  'tools',
];

export const BROWSER_AUTOMATION_PROVIDERS = ['playwright', 'playwright-cli', 'agent-browser'];

export const EMBEDDING_PROVIDERS = ['openai', 'ollama', 'custom'];

export const RUNTIME_FEATURE_FLAGS = ['managers', 'tools', 'hooks', 'capabilityDiagnostics'];

export const DEFAULT_RUNTIME_MANAGER_IDS = [
  'manager.config-handler',
  'manager.background',
  'manager.skill-mcp',
  'manager.supervisor-dialogue',
  'manager.notifications',
  'manager.tmux',
];

export const DEFAULT_RUNTIME_TOOL_IDS = [
  'tool.workflow-state',
  'tool.runtime-summary',
  'tool.evidence-capture',
  'tool.session-introspection',
];

export const DEFAULT_RUNTIME_HOOK_IDS = [
  'hook.session-start',
  'hook.runtime-config-validation',
];
