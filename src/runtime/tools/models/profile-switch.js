function buildProfileSummary(agentId, profiles = [], selectedProfileIndex = 0, manualSelection = null) {
  return {
    agentId,
    selectedProfileIndex,
    manualSelection,
    profiles: profiles.map((profile, index) => ({
      index,
      model: profile?.model ?? null,
      variant: profile?.variant ?? null,
      active: index === selectedProfileIndex,
    })),
  };
}

function resolveLiveSelectedProfileIndex({ resolution, agentProfileSwitchManager }) {
  const manualSelection = agentProfileSwitchManager.get(resolution.trace.subjectId);
  const profiles = Array.isArray(resolution.profiles) ? resolution.profiles : [];

  if (Number.isInteger(manualSelection?.profileIndex) && manualSelection.profileIndex >= 0 && manualSelection.profileIndex < profiles.length) {
    return manualSelection.profileIndex;
  }

  return resolution.selectedProfileIndex ?? 0;
}

export function createProfileSwitchTool({ specialists, modelRuntime, agentProfileSwitchManager }) {
  return {
    id: 'tool.profile-switch',
    name: 'Profile Switch',
    family: 'models',
    description: 'Lists and switches between saved agent model profiles.',
    execute(input = {}) {
      const action = typeof input === 'string' ? input : input.action ?? 'list';
      const agentId = typeof input === 'object' && input !== null ? input.agentId ?? null : null;

      if (action === 'list') {
        return {
          status: 'ok',
          items: modelRuntime.resolutions
          .filter((entry) => Array.isArray(entry.profiles) && entry.profiles.length > 1)
          .map((entry) =>
            buildProfileSummary(
              entry.trace.subjectId,
              entry.profiles,
              resolveLiveSelectedProfileIndex({ resolution: entry, agentProfileSwitchManager }),
              agentProfileSwitchManager.get(entry.trace.subjectId)
            )
          ),
        };
      }

      if (!agentId) {
        return { status: 'invalid-input', message: 'profile-switch requires agentId for get/set/toggle/clear actions.' };
      }

      const resolution = modelRuntime.resolutions.find((entry) => entry.trace.subjectId === agentId);
      if (!resolution) {
        return { status: 'unknown-agent', agentId, message: `Unknown runtime agent '${agentId}'.` };
      }

      const profiles = Array.isArray(resolution.profiles) ? resolution.profiles : [];
      if (profiles.length < 2) {
        return { status: 'profiles-unavailable', agentId, message: `Agent '${agentId}' does not have multiple profiles configured.` };
      }

      if (action === 'get') {
        return {
          status: 'ok',
          ...buildProfileSummary(
            agentId,
            profiles,
            resolveLiveSelectedProfileIndex({ resolution, agentProfileSwitchManager }),
            agentProfileSwitchManager.get(agentId)
          ),
        };
      }

      if (action === 'toggle') {
        const selection = agentProfileSwitchManager.toggle(agentId, profiles.length);
        return {
          status: 'ok',
          ...buildProfileSummary(agentId, profiles, selection.profileIndex, selection),
        };
      }

      if (action === 'set') {
        const profileIndex = Number.isInteger(input.profileIndex) ? input.profileIndex : Number.parseInt(String(input.profileIndex), 10);
        if (!Number.isInteger(profileIndex) || profileIndex < 0 || profileIndex >= profiles.length) {
          return {
            status: 'invalid-input',
            agentId,
            message: `profile-switch received an invalid profileIndex for '${agentId}'.`,
          };
        }
        const selection = agentProfileSwitchManager.set(agentId, profileIndex, profiles.length);
        return {
          status: 'ok',
          ...buildProfileSummary(agentId, profiles, selection.profileIndex, selection),
        };
      }

      if (action === 'clear') {
        agentProfileSwitchManager.clear(agentId);
        return {
          status: 'ok',
          ...buildProfileSummary(agentId, profiles, resolution.selectedProfileIndex ?? 0, null),
        };
      }

      return { status: 'invalid-input', agentId, message: `Unknown profile-switch action '${action}'.` };
    },
  };
}
