import { inspectGlobalDoctor } from '../../global/doctor.js';
import { getDefaultToolAdapter } from '../../integrations/tool-adapters.js';
import { DEFAULT_ENTRY_COMMAND, listPrimaryEntryContracts } from '../../runtime/instruction-contracts.js';

function onboardHelp() {
  return [
    'Usage: openkit onboard',
    '',
    'Explain the safest first-run path for the current machine and project without launching OpenCode.',
  ].join('\n');
}

function renderLaneGuidance() {
  const lines = ['Primary entry commands:'];
  for (const contract of listPrimaryEntryContracts()) {
    lines.push(`- ${contract.command}: ${contract.whenToUse}`);
    lines.push(`  Next action: ${contract.nextAction}`);
  }
  return lines.join('\n');
}

function renderCapabilityGuidance(doctor) {
  const lines = ['Capability-guided next steps:'];
  const toolFamilies = doctor.runtimeDoctor?.capabilities?.toolFamilies ?? [];
  const browser = toolFamilies.find((entry) => entry.family === 'browser');
  const lsp = toolFamilies.find((entry) => entry.family === 'lsp');
  const continuation = doctor.runtimeFoundation?.runtimeInterface?.runtimeState?.continuation ?? null;

  if (browser) {
    lines.push(`- browser verification: ${browser.active > 0 ? 'available' : 'degraded'} via /browser-verify and the browser-automation skill`);
  }
  if (lsp) {
    lines.push(`- code intelligence: heuristic LSP tools are available for symbols, references, diagnostics, and rename preview`);
  }
  if (continuation) {
    lines.push(`- continuation control: status=${continuation.status}, remaining actions=${continuation.remainingActionCount ?? 0}`);
  }

  const commandCount = doctor.runtimeDoctor?.commands?.length ?? 0;
  const skillCount = doctor.runtimeDoctor?.skills?.length ?? 0;
  if (commandCount > 0 || skillCount > 0) {
    lines.push(`- compatibility loading: ${commandCount} commands and ${skillCount} skills were discovered from the current workspace/profile scopes`);
  }

  return lines.join('\n');
}

function renderSurfaceGuidance() {
  return [
    'Surface boundaries:',
    '- Preferred product path (global_cli): `npm install -g @duypham93/openkit` -> `openkit doctor` -> `openkit run`; maintain with `openkit upgrade` and `openkit uninstall`.',
    '- In-session workflow path (in_session): use `/task`, `/quick-task`, `/migrate`, or `/delivery` after OpenCode launches.',
    '- Compatibility runtime path (compatibility_runtime): use `node .opencode/workflow-state.js ...` for workflow-state inspection, resume, task-board, issue, and evidence diagnostics.',
    '- Validation split: OpenKit runtime checks are not target-project app validation; use target-project app validation only when that project defines build, lint, or test commands.',
  ].join('\n');
}

export const onboardCommand = {
  name: 'onboard',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${onboardHelp()}\n`);
      return 0;
    }

    const doctor = inspectGlobalDoctor({
      projectRoot: process.cwd(),
      env: process.env,
    });
    const adapter = getDefaultToolAdapter();

    const lines = [
      'OpenKit onboarding',
      `Supported tool: ${adapter?.name ?? 'unknown'}`,
      `Project root: ${doctor.workspacePaths.projectRoot}`,
      `Current doctor status: ${doctor.status}`,
      `Default entrypoint after launch: ${DEFAULT_ENTRY_COMMAND}`,
      '',
      'Recommended first steps:',
    ];

    if (doctor.status === 'install-missing') {
      lines.push('- Run `openkit run` to perform first-time setup and launch OpenCode.');
    } else if (!doctor.canRunCleanly) {
      lines.push('- Fix the doctor issues below before relying on the workspace.');
    } else {
      lines.push('- Run `openkit doctor` whenever you want to re-check global or workspace readiness.');
      lines.push('- Run `openkit run` to open OpenCode with the managed OpenKit profile.');
    }

    if (doctor.status === 'install-missing') {
      lines.push('- Run `openkit doctor` after setup if you want an explicit readiness check before relaunching.');
    }
    lines.push(`- Once OpenCode opens, start with ${DEFAULT_ENTRY_COMMAND} unless the lane is already obvious.`);
    lines.push('- If workflow state already exists later, use `node .opencode/workflow-state.js resume-summary` for a plain-language resume snapshot.');
    lines.push('- Use `openkit configure-agent-models --interactive` if you want agent-specific models before launch.');
    lines.push('');
    lines.push(renderLaneGuidance());
    lines.push('');
    lines.push(renderSurfaceGuidance());

    if (doctor.runtimeDoctor) {
      lines.push('');
      lines.push(renderCapabilityGuidance(doctor));
    }

    if (doctor.issues.length > 0) {
      lines.push('');
      lines.push('Current issues:');
      for (const issue of doctor.issues) {
        lines.push(`- ${issue}`);
      }
    }

    io.stdout.write(`${lines.join('\n')}\n`);
    return doctor.status === 'install-missing' || doctor.canRunCleanly ? 0 : 1;
  },
};
