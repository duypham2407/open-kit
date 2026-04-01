import { createRuleScanTool } from './rule-scan.js';

export function createSecurityScanTool({ projectRoot }) {
  const base = createRuleScanTool({ projectRoot });
  return {
    ...base,
    id: 'tool.security-scan',
    name: 'Security Scan Tool',
    description: 'Runs Semgrep security-focused scans against the current project or a target path.',
    execute(input = {}) {
      if (typeof input === 'string') {
        return base.execute({ path: input, config: 'p/security-audit' });
      }

      return base.execute({
        ...(typeof input === 'object' && input !== null ? input : {}),
        config: typeof input === 'object' && input !== null && input.config ? input.config : 'p/security-audit',
      });
    },
  };
}
