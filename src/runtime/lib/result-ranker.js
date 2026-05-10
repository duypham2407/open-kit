export class ResultRanker {
  rank(items, query = {}) {
    const scored = items.map(item => ({
      ...item,
      score: this.calculateScore(item, query)
    }));

    return scored.sort((a, b) => b.score - a.score);
  }

  calculateScore(item, query) {
    const scores = {
      graphDistance: 0.15 * (1.0 / (item.graphHops || 1 + 1)),
      embeddingSimilarity: 0.20 * (item.cosineSimilarity || 0),
      intentMatch: 0.15 * (item.intentTypes?.includes(query.intentType) ? 1.0 : 0),
      multiLayerBonus: 0.20 * (item.foundInLayers?.size - 1 || 0)
    };

    return Object.values(scores).reduce((a, b) => a + b, 0);
  }
}
