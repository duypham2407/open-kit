import { runConfigureMcp, configureMcpHelp } from '../../global/mcp/mcp-configurator.js';

function configureHelp() {
  return [
    'Usage: openkit configure <surface> [options]',
    '',
    'Surfaces:',
    '  mcp   Configure bundled and OpenKit-managed custom MCP capability pack safely',
    '',
    configureMcpHelp(),
  ].join('\n');
}

export const configureCommand = {
  name: 'configure',
  async run(args = [], io) {
    const [surface, ...rest] = args;
    if (!surface || surface === '--help' || surface === '-h') {
      io.stdout.write(`${configureHelp()}\n`);
      return 0;
    }
    try {
      if (surface === 'mcp') {
        return await runConfigureMcp(rest, io);
      }
      io.stderr.write(`Unknown configure surface: ${surface}\n`);
      return 1;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
