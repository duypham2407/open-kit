import { materializeGlobalInstall } from '../../global/materialize.js';

function initHelp() {
  return [
    'Usage: openkit init',
    '',
    'Compatibility alias for `openkit install-global`.',
  ].join('\n');
}

export const initCommand = {
  name: 'init',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${initHelp()}\n`);
      return 0;
    }

    const result = materializeGlobalInstall({ env: process.env });
    io.stdout.write('Installed OpenKit globally.\n');
    io.stdout.write(`Kit root: ${result.kitRoot}\n`);
    return 0;
  },
};
