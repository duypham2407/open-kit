import { launchManagedOpenCode } from '../../runtime/launcher.js';

function runHelp() {
  return [
    'Usage: openkit run',
    '',
    'Run the managed OpenKit launcher path for the current project.',
    'This path layers OpenKit-managed OpenCode config onto your current baseline config.',
  ].join('\n');
}

export const runCommand = {
  name: 'run',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${runHelp()}\n`);
      return 0;
    }

    const projectRoot = process.cwd();
    const result = launchManagedOpenCode(args, {
      projectRoot,
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
