#!/usr/bin/env node
// ---------------------------------------------------------------------------
// bin/openkit-mcp.js
//
// Entry point for the OpenKit MCP server.
// Spawned by OpenCode as a local MCP server (stdio transport).
//
// Audit fix [2-L-3]: previously this file was a single bare import. If the
// MCP server crashed during module evaluation the parent process saw a
// silent stdio disconnect with no diagnostic. Now we wrap the import in a
// top-level try and emit a structured stderr line on failure before
// exiting non-zero, so OpenCode can show an operator-readable error.
// ---------------------------------------------------------------------------

try {
  await import('../mcp-server/index.js');
} catch (err) {
  const message = err?.message ?? String(err);
  process.stderr.write(`openkit-mcp: failed to start MCP server — ${message}\n`);
  if (err?.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
}
