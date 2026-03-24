import { materializeGlobalInstall } from '../../global/materialize.js';

function installGlobalHelp() {
  return [
    'Usage: openkit install-global',
    '',
    'Manually install OpenKit globally into the OpenCode home directory.',
    'Most users should run `openkit run`, which performs first-time setup automatically.',
  ].join('\n');
}

export const installGlobalCommand = {
  name: 'install-global',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${installGlobalHelp()}\n`);
      return 0;
    }

    const result = materializeGlobalInstall({ env: process.env });
    io.stdout.write(`Installed OpenKit globally.\n`);
    io.stdout.write(`Kit root: ${result.kitRoot}\n`);
    io.stdout.write(`Profile root: ${result.profilesRoot}\n`);
    return 0;
  },
};
