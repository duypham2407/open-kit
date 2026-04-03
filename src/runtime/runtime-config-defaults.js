import { RUNTIME_CONFIG_SCHEMA } from './types.js';

export function createDefaultRuntimeConfig() {
  return {
    schema: RUNTIME_CONFIG_SCHEMA,
    runtime: {
      enabled: true,
      foundationVersion: 1,
      featureFlags: {
        managers: true,
        tools: true,
        hooks: true,
        capabilityDiagnostics: true,
      },
    },
    disabled: {
      agents: [],
      capabilities: [],
      categories: [],
      commands: [],
      hooks: [],
      mcps: [],
      skills: [],
      tools: [],
    },
    agents: {},
    categories: {},
    modelExecution: {
      autoFallback: {
        enabled: true,
        afterFailures: 3,
      },
      quickSwitchProfiles: {
        enabled: true,
      },
    },
    hooks: {
      continuationRuntime: {
        attentionOnRisk: true,
      },
      toolOutputTruncation: {
        maxChars: 12000,
        maxItems: 200,
      },
      rulesInjector: {
        always: [],
        byMode: {},
        byCategory: {},
      },
    },
    tools: {},
    skills: {},
    commands: {},
    mcps: {
      builtin: {
        websearch: true,
        docsSearch: true,
        codeSearch: true,
      },
    },
    backgroundTask: {
      enabled: false,
      providerConcurrency: {},
      modelConcurrency: {},
    },
    notifications: {
      enabled: false,
    },
    tmux: {
      enabled: false,
      layout: 'main-vertical',
    },
    browserAutomation: {
      provider: 'playwright',
    },
    embedding: {
      enabled: false,
      provider: 'openai',
      model: 'openai/text-embedding-3-small',
      dimensions: 1536,
      batchSize: 20,
      apiKey: null,
      baseUrl: null,
    },
    runtimeFallback: {
      enabled: true,
    },
    experimental: {
      taskSystem: false,
      aggressiveTruncation: false,
    },
  };
}
