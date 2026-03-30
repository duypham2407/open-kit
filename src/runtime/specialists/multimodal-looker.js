export function createMultimodalLookerSpecialist() {
  return {
    id: 'specialist.multimodal-looker',
    name: 'Multimodal Looker',
    defaultModel: 'openai/gpt-5.4',
    permissions: ['read'],
    role: 'visual-and-document-analysis-helper',
  };
}
