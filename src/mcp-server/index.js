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

function isDirectScanToolName(name) {
  return name === 'tool.rule-scan' || name === 'tool.security-scan';
}

function createUnknownScanToolResult(name) {
  const scanKind = name === 'tool.security-scan' ? 'security' : 'rule';
  return {
    status: 'unregistered',
    capabilityState: 'unavailable',
    validationSurface: 'runtime_tooling',
    toolId: name,
    scanKind,
    provider: 'semgrep',
    availability: {
      state: 'unavailable',
      reason: `${name} is not registered in this MCP runtime tool namespace.`,
      fallback: 'Refresh or restart the active OpenCode/OpenKit runtime, then retry the direct scan tool. If the active session remains stale, record substitute_scan or manual_override evidence with this namespace caveat.',
      staleProcessHint: {
        suspected: true,
        surface: 'in_session',
        refresh: 'Restart/reload the OpenCode session or refresh the global OpenKit install so the role namespace reconnects to a fresh MCP tool list.',
      },
    },
    resultState: 'unavailable',
    findingCount: 0,
    severitySummary: {},
    triageSummary: {
      groupCount: 0,
      blockingCount: 0,
      truePositiveCount: 0,
      nonBlockingNoiseCount: 0,
      falsePositiveCount: 0,
      followUpCount: 0,
      unclassifiedCount: 0,
      groups: [],
    },
    falsePositiveSummary: { count: 0, items: [] },
    artifactRefs: [],
    limitations: ['The direct scan tool call reached MCP but did not resolve to a registered OpenKit runtime tool.'],
    evidenceHint: {
      evidenceType: 'direct_tool',
      source: name,
      kind: 'automated',
      validationSurface: 'runtime_tooling',
    },
    details: {
      validation_surface: 'runtime_tooling',
      scan_evidence: {
        evidence_type: 'direct_tool',
        direct_tool: {
          tool_id: name,
          availability_state: 'unavailable',
          result_state: 'unavailable',
          reason: `${name} is not registered in this MCP runtime tool namespace.`,
          invocation_ref: null,
          namespace_status: 'unknown_tool',
          stale_process: {
            suspected: true,
            affected_surface: 'in_session',
            caveat: 'Direct scan call reached MCP but the active namespace did not expose the tool; refresh/restart OpenCode/OpenKit before claiming global absence.',
          },
        },
        substitute: null,
        scan_kind: scanKind,
        target_scope_summary: 'direct scan tool was not registered in MCP namespace',
        rule_config_source: 'bundled',
        finding_counts: {
          total: 0,
          blocking: 0,
          true_positive: 0,
          non_blocking_noise: 0,
          false_positive: 0,
          follow_up: 0,
          unclassified: 0,
        },
        severity_summary: {},
        triage_summary: {
          groupCount: 0,
          blockingCount: 0,
          truePositiveCount: 0,
          nonBlockingNoiseCount: 0,
          falsePositiveCount: 0,
          followUpCount: 0,
          unclassifiedCount: 0,
          groups: [],
        },
        false_positive_summary: { count: 0, items: [] },
        manual_override: null,
        artifact_refs: [],
      },
    },
  };
}

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
      if (isDirectScanToolName(name)) {
        const result = createUnknownScanToolResult(name);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: true,
        };
      }

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
