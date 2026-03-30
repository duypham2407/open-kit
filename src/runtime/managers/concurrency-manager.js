export class ConcurrencyManager {
  constructor({ providerConcurrency = {}, modelConcurrency = {} } = {}) {
    this.providerConcurrency = providerConcurrency;
    this.modelConcurrency = modelConcurrency;
  }

  getProviderLimit(provider) {
    return this.providerConcurrency[provider] ?? null;
  }

  getModelLimit(model) {
    return this.modelConcurrency[model] ?? null;
  }

  describe() {
    return {
      providerConcurrency: { ...this.providerConcurrency },
      modelConcurrency: { ...this.modelConcurrency },
    };
  }
}
