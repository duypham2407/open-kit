// Positive fixture for openkit.security.no-exec-shell-string-from-array
// and no-exec-shell-string-concat. The rules MUST flag these patterns.
import { execSync, exec } from 'node:child_process';

const args = ['ast-grep', 'run', '--pattern', 'foo'];
execSync(args.join(' '), { encoding: 'utf8' });

const userInput = 'whatever';
exec('cat ' + userInput, (err, stdout) => {
  console.log(stdout);
});
