import fs from 'node:fs';
import path from 'node:path';

function listWindowsExecutableExtensions(env) {
  const raw = env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
  const extensions = raw
    .split(';')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return extensions.length > 0 ? extensions : ['.com', '.exe', '.bat', '.cmd'];
}

export function isCommandAvailable(command, { env = process.env, platform = process.platform } = {}) {
  if (typeof command !== 'string' || command.length === 0) {
    return false;
  }

  const pathValue = env.PATH ?? '';
  if (pathValue.length === 0) {
    return false;
  }

  const segments = pathValue.split(path.delimiter).filter(Boolean);
  const hasExtension = path.extname(command).length > 0;
  const suffixes = platform === 'win32' && !hasExtension ? ['', ...listWindowsExecutableExtensions(env)] : [''];

  for (const segment of segments) {
    for (const suffix of suffixes) {
      if (fs.existsSync(path.join(segment, `${command}${suffix}`))) {
        return true;
      }
    }
  }

  return false;
}
