export function getCategoryModelPolicy(category) {
  return {
    category: category.id,
    model: category.model,
  };
}
