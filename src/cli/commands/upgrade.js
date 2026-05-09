import { materializeGlobalInstall } from '../../global/materialize.js';

function upgradeHelp() {
  return [
    'Usage: openkit upgrade',
    '',
    'Refresh the globally installed OpenKit kit in the OpenCode home directory.',
    'Use this when the global install needs to be repaired or refreshed.',
  ].join('\n');
}

export const upgradeCommand = {
  name: 'upgrade',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${upgradeHelp()}\n`);
      return 0;
    }

    let result;
    try {
      result = materializeGlobalInstall({ env: process.env });
    } catch (err) {
      // Audit fix [2-H-4]: previously this call had no error handling, so
      // any failure produced an uncaught exception with a raw stack trace.
      // Combined with the (now-fixed) non-atomic upgrade in [2-H-1], that
      // could leave the kit-root in a half-installed state with no
      // user-facing diagnostic. Now: emit a structured stderr message and
      // exit non-zero. The atomic-rollback in materializeGlobalInstall
      // guarantees the prior install is restored before this catch runs.
      const message = err?.message ?? String(err);
      io.stderr.write(`openkit upgrade failed: ${message}\n`);
      io.stderr.write(
        'Your previous OpenKit install has been restored. ' +
        'If the failure looks transient (disk space, permissions), retry; ' +
        'otherwise re-install the npm package: npm install -g @duypham93/openkit@latest\n',
      );
      return 1;
    }

    io.stdout.write('Upgraded OpenKit global install.\n');
    io.stdout.write(`Kit root: ${result.kitRoot}\n`);
    if (result.tooling?.installed) {
      io.stdout.write(`Installed ast-grep tooling into ${result.tooling.toolingRoot}\n`);
    }
    if (result.semgrepTooling?.installed) {
      io.stdout.write(`Installed semgrep tooling into ${result.semgrepTooling.toolingRoot}\n`);
    }
    return 0;
  },
};
