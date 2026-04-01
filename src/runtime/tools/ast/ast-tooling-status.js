import { isAstGrepAvailable } from '../../../global/tooling.js';

export function getAstToolingStatus(env = process.env) {
  if (isAstGrepAvailable({ env })) {
    return {
      provider: 'ast-grep',
      providerStatus: 'available',
      degraded: false,
      scope: 'json-structural-preview',
    };
  }

  return {
    provider: 'json-parser-fallback',
    providerStatus: 'fallback-active',
    degraded: true,
    scope: 'json-structural-preview',
  };
}
