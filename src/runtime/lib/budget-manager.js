export class BudgetManager {
  allocate(totalBudget, priorities = {}) {
    const defaultRatios = {
      critical: 0.40,
      important: 0.30,
      supplementary: 0.20,
      buffer: 0.10
    };

    const ratios = { ...defaultRatios, ...priorities };

    return {
      critical: Math.floor(totalBudget * ratios.critical),
      important: Math.floor(totalBudget * ratios.important),
      supplementary: Math.floor(totalBudget * ratios.supplementary),
      buffer: Math.floor(totalBudget * ratios.buffer)
    };
  }

  applyBudget(rankedItems, totalBudget) {
    const allocation = this.allocate(totalBudget);
    const result = [];

    const categorized = this.categorizeItems(rankedItems);

    result.push(...this.fillBucket(categorized.critical, allocation.critical));
    result.push(...this.fillBucket(categorized.important, allocation.important));
    result.push(...this.fillBucket(categorized.supplementary, allocation.supplementary));

    const remaining = rankedItems.filter(i => !result.includes(i));
    const overflow = remaining
      .filter(i => i.score > 0.7)
      .slice(0, Math.floor(allocation.buffer / 200));
    result.push(...overflow);

    return result;
  }

  categorizeItems(items) {
    return {
      critical: items.filter(i => i.category === 'critical'),
      important: items.filter(i => i.category === 'important'),
      supplementary: items.filter(i => i.category === 'supplementary')
    };
  }

  fillBucket(items, budgetAllocation) {
    const selected = [];
    let usedTokens = 0;

    for (const item of items) {
      if (usedTokens + item.estimatedTokens <= budgetAllocation) {
        selected.push(item);
        usedTokens += item.estimatedTokens;
      }
    }

    return selected;
  }
}
