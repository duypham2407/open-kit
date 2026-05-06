export function createCapabilityLedgerTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.capability-ledger',
    name: 'Capability Decision Ledger',
    description: 'Reads sanitized capability decision ledger entries and summaries.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      if (input.action === 'get') {
        return capabilityRegistryManager.getDecision(input.id);
      }
      const ledger = capabilityRegistryManager.listDecisions(input);
      if (input.action === 'summary') {
        const byAction = {};
        const byOutcome = {};
        for (const entry of ledger.entries) {
          byAction[entry.actionType] = (byAction[entry.actionType] ?? 0) + 1;
          byOutcome[entry.outcome] = (byOutcome[entry.outcome] ?? 0) + 1;
        }
        return { ...ledger, entries: undefined, summary: { total: ledger.total, byAction, byOutcome } };
      }
      return ledger;
    },
  };
}
