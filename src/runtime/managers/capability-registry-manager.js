import { listBundledSkills } from '../../capabilities/skill-catalog.js';
import { buildCapabilityGuidance } from '../tools/capability/capability-router-summary.js';

const STATUS_WEIGHT = {
  stable: 30,
  preview: 10,
  experimental: 0,
};

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function includesWildcard(values = [], expected) {
  return values.includes(expected) || values.includes('all');
}

function matchText(value, intent) {
  const normalizedIntent = normalize(intent);
  const normalizedValue = normalize(value);
  return normalizedIntent.length > 0 && normalizedValue.length > 0 && normalizedIntent.includes(normalizedValue);
}

function buildMcpContext(mcpRef, mcps) {
  const mcp = mcps.find((entry) => entry.mcpId === mcpRef.id);
  return {
    id: mcpRef.id,
    relationship: mcpRef.relationship,
    reason: mcpRef.reason,
    mcpKnown: Boolean(mcp),
    capabilityState: mcp?.capabilityState ?? 'unavailable',
    enabled: mcp?.enabled ?? false,
    guidance: mcp?.guidance ?? `MCP '${mcpRef.id}' is not configured in the current inventory.`,
  };
}

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

  summarizeGuidance({ scope = 'openkit', workflowState = null, source = 'explicit_runtime_tool', limits = undefined } = {}) {
    const capabilities = this.listCapabilities({ scope });
    return buildCapabilityGuidance({
      workflowState,
      capabilities,
      source,
      limits,
    });
  }

  routeCapability({ scope = 'openkit', mcpId = null, skillName = null, intent = '', mode = null, role = null, stage = null, status = null, summary = false, tags = [], includePreview = false, includeExperimental = false } = {}) {
    if (summary === true) {
      return this.summarizeGuidance({
        scope,
        workflowState: {
          mode,
          current_stage: stage,
          current_owner: role,
          status,
        },
        source: 'explicit_runtime_tool',
      });
    }

    const capabilities = this.listCapabilities({ scope });
    if (mcpId) {
      return this.routeMcpCapability({ capabilities, scope, mcpId, intent });
    }

    if (skillName || role || stage || (Array.isArray(tags) && tags.length > 0)) {
      return this.routeSkillCapability({ capabilities, skillName, intent, role, stage, tags, includePreview, includeExperimental });
    }

    const skillRoute = this.routeSkillCapability({ capabilities, skillName, intent, role, stage, tags, includePreview, includeExperimental });
    if (skillRoute.matchStatus === 'matched') {
      return skillRoute;
    }

    return this.routeMcpCapability({ capabilities, scope, mcpId, intent });
  }

  routeMcpCapability({ capabilities, scope, mcpId = null, intent = '' }) {
    let candidate = null;
    if (mcpId) {
      candidate = capabilities.mcps.find((entry) => entry.mcpId === mcpId);
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

  routeSkillCapability({ capabilities, skillName = null, intent = '', role = null, stage = null, tags = [], includePreview = false, includeExperimental = false } = {}) {
    const normalizedSkillName = String(skillName ?? '').replace(/^skill\./, '');
    const requestedTags = Array.isArray(tags) ? tags : [tags].filter(Boolean);
    const candidates = [];
    const suppressedCandidates = [];

    for (const skill of capabilities.skills) {
      const selectionReasons = [];
      let score = STATUS_WEIGHT[skill.status] ?? 0;

      if (normalizedSkillName) {
        if (skill.name === normalizedSkillName || skill.id === skillName) {
          score += 100;
          selectionReasons.push({ field: 'skillName', value: normalizedSkillName, weight: 100 });
        } else {
          continue;
        }
      }

      for (const tag of requestedTags) {
        if ((skill.tags ?? []).includes(tag)) {
          score += 8;
          selectionReasons.push({ field: 'tag', value: tag, weight: 8 });
        } else if (!normalizedSkillName) {
          score = -Infinity;
        }
      }

      if (score === -Infinity) {
        continue;
      }

      if (role && includesWildcard(skill.roles ?? [], role)) {
        score += 6;
        selectionReasons.push({ field: 'role', value: role, weight: 6 });
      }

      if (stage && includesWildcard(skill.stages ?? [], stage)) {
        score += 6;
        selectionReasons.push({ field: 'stage', value: stage, weight: 6 });
      }

      for (const trigger of skill.triggers ?? []) {
        if (matchText(trigger.value, intent)) {
          score += 10;
          selectionReasons.push({ field: 'trigger', value: trigger.value, weight: 10 });
        }
      }

      for (const tag of skill.tags ?? []) {
        if (matchText(tag, intent)) {
          score += 4;
          selectionReasons.push({ field: 'tag', value: tag, weight: 4 });
        }
      }

      if (!normalizedSkillName && selectionReasons.length === 0) {
        continue;
      }

      if (skill.capabilityState === 'unavailable' && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'metadata-only-or-unavailable' });
        continue;
      }
      if (skill.status === 'preview' && !includePreview && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'preview-not-requested' });
        continue;
      }
      if (skill.status === 'experimental' && !includeExperimental && !normalizedSkillName) {
        suppressedCandidates.push({ skillId: skill.id, reason: 'experimental-not-requested' });
        continue;
      }

      candidates.push({ skill, score, selectionReasons });
    }

    candidates.sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name));
    const selected = candidates[0];

    if (!selected) {
      return {
        validationSurface: 'runtime_tooling',
        status: 'unavailable',
        matchStatus: 'no_match',
        candidatesConsidered: capabilities.skills.length,
        suppressedCandidates,
        guidance: 'No metadata-backed skill match was suitable for the supplied intent, role, stage, or tag filters.',
      };
    }

    return {
      validationSurface: 'runtime_tooling',
      status: selected.skill.capabilityState,
      matchStatus: 'matched',
      selectedSkill: {
        id: selected.skill.id,
        name: selected.skill.name,
        displayName: selected.skill.displayName,
        status: selected.skill.status,
        capabilityState: selected.skill.capabilityState,
        support_level: selected.skill.support_level,
        limitations: selected.skill.limitations,
      },
      selectionReasons: selected.selectionReasons,
      candidatesConsidered: candidates.length,
      suppressedCandidates,
      recommendedMcps: (selected.skill.recommended_mcps ?? []).map((mcpRef) => buildMcpContext(mcpRef, capabilities.mcps)),
      guidance: 'Load the selected skill explicitly before using it; router output is advisory and does not silently activate skills.',
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
