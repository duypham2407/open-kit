import { uninstallGlobalOpenKit } from '../../global/uninstall.js';

function uninstallHelp() {
  return [
    'Usage: openkit uninstall [--remove-workspaces]',
    '',
    'Remove the globally installed OpenKit kit and profile from the OpenCode home directory.',
  ].join('\n');
}

export const uninstallCommand = {
  name: 'uninstall',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${uninstallHelp()}\n`);
      return 0;
    }

    const result = uninstallGlobalOpenKit({
      env: process.env,
      removeWorkspaces: args.includes('--remove-workspaces'),
    });

    io.stdout.write('Uninstalled OpenKit global kit.\n');
    if (result.removedWorkspaces) {
      io.stdout.write('Workspace state was removed.\n');
    } else {
      io.stdout.write('Workspace state was preserved.\n');
    }
    return 0;
  },
};
