import { helpCommand } from './commands/help.js';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { installGlobalCommand } from './commands/install-global.js';
import { runCommand } from './commands/run.js';
import { upgradeCommand } from './commands/upgrade.js';
import { uninstallCommand } from './commands/uninstall.js';
import { doctorCommand } from './commands/doctor.js';
import { detectVietnameseCommand } from './commands/detect-vietnamese.js';
import { configureAgentModelsCommand } from './commands/configure-agent-models.js';
import { releaseCommand } from './commands/release.js';

const commands = {
  help: helpCommand,
  init: initCommand,
  install: installCommand,
  'install-global': installGlobalCommand,
  run: runCommand,
  upgrade: upgradeCommand,
  uninstall: uninstallCommand,
  doctor: doctorCommand,
  'configure-agent-models': configureAgentModelsCommand,
  release: releaseCommand,
  'internal-audit-vietnamese': detectVietnameseCommand,
};

export async function runCli(argv, io = defaultIo()) {
  const args = Array.isArray(argv) ? argv : [];
  const [commandName, ...rest] = args;

  if (!commandName || commandName === '--help' || commandName === '-h') {
    return helpCommand.run([], io, { commands });
  }

  if (commandName === 'help') {
    return helpCommand.run(rest, io, { commands });
  }

  const command = commands[commandName];

  if (!command) {
    io.stderr.write(
      `Unknown command: ${commandName}\nRun \`openkit --help\` to see available commands.\n`
    );
    return 1;
  }

  if (rest.includes('--help') || rest.includes('-h')) {
    return command.run(['--help'], io, { commands });
  }

  return command.run(rest, io, { commands });
}

function defaultIo() {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
  };
}
