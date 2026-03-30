export function buildCategoryPrompt(category) {
  return `${category.id}: ${category.description}`;
}
