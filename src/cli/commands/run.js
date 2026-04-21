import { ensureGlobalInstall } from '../../global/ensure-install.js';
import { launchGlobalOpenKit } from '../../global/launcher.js';
import { DEFAULT_ENTRY_COMMAND, getCommandInstructionContract } from '../../runtime/instruction-contracts.js';
import {
  createPromptAdapter,
  ENV_PROPAGATION_MODES,
  isInteractiveIo,
  parseRunOptions,
  promptLine,
  WORKTREE_MODES,
} from './run-options.js';

function runHelp() {
  return [
    'Usage: openkit run [--work-item <work_item_id>] [--worktree-mode <new|reuse|reopen|none>] [--env-propagation <none|symlink|copy>] [opencode args...]',
    '',
    'Run OpenCode with the globally installed OpenKit profile for the current project.',
    'Use `--work-item` to launch a specific work item inside its managed git worktree.',
    'Use `--worktree-mode` to force explicit worktree behavior for that launch.',
    'Use `--env-propagation` to choose managed worktree .env behavior (ignored for worktree-mode=none).',
  ].join('\n');
}

function normalizeInteractiveSelection(value, allowedValues) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowedValues.includes(normalized) ? normalized : null;
}

async function promptLaunchSelection(io, reason) {
  const rl = createPromptAdapter(io);

  try {
    if (reason) {
      io.stderr.write(`${reason}\n`);
    }

    io.stdout.write(`Select worktree mode (${WORKTREE_MODES.join('/')}) for this launch.\n`);

    let selectedMode = null;
    while (!selectedMode) {
      const response = await promptLine(rl, 'worktree mode (or q to cancel): ');
      if (!response || response.toLowerCase() === 'q' || response.toLowerCase() === 'quit') {
        return null;
      }
      selectedMode = normalizeInteractiveSelection(response, WORKTREE_MODES);
      if (!selectedMode) {
        io.stderr.write(`Invalid worktree mode. Expected one of: ${WORKTREE_MODES.join(', ')}.\n`);
      }
    }

    if (selectedMode === 'none') {
      return {
        worktreeMode: selectedMode,
        envPropagation: 'none',
      };
    }

    io.stdout.write(`Select env propagation (${ENV_PROPAGATION_MODES.join('/')}).\n`);
    io.stdout.write('Tip: symlink is preferred when available; copy duplicates env files.\n');

    let selectedEnvPropagation = null;
    while (!selectedEnvPropagation) {
      const response = await promptLine(rl, 'env propagation [none]: ');
      if (!response) {
        selectedEnvPropagation = 'none';
        break;
      }

      selectedEnvPropagation = normalizeInteractiveSelection(response, ENV_PROPAGATION_MODES);
      if (!selectedEnvPropagation) {
        io.stderr.write(`Invalid env propagation mode. Expected one of: ${ENV_PROPAGATION_MODES.join(', ')}.\n`);
      }
    }

    return {
      worktreeMode: selectedMode,
      envPropagation: selectedEnvPropagation,
    };
  } finally {
    rl.close();
  }
}

export const runCommand = {
  name: 'run',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${runHelp()}\n`);
      return 0;
    }

    let parsedArgs;
    try {
      parsedArgs = parseRunOptions(args);
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
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

    let launchRequest = parsedArgs;
    let result = launchGlobalOpenKit(launchRequest, {
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (result.promptRequired) {
      if (!isInteractiveIo(io)) {
        if (result.promptReason) {
          io.stderr.write(`${result.promptReason}\n`);
        }
        io.stderr.write('Run again with --worktree-mode <new|reuse|reopen|none> to continue in non-interactive mode.\n');
        return 1;
      }

      const interactiveSelection = await promptLaunchSelection(io, result.promptReason);
      if (!interactiveSelection) {
        io.stderr.write('Launch cancelled before selecting a worktree mode.\n');
        return 1;
      }

      launchRequest = {
        ...launchRequest,
        ...interactiveSelection,
      };

      result = launchGlobalOpenKit(launchRequest, {
        projectRoot: process.cwd(),
        env: process.env,
      });
    }

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
