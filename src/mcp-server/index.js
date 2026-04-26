#!/usr/bin/env node
// ---------------------------------------------------------------------------
// src/mcp-server/index.js
//
// MCP server that exposes the OpenKit runtime tool registry to OpenCode.
// Communicates over stdio using the Model Context Protocol.
//
// Usage:
//   node src/mcp-server/index.js [--project-root <path>]
//
// Environment:
//   OPENKIT_PROJECT_ROOT  — project root override (fallback: cwd)
// ---------------------------------------------------------------------------

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { bootstrapRuntimeFoundation } from '../runtime/index.js';
import { parseServerArgs } from './args.js';
import { TOOL_SCHEMAS, getMcpExposedToolIds } from './tool-schemas.js';

async function main() {
  const { projectRoot } = parseServerArgs(process.argv.slice(2), process.env);

  const originalConsoleLog = console.log;
  console.log = (...args) => console.error('[openkit-mcp]', ...args);

  let runtime;
  try {
    runtime = bootstrapRuntimeFoundation({
      projectRoot,
      env: process.env,
      mode: 'read-only',
    });
  } catch (err) {
    console.error('Failed to bootstrap OpenKit runtime:', err.message);
    process.exit(1);
  }

  const exposedIds = getMcpExposedToolIds();
  const toolMap = runtime.tools.tools;

  const mcpTools = [];
  for (const [id, tool] of Object.entries(toolMap)) {
    if (!exposedIds.has(id)) continue;
    const schema = TOOL_SCHEMAS[id];
    if (!schema) continue;

    mcpTools.push({
      name: id,
      description: schema.description,
      inputSchema: schema.inputSchema,
      _execute: tool.execute,
    });
  }

  const server = new Server(
    {
      name: 'openkit',
      version: runtime.configResult?.config?.version ?? '0.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = mcpTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', reason: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      let input = args ?? {};
      if (name === 'tool.look-at' && typeof input === 'object' && input.filePath) {
        input = input.filePath;
      }

      const result = await tool._execute(input);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const isError = result?.status && /error|unavailable|blocked/i.test(result.status);

      return {
        content: [{ type: 'text', text }],
        isError: isError || false,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', reason: err.message }) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log = originalConsoleLog;
  console.error(`[openkit-mcp] Server started — ${mcpTools.length} tools exposed for project: ${projectRoot}`);
}

main().catch((err) => {
  console.error('[openkit-mcp] Fatal:', err);
  process.exit(1);
});
