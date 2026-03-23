import { materializeGlobalInstall } from '../../global/materialize.js';

function upgradeHelp() {
  return [
    'Usage: openkit upgrade',
    '',
    'Refresh the globally installed OpenKit kit in the OpenCode home directory.',
  ].join('\n');
}

export const upgradeCommand = {
  name: 'upgrade',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${upgradeHelp()}\n`);
      return 0;
    }

    const result = materializeGlobalInstall({ env: process.env });
    io.stdout.write('Upgraded OpenKit global install.\n');
    io.stdout.write(`Kit root: ${result.kitRoot}\n`);
    return 0;
  },
};
