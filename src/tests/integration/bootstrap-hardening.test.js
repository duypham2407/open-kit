import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectProjectRootWithDiagnostics } from '../../global/paths.js';
import { loadRuntimeConfigWithDiagnostics } from '../../runtime/runtime-config-loader.js';
import { getDiagnosticsPath } from '../../runtime/lib/diagnostics.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-integration-test-'));
}

function createTempProject(options = {}) {
  const tempDir = createTempDir();
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project' }));

  if (options.config) {
    const configPath = path.join(tempDir, '.opencode', 'openkit.runtime.jsonc');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(options.config));
  }

  // Provide an isolated, empty fake home so the loader's user-config step
  // cannot find a real ~/.config/openkit/config.jsonc on the host machine.
  const fakeHome = path.join(tempDir, '__fake_home__');
  fs.mkdirSync(fakeHome, { recursive: true });

  return { projectRoot: tempDir, fakeHome };
}

test('bootstrap flow with valid config - no crashes', () => {
  const { projectRoot, fakeHome } = createTempProject({
    config: {
      profiles: { default: 'opus' },
      mcps: { servers: [] },
    },
  });

  // Step 1: Detect project
  const projectResult = detectProjectRootWithDiagnostics(projectRoot);
  assert.equal(projectResult.valid, true);
  assert.equal(projectResult.path, projectRoot);

  // Step 2: Load config
  const configResult = loadRuntimeConfigWithDiagnostics(projectRoot, { home: fakeHome });
  assert.equal(configResult.success, true);
  assert.equal(configResult.source, 'project');
  assert.equal(configResult.data.profiles.default, 'opus');

  // Step 3: Verify diagnostics were logged
  const diagnosticsPath = getDiagnosticsPath(projectRoot);
  assert.equal(fs.existsSync(diagnosticsPath), true);

  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
  // At least one project_detection event + one config_loading event
  assert.ok(diagnostics.events.length >= 2,
    `expected at least 2 diagnostic events, got ${diagnostics.events.length}`);

  const detectionEvent = diagnostics.events.find((e) => e.category === 'project_detection');
  assert.notEqual(detectionEvent, undefined, 'expected project_detection event');

  const configEvent = diagnostics.events.find(
    (e) => e.category === 'config_loading' && e.level === 'info',
  );
  assert.notEqual(configEvent, undefined, 'expected info-level config_loading event');

  // Cleanup
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

test('bootstrap flow with missing config - graceful fallback', () => {
  const { projectRoot, fakeHome } = createTempProject(); // No config

  // Step 1: Detect project
  const projectResult = detectProjectRootWithDiagnostics(projectRoot);
  assert.equal(projectResult.valid, true);

  // Step 2: Load config (should fallback to defaults)
  const configResult = loadRuntimeConfigWithDiagnostics(projectRoot, { home: fakeHome });
  assert.equal(configResult.success, true);
  assert.equal(configResult.source, 'defaults');
  // Default profile from getDefaultRuntimeConfig
  assert.equal(configResult.data.profiles.default, 'sonnet');

  // Step 3: Verify warning diagnostic was logged for fallback
  const diagnosticsPath = getDiagnosticsPath(projectRoot);
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));

  const warningEvent = diagnostics.events.find(
    (e) => e.level === 'warning' && e.category === 'config_loading',
  );
  assert.notEqual(warningEvent, undefined,
    `expected a config_loading warning event, got: ${JSON.stringify(diagnostics.events)}`);
  // The fallback warning message describes falling back to default config.
  assert.match(warningEvent.message, /default/i);
  assert.equal(warningEvent.details.reason, 'no_usable_config_found');

  // Cleanup
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

test('bootstrap flow with invalid config - graceful fallback', () => {
  const { projectRoot, fakeHome } = createTempProject();
  const configPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '{ invalid json }');

  // Step 1: Detect project
  const projectResult = detectProjectRootWithDiagnostics(projectRoot);
  assert.equal(projectResult.valid, true);

  // Step 2: Load config (should fallback despite invalid JSON)
  const configResult = loadRuntimeConfigWithDiagnostics(projectRoot, { home: fakeHome });
  assert.equal(configResult.success, true);
  assert.equal(configResult.source, 'defaults');

  // Step 3: Verify parse error diagnostic was logged
  const diagnosticsPath = getDiagnosticsPath(projectRoot);
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));

  const parseErrorEvent = diagnostics.events.find(
    (e) => e.category === 'config_loading' && e.details && e.details.reason === 'parse_error',
  );
  assert.notEqual(parseErrorEvent, undefined,
    `expected a parse_error config_loading event, got: ${JSON.stringify(diagnostics.events)}`);
  assert.ok(['warning', 'error'].includes(parseErrorEvent.level),
    `expected warning or error level, got: ${parseErrorEvent.level}`);

  // Cleanup
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

test('bootstrap flow in nested directory - detects project root', () => {
  const { projectRoot, fakeHome } = createTempProject();
  const nestedDir = path.join(projectRoot, 'src', 'components');
  fs.mkdirSync(nestedDir, { recursive: true });

  // Start from nested directory
  const projectResult = detectProjectRootWithDiagnostics(nestedDir);
  assert.equal(projectResult.valid, true);
  assert.equal(projectResult.path, projectRoot); // Should detect root, not nested

  // Config loading should work from detected root
  const configResult = loadRuntimeConfigWithDiagnostics(projectResult.path, { home: fakeHome });
  assert.equal(configResult.success, true);

  // Cleanup
  fs.rmSync(projectRoot, { recursive: true, force: true });
});
