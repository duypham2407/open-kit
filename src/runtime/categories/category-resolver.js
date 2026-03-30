import { deepMergeConfig } from '../../global/config-merge.js';
import { listDefaultCategories } from './default-categories.js';

export function resolveCategories(config = {}) {
  const defaults = Object.fromEntries(listDefaultCategories().map((entry) => [entry.id, entry]));
  const overrides = config.categories ?? {};
  return Object.values(
    Object.fromEntries(
      Object.keys({ ...defaults, ...overrides }).map((id) => [
        id,
        deepMergeConfig(defaults[id] ?? { id }, { id, ...(overrides[id] ?? {}) }),
      ])
    )
  );
}
