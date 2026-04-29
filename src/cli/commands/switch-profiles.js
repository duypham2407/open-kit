import { runSwitchProfilesCli } from '../../runtime/switch-profiles-cli.js';

export const switchProfilesCommand = {
  name: 'switch-profiles',
  async run(args = [], io) {
    return runSwitchProfilesCli({
      argv: args,
      env: process.env,
      io,
      invocation: 'openkit switch-profiles',
    });
  },
};
