import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import {
  clearAgentModel,
  isValidModelId,
  readAgentCatalog,
  readAgentModelSettings,
  setAgentModel,
} from '../../global/agent-models.js';
import { ensureGlobalInstall } from '../../global/ensure-install.js';
import { getGlobalPaths } from '../../global/paths.js';

function configureAgentModelsHelp() {
  return [
    'Usage: openkit configure-agent-models [options]',
    '',
    'Inspect available OpenCode models and persist provider-specific model overrides for OpenKit agents.',
    '',
    'Options:',
    '  --list                 List available OpenKit agents and current model overrides',
    '  --agent <id>           Agent id to configure (example: master-orchestrator)',
    '  --model <provider/id>  Provider-qualified model id to assign to the agent',
    '  --clear                Remove a saved model override for the selected agent',
    '  --interactive          Walk through agent/model selection interactively',
    '  --models [provider]    Show available models from OpenCode before saving',
    '  --refresh              Refresh the OpenCode models cache when using --models',
    '  --verbose              Request verbose model output from `opencode models`',
    '',
    'Examples:',
    '  openkit configure-agent-models --list',
    '  openkit configure-agent-models --interactive',
    '  openkit configure-agent-models --models openai --refresh',
    '  openkit configure-agent-models --agent qa-agent --model openai/gpt-5',
    '  openkit configure-agent-models --agent code-reviewer --clear',
    '',
    'Tip: use `openkit configure-agent-models --models` to see the exact provider/model ids OpenCode knows about.',
  ].join('\n');
}

function parseArgs(args) {
  const parsed = {
    list: false,
    clear: false,
    interactive: false,
    refresh: false,
    verbose: false,
    modelsProvider: null,
    agent: null,
    model: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === '--list') {
      parsed.list = true;
      continue;
    }

    if (value === '--clear') {
      parsed.clear = true;
      continue;
    }

    if (value === '--interactive') {
      parsed.interactive = true;
      continue;
    }

    if (value === '--refresh') {
      parsed.refresh = true;
      continue;
    }

    if (value === '--verbose') {
      parsed.verbose = true;
      continue;
    }

    if (value === '--agent') {
      parsed.agent = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--model') {
      parsed.model = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--models') {
      const next = args[index + 1];
      if (next && !next.startsWith('--')) {
        parsed.modelsProvider = next;
        index += 1;
      } else {
        parsed.modelsProvider = '';
      }
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return parsed;
}

function formatAgentList(agents, settings) {
  const lines = ['Configured OpenKit agents:'];

  for (const [index, agent] of agents.entries()) {
    const override = settings.agentModels[agent.id]?.model ?? null;
    lines.push(`${index + 1}. ${agent.id} (${agent.name})${override ? ` -> ${override}` : ''}`);
  }

  return lines.join('\n');
}

function parseModelIdsFromOutput(output) {
  const matches = new Set();
  const pattern = /(^|\s)([a-z0-9._-]+\/[A-Za-z0-9._:-]+)(?=\s|$)/gim;

  for (const line of output.split('\n')) {
    let match = pattern.exec(line);
    while (match) {
      const candidate = match[2].trim();
      if (!candidate.startsWith('http')) {
        matches.add(candidate);
      }
      match = pattern.exec(line);
    }
    pattern.lastIndex = 0;
  }

  return [...matches].sort();
}

async function promptLine(rl, label) {
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

function createPromptAdapter(io) {
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

async function chooseAgentInteractively(rl, agents, settings, io) {
  io.stdout.write(`${formatAgentList(agents, settings)}\n`);

  while (true) {
    const response = await promptLine(rl, 'Select agent by number or id (q to quit): ');
    if (!response || response.toLowerCase() === 'q') {
      return null;
    }

    const asNumber = Number.parseInt(response, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= agents.length) {
      return agents[asNumber - 1];
    }

    const direct = agents.find((agent) => agent.id === response);
    if (direct) {
      return direct;
    }

    io.stderr.write('Unknown agent selection. Try again.\n');
  }
}

async function chooseActionInteractively(rl, agent, settings, io) {
  const currentModel = settings.agentModels[agent.id]?.model ?? null;
  if (!currentModel) {
    return 'set';
  }

  io.stdout.write(`Current override for ${agent.id}: ${currentModel}\n`);
  while (true) {
    const response = await promptLine(rl, 'Choose action: [s]et, [c]lear, [q]uit: ');
    const normalized = response.toLowerCase();
    if (normalized === 's' || normalized === 'set' || normalized === '') {
      return 'set';
    }
    if (normalized === 'c' || normalized === 'clear') {
      return 'clear';
    }
    if (normalized === 'q' || normalized === 'quit') {
      return 'quit';
    }
    io.stderr.write('Unknown action. Try again.\n');
  }
}

async function chooseModelInteractively(rl, io, { env, refresh, verbose }) {
  let eofAttempts = 0;

  while (true) {
    const provider = await promptLine(rl, 'Provider filter (blank for all models): ');
    const search = await promptLine(rl, 'Search text to narrow models (blank for all): ');

    if (!provider && !search) {
      eofAttempts += 1;
      if (eofAttempts >= 2) {
        return null;
      }
    } else {
      eofAttempts = 0;
    }

    const modelResult = runOpenCodeModels(provider, { env, refresh, verbose });

    if (modelResult.stdout) {
      io.stdout.write(modelResult.stdout);
      if (!modelResult.stdout.endsWith('\n')) {
        io.stdout.write('\n');
      }
    }
    if (modelResult.stderr) {
      io.stderr.write(modelResult.stderr);
    }

    if (modelResult.error?.code === 'ENOENT') {
      throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
    }

    if ((modelResult.status ?? 1) !== 0) {
      throw new Error('`opencode models` failed, so interactive model selection could not continue.');
    }

    const allModelIds = parseModelIdsFromOutput(modelResult.stdout ?? '');
    const filtered = search
      ? allModelIds.filter((entry) => entry.toLowerCase().includes(search.toLowerCase()))
      : allModelIds;

    if (filtered.length === 0) {
      io.stderr.write('No models matched that filter. Try a different provider or search term.\n');
      continue;
    }

    if (filtered.length === 1) {
      io.stdout.write(`Selected model: ${filtered[0]}\n`);
      return filtered[0];
    }

    const preview = filtered.slice(0, 20);
    io.stdout.write('Matching models:\n');
    for (const [index, model] of preview.entries()) {
      io.stdout.write(`${index + 1}. ${model}\n`);
    }
    if (filtered.length > preview.length) {
      io.stdout.write(`... ${filtered.length - preview.length} more match(es). Narrow the search or enter an exact provider/model.\n`);
    }

    const response = await promptLine(rl, 'Choose model by number, exact provider/model, or press Enter to search again: ');
    if (!response) {
      eofAttempts += 1;
      if (eofAttempts >= 2) {
        return null;
      }
      continue;
    }

    eofAttempts = 0;

    const asNumber = Number.parseInt(response, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= preview.length) {
      return preview[asNumber - 1];
    }

    if (isValidModelId(response)) {
      return response;
    }

    io.stderr.write('Unknown model selection. Try again.\n');
  }
}

async function configureInteractively({ agents, settingsPath, env, refresh, verbose, io }) {
  const rl = createPromptAdapter(io);

  try {
    io.stdout.write('Interactive OpenKit agent model setup\n');

    while (true) {
      const latestSettings = readAgentModelSettings(settingsPath);
      const agent = await chooseAgentInteractively(rl, agents, latestSettings, io);
      if (!agent) {
        io.stdout.write('Interactive setup cancelled.\n');
        return 0;
      }

      const action = await chooseActionInteractively(rl, agent, latestSettings, io);
      if (action === 'quit') {
        io.stdout.write('Interactive setup cancelled.\n');
        return 0;
      }

      if (action === 'clear') {
        clearAgentModel(settingsPath, agent.id);
        io.stdout.write(`Cleared model override for ${agent.id}.\n`);
      } else {
        const model = await chooseModelInteractively(rl, io, { env, refresh, verbose });
        if (!model) {
          io.stdout.write('Interactive setup cancelled.\n');
          return 0;
        }
        setAgentModel(settingsPath, agent.id, model);
        io.stdout.write(`Saved ${model} for ${agent.id}.\n`);
      }

      const again = await promptLine(rl, 'Configure another agent? [y/N]: ');
      if (!['y', 'yes'].includes(again.toLowerCase())) {
        io.stdout.write(`Settings file: ${settingsPath}\n`);
        io.stdout.write('Run `openkit run` to start a session with the updated per-agent model overrides.\n');
        return 0;
      }
    }
  } finally {
    rl.close();
  }
}

function runOpenCodeModels(provider, { env, refresh, verbose }) {
  const args = ['models'];
  if (provider) {
    args.push(provider);
  }
  if (refresh) {
    args.push('--refresh');
  }
  if (verbose) {
    args.push('--verbose');
  }

  return spawnSync('opencode', args, {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

export const configureAgentModelsCommand = {
  name: 'configure-agent-models',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${configureAgentModelsHelp()}\n`);
      return 0;
    }

    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      io.stderr.write('Run `openkit configure-agent-models --help` for usage.\n');
      return 1;
    }

    const ensured = ensureGlobalInstall({
      projectRoot: process.cwd(),
      env: process.env,
    });

    if (ensured.action === 'blocked') {
      for (const issue of ensured.doctor.issues ?? []) {
        io.stderr.write(`${issue}\n`);
      }
      if (ensured.doctor.nextStep) {
        io.stderr.write(`Next: ${ensured.doctor.nextStep}\n`);
      }
      return 1;
    }

    const globalPaths = getGlobalPaths({ env: process.env });
    const registryPath = `${globalPaths.kitRoot}/registry.json`;
    const settingsPath = globalPaths.agentModelSettingsPath;
    const agents = readAgentCatalog(registryPath);
    const settings = readAgentModelSettings(settingsPath);

    if (parsed.interactive) {
      try {
        return await configureInteractively({
          agents,
          settingsPath,
          env: process.env,
          refresh: parsed.refresh,
          verbose: parsed.verbose,
          io,
        });
      } catch (error) {
        io.stderr.write(`${error.message}\n`);
        return 1;
      }
    }

    if (parsed.list || args.length === 0) {
      io.stdout.write(`${formatAgentList(agents, settings)}\n`);
    }

    if (parsed.modelsProvider !== null) {
      const modelResult = runOpenCodeModels(parsed.modelsProvider, {
        env: process.env,
        refresh: parsed.refresh,
        verbose: parsed.verbose,
      });

      if (modelResult.stdout) {
        io.stdout.write(modelResult.stdout);
        if (!modelResult.stdout.endsWith('\n')) {
          io.stdout.write('\n');
        }
      }
      if (modelResult.stderr) {
        io.stderr.write(modelResult.stderr);
      }

      if (modelResult.error?.code === 'ENOENT') {
        io.stderr.write('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.\n');
        return 1;
      }

      if ((modelResult.status ?? 1) !== 0) {
        return typeof modelResult.status === 'number' ? modelResult.status : 1;
      }
    }

    if (!parsed.agent && !parsed.model && !parsed.clear) {
      return 0;
    }

    if (!parsed.agent) {
      io.stderr.write('Missing required --agent <id> option.\n');
      return 1;
    }

    const agent = agents.find((entry) => entry.id === parsed.agent);
    if (!agent) {
      io.stderr.write(`Unknown agent id: ${parsed.agent}\n`);
      io.stderr.write('Run `openkit configure-agent-models --list` to see valid agent ids.\n');
      return 1;
    }

    if (parsed.clear) {
      clearAgentModel(settingsPath, agent.id);
      io.stdout.write(`Cleared model override for ${agent.id}.\n`);
      return 0;
    }

    if (!parsed.model) {
      io.stderr.write('Missing required --model <provider/id> option.\n');
      return 1;
    }

    if (!isValidModelId(parsed.model)) {
      io.stderr.write('Model ids must use the form provider/model.\n');
      return 1;
    }

    setAgentModel(settingsPath, agent.id, parsed.model);
    io.stdout.write(`Saved ${parsed.model} for ${agent.id}.\n`);
    io.stdout.write(`Settings file: ${settingsPath}\n`);
    io.stdout.write('Run `openkit run` to start a session with the updated per-agent model overrides.\n');
    return 0;
  },
};
