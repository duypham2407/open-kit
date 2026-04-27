import net from 'node:net';
import path from 'node:path';

import { isCommandAvailable } from '../../command-detection.js';
import { getMcpCatalogEntry } from '../../capabilities/mcp-catalog.js';

const CUSTOM_ID_PATTERN = /^[a-z][a-z0-9_-]{1,62}$/u;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const PLACEHOLDER_PATTERN = /^\$\{([A-Z][A-Z0-9_]*)\}$/u;
const SHELL_OPERATORS = ['&&', '||', ';', '|', '>', '<', '`', '$(', '\n', '\r'];
const SHELL_LAUNCHERS = new Set(['sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh']);
const SHELL_EXEC_FLAGS = new Set(['-c', '/c', '-command', '-encodedcommand']);
const SECRET_KEY_PATTERN = /(?:token|secret|password|api[_-]?key|authorization|cookie)/iu;
const SECRET_VALUE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/u,
  /^Bearer\s+\S+/iu,
  /(?:token|secret|password|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s}$]+/iu,
];
const SUPPORTED_TRANSPORTS = new Set(['http', 'sse', 'streamable-http']);
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);

function redact(value) {
  if (typeof value !== 'string') {
    return value;
  }
  let next = value.replace(/sk-[A-Za-z0-9_-]{8,}/gu, '[REDACTED_SECRET]');
  next = next.replace(/Bearer\s+\S+/giu, 'Bearer [REDACTED_SECRET]');
  next = next.replace(/((?:token|secret|password|api[_-]?key|authorization|cookie)\s*[:=]\s*)[^\s}$]+/giu, '$1[REDACTED_SECRET]');
  return next;
}

function sanitizeMessages(messages) {
  return messages.map((message) => redact(String(message)));
}

function hasRawSecret(value, key = '') {
  if (typeof value === 'string') {
    if (PLACEHOLDER_PATTERN.test(value)) {
      return false;
    }
    if (SECRET_KEY_PATTERN.test(key) && value.length > 0) {
      return true;
    }
    return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasRawSecret(entry, key));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([childKey, childValue]) => hasRawSecret(childValue, childKey));
  }
  return false;
}

function collectPlaceholderBindings(values = {}, { source = 'custom', labelPrefix = 'Custom MCP' } = {}) {
  const bindings = [];
  for (const [name, value] of Object.entries(values ?? {})) {
    const match = typeof value === 'string' ? value.match(PLACEHOLDER_PATTERN) : null;
    if (match) {
      bindings.push({
        id: name.toLowerCase().replace(/_/g, '-'),
        envVar: match[1],
        label: `${labelPrefix} ${name}`,
        required: true,
        placeholder: `\${${match[1]}}`,
        source,
      });
    }
  }
  return bindings;
}

function validateCustomId(id, errors) {
  const normalized = String(id ?? '').trim();
  if (!normalized) {
    errors.push('Custom MCP id is required.');
    return normalized;
  }
  if (!CUSTOM_ID_PATTERN.test(normalized)) {
    errors.push(`Custom MCP id '${redact(normalized)}' must match ${CUSTOM_ID_PATTERN}.`);
  }
  if (getMcpCatalogEntry(normalized)) {
    errors.push(`Custom MCP id '${normalized}' collides with a bundled MCP id; use bundled MCP commands instead.`);
  }
  return normalized;
}

function normalizeEnvironment(environment = {}, errors) {
  const normalized = {};
  for (const [key, value] of Object.entries(environment ?? {})) {
    if (!ENV_NAME_PATTERN.test(key)) {
      errors.push(`Environment variable '${redact(key)}' must be uppercase with underscores.`);
      continue;
    }
    if (typeof value !== 'string' || !PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`Environment variable '${key}' must use a placeholder such as \${${key}}; raw secret values are not allowed.`);
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

function hasShellOperator(value) {
  return SHELL_OPERATORS.some((operator) => value.includes(operator));
}

function executableName(command) {
  return path.basename(String(command ?? '')).toLowerCase().replace(/\.(exe|cmd|bat|com)$/u, '');
}

function buildResult({ errors, warnings, normalizedDefinition = null, secretBindings = [], riskWarnings = [] }) {
  const status = errors.length > 0 ? 'invalid' : 'valid';
  return {
    status,
    errors: sanitizeMessages(errors),
    warnings: sanitizeMessages(warnings),
    normalizedDefinition: status === 'valid' ? normalizedDefinition : null,
    secretBindings: status === 'valid' ? dedupeBindings(secretBindings) : [],
    riskWarnings: sanitizeMessages([...new Set(riskWarnings)]),
  };
}

function dedupeBindings(bindings = []) {
  const byEnvVar = new Map();
  for (const binding of bindings) {
    byEnvVar.set(binding.envVar, binding);
  }
  return [...byEnvVar.values()];
}

export function validateLocalCustomMcpDefinition(input = {}, { env = process.env } = {}) {
  const errors = [];
  const warnings = [];
  const id = validateCustomId(input.id, errors);
  const command = Array.isArray(input.command) ? input.command.map((part) => String(part)) : null;

  if (!command || command.length === 0 || !command[0]) {
    errors.push('Local custom MCP command must be an argv array with a non-empty executable.');
  } else {
    for (const part of command) {
      if (hasShellOperator(part)) {
        errors.push('Local custom MCP command argv contains a shell operator or command substitution token; use argv elements only.');
        break;
      }
    }
    const launcher = executableName(command[0]);
    if (SHELL_LAUNCHERS.has(launcher) && command.slice(1).some((part) => SHELL_EXEC_FLAGS.has(part.toLowerCase()))) {
      errors.push('Local custom MCP command cannot use a shell launcher for command-string execution.');
    }
    if (command.some((part) => hasRawSecret(part))) {
      errors.push('Local custom MCP command contains raw secret-looking values; use placeholders or secret bindings.');
    }
    if (command[0] && !command[0].includes('/') && !isCommandAvailable(command[0], { env })) {
      warnings.push(`Executable '${command[0]}' was not found on PATH in the current environment.`);
    }
    if (command[0] && (command[0].includes(' ') || command[0].startsWith('.'))) {
      warnings.push('Local custom MCP executable path may be environment-dependent; verify it before enabling globally.');
    }
  }

  if (hasRawSecret(input.environment ?? {})) {
    errors.push('Local custom MCP environment contains raw secret values; use placeholder-only values.');
  }
  const environment = normalizeEnvironment(input.environment ?? {}, errors);
  if (input.cwd) {
    warnings.push('Custom cwd changes execution context; verify path safety before testing.');
  }
  warnings.push('Local custom MCP execution can run code on this machine. Test only trusted servers.');

  return buildResult({
    errors,
    warnings,
    normalizedDefinition: {
      type: 'local',
      command: command ?? [],
      cwd: input.cwd ?? null,
      environment,
    },
    secretBindings: collectPlaceholderBindings(environment, { labelPrefix: input.displayName ?? id }),
    riskWarnings: ['Local custom MCP execution can run code on this machine. Test only trusted servers.'],
  });
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function isPrivateNetworkHost(hostname) {
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const [first, second] = hostname.split('.').map((value) => Number(value));
    return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  }
  return hostname.endsWith('.local');
}

function hasTokenQuery(url) {
  for (const [key, value] of url.searchParams.entries()) {
    if (SECRET_KEY_PATTERN.test(key)) {
      return true;
    }
    if (hasRawSecret(value)) {
      return true;
    }
  }
  return false;
}

function normalizeHeaders(headers = {}, errors) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value !== 'string' || !PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`Header '${redact(key)}' must use a placeholder-only value; raw header secrets are not allowed.`);
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

export function validateRemoteCustomMcpDefinition(input = {}) {
  const errors = [];
  const warnings = [];
  const id = validateCustomId(input.id, errors);
  const transport = input.transport ?? 'streamable-http';
  let parsedUrl = null;

  if (!SUPPORTED_TRANSPORTS.has(transport)) {
    errors.push(`Remote custom MCP transport '${redact(transport)}' is unsupported.`);
  }

  try {
    parsedUrl = new URL(String(input.url ?? ''));
  } catch {
    errors.push('Remote custom MCP URL must be syntactically valid.');
  }

  if (parsedUrl) {
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      errors.push(`Remote custom MCP URL scheme '${parsedUrl.protocol}' is unsupported.`);
    }
    if (parsedUrl.username || parsedUrl.password) {
      errors.push('Remote custom MCP URL cannot contain embedded credentials.');
    }
    if (hasTokenQuery(parsedUrl)) {
      errors.push('Remote custom MCP URL cannot contain token-like query parameters.');
    }
    if (BLOCKED_HOSTS.has(parsedUrl.hostname)) {
      errors.push('Remote custom MCP URL targets a blocked metadata-service host.');
    }
    if (parsedUrl.protocol === 'http:' && !isLocalhost(parsedUrl.hostname)) {
      errors.push('Remote custom MCP URL must use https except for localhost loopback development.');
    }
    if (parsedUrl.protocol === 'http:' && isLocalhost(parsedUrl.hostname)) {
      warnings.push('localhost HTTP is allowed only as a local-development exception.');
    }
    if (isPrivateNetworkHost(parsedUrl.hostname) && !isLocalhost(parsedUrl.hostname)) {
      warnings.push('Remote custom MCP URL targets a private-network host; verify trust and network boundaries.');
    }
  }

  if (hasRawSecret(input.headers ?? {}) || hasRawSecret(input.environment ?? {})) {
    errors.push('Remote custom MCP headers or environment contain raw secret values; use placeholder-only values.');
  }
  const headers = normalizeHeaders(input.headers ?? {}, errors);
  const environment = normalizeEnvironment(input.environment ?? {}, errors);

  return buildResult({
    errors,
    warnings,
    normalizedDefinition: {
      type: 'remote',
      transport,
      url: parsedUrl ? parsedUrl.toString() : String(input.url ?? ''),
      headers,
      environment,
    },
    secretBindings: [
      ...collectPlaceholderBindings(headers, { labelPrefix: input.displayName ?? id }),
      ...collectPlaceholderBindings(environment, { labelPrefix: input.displayName ?? id }),
    ],
    riskWarnings: warnings,
  });
}

function convertRawSecretFieldsToPlaceholders(entry) {
  let converted = false;
  function visit(value, key = '') {
    if (typeof value === 'string') {
      if (PLACEHOLDER_PATTERN.test(value)) {
        return value;
      }
      if (SECRET_KEY_PATTERN.test(key) || SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
        converted = true;
        const envVar = ENV_NAME_PATTERN.test(key) ? key : key.toUpperCase().replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '') || 'CUSTOM_MCP_SECRET';
        return `\${${envVar}}`;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, key));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]));
    }
    return value;
  }
  return { value: visit(entry), converted };
}

function inferGlobalEntryKind(entry) {
  if (entry?.type === 'local' || Array.isArray(entry?.command)) {
    return 'local';
  }
  if (entry?.type === 'remote' || entry?.url || entry?.endpoint) {
    return 'remote';
  }
  return 'unsupported';
}

export function normalizeImportedGlobalMcpEntry(globalId, sourceEntry = {}, { customId = globalId, enabled = { openkit: true, global: false } } = {}) {
  const { value: sanitizedSource, converted } = convertRawSecretFieldsToPlaceholders(sourceEntry);
  const kind = inferGlobalEntryKind(sanitizedSource);
  if (kind === 'unsupported') {
    return { outcome: 'unsupported', globalId, customId, reason: 'unsupported global MCP shape' };
  }

  const validation = kind === 'local'
    ? validateLocalCustomMcpDefinition({
      id: customId,
      displayName: sanitizedSource.displayName ?? sanitizedSource.name ?? customId,
      command: sanitizedSource.command,
      cwd: sanitizedSource.cwd ?? null,
      environment: sanitizedSource.environment ?? sanitizedSource.env ?? {},
    })
    : validateRemoteCustomMcpDefinition({
      id: customId,
      displayName: sanitizedSource.displayName ?? sanitizedSource.name ?? customId,
      url: sanitizedSource.url ?? sanitizedSource.endpoint,
      transport: sanitizedSource.transport ?? (SUPPORTED_TRANSPORTS.has(sanitizedSource.type) ? sanitizedSource.type : 'streamable-http'),
      headers: sanitizedSource.headers ?? {},
      environment: sanitizedSource.environment ?? sanitizedSource.env ?? {},
    });

  if (validation.status !== 'valid') {
    return { outcome: 'invalid', globalId, customId, errors: validation.errors, warnings: validation.warnings };
  }

  return {
    outcome: converted ? 'needs_secret_setup' : 'imported',
    globalId,
    customId,
    entry: {
      id: customId,
      displayName: sanitizedSource.displayName ?? sanitizedSource.name ?? customId,
      origin: 'imported-global',
      ownership: 'openkit-managed-custom',
      enabled,
      definition: validation.normalizedDefinition,
      secretBindings: validation.secretBindings,
      riskWarnings: validation.riskWarnings,
      validationWarnings: validation.warnings,
    },
    warnings: validation.warnings,
  };
}

export { PLACEHOLDER_PATTERN };
