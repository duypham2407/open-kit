import crypto from 'node:crypto';

export class IntentCacheManager {
  constructor() {
    this.cache = new Map(); // In-memory cache
  }

  generateCacheKey(code, extractorType, model) {
    const hash = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex')
      .substring(0, 16);

    return `${hash}-${extractorType}-${model}`;
  }

  set(code, extractorType, model, result) {
    const key = this.generateCacheKey(code, extractorType, model);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0,
      validated: false
    });
  }

  get(code, extractorType, model) {
    const key = this.generateCacheKey(code, extractorType, model);
    const entry = this.cache.get(key);

    if (entry) {
      entry.hits += 1;
      return entry;
    }

    return null;
  }
}
