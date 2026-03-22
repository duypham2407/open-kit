import { materializeInstall } from '../../install/materialize.js';
import { writeConflictReport } from '../conflict-output.js';

function initHelp() {
  return [
    'Usage: openkit init',
    '',
    'Initialize the thin OpenKit wrapper surface for a project.',
  ].join('\n');
}

export const initCommand = {
  name: 'init',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${initHelp()}\n`);
      return 0;
    }

    const result = materializeInstall(process.cwd());

    if (result.conflicts.length > 0) {
      writeConflictReport(io, 'Init', result.conflicts);
      return 1;
    }

    io.stdout.write('Initialized OpenKit wrapper.\n');
    return 0;
  },
};
