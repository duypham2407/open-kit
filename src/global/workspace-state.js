import fs from 'node:fs';
import path from 'node:path';

import { getWorkspacePaths } from './paths.js';

const WORKSPACE_STATE_SCHEMA = 'openkit/workspace-state@1';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function createWorkspaceMeta({ projectRoot, workspaceId, kitVersion = '0.1.0', profile = 'openkit' }) {
  return {
    schema: WORKSPACE_STATE_SCHEMA,
    stateVersion: 1,
    projectRoot,
    workspaceId,
    profile,
    kitVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ensureWorkspaceBootstrap(options = {}) {
  const paths = getWorkspacePaths(options);

  fs.mkdirSync(paths.opencodeDir, { recursive: true });
  fs.mkdirSync(paths.workItemsDir, { recursive: true });

  if (!fs.existsSync(paths.workspaceMetaPath)) {
    writeJson(
      paths.workspaceMetaPath,
      createWorkspaceMeta({
        projectRoot: paths.projectRoot,
        workspaceId: paths.workspaceId,
      }),
    );
  }

  if (!fs.existsSync(paths.workItemIndexPath)) {
    writeJson(paths.workItemIndexPath, {
      active_work_item_id: null,
      work_items: [],
    });
  }

  return paths;
}

export function readWorkspaceMeta(options = {}) {
  const paths = ensureWorkspaceBootstrap(options);
  return {
    paths,
    meta: readJson(paths.workspaceMetaPath),
    index: readJson(paths.workItemIndexPath),
  };
}
