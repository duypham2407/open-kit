import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import { isValidModelId } from '../../global/agent-models.js';

export function parseModelIdsFromOutput(output) {
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

export function groupModelsByProvider(modelIds) {
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

export function parseVerboseModelCatalog(output) {
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

export function toPlainModelEntries(modelIds) {
  return modelIds.map((modelId) => ({
    modelId,
    variants: {},
  }));
}

export function describeVariantOptions(variantConfig) {
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

export async function chooseVariantInteractively(rl, io, modelEntry) {
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

function chooseExactModel(modelEntries, modelResponse, { strict }) {
  const discovered = modelEntries.find((entry) => entry.modelId === modelResponse);
  if (discovered) {
    return discovered;
  }

  if (!strict && isValidModelId(modelResponse)) {
    return {
      modelId: modelResponse,
      variants: {},
    };
  }

  return null;
}

export async function chooseModelInteractively(
  rl,
  io,
  { env, refresh, verbose, strict = false, runModels = runOpenCodeModels }
) {
  const verboseResult = runModels('', { env, refresh, verbose: true });

  if (verboseResult.error?.code === 'ENOENT') {
    throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
  }

  let modelEntries = [];
  let allModelIds = [];

  if ((verboseResult.status ?? 1) === 0) {
    if (verboseResult.stderr) {
      io.stderr.write(verboseResult.stderr);
    }

    modelEntries = parseVerboseModelCatalog(verboseResult.stdout ?? '');
    allModelIds = modelEntries.map((entry) => entry.modelId);
  } else {
    if (verboseResult.stderr) {
      io.stderr.write(verboseResult.stderr);
    }
    io.stderr.write('Falling back to plain `opencode models` output because verbose model discovery was unavailable. Variant selection will be skipped unless a later retry succeeds.\n');
  }

  if (allModelIds.length === 0) {
    const plainResult = runModels('', { env, refresh, verbose: false });

    if (plainResult.error?.code === 'ENOENT') {
      throw new Error('Could not find `opencode` on your PATH. Install OpenCode or add it to PATH first.');
    }

    if ((plainResult.status ?? 1) !== 0) {
      throw new Error('`opencode models` failed, so interactive model selection could not continue.');
    }

    if (plainResult.stderr) {
      io.stderr.write(plainResult.stderr);
    }

    allModelIds = parseModelIdsFromOutput(plainResult.stdout ?? '');
    modelEntries = toPlainModelEntries(allModelIds);
  }

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
      return chooseModelInteractively(rl, io, { env, refresh: true, verbose, strict, runModels });
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

      const exactModel = chooseExactModel(modelEntries, modelResponse, { strict });
      if (exactModel) {
        return exactModel;
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

      const exactModel = chooseExactModel(modelEntries, modelResponse, { strict });
      if (exactModel) {
        return exactModel;
      }

      io.stderr.write('Unknown model selection. Try again.\n');
    }
  }
}

export function runOpenCodeModels(provider, { env, refresh, verbose }) {
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
