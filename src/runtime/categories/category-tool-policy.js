export function getCategoryToolPolicy(category) {
  return {
    category: category.id,
    disabledTools: category.tools ?? {},
  };
}
