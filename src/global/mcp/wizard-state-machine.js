import { isSupportedMcpScope } from '../../capabilities/status.js';
import { getMcpCatalogEntry } from '../../capabilities/mcp-catalog.js';

export function createWizardState(overrides = {}) {
  return {
    state: 'inventory',
    scope: 'openkit',
    selectedMcpId: null,
    cancelled: false,
    ...overrides,
  };
}

export function transitionWizardState(currentState, event) {
  const state = createWizardState(currentState);

  if (!event || typeof event !== 'object') {
    return state;
  }

  if (event.type === 'cancel') {
    return { ...state, state: 'cancelled', cancelled: true };
  }

  if (event.type === 'finish') {
    return { ...state, state: 'summary' };
  }

  if (event.type === 'choose_scope') {
    if (!isSupportedMcpScope(event.scope)) {
      return state;
    }
    return { ...state, state: 'inventory', scope: event.scope };
  }

  if (event.type === 'choose_mcp') {
    if (!getMcpCatalogEntry(event.mcpId)) {
      return state;
    }
    return { ...state, state: 'action_selection', selectedMcpId: event.mcpId };
  }

  if (event.type === 'choose_action') {
    return { ...state, state: event.action === 'back' ? 'inventory' : 'action_selection' };
  }

  if (event.type === 'action_result' || event.type === 'test_result') {
    return { ...state, state: 'inventory' };
  }

  return state;
}
