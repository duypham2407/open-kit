function topLevelHelp() {
  return [
    'Usage: openkit <command> [options]',
    '',
    'Commands:',
    '  help      Show CLI help',
    '  install-global  Install OpenKit globally into OpenCode home',
    '  init      Compatibility alias for install-global',
    '  install   Compatibility alias for install-global',
    '  run       Launch OpenCode with the global OpenKit profile',
    '  upgrade   Refresh the global OpenKit install',
    '  uninstall Remove the global OpenKit install',
    '  doctor    Inspect global OpenKit and workspace readiness',
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
