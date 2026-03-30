import { resolveCategories } from './category-resolver.js';

export function createCategoryRuntime(config = {}) {
  const categories = resolveCategories(config);
  return {
    categories,
    byId: Object.fromEntries(categories.map((entry) => [entry.id, entry])),
  };
}
