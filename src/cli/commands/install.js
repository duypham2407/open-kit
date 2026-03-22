import { materializeInstall } from '../../install/materialize.js';
import { discoverProjectShape } from '../../install/discovery.js';
import { writeConflictReport } from '../conflict-output.js';

function installHelp() {
  return [
    'Usage: openkit install',
    '',
    'Install the managed OpenKit wrapper files into a project.',
  ].join('\n');
}

export const installCommand = {
  name: 'install',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${installHelp()}\n`);
      return 0;
    }

    const projectRoot = process.cwd();
    const projectShape = discoverProjectShape(projectRoot);
    const result = materializeInstall(projectRoot);

    if (result.conflicts.length > 0) {
      writeConflictReport(io, 'Install', result.conflicts);
      return 1;
    }

    if (projectShape.hasRuntimeManifest) {
      io.stdout.write('Installed OpenKit wrapper; detected existing OpenCode runtime.\n');
      return 0;
    }

    io.stdout.write('Installed OpenKit wrapper.\n');
    return 0;
  },
};
