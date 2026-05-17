import fs from 'node:fs';
import path from 'node:path';

import { inspectGlobalDoctor } from './doctor.js';
import { materializeGlobalInstall, repairKitLayout } from './materialize.js';
import { getGlobalPaths } from './paths.js';
import {
  ensureAstGrepInstalled,
  ensureSemgrepInstalled,
  isAstGrepAvailable,
  isSemgrepAvailable,
} from './tooling.js';

function hasManagedAstGrepShims(env) {
  const { toolingBinRoot } = getGlobalPaths({ env });
  return fs.existsSync(path.join(toolingBinRoot, 'ast-grep')) || fs.existsSync(path.join(toolingBinRoot, 'sg'));
}

const LAYER_A_REQUIRED_DIRS = ['commands', 'agents', 'skills'];

/**
 * Cheap heuristic to detect Layer A drift on an existing kit root.
 * Returns `true` if any of `<kitRoot>/{commands,agents,skills}/` is
 * missing or empty (ignoring dotfiles). Returns `false` only when all
 * three are present and contain at least one non-dot entry.
 *
 * Used by `ensureGlobalInstall` to decide whether to auto-run
 * `repairKitLayout` without triggering the full materialize+rollback
 * pipeline.
 *
 * Note: `context/` is intentionally not included in the drift check.
 * It is staged by `stageOpenCodeDiscoveryLayer` but is not required for
 * OpenCode slash-command discovery; its absence does not warrant a repair.
 *
 * @param {string} kitRoot Absolute path to the kit root.
 * @returns {boolean} `true` when at least one required dir is missing or empty.
 */
export function detectKitLayoutDrift(kitRoot) {
  for (const cls of LAYER_A_REQUIRED_DIRS) {
    const dir = path.join(kitRoot, cls);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return true;
    const entries = fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
    if (entries.length === 0) return true;
  }
  return false;
}

export function ensureGlobalInstall({
  projectRoot = process.cwd(),
  env = process.env,
  ensureAstGrep = ensureAstGrepInstalled,
  ensureSemgrep = ensureSemgrepInstalled,
} = {}) {
  const initialDoctor = inspectGlobalDoctor({ projectRoot, env });

  if (initialDoctor.status === 'install-invalid') {
    return { action: 'blocked', installed: false, doctor: initialDoctor };
  }

  if (initialDoctor.status === 'install-missing') {
    const install = materializeGlobalInstall({ env, ensureAstGrep, ensureSemgrep });
    const doctor = inspectGlobalDoctor({ projectRoot, env });
    return {
      action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'installed' : 'blocked',
      installed: true,
      install,
      doctor,
    };
  }

  const { kitRoot } = getGlobalPaths({ env });
  const layoutDrifted = detectKitLayoutDrift(kitRoot);
  const astGrepMissing = !hasManagedAstGrepShims(env) || !isAstGrepAvailable({ env });
  const semgrepMissing = !isSemgrepAvailable({ env });

  let repair = null;
  if (layoutDrifted) {
    repair = repairKitLayout({ kitRoot });
  }

  let tooling = null;
  if (astGrepMissing || semgrepMissing) {
    tooling = {
      astGrep: astGrepMissing ? ensureAstGrep({ env }) : null,
      semgrep: semgrepMissing ? ensureSemgrep({ env }) : null,
    };
  }

  if (!layoutDrifted && !astGrepMissing && !semgrepMissing) {
    return { action: 'none', installed: false, doctor: initialDoctor };
  }

  const doctor = inspectGlobalDoctor({ projectRoot, env });
  let action;
  if (repair && tooling) action = 'repaired-tooling-and-layout';
  else if (repair)       action = 'repaired-layout';
  else                   action = doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'repaired-tooling' : 'blocked';

  return {
    action,
    installed: false,
    doctor,
    ...(repair ? { repair } : {}),
    ...(tooling ? { tooling } : {}),
  };
}
