// ---------------------------------------------------------------------------
// tool.semantic-search
//
// Semantic code search and agent context builder.
// When embeddings are available (sessionMemoryManager has an embeddingProvider
// AND the DB contains indexed embeddings), performs vector similarity search.
// When not, falls back to keyword-based search through the graph DB.
// Also surfaces session memory and graph context.
// ---------------------------------------------------------------------------

export function createSemanticSearchTool({ projectGraphManager, sessionMemoryManager }) {
  return {
    id: 'tool.semantic-search',
    name: 'Semantic Search Tool',
    description:
      'Search the project for relevant code using semantic context. ' +
      'Combines session memory, import graph, and symbol index. ' +
      'Actions: "search" (keyword or embedding), "context" (build context), "session" (session touches), "recent" (recent activity).',
    family: 'graph',
    stage: 'foundation',
    status: projectGraphManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!projectGraphManager?.available) {
        return {
          status: 'unavailable',
          reason: 'Project graph database is not available.',
        };
      }

      const action = typeof input === 'string' ? 'search' : (input.action ?? 'search');

      switch (action) {
        case 'search': {
          const query = typeof input === 'string' ? input : input.query;
          if (!query) {
            return { status: 'error', reason: 'query is required for search.' };
          }

          // Use embedding-based search when the session memory manager has a
          // configured provider and the DB contains indexed embeddings.
          if (sessionMemoryManager?.hasEmbeddingProvider) {
            const embeddingResults = await sessionMemoryManager.semanticSearchQuery(
              query,
              { topK: input.topK ?? 20, minScore: input.minScore ?? 0.1 }
            );
            if (embeddingResults.length > 0) {
              return {
                status: 'ok',
                query,
                searchMode: 'embedding',
                results: embeddingResults,
                totalMatches: embeddingResults.length,
              };
            }
            // Fall through to keyword search when no embedding results
          }

          return executeKeywordSearch(projectGraphManager, query);
        }

        case 'context': {
          if (!sessionMemoryManager) {
            return { status: 'unavailable', reason: 'Session memory manager is not available.' };
          }
          return {
            status: 'ok',
            ...sessionMemoryManager.buildContext({
              filePath: input.filePath,
              symbolName: input.symbol,
              recentLimit: input.recentLimit ?? 20,
            }),
          };
        }

        case 'session': {
          if (!sessionMemoryManager) {
            return { status: 'unavailable', reason: 'Session memory manager is not available.' };
          }
          return {
            status: 'ok',
            sessionId: sessionMemoryManager.sessionId,
            touches: sessionMemoryManager.getSessionTouches(),
          };
        }

        case 'recent': {
          if (!sessionMemoryManager) {
            return { status: 'unavailable', reason: 'Session memory manager is not available.' };
          }
          return {
            status: 'ok',
            recentActivity: sessionMemoryManager.getRecentActivity(input.limit ?? 50),
          };
        }

        default:
          return { status: 'error', reason: `Unknown action: ${action}. Use "search", "context", "session", or "recent".` };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: keyword-based search through graph DB
// ---------------------------------------------------------------------------

function executeKeywordSearch(manager, query) {
  // Split query into keywords, preserving original casing for exact lookups
  const keywords = query.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) {
    return { status: 'ok', query, searchMode: 'keyword', results: [] };
  }

  // Search for each keyword as a symbol name.
  // Try exact match first, fall back to case-insensitive if no results.
  const allMatches = new Map();
  for (const keyword of keywords) {
    let result = manager.findSymbol(keyword);
    // Fall back to case-insensitive search when exact match yields nothing
    if (result.status === 'ok' && result.matches.length === 0 && manager.findSymbolLike) {
      result = manager.findSymbolLike(keyword);
    }
    if (result.status === 'ok') {
      for (const match of result.matches) {
        const key = `${match.absolutePath}:${match.line}`;
        if (!allMatches.has(key)) {
          allMatches.set(key, {
            ...match,
            matchedKeywords: [keyword],
            relevanceScore: 0,
          });
        } else {
          allMatches.get(key).matchedKeywords.push(keyword);
        }
      }
    }
  }

  // Score results: more keyword matches = higher relevance
  const results = Array.from(allMatches.values());
  for (const r of results) {
    r.relevanceScore = r.matchedKeywords.length / keywords.length;
    // Boost exported symbols
    if (r.isExport) r.relevanceScore += 0.1;
  }
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    status: 'ok',
    query,
    keywords,
    searchMode: 'keyword',
    results: results.slice(0, 20),
    totalMatches: results.length,
  };
}
