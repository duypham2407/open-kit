import { materializeGlobalInstall } from '../../global/materialize.js';
import {
  ensureAstGrepInstalled,
  ensureSemgrepInstalled,
  isAstGrepAvailable,
  isBetterSqliteAvailable,
  isCodemodAvailable,
  isSemgrepAvailable,
  isSyntaxParsingAvailable,
} from '../../global/tooling.js';

function installHelp() {
  return [
    'Usage: openkit install [options]',
    '',
    'Compatibility alias for manual global setup with runtime tooling verification.',
    'Most users should run `openkit run`.',
    '',
    'Install the OpenKit global kit and provision all runtime tooling.',
    '',
    'This command ensures the global kit is materialized and that every',
    'runtime tooling (ast-grep, semgrep) and bundled runtime packages',
    '(`better-sqlite3`, `jscodeshift`, `web-tree-sitter`, tree-sitter grammars)',
    'are provisioned and verified before you run `openkit run`.',
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
  checkBetterSqlite: isBetterSqliteAvailable,
  checkSyntaxParsing: isSyntaxParsingAvailable,
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
    io.stdout.write('Installed OpenKit globally.\n');

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
    const runtimeDeps = installResult.runtimeDependencies;
    if (runtimeDeps?.provisioned) {
      io.stdout.write(`  managed node_modules: ${runtimeDeps.mode} (${runtimeDeps.target})\n`);
    } else {
      const reason = runtimeDeps?.reason ?? 'failed to provision bundled runtime dependencies';
      io.stdout.write(`  managed node_modules: FAILED — ${reason}\n`);
    }

    // Step 3: Check bundled npm runtime dependencies
    const codemodReady = deps.checkCodemod();
    const betterSqliteReady = deps.checkBetterSqlite();
    const syntaxParsingReady = deps.checkSyntaxParsing();
    io.stdout.write(`  jscodeshift: ${codemodReady ? 'available (bundled dependency)' : 'NOT FOUND — reinstall the openkit package'}\n`);
    io.stdout.write(`  better-sqlite3: ${betterSqliteReady ? 'available (bundled native dependency)' : 'NOT FOUND — reinstall the openkit package to rebuild native addons'}\n`);
    io.stdout.write(`  syntax parsers: ${syntaxParsingReady ? 'available (bundled dependencies)' : 'NOT FOUND — reinstall the openkit package'}\n`);

    // Step 4: Tally failures
    const failures = [];

    if (!installResult.tooling?.installed) {
      failures.push('ast-grep');
    }
    if (!installResult.semgrepTooling?.installed) {
      failures.push('semgrep');
    }
    if (!runtimeDeps?.provisioned) {
      failures.push('managed-node-modules');
    }
    if (!codemodReady) {
      failures.push('jscodeshift');
    }
    if (!betterSqliteReady) {
      failures.push('better-sqlite3');
    }
    if (!syntaxParsingReady) {
      failures.push('syntax-parser-packages');
    }

    if (failures.length > 0) {
      io.stderr.write(`\nFailed to install: ${failures.join(', ')}\n`);
      if (failures.includes('semgrep')) {
        io.stderr.write('Semgrep requires python3 and pip. Install them and retry:\n');
        io.stderr.write('  macOS: brew install python3\n');
        io.stderr.write('  Ubuntu/Debian: sudo apt install python3 python3-pip\n');
        io.stderr.write('  Then run: openkit install\n');
      }
      if (
        failures.includes('managed-node-modules') ||
        failures.includes('jscodeshift') ||
        failures.includes('better-sqlite3') ||
        failures.includes('syntax-parser-packages')
      ) {
        io.stderr.write('Bundled runtime packages were not available to the managed kit. Reinstall the npm package and retry:\n');
        io.stderr.write('  npm install -g @duypham93/openkit\n');
        io.stderr.write('  openkit install --verify\n');
      }
    } else {
      io.stdout.write('\nAll runtime tooling and bundled dependencies installed successfully.\n');
    }

    // Step 5: Optional verification
    if (shouldVerify) {
      io.stdout.write('\nVerifying installation...\n');

      const astGrepOk = deps.checkAstGrep({ env: deps.env });
      const semgrepOk = deps.checkSemgrep({ env: deps.env });
      const codemodOk = deps.checkCodemod();
      const betterSqliteOk = deps.checkBetterSqlite();
      const syntaxParsingOk = deps.checkSyntaxParsing();
      const runtimeDepsOk = Boolean(runtimeDeps?.provisioned);

      io.stdout.write(`  ast-grep: ${astGrepOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  semgrep:  ${semgrepOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  jscodeshift: ${codemodOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  better-sqlite3: ${betterSqliteOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  syntax parsers: ${syntaxParsingOk ? 'OK' : 'NOT FOUND'}\n`);
      io.stdout.write(`  managed node_modules: ${runtimeDepsOk ? 'OK' : 'FAILED'}\n`);

      const verifyFailures = [];
      if (!astGrepOk) verifyFailures.push('ast-grep');
      if (!semgrepOk) verifyFailures.push('semgrep');
      if (!codemodOk) verifyFailures.push('jscodeshift');
      if (!betterSqliteOk) verifyFailures.push('better-sqlite3');
      if (!syntaxParsingOk) verifyFailures.push('syntax-parser-packages');
      if (!runtimeDepsOk) verifyFailures.push('managed-node-modules');

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
