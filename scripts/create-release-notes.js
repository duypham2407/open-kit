#!/usr/bin/env node

import { createReleaseNotes, updateReleasesIndex } from '../src/release/workflow.js';

const [, , version, ...rest] = process.argv;

if (!version) {
  process.stderr.write('Usage: node scripts/create-release-notes.js <version> [--summary <text>]\n');
  process.exit(1);
}

const summaryIndex = rest.indexOf('--summary');
const summary = summaryIndex === -1 ? 'pending release summary' : rest[summaryIndex + 1] ?? 'pending release summary';

try {
  const created = createReleaseNotes(process.cwd(), version);
  updateReleasesIndex(process.cwd(), version, summary);
  process.stdout.write(`${created.created ? 'Created' : 'Reused'} ${created.notesPath}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
