#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'src', 'runtime', 'switch-profiles-cli.js');
const statePath = process.env.OPENKIT_WORKFLOW_STATE ?? path.join(projectRoot, '.opencode', 'workflow-state.json');
const runtimeSessionId = typeof process.env.OPENKIT_RUNTIME_SESSION_ID === 'string' && process.env.OPENKIT_RUNTIME_SESSION_ID.trim().length > 0
  ? process.env.OPENKIT_RUNTIME_SESSION_ID.trim()
  : null;

if (!runtimeSessionId) {
  process.stderr.write('/switch-profiles requires OPENKIT_RUNTIME_SESSION_ID for current-session scoping. Relaunch with `openkit run` and retry.\n');
  process.exit(1);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    OPENKIT_PROJECT_ROOT: process.env.OPENKIT_PROJECT_ROOT ?? projectRoot,
    OPENKIT_WORKFLOW_STATE: statePath,
    OPENKIT_KIT_ROOT: process.env.OPENKIT_KIT_ROOT ?? projectRoot,
    OPENKIT_RUNTIME_SESSION_ID: runtimeSessionId,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
