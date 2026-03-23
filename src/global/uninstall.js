import fs from 'node:fs';

import { getGlobalPaths } from './paths.js';

function removeIfPresent(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

export function uninstallGlobalOpenKit({ env = process.env, removeWorkspaces = false } = {}) {
  const paths = getGlobalPaths({ env });

  removeIfPresent(paths.kitRoot);
  removeIfPresent(paths.profilesRoot);

  if (removeWorkspaces) {
    removeIfPresent(paths.workspacesRoot);
  }

  return {
    ...paths,
    removedWorkspaces: removeWorkspaces,
  };
}
