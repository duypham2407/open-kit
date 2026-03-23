import { inspectGlobalDoctor, renderGlobalDoctorSummary } from '../../global/doctor.js';

function doctorHelp() {
  return [
    'Usage: openkit doctor',
    '',
    'Check whether the global OpenKit install and the current workspace are ready.',
  ].join('\n');
}

export const doctorCommand = {
  name: 'doctor',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${doctorHelp()}\n`);
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
