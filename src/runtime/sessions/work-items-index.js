import fs from 'node:fs';
import { atomicReadJson, atomicReadModifyWrite } from './atomic-json.js';
import { workItemsIndexPath } from './session-paths.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from './constants.js';

const empty = () => ({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] });

export function readWorkItemsIndex(baseDir) {
  return atomicReadJson(workItemsIndexPath(baseDir), empty());
}

export function migrateWorkItemsIndex(baseDir) {
  const file = workItemsIndexPath(baseDir);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(empty(), null, 2)}\n`);
    return;
  }
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cur.schema === WORK_ITEMS_INDEX_SCHEMA_V3) return;
  const items = (cur.work_items ?? []).map((wi) => {
    const lane = wi.lane ?? wi.mode ?? 'full';
    let status = wi.status;
    if (status !== 'done' && status !== 'abandoned') status = 'orphan';
    return {
      work_item_id: wi.work_item_id,
      feature_id: wi.feature_id ?? null,
      feature_slug: wi.feature_slug ?? null,
      lane,
      status,
      current_session_id: null,
      state_path: wi.state_path,
      created_at: wi.created_at ?? new Date().toISOString(),
    };
  });
  fs.writeFileSync(file, `${JSON.stringify({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: items }, null, 2)}\n`);
}

export async function addWorkItem(baseDir, { workItemId, featureId = null, featureSlug, lane, currentSessionId, statePath }) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    if (idx.work_items.some((wi) => wi.work_item_id === workItemId)) {
      throw new Error(`duplicate work_item_id: ${workItemId}`);
    }
    return {
      ...idx,
      work_items: [
        ...idx.work_items,
        {
          work_item_id: workItemId,
          feature_id: featureId,
          feature_slug: featureSlug,
          lane,
          status: 'in_progress',
          current_session_id: currentSessionId,
          state_path: statePath,
          created_at: new Date().toISOString(),
        },
      ],
    };
  }, { defaultValue: empty() });
}

export async function setCurrentSessionId(baseDir, workItemId, sessionId) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      work_items: idx.work_items.map((wi) =>
        wi.work_item_id === workItemId ? { ...wi, current_session_id: sessionId } : wi,
      ),
    };
  }, { defaultValue: empty() });
}

export async function setWorkItemStatus(baseDir, workItemId, status) {
  await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      work_items: idx.work_items.map((wi) =>
        wi.work_item_id === workItemId ? { ...wi, status } : wi,
      ),
    };
  }, { defaultValue: empty() });
}
