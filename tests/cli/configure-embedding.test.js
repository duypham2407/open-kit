import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-configure-embedding-'));
}

async function runCli(args, { cwd = worktreeRoot, prompt } = {}) {
  const { runCli: _runCli } = await import('../../src/cli/index.js');
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const originalCwd = process.cwd();

  let stdoutText = '';
  let stderrText = '';
  stdout.setEncoding('utf8');
  stderr.setEncoding('utf8');
  stdout.on('data', (chunk) => { stdoutText += chunk; });
  stderr.on('data', (chunk) => { stderrText += chunk; });

  process.chdir(cwd);

  try {
    const runPromise = _runCli(args, { stdout, stderr, stdin, prompt });
    stdin.end();
    const status = await runPromise;
    await new Promise((resolve) => setImmediate(resolve));
    return { status, stdout: stdoutText, stderr: stderrText };
  } finally {
    process.chdir(originalCwd);
    stdout.destroy();
    stderr.destroy();
    stdin.destroy();
  }
}

function readJsonc(filePath) {
  // writeEmbeddingConfig writes plain JSON (no comments), so JSON.parse is safe here
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------------------
// --list / no-args
// ---------------------------------------------------------------------------

test('configure-embedding --list shows "not set" when config file does not exist', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding', '--list'], { cwd: tempDir });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /not set/);
});

test('configure-embedding no-args behaves same as --list', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding'], { cwd: tempDir });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /not set/);
});

test('configure-embedding --list shows current config when file exists', async () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'openkit.runtime.jsonc'),
    JSON.stringify({ embedding: { enabled: true, provider: 'openai', model: 'openai/text-embedding-3-small', dimensions: 1536 } }, null, 2),
    'utf8'
  );

  const result = await runCli(['configure-embedding', '--list'], { cwd: tempDir });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /enabled:\s+true/);
  assert.match(result.stdout, /provider:\s+openai/);
  assert.match(result.stdout, /model:\s+openai\/text-embedding-3-small/);
  assert.match(result.stdout, /dimensions:\s+1536/);
});

// ---------------------------------------------------------------------------
// --help
// ---------------------------------------------------------------------------

test('configure-embedding --help prints usage', async () => {
  const result = await runCli(['configure-embedding', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: openkit configure-embedding/);
  assert.match(result.stdout, /--interactive/);
  assert.match(result.stdout, /--provider/);
});

// ---------------------------------------------------------------------------
// Flag-based writes
// ---------------------------------------------------------------------------

test('configure-embedding --enable creates config with enabled true', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(
    ['configure-embedding', '--provider', 'openai', '--model', 'openai/text-embedding-3-small', '--enable'],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0);

  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  assert.ok(fs.existsSync(configPath), 'config file should be created');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.enabled, true);
  assert.equal(parsed.embedding.provider, 'openai');
  assert.equal(parsed.embedding.model, 'openai/text-embedding-3-small');
});

test('configure-embedding --disable sets enabled false', async () => {
  const tempDir = makeTempDir();

  // First enable
  await runCli(['configure-embedding', '--provider', 'openai', '--enable'], { cwd: tempDir });

  // Then disable
  const result = await runCli(['configure-embedding', '--disable'], { cwd: tempDir });

  assert.equal(result.status, 0);
  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.enabled, false);
  assert.equal(parsed.embedding.provider, 'openai', 'other fields should be preserved');
});

test('configure-embedding merges patch without discarding existing fields', async () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'openkit.runtime.jsonc'),
    JSON.stringify({ embedding: { enabled: false, provider: 'openai', model: 'openai/text-embedding-3-small', dimensions: 1536 } }, null, 2),
    'utf8'
  );

  const result = await runCli(['configure-embedding', '--enable'], { cwd: tempDir });

  assert.equal(result.status, 0);
  const parsed = readJsonc(path.join(configDir, 'openkit.runtime.jsonc'));
  assert.equal(parsed.embedding.enabled, true);
  assert.equal(parsed.embedding.provider, 'openai');
  assert.equal(parsed.embedding.model, 'openai/text-embedding-3-small');
  assert.equal(parsed.embedding.dimensions, 1536);
});

test('configure-embedding --dimensions and --batch-size are written correctly', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(
    ['configure-embedding', '--provider', 'ollama', '--model', 'ollama/nomic-embed-text', '--dimensions', '768', '--batch-size', '10'],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0);
  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.dimensions, 768);
  assert.equal(parsed.embedding.batchSize, 10);
});

test('configure-embedding preserves non-embedding keys in config file', async () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'openkit.runtime.jsonc'),
    JSON.stringify({ someOtherKey: 42 }, null, 2),
    'utf8'
  );

  await runCli(['configure-embedding', '--provider', 'openai', '--enable'], { cwd: tempDir });

  const parsed = readJsonc(path.join(configDir, 'openkit.runtime.jsonc'));
  assert.equal(parsed.someOtherKey, 42, 'pre-existing keys must not be removed');
  assert.equal(parsed.embedding.enabled, true);
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

test('configure-embedding rejects invalid provider', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding', '--provider', 'notavalidprovider'], { cwd: tempDir });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /provider must be one of/);
});

test('configure-embedding rejects custom provider without baseUrl', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding', '--provider', 'custom', '--enable'], { cwd: tempDir });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /baseUrl is required/);
});

test('configure-embedding rejects non-integer --dimensions', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding', '--dimensions', 'abc'], { cwd: tempDir });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /dimensions/);
});

// ---------------------------------------------------------------------------
// --clear
// ---------------------------------------------------------------------------

test('configure-embedding --clear removes embedding section', async () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'openkit.runtime.jsonc'),
    JSON.stringify({ someOtherKey: 1, embedding: { enabled: true, provider: 'openai' } }, null, 2),
    'utf8'
  );

  const result = await runCli(['configure-embedding', '--clear'], { cwd: tempDir });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Cleared embedding config/);
  const parsed = readJsonc(path.join(configDir, 'openkit.runtime.jsonc'));
  assert.equal(parsed.embedding, undefined);
  assert.equal(parsed.someOtherKey, 1, 'other keys must survive --clear');
});

test('configure-embedding --clear is a no-op when config does not exist', async () => {
  const tempDir = makeTempDir();

  const result = await runCli(['configure-embedding', '--clear'], { cwd: tempDir });

  assert.equal(result.status, 0);
});

// ---------------------------------------------------------------------------
// Interactive flow
// ---------------------------------------------------------------------------

test('configure-embedding --interactive writes config for openai provider', async () => {
  const tempDir = makeTempDir();
  // Answers: provider=1 (openai), model=default, dimensions=default, api-key=blank, batch-size=default, enable=y
  const answers = ['1', '', '', '', '', 'y'];

  const result = await runCli(['configure-embedding', '--interactive'], {
    cwd: tempDir,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Interactive embedding provider setup/);
  assert.match(result.stdout, /provider:\s+openai/);

  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  assert.ok(fs.existsSync(configPath), 'config file should be created');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.provider, 'openai');
  assert.equal(parsed.embedding.enabled, true);
});

test('configure-embedding --interactive writes config for ollama provider', async () => {
  const tempDir = makeTempDir();
  // Answers: provider=2 (ollama), model=default, dimensions=default, base-url=blank, batch-size=default, enable=n
  const answers = ['2', '', '', '', '', 'n'];

  const result = await runCli(['configure-embedding', '--interactive'], {
    cwd: tempDir,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.provider, 'ollama');
  assert.equal(parsed.embedding.enabled, false);
});

test('configure-embedding --interactive writes config for custom provider', async () => {
  const tempDir = makeTempDir();
  // Answers: provider=3 (custom), model=default, dimensions=default, base-url=required, api-key=blank, batch-size=default, enable=y
  const answers = ['3', '', '', 'https://my-api.example.com/v1', '', '', 'y'];

  const result = await runCli(['configure-embedding', '--interactive'], {
    cwd: tempDir,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  const parsed = readJsonc(configPath);
  assert.equal(parsed.embedding.provider, 'custom');
  assert.equal(parsed.embedding.baseUrl, 'https://my-api.example.com/v1');
  assert.equal(parsed.embedding.enabled, true);
});

test('configure-embedding --interactive cancels on q', async () => {
  const tempDir = makeTempDir();
  const answers = ['q'];

  const result = await runCli(['configure-embedding', '--interactive'], {
    cwd: tempDir,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /cancelled/i);
  const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
  assert.ok(!fs.existsSync(configPath), 'config file should NOT be created on cancel');
});
