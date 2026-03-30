export function listDefaultCategories() {
  return [
    { id: 'quick', model: 'openai/gpt-5.4-mini', description: 'Trivial and bounded work.' },
    { id: 'deep', model: 'openai/gpt-5.4', description: 'Deep, multi-step technical work.' },
    { id: 'ultrabrain', model: 'openai/gpt-5.4', description: 'High-effort reasoning tasks.' },
    { id: 'visual-engineering', model: 'google/gemini-3.1-pro', description: 'UI and visual work.' },
    { id: 'writing', model: 'google/gemini-3-flash', description: 'Documentation and prose.' },
    { id: 'migration-safe', model: 'anthropic/claude-sonnet-4-6', description: 'Behavior-preserving migrations.' },
    { id: 'qa-regression', model: 'openai/gpt-5.4-mini', description: 'Focused QA and regression verification.' },
    { id: 'docs-research', model: 'google/gemini-3-flash', description: 'Documentation and codebase lookup.' },
  ];
}
