function topLevelHelp() {
  return [
    'Usage: openkit <command> [options]',
    '',
    'Quickstart:',
    '  npm install -g @duypham93/openkit',
    '  openkit doctor',
    '  openkit run',
    '',
    'Commands:',
    '  help      Show CLI help',
    '  install-global  Manual global setup command',
    '  init      Compatibility alias for install-global',
    '  install   Compatibility alias for install-global',
    '  run       Launch OpenCode and perform first-time setup if needed',
    '  upgrade   Refresh the global OpenKit install',
    '  uninstall Remove the global OpenKit install',
    '  doctor    Inspect global OpenKit and workspace readiness',
    '  onboard   Explain the safest first-run path and command choices',
    '  configure-agent-models  Configure provider-specific models per OpenKit agent',
    '  release   Prepare, verify, and publish OpenKit releases',
  ].join('\n');
}

export const helpCommand = {
  name: 'help',
  async run(args = [], io, context = {}) {
    const [target] = args;

    if (target && context.commands?.[target]) {
      return context.commands[target].run(['--help'], io, context);
    }

    io.stdout.write(`${topLevelHelp()}\n`);
    return 0;
  },
};
