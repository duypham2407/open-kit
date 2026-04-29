#!/usr/bin/env node

import { createPromptAdapter, promptLine } from '../cli/commands/agent-model-selection.js';
import { getWorkspacePaths } from '../global/paths.js';
import { SessionProfileManager } from './managers/session-profile-manager.js';
import { normalizeRuntimeSessionId } from './runtime-session-id.js';
import { createSessionProfileSwitchTool } from './tools/models/session-profile-switch.js';

function formatProfiles(profiles = []) {
  if (profiles.length === 0) {
    return 'No global agent model profiles are available to switch.';
  }

  const lines = ['Available global agent model profiles:'];
  for (const [index, profile] of profiles.entries()) {
    const defaultMarker = profile.isDefault ? ' [default]' : '';
    const description = profile.description ? ` — ${profile.description}` : '';
    const roleLabel = profile.agentCount === 1 ? 'role' : 'roles';
    lines.push(`${index + 1}. ${profile.name}${defaultMarker} (${profile.agentCount} ${roleLabel})${description}`);
  }
  return lines.join('\n');
}

function printHelp(io, invocation = 'node .opencode/switch-profiles.js') {
  io.stdout.write(
    [
      'OpenKit switch profiles',
      '',
      'Usage:',
      `  ${invocation}`,
      '',
      'This command is interactive-only. It lists global profiles and applies the selected profile to this workspace session.',
      'It does not change the global default profile, edit profiles, delete profiles, or affect other sessions.',
    ].join('\n') + '\n'
  );
}

async function chooseProfileInteractively(profiles, io) {
  const rl = createPromptAdapter(io);
  try {
    io.stdout.write(`${formatProfiles(profiles)}\n`);
    while (true) {
      const response = await promptLine(rl, 'Select profile by number/name, or q to cancel: ');
      if (!response || response.toLowerCase() === 'q' || response.toLowerCase() === 'quit') {
        return null;
      }

      const asNumber = Number.parseInt(response, 10);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= profiles.length) {
        return profiles[asNumber - 1];
      }

      const direct = profiles.find((profile) => profile.name === response);
      if (direct) {
        return direct;
      }

      io.stderr.write('Unknown profile selection. Try again.\n');
    }
  } finally {
    rl.close();
  }
}

export async function runSwitchProfilesCli({
  argv = process.argv.slice(2),
  env = process.env,
  io = process,
  invocation = 'node .opencode/switch-profiles.js',
} = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp(io, invocation);
    return 0;
  }

  if (argv.length > 0) {
    io.stderr.write('Direct `/switch-profiles <name>` support is not available. Run without arguments for interactive selection.\n');
    return 1;
  }

  if (!normalizeRuntimeSessionId(env.OPENKIT_RUNTIME_SESSION_ID)) {
    io.stderr.write('/switch-profiles requires OPENKIT_RUNTIME_SESSION_ID for current-session scoping. Relaunch with `openkit run` and retry.\n');
    return 1;
  }

  const paths = getWorkspacePaths({ projectRoot: env.OPENKIT_PROJECT_ROOT ?? process.cwd(), env });
  const manager = new SessionProfileManager({
    projectRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    env,
  });
  const tool = createSessionProfileSwitchTool({ sessionProfileManager: manager });
  const listing = tool.execute({ action: 'list' });
  if (listing.status === 'empty') {
    io.stdout.write(`${listing.message}\n`);
    return 0;
  }

  const selected = await chooseProfileInteractively(listing.profiles, io);
  if (!selected) {
    const cancelled = tool.execute({ action: 'cancel' });
    io.stdout.write(`${cancelled.message}\n`);
    return 0;
  }

  const applied = tool.execute({ action: 'apply', profileName: selected.name });
  if (applied.status !== 'ok') {
    io.stderr.write(`${applied.message ?? 'Profile switch failed.'}\n`);
    return 1;
  }

  io.stdout.write(`Active session profile set to ${applied.activeProfile.name}.\n`);
  io.stdout.write('Global default profile was not changed. Other sessions are unaffected.\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSwitchProfilesCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
