import { inspectManagedDoctor } from '../../runtime/doctor.js';
import { renderManagedDoctorSummary } from '../../runtime/openkit-managed-summary.js';

function doctorHelp() {
  return [
    'Usage: openkit doctor',
    '',
    'Check whether the local project is ready for managed OpenKit use.',
    'This is the supported readiness check for the managed wrapper path.',
    '',
    'Reported states: install-missing, install-incomplete, drift-detected, runtime-prerequisites-missing, healthy.',
  ].join('\n');
}

export const doctorCommand = {
  name: 'doctor',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${doctorHelp()}\n`);
      return 0;
    }

    const result = inspectManagedDoctor({
      projectRoot: process.cwd(),
      env: process.env,
    });
    const output = renderManagedDoctorSummary(result);

    if (result.canRunCleanly) {
      io.stdout.write(output);
      return 0;
    }

    io.stdout.write(output);
    return 1;
  },
};
