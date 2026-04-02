import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createMcpPlatform } from '../../src/runtime/mcp/index.js';
import { dispatchMcpCall, findExternalMcp, invokeExternalMcp, normalizeExternalServers } from '../../src/runtime/mcp/dispatch.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-mcp-dispatch-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('dispatchMcpCall invokes builtin execute when available', async () => {
  let invoked = false;
  const result = await dispatchMcpCall({
    builtin: [
      {
        id: 'mcp.echo',
        name: 'echo',
        aliases: ['echo-tool'],
        transport: 'builtin',
        async execute(input) {
          invoked = true;
          return { status: 'ok', payload: input };
        },
      },
    ],
    loadedServers: [],
    enabledBuiltinIds: [],
  }, 'echo-tool', { value: 1 });

  assert.equal(invoked, true);
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'builtin');
  assert.deepEqual(result.payload, { value: 1 });
});

test('dispatchMcpCall returns disabled when builtin is explicitly turned off', async () => {
  const result = await dispatchMcpCall({
    builtin: [{ id: 'mcp.websearch', name: 'websearch', transport: 'builtin', execute: async () => ({ status: 'ok' }) }],
    loadedServers: [],
    enabledBuiltinIds: ['mcp.code-search'],
  }, 'websearch', { query: 'openkit' });

  assert.equal(result.status, 'disabled');
  assert.equal(result.source, 'builtin');
});

test('dispatchMcpCall routes to external by name when builtin is missing', async () => {
  const projectRoot = makeTempDir();
  const scriptPath = path.join(projectRoot, 'mock-stdio-mcp.js');
  writeText(
    scriptPath,
    "process.stdin.on('data', (chunk) => { const req = JSON.parse(String(chunk).trim()); process.stdout.write(JSON.stringify({ status: 'ok', echoed: req.input.query })); process.exit(0); });"
  );

  const result = await dispatchMcpCall({
    builtin: [],
    loadedServers: [{
      id: 'external-web',
      name: 'external-web',
      transport: 'stdio',
      command: process.execPath,
      args: [scriptPath],
      capabilities: ['websearch'],
      tools: [],
      timeoutMs: 5000,
    }],
    enabledBuiltinIds: [],
  }, 'external-web', { query: 'openkit docs' });

  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'external');
  assert.equal(result.server, 'external-web');
  assert.equal(result.echoed, 'openkit docs');
});

test('findExternalMcp selects by capability and tool alias', () => {
  const servers = normalizeExternalServers([
    {
      name: 'docs-provider',
      transport: 'http',
      url: 'http://127.0.0.1:1',
      capabilities: ['docs-search'],
      tools: ['docs.query'],
    },
  ]);

  const byCapability = findExternalMcp(servers, { capability: 'docs-search' });
  assert.equal(byCapability?.name, 'docs-provider');

  const byTool = findExternalMcp(servers, { mcpName: 'docs.query' });
  assert.equal(byTool?.name, 'docs-provider');
});

test('invokeExternalMcp stdio transport handles timeout', async () => {
  const projectRoot = makeTempDir();
  const scriptPath = path.join(projectRoot, 'slow-stdio-mcp.js');
  writeText(
    scriptPath,
    "setTimeout(() => { process.stdout.write(JSON.stringify({ status: 'ok' })); process.exit(0); }, 5000);"
  );

  const result = await invokeExternalMcp({
    name: 'slow-server',
    transport: 'stdio',
    command: process.execPath,
    args: [scriptPath],
    timeoutMs: 300,
  }, { query: 'x' });

  assert.equal(result.status, 'timeout');
  assert.equal(result.transport, 'stdio');
});

test('createMcpPlatform builds normalized external servers and async dispatch', async () => {
  const projectRoot = makeTempDir();
  writeText(
    path.join(projectRoot, '.mcp.json'),
    JSON.stringify({
      servers: [
        {
          name: 'docs-provider',
          transport: 'http',
          url: 'http://127.0.0.1:9999/mcp',
          capabilities: ['docs-search'],
        },
      ],
    })
  );

  const platform = createMcpPlatform({
    projectRoot,
    env: {},
    config: {
      mcps: {
        builtin: {
          websearch: true,
          docsSearch: false,
          codeSearch: true,
        },
      },
    },
    sessionMemoryManager: {
      available: false,
      hasEmbeddingProvider: false,
      async semanticSearchQuery() {
        return [];
      },
    },
  });

  assert.equal(platform.loadedServers.length, 1);
  assert.equal(platform.loadedServers[0].name, 'docs-provider');
  assert.ok(platform.enabledBuiltinIds.includes('mcp.websearch'));
  assert.ok(platform.enabledBuiltinIds.includes('mcp.code-search'));

  const dispatchResult = await platform.dispatch('code-search', { query: 'symbol' });
  assert.equal(dispatchResult.mcp, 'code-search');
  assert.equal(typeof dispatchResult.status, 'string');
});

test('builtin docs-search and websearch return no-provider without configured external capability', async () => {
  const platform = createMcpPlatform({
    projectRoot: makeTempDir(),
    env: {},
    config: {},
    sessionMemoryManager: null,
  });

  const docs = await platform.dispatch('docs-search', { query: 'api reference' });
  const web = await platform.dispatch('websearch', { query: 'latest release' });

  assert.equal(docs.status, 'no-provider');
  assert.equal(web.status, 'no-provider');
});
