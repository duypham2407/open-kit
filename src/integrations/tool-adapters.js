export const TOOL_ADAPTERS = [
  {
    id: 'opencode',
    name: 'OpenCode',
    status: 'supported',
    delivery: 'managed global profile with repository-local compatibility runtime',
    defaultEntryCommand: '/task',
    launchCommand: 'openkit run',
    notes: 'Current first-class delivery surface for OpenKit.',
  },
];

export function listSupportedToolAdapters() {
  return TOOL_ADAPTERS;
}

export function getDefaultToolAdapter() {
  return TOOL_ADAPTERS[0] ?? null;
}
