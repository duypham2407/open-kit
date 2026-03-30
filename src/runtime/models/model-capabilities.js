export function inferModelCapabilities(model) {
  return {
    model,
    supportsReasoning: /gpt|claude|gemini|kimi/i.test(model),
    supportsVision: /gemini|gpt/i.test(model),
  };
}
