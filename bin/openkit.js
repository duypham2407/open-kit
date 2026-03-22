#!/usr/bin/env node

import { runCli } from '../src/cli/index.js';

const exitCode = await runCli(process.argv.slice(2));

if (typeof exitCode === 'number' && exitCode !== 0) {
  process.exit(exitCode);
}
