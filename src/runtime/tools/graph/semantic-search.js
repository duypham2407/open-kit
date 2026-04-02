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

          const topK = input.topK ?? 20;
          const minScore = input.minScore ?? 0.1;
          const vectorResults = sessionMemoryManager?.hasEmbeddingProvider
            ? await sessionMemoryManager.semanticSearchQuery(query, { topK, minScore })
            : [];
          const keywordResult = executeKeywordSearch(projectGraphManager, query, { topK });
          const keywordResults = keywordResult.results ?? [];

          if (vectorResults.length > 0 && keywordResults.length > 0) {
            const merged = mergeHybridResults({
              vectorResults,
              keywordResults,
              projectGraphManager,
              sessionMemoryManager,
            }, input);

            return {
              status: 'ok',
              query,
              searchMode: 'hybrid',
              results: merged,
              totalMatches: merged.length,
            };
          }

          // Use embedding-based search when the session memory manager has a
          // configured provider and the DB contains indexed embeddings.
          if (vectorResults.length > 0) {
            const enriched = vectorResults.map((result) => enrichVectorResult(result, { sessionMemoryManager }));
            return {
              status: 'ok',
              query,
              searchMode: 'embedding',
              results: enriched,
              totalMatches: enriched.length,
            };
          }

          return executeKeywordSearch(projectGraphManager, query, { topK, sessionMemoryManager });
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

function executeKeywordSearch(manager, query, { topK = 20, sessionMemoryManager = null } = {}) {
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

  const normalized = results.slice(0, topK).map((result) => {
    const enriched = {
      ...result,
      absolutePath: result.absolutePath,
      score: clampMergedScore(result.relevanceScore),
      keywordScore: clampMergedScore(result.relevanceScore),
      vectorScore: 0,
      scoreBreakdown: {
        vector: 0,
        keyword: clampMergedScore(result.relevanceScore),
        rerank: 0,
      },
      symbolName: result.name ?? result.symbolName ?? null,
    };

    if (sessionMemoryManager) {
      enriched.context = sessionMemoryManager.buildResultContext(enriched, {});
    }
    return enriched;
  });

  return {
    status: 'ok',
    query,
    keywords,
    searchMode: 'keyword',
    results: normalized,
    totalMatches: results.length,
  };
}

function clampMergedScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

function enrichVectorResult(result, { sessionMemoryManager }) {
  const enriched = {
    ...result,
    absolutePath: result.path,
    path: result.path,
    symbolName: result.metadata?.symbolName ?? null,
    kind: result.metadata?.kind ?? null,
    startLine: result.metadata?.startLine ?? null,
    endLine: result.metadata?.endLine ?? null,
    score: clampMergedScore(result.score),
    keywordScore: 0,
    scoreBreakdown: {
      vector: clampMergedScore(result.vectorScore ?? result.score),
      keyword: 0,
      rerank: 0,
    },
  };

  if (sessionMemoryManager) {
    enriched.context = sessionMemoryManager.buildResultContext(enriched, {});
  }
  return enriched;
}

function mergeHybridResults({ vectorResults, keywordResults, sessionMemoryManager }, input) {
  const merged = new Map();
  const topK = input.topK ?? 20;

  for (const result of vectorResults) {
    const key = result.chunkId ?? `${result.path}:${result.metadata?.startLine ?? 0}`;
    merged.set(key, {
      ...enrichVectorResult(result, { sessionMemoryManager }),
      keywordScore: 0,
    });
  }

  for (const result of keywordResults) {
    const key = result.chunkId ?? `${result.absolutePath}:${result.line ?? result.startLine ?? 0}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, result);
      continue;
    }

    existing.keywordScore = clampMergedScore(result.keywordScore ?? result.score ?? result.relevanceScore ?? 0);
    existing.scoreBreakdown.keyword = existing.keywordScore;
    existing.symbolName = existing.symbolName ?? result.symbolName ?? result.name ?? null;
    existing.kind = existing.kind ?? result.kind ?? null;
    existing.startLine = existing.startLine ?? result.startLine ?? result.line ?? null;
    existing.endLine = existing.endLine ?? result.endLine ?? result.line ?? null;
    existing.context = existing.context ?? result.context ?? null;
  }

  const ranked = Array.from(merged.values()).map((result) => {
    const vectorScore = clampMergedScore(result.scoreBreakdown?.vector ?? result.vectorScore ?? 0);
    const keywordScore = clampMergedScore(result.scoreBreakdown?.keyword ?? result.keywordScore ?? 0);
    let rerankBoost = 0;
    if (result.symbolName && input.query?.toLowerCase().includes(String(result.symbolName).toLowerCase())) {
      rerankBoost += 0.1;
    }
    if (result.kind === 'function' || result.kind === 'class') {
      rerankBoost += 0.03;
    }
    if (result.isExport) {
      rerankBoost += 0.05;
    }
    const finalScore = clampMergedScore((vectorScore * 0.7) + (keywordScore * 0.3) + rerankBoost);

    return {
      ...result,
      vectorScore,
      keywordScore,
      score: finalScore,
      scoreBreakdown: {
        vector: vectorScore,
        keyword: keywordScore,
        rerank: rerankBoost,
      },
      context: result.context ?? sessionMemoryManager?.buildResultContext(result, {}) ?? null,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topK);
}
