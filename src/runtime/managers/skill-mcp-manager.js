export class SkillMcpManager {
  constructor({ registry = [], mcpHealthManager = null } = {}) {
    this.registry = registry;
    this.mcpHealthManager = mcpHealthManager;
  }

  listBindings() {
    return [...this.registry];
  }

  registerSkillBindings(skills = []) {
    const nextBindings = skills.flatMap((skill) => {
      const recommendedMcps = skill.recommended_mcps ?? [
        ...(skill.mcpRefs ?? []).map((mcpId) => ({ id: mcpId, relationship: 'supporting', reason: 'Legacy required MCP reference.' })),
        ...(skill.optionalMcpRefs ?? []).map((mcpId) => ({ id: mcpId, relationship: 'optional', reason: 'Legacy optional MCP reference.' })),
      ];

      return recommendedMcps.map((mcpRef) => {
        const mcpStatus = this.mcpHealthManager?.get?.(mcpRef.id, { scope: skill.scope ?? 'openkit' }) ?? null;
        const optionalOrCustomCaveat = buildMcpCaveat(mcpRef, mcpStatus);
        return {
          skillId: skill.id ?? `skill.${skill.name}`,
          skillName: skill.name,
          skill: skill.name,
          scope: skill.scope,
          mcpId: mcpRef.id,
          relationship: mcpRef.relationship ?? 'supporting',
          reason: mcpRef.reason ?? null,
          optional: (mcpRef.relationship ?? 'supporting') === 'optional',
          mcpKnown: mcpStatus !== null,
          mcpCapabilityState: mcpStatus?.capabilityState ?? null,
          mcpEnabled: mcpStatus?.enabled ?? null,
          skillStatus: skill.status ?? skill.lifecycle ?? 'preview',
          skillSupportLevel: skill.support_level ?? 'best_effort',
          optionalOrCustomCaveat,
        };
      });
    });
    this.registry = nextBindings;
    return this.listBindings();
  }
}

function buildMcpCaveat(mcpRef, mcpStatus) {
  if (!mcpStatus) {
    return `MCP '${mcpRef.id}' is not known in the bundled/custom MCP inventory.`;
  }
  if (mcpRef.relationship === 'optional') {
    return `MCP '${mcpRef.id}' is optional for this skill.`;
  }
  if (mcpStatus.enabled === false) {
    return `MCP '${mcpRef.id}' is disabled for this scope.`;
  }
  if (['unavailable', 'degraded', 'not_configured', 'preview'].includes(mcpStatus.capabilityState)) {
    return `MCP '${mcpRef.id}' is ${mcpStatus.capabilityState}; skill remains discoverable but may have reduced backing support.`;
  }
  return null;
}
