import { ensureGlobalInstall } from '../../global/ensure-install.js';
import { launchGlobalOpenKit } from '../../global/launcher.js';
import { DEFAULT_ENTRY_COMMAND, getCommandInstructionContract } from '../../runtime/instruction-contracts.js';

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
      if (ensured.install.tooling?.action === 'installed') {
        io.stdout.write(`Installed ast-grep tooling into ${ensured.install.tooling.toolingRoot}\n`);
      }
      if (ensured.install.semgrepTooling?.action === 'installed') {
        io.stdout.write(`Installed semgrep tooling into ${ensured.install.semgrepTooling.toolingRoot}\n`);
      }
      io.stdout.write(`Next action after launch: start with ${DEFAULT_ENTRY_COMMAND}.\n`);
    }

    if (ensured.action === 'repaired-tooling') {
      io.stdout.write('OpenKit detected missing runtime tooling and repaired it automatically.\n');
      if (ensured.tooling?.astGrep?.installed) {
        io.stdout.write(`Installed ast-grep tooling into ${ensured.tooling.astGrep.toolingRoot}\n`);
      }
      if (ensured.tooling?.semgrep?.installed) {
        io.stdout.write(`Installed semgrep tooling into ${ensured.tooling.semgrep.toolingRoot}\n`);
      }
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

    const defaultEntry = getCommandInstructionContract('task');
    if (defaultEntry) {
      io.stdout.write(`Recommended entrypoint: ${defaultEntry.command} — ${defaultEntry.whenToUse}\n`);
    }

    const result = launchGlobalOpenKit(args, {
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (result.runtimeFoundation?.runtimeInterface) {
      const runtimeInterface = result.runtimeFoundation.runtimeInterface;
      io.stdout.write(
        `Runtime foundation: v${runtimeInterface.foundationVersion} | capabilities ${runtimeInterface.capabilitySummary.total} | tools ${runtimeInterface.tools.length} | hooks ${runtimeInterface.hooks.length}\n`
      );
    }

    if (result.stdout) {
      io.stdout.write(result.stdout);
    }

    if (result.stderr) {
      io.stderr.write(result.stderr);
    }

    return result.exitCode;
  },
};
