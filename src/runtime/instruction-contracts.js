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
    purpose: 'Direct quick-lane entry routed to Quick Agent with no Master Orchestrator involvement.',
    nextAction: 'Quick Agent reads the codebase, brainstorms 3 options, presents to user, then plans, implements, and tests.',
    expectedOutputs: ['3 solution options', 'execution plan', 'test evidence'],
    whenToUse: 'Use for daily work — bounded tasks where you want a single agent to handle everything.',
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
    nextAction: 'Initialize full_intake, route Product Lead through full_product, then hand off to Solution Lead in full_solution before implementation and QA.',
    expectedOutputs: ['full intake context', 'Product Lead scope package', 'Solution Lead solution package handoff'],
    whenToUse: 'Use when requirements, product behavior, or cross-boundary design uncertainty dominates.',
  },
  'browser-verify': {
    command: '/browser-verify',
    purpose: 'Guide browser verification planning and evidence capture for UI or browser-dependent work.',
    nextAction: 'Choose the target page or flow, run the browser verification checklist, and record evidence before closure.',
    expectedOutputs: ['browser verification plan', 'scenario checklist', 'evidence-ready notes'],
    whenToUse: 'Use when acceptance depends on page behavior, interactive flows, or browser evidence.',
  },
  switch: {
    command: '/switch',
    purpose: 'Inspect or quickly switch a runtime agent between configured model profiles.',
    nextAction: 'List the current profile selection, choose the target agent, and prefer the short in-session syntax like `node .opencode/profile-switch.js specialist.oracle 1` or `node .opencode/profile-switch.js specialist.oracle t`.',
    expectedOutputs: ['target agent', 'active profile index', 'manual selection state', 'affected future actions'],
    whenToUse: 'Use when the same agent has multiple provider-backed profiles and you want to swap quickly or pin one manually during a running session for later actions that re-read selection state.',
  },
  'start-work': {
    command: '/start-work',
    purpose: 'Resume approved execution work from explicit task-board or workflow-state context.',
    nextAction: 'Inspect resumable context, confirm the active work item, and continue bounded execution without bypassing gates.',
    expectedOutputs: ['resume context', 'next safe action', 'execution focus'],
    whenToUse: 'Use when work is already approved and you need a structured execution restart.',
  },
  handoff: {
    command: '/handoff',
    purpose: 'Record a structured handoff for the next session without changing workflow closure state.',
    nextAction: 'Summarize the active work item, remaining actions, evidence, and stop conditions for the next operator.',
    expectedOutputs: ['handoff summary', 'remaining actions', 'resume-safe context'],
    whenToUse: 'Use before pausing or switching sessions on multi-step work.',
  },
  'stop-continuation': {
    command: '/stop-continuation',
    purpose: 'Stop continuation-oriented runtime behavior while preserving workflow-state authority.',
    nextAction: 'Record why continuation stopped and leave the workflow stage untouched until an explicit operator action resumes.',
    expectedOutputs: ['stop reason', 'continuation state update'],
    whenToUse: 'Use when continuation should pause, yield, or stop despite unfinished execution context.',
  },
  refactor: {
    command: '/refactor',
    purpose: 'Run a refactoring-focused flow with stronger safety and validation expectations.',
    nextAction: 'Inspect the current code surface, choose the safer editing/refactor path, and verify behavior stays stable.',
    expectedOutputs: ['refactor plan', 'safer edit strategy', 'verification notes'],
    whenToUse: 'Use when structural code change matters more than new behavior.',
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
