import fs from 'node:fs';
import path from 'node:path';

export const LEVELS = ['debug', 'info', 'warning', 'error'];

export function getDiagnosticsPath(projectRoot) {
  return path.join(projectRoot, '.opencode', 'diagnostics.json');
}

/**
 * Log a diagnostic event. Never throws - errors are silently swallowed.
 *
 * Diagnostic logging is part of OpenKit's defensive error handling layer:
 * callers (often in catch blocks) must be able to log without fear of the
 * logger itself crashing and masking the original error. Any failure during
 * logging (filesystem errors, JSON serialization issues, etc.) is swallowed.
 *
 * @param {string} category - Event category (e.g., 'config_loading', 'project_detection')
 * @param {string} level - Event level. Expected values: 'debug', 'info', 'warning', 'error'
 *                         (see exported LEVELS constant). Free-form strings are accepted
 *                         but callers should prefer the documented enum for consistency.
 * @param {string} message - Human-readable event message
 * @param {object} [details={}] - Additional event details
 * @param {string} [projectRoot=process.cwd()] - Project root directory; diagnostics are
 *                                                written to <projectRoot>/.opencode/diagnostics.json
 * @returns {void}
 */
export function logDiagnostic(category, level, message, details = {}, projectRoot = process.cwd()) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details
    };

    appendToDiagnosticsFile(entry, projectRoot);
  } catch {
    // Swallow errors - logging should never crash
  }
}

function appendToDiagnosticsFile(entry, projectRoot) {
  const diagnosticsPath = getDiagnosticsPath(projectRoot);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(diagnosticsPath), { recursive: true });

  // Read existing diagnostics
  let diagnostics = { version: '1.0', events: [] };
  if (fs.existsSync(diagnosticsPath)) {
    try {
      const content = fs.readFileSync(diagnosticsPath, 'utf8');
      diagnostics = JSON.parse(content);
    } catch {
      // Corrupt file, start fresh
      diagnostics = { version: '1.0', events: [] };
    }
  }

  // Append new entry
  diagnostics.events.push(entry);

  // Rotate if too large (keep last 1000 events)
  if (diagnostics.events.length > 1000) {
    diagnostics.events = diagnostics.events.slice(-1000);
  }

  // Write back
  fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf8');
}
