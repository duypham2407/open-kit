function topLevelHelp() {
  return [
    'Usage: openkit <command> [options]',
    '',
    'Commands:',
    '  help      Show CLI help',
    '  init      Set up OpenKit in a project',
    '  install   Install managed OpenKit files',
    '  run       Launch the managed OpenKit flow',
    '  doctor    Inspect local OpenKit readiness',
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
