import { materializeGlobalInstall } from '../../global/materialize.js';
import {
  ensureAstGrepInstalled,
  ensureSemgrepInstalled,
  isAstGrepAvailable,
  isCodemodAvailable,
  isSemgrepAvailable,
} from '../../global/tooling.js';

function installHelp() {
  return [
    'Usage: openkit install [options]',
    '',
    'Install the OpenKit global kit and provision all runtime tooling.',
    '',
    'This command ensures the global kit is materialized and that every',
    'runtime tool (ast-grep, semgrep, jscodeshift) is installed and',
    'verified before you run `openkit run`.',
    '',
    'Options:',
    '  --verify   Run a post-install verification check',
    '',
    'Recommended first-time flow:',
    '  openkit install',
    '  openkit run',
  ].join('\n');
}

function renderToolStatus(name, result) {
  if (!result) {
    return `  ${name}: skipped`;
  }
  if (result.installed) {
    return `  ${name}: installed (${result.toolingRoot})`;
  }
  const reason = result.reason ?? result.stderr ?? `exit code ${result.exitCode ?? 'unknown'}`;
  return `  ${name}: FAILED — ${reason}`;
}

const defaultInstallDeps = {
  env: process.env,
  materialize: materializeGlobalInstall,
  ensureAstGrep: ensureAstGrepInstalled,
  ensureSemgrep: ensureSemgrepInstalled,
  checkAstGrep: isAstGrepAvailable,
  checkSemgrep: isSemgrepAvailable,
  checkCodemod: isCodemodAvailable,
};

export const installCommand = {
  name: 'install',
  async run(args = [], io, context = {}) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${installHelp()}\n`);
      return 0;
    }

    const deps = { ...defaultInstallDeps, ...context.installDeps };
    const shouldVerify = args.includes('--verify');

    // Step 1: Materialize the global kit
    io.stdout.write('Installing OpenKit global kit...\n');

    const installResult = deps.materialize({
      env: deps.env,
      ensureAstGrep: deps.ensureAstGrep,
      ensureSemgrep: deps.ensureSemgrep,
    });

    io.stdout.write(`Kit root: ${installResult.kitRoot}\n`);
    io.stdout.write(`Profile root: ${installResult.profilesRoot}\n`);

    // Step 2: Report tooling results from materialize
    io.stdout.write('\nRuntime tooling:\n');
    io.stdout.write(`${renderToolStatus('ast-grep', installResult.tooling)}\n`);
    io.stdout.write(`${renderToolStatus('semgrep', installResult.semgrepTooling)}\n`);

    // Step 3: Check jscodeshift (bundled npm dependency, no install step)
    const codemodReady = deps.checkCodemod();
    io.stdout.write(`  jscodeshift: ${codemodReady ? 'available (bundled dependency)' : 'NOT FOUND — reinstall the openkit package'}\n`);

    // Step 4: Tally failures
    const failures = [];

    if (!installResult.tooling?.installed) {
      failures.push('ast-grep');
    }
    if (!installResult.semgrepTooling?.installed) {
      failures.push('semgrep');
    }
    if (!codemodReady) {
      failures.push('jscodeshift');
    }

    if (failures.length > 0) {
      io.stderr.write(`\nFailed to install: ${failures.join(', ')}\n`);
      if (failures.includes('semgrep')) {
        io.stderr.write('Semgrep requires python3 and pip. Install them and retry:\n');
        io.stderr.write('  macOS: brew install python3\n');
        io.stderr.write('  Ubuntu/Debian: sudo apt install python3 python3-pip\n');
        io.stderr.write('  Then run: openkit install\n');
      }
    } else {
      io.stdout.write('\nAll runtime tooling installed successfully.\n');
    }

    // Step 5: Optional verification
    if (shouldVerify) {
      io.stdout.write('\nVerifying installation...\n');

      const astGrepOk = deps.checkAstGrep({ env: deps.env });
      const semgrepOk = deps.checkSemgrep({ env: deps.env });
      const codemodOk = deps.checkCodemod();

      io.stdout.write(`  ast-grep: ${astGrepOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  semgrep:  ${semgrepOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  jscodeshift: ${codemodOk ? 'OK' : 'NOT FOUND'}\n`);

      const verifyFailures = [];
      if (!astGrepOk) verifyFailures.push('ast-grep');
      if (!semgrepOk) verifyFailures.push('semgrep');
      if (!codemodOk) verifyFailures.push('jscodeshift');

      if (verifyFailures.length > 0) {
        io.stderr.write(`\nVerification failed for: ${verifyFailures.join(', ')}\n`);
        io.stderr.write('Run `openkit doctor` for detailed diagnostics.\n');
        return 1;
      }

      io.stdout.write('Verification passed.\n');
    }

    if (failures.length > 0) {
      io.stdout.write('\nNext: fix the failures above, then run `openkit install` again.\n');
      return 1;
    }

    io.stdout.write('\nNext: run `openkit run` to launch OpenCode.\n');
    return 0;
  },
};
