import { isCommandAvailable } from '../../../command-detection.js';

function providerStatus(provider, env) {
  if (provider === 'playwright-cli') {
    return isCommandAvailable('playwright', { env })
      ? { available: true, status: 'active' }
      : { available: false, status: 'dependency-missing' };
  }

  if (provider === 'playwright') {
    return { available: true, status: 'host-provided' };
  }

  if (provider === 'agent-browser') {
    return { available: true, status: 'agent-provided' };
  }

  return { available: false, status: 'unconfigured' };
}

export function createBrowserVerifyTool({ config = {}, env = process.env }) {
  const provider = config?.browserAutomation?.provider ?? 'playwright';
  const availability = providerStatus(provider, env);

  return {
    id: 'tool.browser-verify',
    name: 'Browser Verify Tool',
    description: 'Builds a browser verification plan with provider diagnostics.',
    family: 'browser',
    stage: 'foundation',
    status: availability.available ? 'active' : 'degraded',
    capabilityState: 'preview',
    validationSurface: 'runtime_tooling',
    provider,
    execute({ target = null, scenarios = [] } = {}) {
      const normalizedScenarios = Array.isArray(scenarios) && scenarios.length > 0
        ? scenarios.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
        : ['Load the target page', 'Exercise the primary user path', 'Capture evidence before closure'];

      return {
        provider,
        providerStatus: availability.status,
        available: availability.available,
        target,
        scenarios: normalizedScenarios,
        recommendedSkill: 'browser-automation',
        recommendedCommand: '/browser-verify',
        evidenceChecklist: [
          'Record the page or route verified.',
          'Note the exact scenario outcome.',
          'Capture evidence before advancing the workflow.',
        ],
      };
    },
  };
}
