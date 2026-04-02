export function createCodeSearchMcp({ sessionMemoryManager = null } = {}) {
  return {
    id: 'mcp.code-search',
    name: 'code-search',
    aliases: ['codeSearch'],
    transport: 'builtin',
    status: sessionMemoryManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      const query = typeof input === 'string' ? input : input.query;
      if (!query || typeof query !== 'string') {
        return {
          status: 'invalid-input',
          mcp: 'code-search',
          reason: 'query is required and must be a non-empty string.',
        };
      }

      if (!sessionMemoryManager?.available) {
        return {
          status: 'unavailable',
          mcp: 'code-search',
          reason: 'Session memory manager is not available.',
        };
      }

      const topK = Number.isInteger(input.topK) ? Math.max(1, Math.min(100, input.topK)) : 20;
      const minScore = Number.isFinite(input.minScore) ? input.minScore : 0.1;
      const vectorResults = sessionMemoryManager.hasEmbeddingProvider
        ? await sessionMemoryManager.semanticSearchQuery(query, { topK, minScore })
        : [];

      const results = vectorResults.map((result) => ({
        chunkId: result.chunkId,
        path: result.path,
        score: result.score,
        vectorScore: result.vectorScore,
        model: result.model,
        metadata: result.metadata,
      }));

      return {
        status: 'ok',
        mcp: 'code-search',
        query,
        searchMode: sessionMemoryManager.hasEmbeddingProvider ? 'embedding' : 'keyword-unavailable',
        totalMatches: results.length,
        results,
      };
    },
  };
}
