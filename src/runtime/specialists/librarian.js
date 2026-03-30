export function createLibrarianSpecialist() {
  return {
    id: 'specialist.librarian',
    name: 'Librarian',
    defaultModel: 'google/gemini-3-flash',
    permissions: ['read'],
    role: 'documentation-and-code-search-consultant',
  };
}
