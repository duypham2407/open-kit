import {
  publishRelease,
  readCurrentVersion,
  releasePrepare,
  releaseVerify,
} from '../../release/workflow.js';

function releaseHelp() {
  return [
    'Usage: openkit release <subcommand> [options]',
    '',
    'Subcommands:',
    '  prepare <version> [--summary <text>]  Bump version metadata, scaffold release notes, and update RELEASES.md',
    '  verify [--skip-tests]                 Check release metadata and optionally run the full test suite',
    '  publish [--skip-tests] [--skip-gh]    Verify, tag, push, publish to npm, and optionally create a GitHub release',
    '',
    'Examples:',
    '  openkit release prepare 0.2.13 --summary "interactive release workflow"',
    '  openkit release verify',
    '  openkit release publish --skip-gh',
  ].join('\n');
}

function parseSummary(args) {
  const index = args.indexOf('--summary');
  if (index === -1) {
    return { summary: 'pending release summary', args };
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('Missing value for --summary');
  }

  const remaining = [...args.slice(0, index), ...args.slice(index + 2)];
  return { summary: value, args: remaining };
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

export const releaseCommand = {
  name: 'release',
  async run(args = [], io, context = {}) {
    const [subcommand, ...rest] = args;
    const deps = context.releaseDeps ?? {
      readCurrentVersion,
      releasePrepare,
      releaseVerify,
      publishRelease,
    };

    if (!subcommand || subcommand === '--help' || subcommand === '-h') {
      io.stdout.write(`${releaseHelp()}\n`);
      return 0;
    }

    try {
      if (subcommand === 'prepare') {
        const { summary, args: remaining } = parseSummary(rest);
        const version = remaining[0];
        if (!version) {
          throw new Error('Missing required version for `openkit release prepare`.');
        }

        const result = deps.releasePrepare(process.cwd(), version, { summary });
        io.stdout.write(`Prepared release ${result.nextVersion}.\n`);
        io.stdout.write(`Release notes: ${result.notesPath}\n`);
        io.stdout.write(`Changed files: ${result.changedFiles.length}\n`);
        return 0;
      }

      if (subcommand === 'verify') {
        const result = deps.releaseVerify(process.cwd(), {
          skipTests: hasFlag(rest, '--skip-tests'),
        });
        io.stdout.write(`Release ${result.version} verified successfully.\n`);
        if (!hasFlag(rest, '--skip-tests')) {
          io.stdout.write('Full test suite passed with warning tracing enabled.\n');
        }
        return 0;
      }

      if (subcommand === 'publish') {
        const result = deps.publishRelease(process.cwd(), {
          skipTests: hasFlag(rest, '--skip-tests'),
          skipGh: hasFlag(rest, '--skip-gh'),
          io,
        });
        io.stdout.write(`Published ${result.version}.\n`);
        io.stdout.write(`Tag: ${result.tag}\n`);
        return 0;
      }

      throw new Error(`Unknown release subcommand: ${subcommand}`);
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      if (!(subcommand === 'prepare' || subcommand === 'verify' || subcommand === 'publish')) {
        io.stderr.write('Run `openkit release --help` for usage.\n');
      }
      return 1;
    }
  },
};
