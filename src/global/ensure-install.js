import { inspectGlobalDoctor } from './doctor.js';
import { materializeGlobalInstall } from './materialize.js';
import {
  ensureAstGrepInstalled,
  ensureSemgrepInstalled,
  isAstGrepAvailable,
  isSemgrepAvailable,
} from './tooling.js';

export function ensureGlobalInstall({
  projectRoot = process.cwd(),
  env = process.env,
  ensureAstGrep = ensureAstGrepInstalled,
  ensureSemgrep = ensureSemgrepInstalled,
} = {}) {
  const initialDoctor = inspectGlobalDoctor({ projectRoot, env });

  if (initialDoctor.status === 'install-invalid') {
    return {
      action: 'blocked',
      installed: false,
      doctor: initialDoctor,
    };
  }

  if (initialDoctor.status !== 'install-missing') {
    const astGrepMissing = !isAstGrepAvailable({ env });
    const semgrepMissing = !isSemgrepAvailable({ env });

    if (!astGrepMissing && !semgrepMissing) {
      return {
        action: 'none',
        installed: false,
        doctor: initialDoctor,
      };
    }

    const tooling = {
      astGrep: astGrepMissing ? ensureAstGrep({ env }) : null,
      semgrep: semgrepMissing ? ensureSemgrep({ env }) : null,
    };
    const doctor = inspectGlobalDoctor({ projectRoot, env });

    return {
      action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues'
        ? 'repaired-tooling'
        : 'blocked',
      installed: false,
      doctor,
      tooling,
    };
  }

  const install = materializeGlobalInstall({ env, ensureAstGrep, ensureSemgrep });
  const doctor = inspectGlobalDoctor({ projectRoot, env });

  return {
    action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'installed' : 'blocked',
    installed: true,
    install,
    doctor,
  };
}
