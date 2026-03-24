import { materializeGlobalInstall } from '../../global/materialize.js';

function installHelp() {
  return [
    'Usage: openkit install',
    '',
    'Compatibility alias for manual global setup.',
    'Most users should run `openkit run`.',
  ].join('\n');
}

export const installCommand = {
  name: 'install',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${installHelp()}\n`);
      return 0;
    }

    const result = materializeGlobalInstall({ env: process.env });
    io.stdout.write('Installed OpenKit globally.\n');
    io.stdout.write(`Kit root: ${result.kitRoot}\n`);
    return 0;
  },
};
