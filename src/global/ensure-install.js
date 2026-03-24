import { inspectGlobalDoctor } from './doctor.js';
import { materializeGlobalInstall } from './materialize.js';

export function ensureGlobalInstall({ projectRoot = process.cwd(), env = process.env } = {}) {
  const initialDoctor = inspectGlobalDoctor({ projectRoot, env });

  if (initialDoctor.status === 'install-invalid') {
    return {
      action: 'blocked',
      installed: false,
      doctor: initialDoctor,
    };
  }

  if (initialDoctor.status !== 'install-missing') {
    return {
      action: 'none',
      installed: false,
      doctor: initialDoctor,
    };
  }

  const install = materializeGlobalInstall({ env });
  const doctor = inspectGlobalDoctor({ projectRoot, env });

  return {
    action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'installed' : 'blocked',
    installed: true,
    install,
    doctor,
  };
}
