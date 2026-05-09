// Negative fixture: argv-form spawnSync should NOT trigger the
// no-exec-shell-string-from-array rule.
import { spawnSync } from 'node:child_process';

const args = ['run', '--pattern', 'foo'];
const result = spawnSync('ast-grep', args, { shell: false });
console.log(result.stdout);
