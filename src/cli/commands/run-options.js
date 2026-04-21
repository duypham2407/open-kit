import readline from 'node:readline/promises';

export const WORKTREE_MODES = ['new', 'reuse', 'reopen', 'none'];
export const ENV_PROPAGATION_MODES = ['none', 'symlink', 'copy'];

const WORKTREE_MODE_SET = new Set(WORKTREE_MODES);
const ENV_PROPAGATION_MODE_SET = new Set(ENV_PROPAGATION_MODES);

function normalizeOptionValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requireOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}

export function parseRunOptions(args = []) {
  const passthroughArgs = [];
  let workItemId = null;
  let worktreeMode = null;
  let envPropagation = null;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (current === '--work-item') {
      const value = requireOptionValue(args, index, '--work-item');
      workItemId = value;
      index += 1;
      continue;
    }

    if (current === '--worktree-mode') {
      const value = normalizeOptionValue(requireOptionValue(args, index, '--worktree-mode'));
      if (!WORKTREE_MODE_SET.has(value)) {
        throw new Error(`Unknown worktree mode '${value}'. Expected one of: ${WORKTREE_MODES.join(', ')}.`);
      }
      worktreeMode = value;
      index += 1;
      continue;
    }

    if (current === '--env-propagation') {
      const value = normalizeOptionValue(requireOptionValue(args, index, '--env-propagation'));
      if (!ENV_PROPAGATION_MODE_SET.has(value)) {
        throw new Error(`Unknown env propagation mode '${value}'. Expected one of: ${ENV_PROPAGATION_MODES.join(', ')}.`);
      }
      envPropagation = value;
      index += 1;
      continue;
    }

    passthroughArgs.push(current);
  }

  return {
    workItemId,
    worktreeMode,
    envPropagation,
    passthroughArgs,
  };
}

export function createPromptAdapter(io) {
  if (typeof io.prompt === 'function') {
    return {
      async question(label) {
        return io.prompt(label);
      },
      close() {},
    };
  }

  return readline.createInterface({
    input: io.stdin ?? process.stdin,
    output: io.stdout ?? process.stdout,
  });
}

export async function promptLine(rl, label) {
  try {
    const value = await rl.question(label);
    return value.trim();
  } catch (error) {
    if (error instanceof Error && error.message === 'readline was closed') {
      return '';
    }
    throw error;
  }
}

export function isInteractiveIo(io) {
  if (typeof io.prompt === 'function') {
    return true;
  }

  return Boolean((io.stdin ?? process.stdin)?.isTTY && (io.stdout ?? process.stdout)?.isTTY);
}
