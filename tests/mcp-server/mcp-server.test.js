import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const mcpBin = path.join(projectRoot, 'bin', 'openkit-mcp.js');

// ---------------------------------------------------------------------------
// Helpers: send JSON-RPC messages to the MCP server over stdio
// ---------------------------------------------------------------------------

function createMcpClient() {
  const child = spawn(process.execPath, [mcpBin], {
    cwd: projectRoot,
    env: { ...process.env, OPENKIT_PROJECT_ROOT: projectRoot },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  const pending = new Map();
  let nextId = 1;

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    // Parse newline-delimited JSON-RPC responses
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {
        // Ignore non-JSON lines (e.g. stderr redirected)
      }
    }
  });

  return {
    async send(method, params = {}) {
      const id = nextId++;
      const request = { jsonrpc: '2.0', id, method, params };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`MCP request ${method} timed out after 15s`));
        }, 15_000);
        pending.set(id, (msg) => {
          clearTimeout(timer);
          if (msg.error) {
            reject(new Error(`MCP error: ${JSON.stringify(msg.error)}`));
          } else {
            resolve(msg.result);
          }
        });
        child.stdin.write(JSON.stringify(request) + '\n');
      });
    },
    async close() {
      child.stdin.end();
      return new Promise((resolve) => {
        child.on('close', resolve);
        setTimeout(() => {
          child.kill();
          resolve();
        }, 3000);
      });
    },
    child,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('MCP server starts and responds to initialize', async () => {
  const client = createMcpClient();
  try {
    const result = await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    assert.ok(result.serverInfo, 'should have serverInfo');
    assert.equal(result.serverInfo.name, 'openkit');
    assert.ok(result.capabilities?.tools, 'should advertise tools capability');

    // Send initialized notification
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  } finally {
    await client.close();
  }
});

test('MCP server lists tools via tools/list', async () => {
  const client = createMcpClient();
  try {
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const result = await client.send('tools/list', {});
    assert.ok(Array.isArray(result.tools), 'should return tools array');
    assert.ok(result.tools.length > 0, 'should have at least one tool');

    // Check that key tools are present
    const toolNames = result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('tool.find-symbol'), 'should have tool.find-symbol');
    assert.ok(toolNames.includes('tool.semantic-search'), 'should have tool.semantic-search');
    assert.ok(toolNames.includes('tool.syntax-outline'), 'should have tool.syntax-outline');
    assert.ok(toolNames.includes('tool.import-graph'), 'should have tool.import-graph');

    // Check tool structure
    const findSymbol = result.tools.find((t) => t.name === 'tool.find-symbol');
    assert.ok(findSymbol.description, 'tool should have description');
    assert.ok(findSymbol.inputSchema, 'tool should have inputSchema');
    assert.equal(findSymbol.inputSchema.type, 'object');
    assert.ok(findSymbol.inputSchema.properties.name, 'find-symbol should have name property');
  } finally {
    await client.close();
  }
});

test('MCP server executes tool.find-symbol via tools/call', async () => {
  const client = createMcpClient();
  try {
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const result = await client.send('tools/call', {
      name: 'tool.find-symbol',
      arguments: { name: 'bootstrapRuntimeFoundation' },
    });

    assert.ok(Array.isArray(result.content), 'should return content array');
    assert.equal(result.content[0].type, 'text');
    const parsed = JSON.parse(result.content[0].text);
    // Graph may not be indexed — both 'ok' and 'unavailable' are valid responses
    assert.ok(['ok', 'unavailable'].includes(parsed.status), `status should be ok or unavailable, got ${parsed.status}`);
  } finally {
    await client.close();
  }
});

test('MCP server executes tool.import-graph status', async () => {
  const client = createMcpClient();
  try {
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const result = await client.send('tools/call', {
      name: 'tool.import-graph',
      arguments: { action: 'status' },
    });

    assert.ok(Array.isArray(result.content), 'should return content array');
    const parsed = JSON.parse(result.content[0].text);
    // status can be 'ok' or 'active' depending on graph state
    assert.ok(parsed.status, 'should have a status field');
  } finally {
    await client.close();
  }
});

test('MCP server returns error for unknown tool', async () => {
  const client = createMcpClient();
  try {
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const result = await client.send('tools/call', {
      name: 'tool.nonexistent',
      arguments: {},
    });

    assert.ok(result.isError, 'should signal error');
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.status, 'error');
    assert.match(parsed.reason, /Unknown tool/);
  } finally {
    await client.close();
  }
});

test('MCP server handles tool.find-symbol with missing required param', async () => {
  const client = createMcpClient();
  try {
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    client.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const result = await client.send('tools/call', {
      name: 'tool.find-symbol',
      arguments: {},
    });

    const parsed = JSON.parse(result.content[0].text);
    // When graph is unavailable, returns 'unavailable'; when available but missing name, returns 'error'
    assert.ok(['error', 'unavailable'].includes(parsed.status), `status should be error or unavailable, got ${parsed.status}`);
  } finally {
    await client.close();
  }
});
