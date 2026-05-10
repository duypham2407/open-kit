import { inspectGlobalDoctor, renderGlobalDoctorSummary, showDiagnostics } from '../../global/doctor.js';

function doctorHelp() {
  return [
    'Usage: openkit doctor [--diagnostics]',
    '',
    'Check whether the global OpenKit install and the current workspace are ready.',
    '',
    'Options:',
    '  --diagnostics   Print recent diagnostic events from .opencode/diagnostics.json',
    '                  (config_loading, project_detection, etc.) instead of running',
    '                  the readiness check.',
  ].join('\n');
}

export const doctorCommand = {
  name: 'doctor',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${doctorHelp()}\n`);
      return 0;
    }

    if (args.includes('--diagnostics')) {
      const consoleAdapter = {
        log: (message = '') => {
          io.stdout.write(`${message}\n`);
        },
      };
      showDiagnostics({ projectRoot: process.cwd(), console: consoleAdapter });
      return 0;
    }

    const result = inspectGlobalDoctor({
      projectRoot: process.cwd(),
      env: process.env,
    });
    const output = renderGlobalDoctorSummary(result);

    if (result.canRunCleanly) {
      io.stdout.write(output);
      return 0;
    }

    io.stdout.write(output);
    return 1;
  },
};
