import { loadRuntimeConfig } from './runtime-config-loader.js';

export function createRuntimeConfig(options = {}) {
  const result = loadRuntimeConfig(options);

  return {
    ...result,
    hasProjectConfig: Boolean(result.projectConfigPath),
    hasUserConfig: Boolean(result.userConfigPath),
  };
}
