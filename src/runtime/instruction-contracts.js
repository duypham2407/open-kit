export const DEFAULT_ENTRY_COMMAND = '/task';

export const COMMAND_INSTRUCTION_CONTRACTS = {
  task: {
    command: '/task',
    purpose: 'Default entrypoint that lets the Master Orchestrator choose the safest lane.',
    nextAction: 'Summarize the request, classify the dominant uncertainty, and route into quick, migration, or full.',
    expectedOutputs: ['mode choice', 'mode_reason', 'first stage initialized'],
    whenToUse: 'Use this unless the lane is already obvious.',
  },
  'quick-task': {
    command: '/quick-task',
    purpose: 'Direct quick-lane entry for bounded low-risk work.',
    nextAction: 'Confirm quick eligibility, define the bounded checklist, and route to quick_build.',
    expectedOutputs: ['quick scope', 'quick_plan context', 'verification path'],
    whenToUse: 'Use only when the work is clearly local, low-risk, and short to verify.',
  },
  migrate: {
    command: '/migrate',
    purpose: 'Direct migration-lane entry for behavior-preserving upgrades and modernization work.',
    nextAction: 'Capture the migration baseline, identify compatibility blockers, and stage the upgrade slices.',
    expectedOutputs: ['migration baseline', 'migration strategy', 'preserved invariants'],
    whenToUse: 'Use when compatibility uncertainty dominates and the target behavior should stay the same.',
  },
  delivery: {
    command: '/delivery',
    purpose: 'Direct full-delivery entry for feature work and high-risk changes.',
    nextAction: 'Initialize full_intake, then route through brief, spec, architecture, plan, implementation, and QA.',
    expectedOutputs: ['full intake context', 'artifact chain', 'approval-gated handoffs'],
    whenToUse: 'Use when requirements, product behavior, or cross-boundary design uncertainty dominates.',
  },
};

export function getCommandInstructionContract(commandName) {
  return COMMAND_INSTRUCTION_CONTRACTS[commandName] ?? null;
}

export function listPrimaryEntryContracts() {
  return ['task', 'quick-task', 'migrate', 'delivery']
    .map((commandName) => COMMAND_INSTRUCTION_CONTRACTS[commandName])
    .filter(Boolean);
}

export function renderEntryPathSummary() {
  const lines = [`Default path: ${DEFAULT_ENTRY_COMMAND}`];

  for (const contract of listPrimaryEntryContracts()) {
    lines.push(`- ${contract.command}: ${contract.whenToUse}`);
  }

  return lines.join('\n');
}
