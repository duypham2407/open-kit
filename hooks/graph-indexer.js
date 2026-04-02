#!/usr/bin/env node
/**
 * graph-indexer.js — Background graph indexing hook.
 *
 * Spawned detached from session-start.js to incrementally index the project
 * import graph without blocking session startup.  Reads environment variables
 * set by session-start to locate the project and kit roots.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(SCRIPT_DIR, '..');

const projectRoot = process.env.OPENKIT_PROJECT_ROOT
  ? path.resolve(process.env.OPENKIT_PROJECT_ROOT)
  : process.cwd();

const kitRoot = process.env.OPENKIT_KIT_ROOT
  ? path.resolve(process.env.OPENKIT_KIT_ROOT)
  : DEFAULT_KIT_ROOT;

const statePath = process.env.OPENKIT_WORKFLOW_STATE
  ? path.resolve(process.env.OPENKIT_WORKFLOW_STATE)
  : path.join(projectRoot, '.opencode', 'workflow-state.json');

const runtimeRoot = path.dirname(path.dirname(statePath));

async function run() {
  // Dynamically import the runtime modules from the kit root
  const syntaxIndexManagerPath = path.join(kitRoot, 'src', 'runtime', 'managers', 'syntax-index-manager.js');
  const projectGraphManagerPath = path.join(kitRoot, 'src', 'runtime', 'managers', 'project-graph-manager.js');

  let SyntaxIndexManager;
  let ProjectGraphManager;

  try {
    ({ SyntaxIndexManager } = await import(syntaxIndexManagerPath));
    ({ ProjectGraphManager } = await import(projectGraphManagerPath));
  } catch {
    // Modules not available — silently exit
    process.exit(0);
  }

  const syntaxIndexManager = new SyntaxIndexManager({ projectRoot });
  const graphManager = new ProjectGraphManager({ projectRoot, runtimeRoot, syntaxIndexManager });

  if (!graphManager.available) {
    process.exit(0);
  }

  try {
    await graphManager.indexProject({ maxFiles: 2000 });
  } catch {
    // Non-critical
  } finally {
    graphManager.dispose();
  }

  process.exit(0);
}

run().catch(() => process.exit(0));
