import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Import the plugin module to test its exported function
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.resolve(SCRIPT_DIR, '..', 'plugins', 'tool-enforcement.js');
const { ToolEnforcementPlugin } = await import(pluginPath);

// Helper to create a fake plugin context and run the before-hook
async function runBeforeHook(command, envOverrides = {}) {
  const originalEnv = { ...process.env };
  Object.assign(process.env, envOverrides);

  try {
    const plugin = await ToolEnforcementPlugin({
      project: {},
      client: { app: { log: async () => {} } },
      $: null,
      directory: '/tmp/test',
      worktree: '/tmp/test',
    });

    const output = { args: { command } };
    await plugin['tool.execute.before']({ tool: 'bash' }, output);
    return { blocked: false };
  } catch (error) {
    return { blocked: true, message: error.message };
  } finally {
    // Restore env
    for (const key of Object.keys(envOverrides)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Strict mode enforcement (default)
// ---------------------------------------------------------------------------

test('plugin blocks grep in strict mode', async () => {
  const result = await runBeforeHook('grep -r "TODO" src/', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('search'));
});

test('plugin blocks cat on .js files in strict mode', async () => {
  const result = await runBeforeHook('cat src/index.js', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('file-read'));
});

test('plugin blocks sed in strict mode', async () => {
  const result = await runBeforeHook('sed -i "s/old/new/g" file.ts', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('text-transform'));
});

test('plugin blocks find -name in strict mode', async () => {
  const result = await runBeforeHook('find . -name "*.ts" -type f', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('file-discovery'));
});

test('plugin blocks awk in strict mode', async () => {
  const result = await runBeforeHook("awk '{print $1}' data.json", { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
});

test('plugin blocks head with flags on source files in strict mode', async () => {
  const result = await runBeforeHook('head -20 src/runtime/tools/tool-registry.js', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('file-read-partial'));
});

// ---------------------------------------------------------------------------
// Allowed commands are never blocked
// ---------------------------------------------------------------------------

test('plugin allows git commands', async () => {
  const result = await runBeforeHook('git status', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin allows npm install', async () => {
  const result = await runBeforeHook('npm install lodash', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin allows node test', async () => {
  const result = await runBeforeHook('node --test .opencode/tests/*.test.js', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin allows docker build', async () => {
  const result = await runBeforeHook('docker build -t app .', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin allows mkdir', async () => {
  const result = await runBeforeHook('mkdir -p src/new-dir', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin blocks grep in migration mode too', async () => {
  const result = await runBeforeHook('grep -r "TODO" src/', { OPENKIT_WORKFLOW_MODE: 'migration' });
  assert.equal(result.blocked, true);
});

test('plugin blocks grep even with permissive override', async () => {
  const result = await runBeforeHook('grep -r "TODO" src/', { OPENKIT_ENFORCEMENT_LEVEL: 'permissive' });
  assert.equal(result.blocked, true);
});

test('plugin blocks default grep tool', async () => {
  const plugin = await ToolEnforcementPlugin({
    project: {},
    client: { app: { log: async () => {} } },
    $: null,
    directory: '/tmp/test',
    worktree: '/tmp/test',
  });
  await assert.rejects(
    () => plugin['tool.execute.before']({ tool: 'grep' }, { args: { pattern: 'foo' } }),
    /Blocked default tool: grep/,
  );
});

test('plugin blocks default glob tool', async () => {
  const plugin = await ToolEnforcementPlugin({
    project: {},
    client: { app: { log: async () => {} } },
    $: null,
    directory: '/tmp/test',
    worktree: '/tmp/test',
  });
  await assert.rejects(
    () => plugin['tool.execute.before']({ tool: 'glob' }, { args: { pattern: '**/*.js' } }),
    /Blocked default tool: glob/,
  );
});

// ---------------------------------------------------------------------------
// Non-bash tools are ignored
// ---------------------------------------------------------------------------

test('plugin ignores non-bash tools', async () => {
  const plugin = await ToolEnforcementPlugin({
    project: {},
    client: null,
    $: null,
    directory: '/tmp/test',
    worktree: '/tmp/test',
  });

  // Should not throw for read tool
  await plugin['tool.execute.before']({ tool: 'read' }, { args: { filePath: '/tmp/test.js' } });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('plugin handles missing command gracefully', async () => {
  const plugin = await ToolEnforcementPlugin({
    project: {},
    client: null,
    $: null,
    directory: '/tmp/test',
    worktree: '/tmp/test',
  });

  // Should not throw when command is missing
  await plugin['tool.execute.before']({ tool: 'bash' }, { args: {} });
  await plugin['tool.execute.before']({ tool: 'bash' }, { args: { command: '' } });
  await plugin['tool.execute.before']({ tool: 'bash' }, {});
});

test('plugin does not block cat on non-code files', async () => {
  const result = await runBeforeHook('cat server.log', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, false);
});

test('plugin blocks ls in strict mode', async () => {
  const result = await runBeforeHook('ls src/', { OPENKIT_ENFORCEMENT_LEVEL: 'strict' });
  assert.equal(result.blocked, true);
});
