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

function groupModelsByProvider(modelIds) {
  const grouped = new Map();

  for (const modelId of modelIds) {
    const separator = modelId.indexOf('/');
    if (separator === -1) {
      continue;
    }

    const provider = modelId.slice(0, separator);
    const existing = grouped.get(provider) ?? [];
    existing.push(modelId);
    grouped.set(provider, existing);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provider, models]) => ({
      provider,
      models: models.sort(),
    }));
}

function parseVerboseModelCatalog(output) {
  const entries = [];
  const lines = output.split('\n');
  const modelIdPattern = /^[a-z0-9._-]+\/[A-Za-z0-9._:-]+$/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!modelIdPattern.test(line)) {
      continue;
    }

    const entry = {
      modelId: line,
      variants: {},
    };

    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim().length === 0) {
      cursor += 1;
    }

    if (cursor < lines.length && lines[cursor].trim().startsWith('{')) {
      let depth = 0;
      const jsonLines = [];

      while (cursor < lines.length) {
        const jsonLine = lines[cursor];
        jsonLines.push(jsonLine);
        for (const character of jsonLine) {
          if (character === '{') {
            depth += 1;
          } else if (character === '}') {
            depth -= 1;
          }
        }
        cursor += 1;
        if (depth === 0) {
          break;
        }
      }

      try {
        const parsed = JSON.parse(jsonLines.join('\n'));
        entry.variants = parsed?.variants && typeof parsed.variants === 'object' && !Array.isArray(parsed.variants)
          ? parsed.variants
          : {};
      } catch {
        entry.variants = {};
      }

      index = cursor - 1;
    }

    entries.push(entry);
  }

  return entries;
}

function describeVariantOptions(variantConfig) {
  if (!variantConfig || typeof variantConfig !== 'object' || Array.isArray(variantConfig)) {
    return 'Custom variant';
  }

  const summary = [];
  const reasoningEffort = typeof variantConfig.reasoningEffort === 'string' ? variantConfig.reasoningEffort : null;
  const textVerbosity = typeof variantConfig.textVerbosity === 'string' ? variantConfig.textVerbosity : null;
  const reasoningSummary = typeof variantConfig.reasoningSummary === 'string' ? variantConfig.reasoningSummary : null;
  const thinkingBudget = typeof variantConfig.thinking?.budgetTokens === 'number' ? variantConfig.thinking.budgetTokens : null;

  if (reasoningEffort) {
    summary.push(`reasoning ${reasoningEffort}`);
  }
  if (textVerbosity) {
    summary.push(`verbosity ${textVerbosity}`);
  }
  if (reasoningSummary) {
    summary.push(`summary ${reasoningSummary}`);
  }
  if (thinkingBudget !== null) {
    summary.push(`thinking ${thinkingBudget} tokens`);
  }

  return summary.length > 0 ? summary.join(', ') : 'Custom variant';
}

async function chooseVariantInteractively(rl, io, modelEntry) {
  const variants = Object.entries(modelEntry.variants ?? {}).map(([id, config]) => ({
    id,
    description: describeVariantOptions(config),
  }));

  if (variants.length === 0) {
    return null;
  }

  io.stdout.write(`Available variants for ${modelEntry.modelId}:\n`);
  io.stdout.write('1. default (no explicit variant)\n');
  for (const [index, variant] of variants.entries()) {
    io.stdout.write(`${index + 2}. ${variant.id} - ${variant.description}\n`);
  }

  while (true) {
    const response = await promptLine(rl, 'Choose variant by number/name, or press Enter for default: ');
    if (!response || response === '1' || response.toLowerCase() === 'default') {
      return null;
    }

    const variantIndex = Number.parseInt(response, 10);
    if (Number.isInteger(variantIndex) && variantIndex >= 2 && variantIndex <= variants.length + 1) {
      return variants[variantIndex - 2].id;
    }

    const direct = variants.find((variant) => variant.id === response);
    if (direct) {
      return direct.id;
    }

    io.stderr.write('Unknown variant selection. Try again.\n');
  }
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
  const modelResult = runOpenCodeModels('', { env, refresh, verbose: true });

  if (modelResult.stderr) {
    io.stderr.write(modelResult.stderr);
  }

  if (modelResult.error?.code === 'ENOENT') {
    throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
  }

  if ((modelResult.status ?? 1) !== 0) {
    throw new Error('`opencode models` failed, so interactive model selection could not continue.');
  }

  const modelEntries = parseVerboseModelCatalog(modelResult.stdout ?? '');
  const allModelIds = modelEntries.map((entry) => entry.modelId);
  const providerGroups = groupModelsByProvider(allModelIds);

  if (providerGroups.length === 0) {
    throw new Error('OpenCode did not return any selectable models.');
  }

  while (true) {
    io.stdout.write('Available providers:\n');
    io.stdout.write('1. all providers\n');
    for (const [index, group] of providerGroups.entries()) {
      io.stdout.write(`${index + 2}. ${group.provider} (${group.models.length} models)\n`);
    }

    const providerResponse = await promptLine(rl, 'Choose provider by number/name, [s]earch, [r]efresh, or [q]uit: ');
    const providerSelection = providerResponse.toLowerCase();

    if (!providerSelection || providerSelection === 'q' || providerSelection === 'quit') {
      return null;
    }

    if (providerSelection === 'r' || providerSelection === 'refresh') {
      return chooseModelInteractively(rl, io, { env, refresh: true, verbose });
    }

    if (providerSelection === 's' || providerSelection === 'search') {
      const search = await promptLine(rl, 'Search models by text: ');
      const filtered = modelEntries.filter((entry) => entry.modelId.toLowerCase().includes(search.toLowerCase()));

      if (filtered.length === 0) {
        io.stderr.write('No models matched that search. Try again.\n');
        continue;
      }

      io.stdout.write('Matching models:\n');
      for (const [index, model] of filtered.slice(0, 30).entries()) {
        io.stdout.write(`${index + 1}. ${model.modelId}\n`);
      }

      const modelResponse = await promptLine(rl, 'Choose model by number, exact provider/model, or press Enter to go back: ');
      if (!modelResponse) {
        continue;
      }

      const modelIndex = Number.parseInt(modelResponse, 10);
      if (Number.isInteger(modelIndex) && modelIndex >= 1 && modelIndex <= filtered.slice(0, 30).length) {
        return filtered.slice(0, 30)[modelIndex - 1];
      }

      if (isValidModelId(modelResponse)) {
        return modelEntries.find((entry) => entry.modelId === modelResponse) ?? {
          modelId: modelResponse,
          variants: {},
        };
      }

      io.stderr.write('Unknown model selection. Try again.\n');
      continue;
    }

    let selectedModels = modelEntries;
    if (providerSelection !== '1' && providerSelection !== 'all' && providerSelection !== 'all providers') {
      const providerIndex = Number.parseInt(providerResponse, 10);
      if (Number.isInteger(providerIndex) && providerIndex >= 2 && providerIndex <= providerGroups.length + 1) {
        const provider = providerGroups[providerIndex - 2].provider;
        selectedModels = modelEntries.filter((entry) => entry.modelId.startsWith(`${provider}/`));
      } else {
        const directProvider = providerGroups.find((group) => group.provider === providerResponse);
        if (!directProvider) {
          io.stderr.write('Unknown provider selection. Try again.\n');
          continue;
        }
        selectedModels = modelEntries.filter((entry) => entry.modelId.startsWith(`${directProvider.provider}/`));
      }
    }

    while (true) {
      io.stdout.write('Available models:\n');
      for (const [index, model] of selectedModels.entries()) {
        io.stdout.write(`${index + 1}. ${model.modelId}\n`);
      }

      const modelResponse = await promptLine(rl, 'Choose model by number, type exact provider/model, [b]ack, or [q]uit: ');
      const normalized = modelResponse.toLowerCase();

      if (!modelResponse || normalized === 'b' || normalized === 'back') {
        break;
      }

      if (normalized === 'q' || normalized === 'quit') {
        return null;
      }

      const modelIndex = Number.parseInt(modelResponse, 10);
      if (Number.isInteger(modelIndex) && modelIndex >= 1 && modelIndex <= selectedModels.length) {
        return selectedModels[modelIndex - 1];
      }

      if (isValidModelId(modelResponse)) {
        return modelEntries.find((entry) => entry.modelId === modelResponse) ?? {
          modelId: modelResponse,
          variants: {},
        };
      }

      io.stderr.write('Unknown model selection. Try again.\n');
    }
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
        const modelEntry = await chooseModelInteractively(rl, io, { env, refresh, verbose });
        if (!modelEntry) {
          io.stdout.write('Interactive setup cancelled.\n');
          return 0;
        }
        const variant = await chooseVariantInteractively(rl, io, modelEntry);
        setAgentModel(settingsPath, agent.id, modelEntry.modelId, variant);
        io.stdout.write(`Saved ${modelEntry.modelId}${variant ? ` (variant: ${variant})` : ''} for ${agent.id}.\n`);
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
