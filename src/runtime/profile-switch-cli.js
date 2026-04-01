#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { getWorkspacePaths } from '../global/paths.js';
import { AgentProfileSwitchManager } from './managers/agent-profile-switch-manager.js';
import { parseJsonc } from './tools/shared/jsonc-utils.js';

function readProfileCount(projectRoot, _env, agentId) {
  try {
    const runtimeConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');
    if (!fs.existsSync(runtimeConfigPath)) {
      return 0;
    }

    const parsed = parseJsonc(fs.readFileSync(runtimeConfigPath, 'utf8'));
    const profiles = parsed?.agents?.[agentId]?.profiles;
    return Array.isArray(profiles) ? profiles.length : 0;
  } catch {
    return 0;
  }
}

function printHelp() {
  process.stdout.write(
    [
      'OpenKit profile switch',
      '',
      'Usage:',
      '  node .opencode/profile-switch.js list',
      '  node .opencode/profile-switch.js <agent-id>',
      '  node .opencode/profile-switch.js <agent-id> <0|1>',
      '  node .opencode/profile-switch.js <agent-id> t',
      '  node .opencode/profile-switch.js <agent-id> c',
      '',
      'Long form:',
      '  node .opencode/profile-switch.js get --agent <agent-id>',
      '  node .opencode/profile-switch.js set --agent <agent-id> --profile <0|1>',
      '  node .opencode/profile-switch.js toggle --agent <agent-id>',
      '  node .opencode/profile-switch.js clear --agent <agent-id>',
      '',
      'Examples:',
      '  node .opencode/profile-switch.js list',
      '  node .opencode/profile-switch.js specialist.oracle',
      '  node .opencode/profile-switch.js specialist.oracle 1',
      '  node .opencode/profile-switch.js specialist.oracle t',
      '  node .opencode/profile-switch.js toggle --agent specialist.oracle',
      '  node .opencode/profile-switch.js set --agent specialist.oracle --profile 1',
    ].join('\n') + '\n'
  );
}

function parseArgs(argv = []) {
  if (argv.length === 0) {
    return {
      command: 'help',
      agentId: null,
      profileIndex: null,
    };
  }

  const first = argv[0];
  const knownCommands = new Set(['help', '--help', '-h', 'list', 'get', 'set', 'toggle', 'clear']);
  if (!knownCommands.has(first) && !first.startsWith('--')) {
    const shorthand = argv[1] ?? null;
    if (shorthand === null) {
      return {
        command: 'get',
        agentId: first,
        profileIndex: null,
      };
    }

    if (shorthand === 't' || shorthand === 'toggle') {
      return {
        command: 'toggle',
        agentId: first,
        profileIndex: null,
      };
    }

    if (shorthand === 'c' || shorthand === 'clear') {
      return {
        command: 'clear',
        agentId: first,
        profileIndex: null,
      };
    }

    const maybeIndex = Number.parseInt(shorthand, 10);
    if (Number.isInteger(maybeIndex)) {
      return {
        command: 'set',
        agentId: first,
        profileIndex: maybeIndex,
      };
    }
  }

  const parsed = {
    command: argv[0] ?? 'help',
    agentId: null,
    profileIndex: null,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--agent') {
      parsed.agentId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === '--profile') {
      parsed.profileIndex = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    }
  }

  return parsed;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h') {
    printHelp();
    return;
  }

  const paths = getWorkspacePaths({
    projectRoot: process.env.OPENKIT_PROJECT_ROOT ?? process.cwd(),
    env: process.env,
  });
  const manager = new AgentProfileSwitchManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
  });
  const profileCount = parsed.agentId ? readProfileCount(paths.projectRoot, process.env, parsed.agentId) : 0;

  if (parsed.command === 'list') {
    process.stdout.write(`${JSON.stringify({ status: 'ok', items: manager.list() }, null, 2)}\n`);
    return;
  }

  if (!parsed.agentId) {
    process.stderr.write('profile-switch requires --agent for this command.\n');
    process.exitCode = 1;
    return;
  }

  if (parsed.command === 'get') {
    process.stdout.write(`${JSON.stringify({ status: 'ok', selection: manager.get(parsed.agentId) }, null, 2)}\n`);
    return;
  }

  if (parsed.command === 'toggle') {
    process.stdout.write(`${JSON.stringify({ status: 'ok', selection: manager.toggle(parsed.agentId, profileCount || 2) }, null, 2)}\n`);
    return;
  }

  if (parsed.command === 'clear') {
    manager.clear(parsed.agentId);
    process.stdout.write(`${JSON.stringify({ status: 'ok', selection: null }, null, 2)}\n`);
    return;
  }

  if (parsed.command === 'set') {
    if (!Number.isInteger(parsed.profileIndex) || parsed.profileIndex < 0) {
      process.stderr.write('profile-switch set requires --profile <0|1>.\n');
      process.exitCode = 1;
      return;
    }
    if (profileCount > 0 && parsed.profileIndex >= profileCount) {
      process.stderr.write(`profile-switch set received an invalid profile for '${parsed.agentId}'.\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ status: 'ok', selection: manager.set(parsed.agentId, parsed.profileIndex, profileCount || 2) }, null, 2)}\n`);
    return;
  }

  process.stderr.write(`Unknown profile-switch command '${parsed.command}'.\n`);
  process.exitCode = 1;
}

main();
