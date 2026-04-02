import readline from 'node:readline/promises';
import path from 'node:path';

import {
  readEmbeddingConfig,
  writeEmbeddingConfig,
  clearEmbeddingConfig,
  validateEmbeddingPatch,
  EMBEDDING_PROVIDERS,
} from '../../global/embedding-config.js';

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function help() {
  return [
    'Usage: openkit configure-embedding [options]',
    '',
    'Inspect and set the embedding provider for semantic code search.',
    'Config is written to .opencode/openkit.runtime.jsonc in the project root.',
    '',
    'Options:',
    '  --list                   Show current embedding config',
    '  --interactive            Walk through setup interactively (recommended)',
    '  --enable                 Set embedding.enabled = true',
    '  --disable                Set embedding.enabled = false',
    '  --provider <name>        Set provider: openai | ollama | custom',
    '  --model <provider/id>    Set model id (e.g. openai/text-embedding-3-small)',
    '  --dimensions <n>         Set vector dimensions (must match the model)',
    '  --api-key <key>          Set API key (stored in config file, not env var)',
    '  --base-url <url>         Set custom base URL (required for custom provider)',
    '  --batch-size <n>         Set number of chunks per API call (default 20)',
    '  --clear                  Remove the entire embedding section from config',
    '',
    'Examples:',
    '  openkit configure-embedding --list',
    '  openkit configure-embedding --interactive',
    '  openkit configure-embedding --provider openai --model openai/text-embedding-3-small --enable',
    '  openkit configure-embedding --provider ollama --model ollama/nomic-embed-text --dimensions 768 --enable',
    '  openkit configure-embedding --provider custom --model my-model --base-url https://my-api.example.com/v1 --enable',
    '  openkit configure-embedding --disable',
    '  openkit configure-embedding --clear',
    '',
    'Tip: set OPENAI_API_KEY or OLLAMA_HOST in your environment instead of --api-key / --base-url when possible.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(args) {
  const parsed = {
    list: false,
    interactive: false,
    enable: false,
    disable: false,
    clear: false,
    provider: null,
    model: null,
    dimensions: null,
    apiKey: null,
    baseUrl: null,
    batchSize: null,
  };

  for (let i = 0; i < args.length; i++) {
    const v = args[i];

    if (v === '--list') { parsed.list = true; continue; }
    if (v === '--interactive') { parsed.interactive = true; continue; }
    if (v === '--enable') { parsed.enable = true; continue; }
    if (v === '--disable') { parsed.disable = true; continue; }
    if (v === '--clear') { parsed.clear = true; continue; }

    if (v === '--provider') { parsed.provider = args[++i] ?? null; continue; }
    if (v === '--model') { parsed.model = args[++i] ?? null; continue; }
    if (v === '--api-key') { parsed.apiKey = args[++i] ?? null; continue; }
    if (v === '--base-url') { parsed.baseUrl = args[++i] ?? null; continue; }

    if (v === '--dimensions') {
      const raw = args[++i];
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isInteger(n) || n <= 0) throw new Error(`--dimensions must be a positive integer, got: ${raw}`);
      parsed.dimensions = n;
      continue;
    }

    if (v === '--batch-size') {
      const raw = args[++i];
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isInteger(n) || n <= 0) throw new Error(`--batch-size must be a positive integer, got: ${raw}`);
      parsed.batchSize = n;
      continue;
    }

    throw new Error(`Unknown argument: ${v}`);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS = {
  openai: { model: 'openai/text-embedding-3-small', dimensions: 1536, envVar: 'OPENAI_API_KEY' },
  ollama: { model: 'ollama/nomic-embed-text', dimensions: 768, envVarUrl: 'OLLAMA_HOST (default: http://localhost:11434)' },
  custom: { model: 'your-model-name', dimensions: 384, note: 'requires --base-url' },
};

function formatEmbeddingConfig(embedding, configPath) {
  if (!embedding) {
    return [
      'Embedding config: not set',
      `Config file: ${configPath}`,
      '',
      'Use `openkit configure-embedding --interactive` to set up a provider.',
    ].join('\n');
  }

  const lines = ['Current embedding config:'];
  lines.push(`  enabled:    ${embedding.enabled ?? false}`);
  lines.push(`  provider:   ${embedding.provider ?? '(not set)'}`);
  lines.push(`  model:      ${embedding.model ?? '(not set)'}`);
  lines.push(`  dimensions: ${embedding.dimensions ?? '(not set)'}`);
  if (embedding.baseUrl) lines.push(`  baseUrl:    ${embedding.baseUrl}`);
  if (embedding.apiKey) lines.push(`  apiKey:     (set)`);
  if (embedding.batchSize) lines.push(`  batchSize:  ${embedding.batchSize}`);
  lines.push(`Config file: ${configPath}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Interactive flow
// ---------------------------------------------------------------------------

function createPromptAdapter(io) {
  if (typeof io.prompt === 'function') {
    return { async question(label) { return io.prompt(label); }, close() {} };
  }
  return readline.createInterface({ input: io.stdin ?? process.stdin, output: io.stdout ?? process.stdout });
}

async function promptLine(rl, label) {
  try {
    const v = await rl.question(label);
    return v.trim();
  } catch (err) {
    if (err instanceof Error && err.message === 'readline was closed') return '';
    throw err;
  }
}

async function configureInteractively({ projectRoot, io }) {
  const rl = createPromptAdapter(io);

  try {
    io.stdout.write('Interactive embedding provider setup\n');
    io.stdout.write('This will write to .opencode/openkit.runtime.jsonc in the project root.\n\n');

    // Step 1: choose provider
    io.stdout.write('Available providers:\n');
    for (const [i, p] of EMBEDDING_PROVIDERS.entries()) {
      const defaults = PROVIDER_DEFAULTS[p];
      const hint = p === 'openai' ? ' (requires OPENAI_API_KEY or --api-key)'
        : p === 'ollama' ? ' (local server, no API key needed)'
        : ' (any OpenAI-compatible endpoint, requires --base-url)';
      io.stdout.write(`${i + 1}. ${p}${hint}\n`);
    }

    let provider = null;
    while (!provider) {
      const resp = await promptLine(rl, 'Choose provider by number or name (q to quit): ');
      if (!resp || resp.toLowerCase() === 'q') {
        io.stdout.write('Setup cancelled.\n');
        return 0;
      }
      const asNum = Number.parseInt(resp, 10);
      if (Number.isInteger(asNum) && asNum >= 1 && asNum <= EMBEDDING_PROVIDERS.length) {
        provider = EMBEDDING_PROVIDERS[asNum - 1];
      } else if (EMBEDDING_PROVIDERS.includes(resp)) {
        provider = resp;
      } else {
        io.stderr.write(`Unknown selection. Choose 1-${EMBEDDING_PROVIDERS.length} or a provider name.\n`);
      }
    }

    const defaults = PROVIDER_DEFAULTS[provider];
    io.stdout.write(`\nSelected provider: ${provider}\n`);

    // Step 2: model
    const modelInput = await promptLine(rl, `Model id [${defaults.model}]: `);
    const model = modelInput || defaults.model;

    // Step 3: dimensions
    const dimInput = await promptLine(rl, `Vector dimensions [${defaults.dimensions}]: `);
    let dimensions = defaults.dimensions;
    if (dimInput) {
      const n = Number.parseInt(dimInput, 10);
      if (!Number.isInteger(n) || n <= 0) {
        io.stderr.write(`Invalid dimensions "${dimInput}", using default ${defaults.dimensions}.\n`);
      } else {
        dimensions = n;
      }
    }

    // Step 4: provider-specific settings
    let apiKey = null;
    let baseUrl = null;

    if (provider === 'openai') {
      const keyInput = await promptLine(rl, 'API key (leave blank to use OPENAI_API_KEY env var): ');
      if (keyInput) apiKey = keyInput;
    } else if (provider === 'ollama') {
      const urlInput = await promptLine(rl, 'Ollama base URL [http://localhost:11434]: ');
      if (urlInput) baseUrl = urlInput;
    } else if (provider === 'custom') {
      while (!baseUrl) {
        const urlInput = await promptLine(rl, 'Base URL (required for custom provider): ');
        if (!urlInput) {
          io.stderr.write('Base URL is required for the custom provider.\n');
        } else {
          baseUrl = urlInput;
        }
      }
      const keyInput = await promptLine(rl, 'API key (leave blank if not required): ');
      if (keyInput) apiKey = keyInput;
    }

    // Step 5: batch size
    const batchInput = await promptLine(rl, 'Batch size (chunks per API call) [20]: ');
    let batchSize = 20;
    if (batchInput) {
      const n = Number.parseInt(batchInput, 10);
      if (Number.isInteger(n) && n > 0) batchSize = n;
    }

    // Step 6: enable now?
    const enableResp = await promptLine(rl, 'Enable embedding indexing now? [Y/n]: ');
    const enabled = !enableResp || ['y', 'yes', ''].includes(enableResp.toLowerCase());

    // Build patch
    const patch = {
      enabled,
      provider,
      model,
      dimensions,
      batchSize,
      ...(apiKey ? { apiKey } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    };

    // Validate
    const errors = validateEmbeddingPatch(patch);
    if (errors.length > 0) {
      for (const e of errors) io.stderr.write(`Validation error: ${e}\n`);
      return 1;
    }

    writeEmbeddingConfig(projectRoot, patch);

    const configPath = path.join(projectRoot, '.opencode/openkit.runtime.jsonc');
    io.stdout.write('\nSaved embedding config:\n');
    io.stdout.write(`  provider:   ${provider}\n`);
    io.stdout.write(`  model:      ${model}\n`);
    io.stdout.write(`  dimensions: ${dimensions}\n`);
    io.stdout.write(`  enabled:    ${enabled}\n`);
    io.stdout.write(`Config file: ${configPath}\n`);
    io.stdout.write('\nRun `openkit run` to start a session with the new embedding config.\n');
    io.stdout.write('Use `tool.embedding-index` inside a session to index the project.\n');
    return 0;
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Command export
// ---------------------------------------------------------------------------

export const configureEmbeddingCommand = {
  name: 'configure-embedding',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      io.stderr.write(`${err.message}\n`);
      io.stderr.write('Run `openkit configure-embedding --help` for usage.\n');
      return 1;
    }

    const projectRoot = process.cwd();
    const { embedding, configPath, parseError } = readEmbeddingConfig(projectRoot);

    if (parseError) {
      io.stderr.write(`Warning: could not parse existing config at ${configPath} — it will be overwritten.\n`);
    }

    // --list (also shown when no args given)
    if (parsed.list || args.length === 0) {
      io.stdout.write(`${formatEmbeddingConfig(embedding, configPath)}\n`);
      if (args.length === 0) return 0;
    }

    // --interactive
    if (parsed.interactive) {
      try {
        return await configureInteractively({ projectRoot, io });
      } catch (err) {
        io.stderr.write(`${err.message}\n`);
        return 1;
      }
    }

    // --clear
    if (parsed.clear) {
      clearEmbeddingConfig(projectRoot);
      io.stdout.write('Cleared embedding config.\n');
      return 0;
    }

    // Non-interactive flag-based config
    const patch = {};

    if (parsed.enable) patch.enabled = true;
    if (parsed.disable) patch.enabled = false;
    if (parsed.provider !== null) patch.provider = parsed.provider;
    if (parsed.model !== null) patch.model = parsed.model;
    if (parsed.dimensions !== null) patch.dimensions = parsed.dimensions;
    if (parsed.apiKey !== null) patch.apiKey = parsed.apiKey;
    if (parsed.baseUrl !== null) patch.baseUrl = parsed.baseUrl;
    if (parsed.batchSize !== null) patch.batchSize = parsed.batchSize;

    if (Object.keys(patch).length === 0) {
      // --list was already handled above; nothing else to do
      return 0;
    }

    const errors = validateEmbeddingPatch(patch);
    if (errors.length > 0) {
      for (const e of errors) io.stderr.write(`Error: ${e}\n`);
      io.stderr.write('Run `openkit configure-embedding --help` for usage.\n');
      return 1;
    }

    writeEmbeddingConfig(projectRoot, patch);

    const { embedding: updated, configPath: updatedPath } = readEmbeddingConfig(projectRoot);
    io.stdout.write(`${formatEmbeddingConfig(updated, updatedPath)}\n`);
    io.stdout.write('Run `openkit run` to start a session with the updated embedding config.\n');
    return 0;
  },
};
