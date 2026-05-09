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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../runtime/index.js';
import { startSessionLifecycle } from '../runtime/runtime-bootstrap.js';
import { loadRoleInstructions } from '../runtime/workflow/instruction-loader.js';
import { getValidNextStages, getStageOwner } from '../runtime/workflow/state-machine.js';
import { getAllowedTools } from '../runtime/workflow/role-permissions.js';
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

  // Start the per-session heartbeat ticker and shutdown handlers. The launcher
  // sets OPENKIT_SESSION_ID and pre-registers the sessions/index entry; we just
  // keep it alive (heartbeat) and mark it closed on shutdown.
  const sessionId = process.env.OPENKIT_SESSION_ID;
  const sessionBaseDir = path.join(runtime.projectRoot, '.opencode');
  startSessionLifecycle({
    baseDir: sessionBaseDir,
    sessionId,
    pid: process.pid,
  });

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
        resources: {},
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

  // --- MCP Resources ---
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'openkit://active-role-instructions',
        name: 'Active Role Instructions',
        description: 'Returns role-specific instructions for the current workflow stage and owner.',
        mimeType: 'text/markdown',
      },
      {
        uri: 'openkit://available-actions',
        name: 'Available Actions',
        description: 'Returns allowed tools and next stages for the current role.',
        mimeType: 'application/json',
      },
      {
        uri: 'openkit://workflow-status',
        name: 'Workflow Status',
        description: 'Returns current stage, owner, mode, and next steps.',
        mimeType: 'application/json',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const workflowKernel = runtime.managers?.workflowKernel;
    const stateResult = workflowKernel?.showState?.() ?? null;
    const state = stateResult?.state ?? stateResult ?? null;

    if (uri === 'openkit://active-role-instructions') {
      if (!state || !state.current_stage || !state.current_owner) {
        return {
          contents: [{
            uri,
            mimeType: 'text/markdown',
            text: '# No Active Workflow\n\nNo workflow state found. Start a workflow with /quick-task, /delivery, or /migrate.',
          }],
        };
      }

      const instructions = loadRoleInstructions(
        state.mode,
        state.current_stage,
        state.current_owner,
        { kitRoot: projectRoot },
      );

      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: instructions,
        }],
      };
    }

    if (uri === 'openkit://available-actions') {
      if (!state || !state.current_owner) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ status: 'no_workflow', allowedTools: [], nextStages: [] }, null, 2),
          }],
        };
      }

      const allowedTools = getAllowedTools(state.current_owner);
      const nextStages = getValidNextStages(state.mode, state.current_stage);

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            currentOwner: state.current_owner,
            currentStage: state.current_stage,
            mode: state.mode,
            allowedTools,
            nextStages,
            nextStageOwners: nextStages.map((s) => ({ stage: s, owner: getStageOwner(state.mode, s) })),
          }, null, 2),
        }],
      };
    }

    if (uri === 'openkit://workflow-status') {
      if (!state) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ status: 'no_workflow', message: 'No active workflow. Start one with /quick-task, /delivery, or /migrate.' }, null, 2),
          }],
        };
      }

      const nextStages = getValidNextStages(state.mode, state.current_stage);

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            mode: state.mode,
            currentStage: state.current_stage,
            currentOwner: state.current_owner,
            workItemId: state.work_item_id ?? null,
            title: state.title ?? null,
            validNextStages: nextStages,
            guidance: `You are ${state.current_owner} in ${state.current_stage}. Call tool.advance-stage to proceed.`,
          }, null, 2),
        }],
      };
    }

    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: `Unknown resource: ${uri}`,
      }],
    };
  });

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
