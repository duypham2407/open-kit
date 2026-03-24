import { ensureGlobalInstall } from '../../global/ensure-install.js';
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

    const ensured = ensureGlobalInstall({
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (ensured.action === 'installed') {
      io.stdout.write('OpenKit is not installed yet. Performing first-time setup...\n');
      io.stdout.write(`Installed OpenKit globally.\n`);
      io.stdout.write(`Kit root: ${ensured.install.kitRoot}\n`);
      io.stdout.write(`Profile root: ${ensured.install.profilesRoot}\n`);
    }

    if (ensured.action === 'blocked' || (!ensured.doctor.canRunCleanly && ensured.doctor.status !== 'workspace-ready-with-issues')) {
      for (const issue of ensured.doctor.issues ?? []) {
        io.stderr.write(`${issue}\n`);
      }

      if (ensured.doctor.nextStep) {
        io.stderr.write(`Next: ${ensured.doctor.nextStep}\n`);
      }

      return 1;
    }

    if (ensured.doctor.status === 'workspace-ready-with-issues') {
      io.stderr.write('OpenKit setup is usable, but the workspace has issues.\n');
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
