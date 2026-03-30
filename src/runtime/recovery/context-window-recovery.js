export function recoverContextWindow({ messageCount = 0 }) {
  return {
    strategy: messageCount > 0 ? 'compact' : 'noop',
  };
}
