import fs from 'node:fs';
import path from 'node:path';

export function materializeRuntimeProfile({ targetPath, templateContent }) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, templateContent, 'utf8');
  return targetPath;
}
