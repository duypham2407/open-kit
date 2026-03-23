import { launchGlobalOpenKit } from '../../global/launcher.js';

function runHelp() {
  return [
    'Usage: openkit run',
    '',
    'Run OpenCode with the globally installed OpenKit profile for the current project.',
  ].join('\n');
}

export const runCommand = {
  name: 'run',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${runHelp()}\n`);
      return 0;
    }

    const result = launchGlobalOpenKit(args, {
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (result.stdout) {
      io.stdout.write(result.stdout);
    }

    if (result.stderr) {
      io.stderr.write(result.stderr);
    }

    return result.exitCode;
  },
};
