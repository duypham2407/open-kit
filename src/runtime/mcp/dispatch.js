import { spawn } from 'node:child_process';

function clampTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs)) {
    return 10_000;
  }
  return Math.max(250, Math.min(120_000, Math.trunc(timeoutMs)));
}

function canonicalKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeBuiltinAliases(builtin) {
  const aliases = new Set();
  aliases.add(canonicalKey(builtin.id));
  aliases.add(canonicalKey(builtin.name));
  for (const alias of builtin.aliases ?? []) {
    aliases.add(canonicalKey(alias));
  }
  return aliases;
}

export function normalizeExternalServers(servers = []) {
  return (Array.isArray(servers) ? servers : [])
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          id: entry,
          name: entry,
          transport: 'unknown',
          capabilities: [],
          tools: [],
          timeoutMs: 10_000,
          raw: entry,
          index,
        };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const name = entry.name ?? entry.id ?? `external-${index + 1}`;
      const transport = entry.transport ?? (entry.url ? 'http' : entry.command ? 'stdio' : 'unknown');
      return {
        id: entry.id ?? name,
        name,
        transport,
        url: entry.url ?? entry.endpoint ?? null,
        command: entry.command ?? null,
        args: Array.isArray(entry.args) ? entry.args : [],
        env: entry.env && typeof entry.env === 'object' ? entry.env : null,
        capabilities: Array.isArray(entry.capabilities) ? entry.capabilities.map(String) : [],
        tools: Array.isArray(entry.tools) ? entry.tools.map(String) : [],
        timeoutMs: clampTimeout(entry.timeoutMs ?? entry.timeout ?? 10_000),
        raw: entry,
        index,
      };
    })
    .filter(Boolean);
}

export function findExternalMcp(servers = [], { mcpName = null, capability = null } = {}) {
  const normalizedName = mcpName ? canonicalKey(mcpName) : null;
  const normalizedCapability = capability ? canonicalKey(capability) : null;

  if (normalizedName) {
    const direct = servers.find((server) => {
      const aliases = new Set([
        canonicalKey(server.id),
        canonicalKey(server.name),
        ...server.tools.map((entry) => canonicalKey(entry)),
      ]);
      return aliases.has(normalizedName);
    });
    if (direct) {
      return direct;
    }
  }

  if (normalizedCapability) {
    const byCapability = servers.find((server) =>
      server.capabilities.some((entry) => canonicalKey(entry) === normalizedCapability)
    );
    if (byCapability) {
      return byCapability;
    }
  }

  return null;
}

function invokeHttpExternal(server, input) {
  if (!server.url) {
    return Promise.resolve({
      status: 'unavailable',
      reason: `External MCP '${server.name}' is missing an HTTP URL.`,
      transport: 'http',
      source: 'external',
      mcp: server.name,
    });
  }

  const controller = new AbortController();
  const timeoutMs = server.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(server.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mcp: server.name,
      input,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      clearTimeout(timer);
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      if (!response.ok) {
        return {
          status: 'error',
          source: 'external',
          mcp: server.name,
          transport: 'http',
          httpStatus: response.status,
          error: typeof payload === 'string' ? payload : JSON.stringify(payload),
        };
      }

      if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.status) {
        return {
          ...payload,
          source: payload.source ?? 'external',
          mcp: payload.mcp ?? server.name,
          transport: payload.transport ?? 'http',
          server: server.name,
        };
      }

      return {
        status: 'ok',
        source: 'external',
        mcp: server.name,
        transport: 'http',
        server: server.name,
        result: payload,
      };
    })
    .catch((error) => {
      clearTimeout(timer);
      return {
        status: error?.name === 'AbortError' ? 'timeout' : 'error',
        source: 'external',
        mcp: server.name,
        transport: 'http',
        server: server.name,
        error: error instanceof Error ? error.message : String(error),
      };
    });
}

function invokeStdioExternal(server, input) {
  if (!server.command) {
    return Promise.resolve({
      status: 'unavailable',
      reason: `External MCP '${server.name}' is missing a stdio command.`,
      transport: 'stdio',
      source: 'external',
      mcp: server.name,
    });
  }

  return new Promise((resolve) => {
    const timeoutMs = server.timeoutMs ?? 10_000;
    const child = spawn(server.command, server.args ?? [], {
      env: {
        ...process.env,
        ...(server.env ?? {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let settled = false;
    let stdout = '';
    let stderr = '';

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        status: 'timeout',
        source: 'external',
        mcp: server.name,
        transport: 'stdio',
        server: server.name,
        error: `External MCP timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      finish({
        status: 'error',
        source: 'external',
        mcp: server.name,
        transport: 'stdio',
        server: server.name,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    child.on('close', (code) => {
      const trimmed = stdout.trim();
      if (code !== 0) {
        finish({
          status: 'error',
          source: 'external',
          mcp: server.name,
          transport: 'stdio',
          server: server.name,
          exitCode: code,
          error: stderr.trim() || 'External MCP process exited with a non-zero status.',
        });
        return;
      }

      if (!trimmed) {
        finish({
          status: 'ok',
          source: 'external',
          mcp: server.name,
          transport: 'stdio',
          server: server.name,
          result: null,
        });
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.status) {
          finish({
            ...parsed,
            source: parsed.source ?? 'external',
            mcp: parsed.mcp ?? server.name,
            transport: parsed.transport ?? 'stdio',
            server: server.name,
          });
          return;
        }

        finish({
          status: 'ok',
          source: 'external',
          mcp: server.name,
          transport: 'stdio',
          server: server.name,
          result: parsed,
        });
      } catch {
        finish({
          status: 'ok',
          source: 'external',
          mcp: server.name,
          transport: 'stdio',
          server: server.name,
          result: trimmed,
        });
      }
    });

    child.stdin.write(`${JSON.stringify({ mcp: server.name, input })}\n`);
    child.stdin.end();
  });
}

export async function invokeExternalMcp(server, input = {}) {
  if (!server) {
    return {
      status: 'unknown-mcp',
      source: 'external',
      reason: 'No external MCP server was selected.',
    };
  }

  if (server.transport === 'http') {
    return invokeHttpExternal(server, input);
  }

  if (server.transport === 'stdio') {
    return invokeStdioExternal(server, input);
  }

  return {
    status: 'unsupported-transport',
    source: 'external',
    mcp: server.name,
    server: server.name,
    transport: server.transport ?? 'unknown',
    reason: 'Supported transports are http and stdio.',
  };
}

export async function dispatchMcpCall(mcpPlatform, mcpName, input = {}) {
  const builtins = mcpPlatform?.builtin ?? [];
  const externalServers = mcpPlatform?.loadedServers ?? [];
  const enabledBuiltins = new Set(mcpPlatform?.enabledBuiltinIds ?? []);
  const requested = canonicalKey(mcpName);

  const builtin = builtins.find((entry) => {
    const aliases = normalizeBuiltinAliases(entry);
    return aliases.has(requested);
  });

  if (builtin) {
    const builtinAliases = normalizeBuiltinAliases(builtin);
    const isExplicitlyDisabled = enabledBuiltins.size > 0
      && ![...enabledBuiltins].some((entry) => builtinAliases.has(canonicalKey(entry)));
    if (isExplicitlyDisabled) {
      return {
        status: 'disabled',
        mcp: builtin.name,
        source: 'builtin',
        reason: `Builtin MCP '${builtin.name}' is disabled by runtime config.`,
      };
    }

    if (typeof builtin.execute !== 'function') {
      return {
        status: 'not-implemented',
        mcp: builtin.name,
        source: 'builtin',
      };
    }

    try {
      const result = await builtin.execute(input, { mcpPlatform, mcpName });
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        return {
          ...result,
          mcp: result.mcp ?? builtin.name,
          source: result.source ?? 'builtin',
          transport: result.transport ?? builtin.transport,
        };
      }

      return {
        status: 'ok',
        mcp: builtin.name,
        source: 'builtin',
        transport: builtin.transport,
        result,
      };
    } catch (error) {
      return {
        status: 'error',
        mcp: builtin.name,
        source: 'builtin',
        transport: builtin.transport,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const external = findExternalMcp(externalServers, { mcpName });
  if (external) {
    return invokeExternalMcp(external, input);
  }

  return {
    status: 'unknown-mcp',
    mcp: mcpName,
    input,
    available: [
      ...builtins.map((entry) => entry.name ?? entry.id).filter(Boolean),
      ...externalServers.map((entry) => entry.name ?? entry.id).filter(Boolean),
    ],
  };
}
