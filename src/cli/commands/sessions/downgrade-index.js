import { downgradeIndex } from '../../../runtime/sessions/downgrade-index.js';
import {
  helpRequested,
  isJsonFlag,
  resolveBaseDir,
  takeFlagValue,
} from './_shared.js';

function help() {
  return [
    'Usage: openkit sessions downgrade-index [--json]',
    '',
    'Maintainer-only: rewrite work-items/index.json from v3 → v2 (lossy) and',
    'restore the most recent workflow-state.json.legacy.* mirror, if any.',
    '',
    'Per-session state cannot be represented in v2 and will appear inconsistent',
    'if multiple sessions had been active. Use only for incident response.',
    '',
    'Options:',
    '  --json        Emit machine-readable JSON of the downgrade summary.',
    '  --help, -h    Show this help.',
  ].join('\n');
}

export const downgradeIndexCmd = {
  name: 'downgrade-index',
  async run(args = [], io) {
    const argv = [...args];
    if (helpRequested(argv)) {
      io.stdout.write(`${help()}\n`);
      return 0;
    }

    const json = isJsonFlag(argv);
    const baseDirFlag = takeFlagValue(argv, '--base-dir');

    if (argv.length > 0) {
      io.stderr.write(`Unknown argument(s): ${argv.join(' ')}\n`);
      io.stderr.write('Run `openkit sessions downgrade-index --help` for usage.\n');
      return 1;
    }

    const baseDir = resolveBaseDir({ baseDirFlag });

    try {
      // Capture the warning from downgradeIndex so we can render it cleanly.
      const warnings = [];
      const logger = { warn: (m) => warnings.push(String(m)) };

      const result = await downgradeIndex({ baseDir, logger });

      if (json) {
        io.stdout.write(
          `${JSON.stringify({ ...result, warnings }, null, 2)}\n`,
        );
      } else {
        io.stdout.write(
          [
            'Rewrote work-items/index.json as v2 (lossy).',
            `  index_path:              ${result.indexPath}`,
            `  active_work_item_id:     ${result.activeWorkItemId ?? '(none)'}`,
            `  work_item_count:         ${result.workItemCount}`,
            `  restored_legacy_mirror:  ${result.restoredLegacyMirror ?? '(none)'}`,
            '',
          ].join('\n'),
        );
        for (const w of warnings) io.stderr.write(`${w}\n`);
      }
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
