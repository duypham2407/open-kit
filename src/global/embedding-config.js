// ---------------------------------------------------------------------------
// Embedding Config Helpers
//
// Reads and writes the `embedding` section of the project-local runtime config
// file (.opencode/openkit.runtime.jsonc).  Mirrors the pattern used in
// agent-models.js for the global agent-model settings file.
//
// The runtime config is project-local (not global) so all reads/writes target
// the project root's .opencode/openkit.runtime.jsonc file.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

import { EMBEDDING_PROVIDERS } from '../runtime/types.js';

const PROJECT_RUNTIME_CONFIG = '.opencode/openkit.runtime.jsonc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripJsonComments(source) {
  let result = '';
  let inString = false;
  let isEscaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') { inLineComment = false; result += ch; }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inString) {
      result += ch;
      if (isEscaped) { isEscaped = false; continue; }
      if (ch === '\\') { isEscaped = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; result += ch; continue; }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    result += ch;
  }
  return result;
}

function stripTrailingCommas(source) {
  return source.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc(source) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(source)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveRuntimeConfigPath(projectRoot = process.cwd()) {
  return path.join(projectRoot, PROJECT_RUNTIME_CONFIG);
}

/**
 * Read the current `embedding` section from the project runtime config.
 * Returns the raw object from the file, or null if the file doesn't exist.
 *
 * @param {string} projectRoot
 * @returns {{ embedding: object | null, configPath: string, exists: boolean }}
 */
export function readEmbeddingConfig(projectRoot = process.cwd()) {
  const configPath = resolveRuntimeConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    return { embedding: null, configPath, exists: false };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = parseJsonc(raw);
    const embedding = isPlainObject(parsed?.embedding) ? parsed.embedding : null;
    return { embedding, configPath, exists: true };
  } catch {
    return { embedding: null, configPath, exists: true, parseError: true };
  }
}

/**
 * Write the `embedding` section into the project runtime config file.
 * Merges with any existing content; creates the file if absent.
 *
 * @param {string} projectRoot
 * @param {object} embeddingPatch  Partial embedding config to merge.
 */
export function writeEmbeddingConfig(projectRoot, embeddingPatch) {
  const configPath = resolveRuntimeConfigPath(projectRoot);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = parseJsonc(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // unreadable config — start fresh but preserve the file path
    }
  }

  const currentEmbedding = isPlainObject(existing.embedding) ? existing.embedding : {};
  const nextEmbedding = { ...currentEmbedding, ...embeddingPatch };

  const next = { ...existing, embedding: nextEmbedding };
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

/**
 * Clear the entire `embedding` section from the project runtime config.
 *
 * @param {string} projectRoot
 */
export function clearEmbeddingConfig(projectRoot) {
  const configPath = resolveRuntimeConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) return;

  let existing = {};
  try {
    existing = parseJsonc(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return;
  }

  const next = { ...existing };
  delete next.embedding;
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

/**
 * Validate an embedding config patch before writing.
 * Returns an array of error strings (empty = valid).
 *
 * @param {object} patch
 * @returns {string[]}
 */
export function validateEmbeddingPatch(patch) {
  const errors = [];

  if (patch.provider !== undefined && !EMBEDDING_PROVIDERS.includes(patch.provider)) {
    errors.push(`provider must be one of: ${EMBEDDING_PROVIDERS.join(', ')}`);
  }

  if (patch.dimensions !== undefined && (!Number.isInteger(patch.dimensions) || patch.dimensions <= 0)) {
    errors.push('dimensions must be a positive integer');
  }

  if (patch.batchSize !== undefined && (!Number.isInteger(patch.batchSize) || patch.batchSize <= 0)) {
    errors.push('batchSize must be a positive integer');
  }

  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') {
    errors.push('enabled must be true or false');
  }

  if (patch.provider === 'custom' && !patch.baseUrl) {
    errors.push('baseUrl is required when provider is "custom"');
  }

  return errors;
}

export { EMBEDDING_PROVIDERS };
