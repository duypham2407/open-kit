#!/usr/bin/env node

import { syncVersionMetadata } from '../release/workflow.js';

try {
  const result = syncVersionMetadata(process.cwd());
  process.stdout.write(`Synced OpenKit version metadata to ${result.nextVersion}.\n`);
  process.stdout.write(`Changed files: ${result.changedFiles.length}\n`);
  for (const file of result.changedFiles) {
    process.stdout.write(`- ${file}\n`);
  }
} catch (error) {
  process.stderr.write(`${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
}
