import { listBundledSkills } from '../../capabilities/skill-catalog.js';

export class CapabilityRegistryManager {
  constructor({ mcpHealthManager, skillMcpManager } = {}) {
    this.mcpHealthManager = mcpHealthManager;
    this.skillMcpManager = skillMcpManager;
  }

  listCapabilities({ scope = 'openkit', includeSkills = true, includeMcps = true } = {}) {
    const mcps = includeMcps ? this.mcpHealthManager.list({ scope }) : [];
    const skills = includeSkills ? listBundledSkills() : [];
    return { mcps, skills };
  }

  routeCapability({ scope = 'openkit', mcpId = null, skillName = null, intent = '' } = {}) {
    const capabilities = this.listCapabilities({ scope });
    let candidate = null;
    if (mcpId) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === mcpId);
    } else if (skillName) {
      const skill = capabilities.skills.find((entry) => entry.name === skillName || entry.id === skillName);
      const refs = [...(skill?.mcpRefs ?? []), ...(skill?.optionalMcpRefs ?? [])];
      candidate = capabilities.mcps.find((entry) => refs.includes(entry.mcpId));
    } else if (/doc|library|api/i.test(intent)) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === 'context7');
    } else if (/browser|ui|page/i.test(intent)) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === 'chrome-devtools' || entry.mcpId === 'playwright');
    } else {
      candidate = capabilities.mcps.find((entry) => entry.enabled && entry.capabilityState === 'available') ?? capabilities.mcps[0];
    }

    if (!candidate) {
      return {
        status: 'unavailable',
        validationSurface: 'runtime_tooling',
        guidance: 'No matching MCP capability is present in the bundled catalog or OpenKit-managed custom registry.',
      };
    }
    if (!candidate.enabled) {
      if (candidate.capabilityState === 'not_configured') {
        return { ...candidate, status: 'not_configured', guidance: candidate.guidance };
      }
      return { ...candidate, status: 'disabled', guidance: `Run openkit configure mcp enable ${candidate.mcpId} --scope ${scope}` };
    }
    return {
      ...candidate,
      status: candidate.capabilityState,
      guidance: candidate.guidance,
    };
  }

  health({ scope = 'openkit', mcpId = null } = {}) {
    if (mcpId) {
      return { mcps: [this.mcpHealthManager.get(mcpId, { scope })].filter(Boolean) };
    }
    return { mcps: this.mcpHealthManager.list({ scope }) };
  }

  listSkillMcpBindings() {
    return this.skillMcpManager?.listBindings?.() ?? [];
  }
}
