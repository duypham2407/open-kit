// ---------------------------------------------------------------------------
// Embedding Provider Interface + Implementations
//
// Pluggable embedding generation for semantic search.  The runtime ships
// with adapters for OpenAI-compatible APIs (including Ollama) plus a
// deterministic mock provider for tests and a no-op provider for
// environments without a configured model.
//
// Configuration follows the same pattern as agent model settings:
//   embedding.provider  — selects the adapter (openai | ollama | custom)
//   embedding.model     — provider-qualified model id (e.g. openai/text-embedding-3-small)
//   embedding.dimensions — embedding vector length
//   embedding.apiKey    — API key (or env var lookup)
//   embedding.baseUrl   — custom endpoint (required for ollama/custom)
// ---------------------------------------------------------------------------

/**
 * Base class that defines the embedding provider contract.
 * Subclasses must implement `_embed(texts)`.
 */
export class BaseEmbeddingProvider {
  /**
   * @param {{ model: string, dimensions: number }} opts
   */
  constructor({ model = 'unknown', dimensions = 384 } = {}) {
    this.model = model;
    this.dimensions = dimensions;
  }

  /**
   * Generate embeddings for one or more text chunks.
   *
   * @param {string[]} texts  Array of text strings to embed.
   * @returns {Promise<Float32Array[]>}  One Float32Array per input text.
   */
  async embed(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    return this._embed(texts);
  }

  /**
   * Generate an embedding for a single text string.
   *
   * @param {string} text
   * @returns {Promise<Float32Array>}
   */
  async embedOne(text) {
    const results = await this.embed([text]);
    return results[0] ?? new Float32Array(this.dimensions);
  }

  /**
   * Subclasses override this to provide the actual embedding logic.
   * @param {string[]} _texts
   * @returns {Promise<Float32Array[]>}
   */
  async _embed(_texts) {
    throw new Error('BaseEmbeddingProvider._embed() must be overridden');
  }

  describe() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      type: this.constructor.name,
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible Embedding Provider
//
// Works with:
//   - OpenAI API (text-embedding-3-small, text-embedding-3-large, etc.)
//   - Any OpenAI-compatible endpoint (Azure, Together, etc.)
//   - Ollama (when baseUrl points to the Ollama server)
//
// Uses native fetch() — no SDK dependency required.
// ---------------------------------------------------------------------------

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  /**
   * @param {{
   *   model?: string,
   *   dimensions?: number,
   *   apiKey?: string | null,
   *   baseUrl?: string,
   * }} opts
   */
  constructor({
    model = 'text-embedding-3-small',
    dimensions = 1536,
    apiKey = null,
    baseUrl = 'https://api.openai.com/v1',
  } = {}) {
    super({ model, dimensions });
    this._apiKey = apiKey;
    this._baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async _embed(texts) {
    const apiKey = this._apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAIEmbeddingProvider: No API key configured. ' +
        'Set embedding.apiKey in runtime config or OPENAI_API_KEY env var.'
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const body = {
      model: this.model,
      input: texts,
    };

    // Only include dimensions if the model supports it
    // (text-embedding-3-* supports it, ada-002 does not)
    if (this.dimensions && this.model.includes('text-embedding-3')) {
      body.dimensions = this.dimensions;
    }

    const response = await fetch(`${this._baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `OpenAIEmbeddingProvider: API request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // OpenAI returns { data: [{ embedding: number[], index: number }, ...] }
    // Sort by index to preserve order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => new Float32Array(item.embedding));
  }

  describe() {
    return {
      ...super.describe(),
      type: 'OpenAIEmbeddingProvider',
      baseUrl: this._baseUrl,
      hasApiKey: !!(this._apiKey ?? process.env.OPENAI_API_KEY),
    };
  }
}

// ---------------------------------------------------------------------------
// Ollama Embedding Provider
//
// Wraps the Ollama API (/api/embeddings endpoint).
// Ollama uses a different API shape than OpenAI, so this adapter handles
// the translation.
// ---------------------------------------------------------------------------

export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  /**
   * @param {{
   *   model?: string,
   *   dimensions?: number,
   *   baseUrl?: string,
   * }} opts
   */
  constructor({
    model = 'nomic-embed-text',
    dimensions = 768,
    baseUrl = 'http://localhost:11434',
  } = {}) {
    super({ model, dimensions });
    this._baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async _embed(texts) {
    // Ollama's /api/embed endpoint accepts multiple inputs since v0.5+
    const response = await fetch(`${this._baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `OllamaEmbeddingProvider: API request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    // Ollama returns { embeddings: [[...], [...], ...] }
    if (data.embeddings && Array.isArray(data.embeddings)) {
      return data.embeddings.map((vec) => new Float32Array(vec));
    }

    // Fallback for older single-input endpoint shape
    if (data.embedding && Array.isArray(data.embedding)) {
      return [new Float32Array(data.embedding)];
    }

    throw new Error('OllamaEmbeddingProvider: unexpected response shape');
  }

  describe() {
    return {
      ...super.describe(),
      type: 'OllamaEmbeddingProvider',
      baseUrl: this._baseUrl,
    };
  }
}

// ---------------------------------------------------------------------------
// Deterministic Mock Provider — for tests
//
// Generates a deterministic embedding based on a simple hash of the input
// text.  This allows tests to verify the pipeline without depending on
// external services or large model files.
// ---------------------------------------------------------------------------

export class MockEmbeddingProvider extends BaseEmbeddingProvider {
  constructor({ dimensions = 64 } = {}) {
    super({ model: 'mock-deterministic', dimensions });
  }

  async _embed(texts) {
    return texts.map((text) => this._hashEmbed(text));
  }

  /**
   * Simple deterministic embedding: hash each character's code point into
   * a fixed-length vector, then L2-normalize.
   */
  _hashEmbed(text) {
    const vec = new Float32Array(this.dimensions);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Distribute character influence across dimensions using a simple
      // multiplicative hash to avoid clustering.
      const idx = ((code * 31 + i * 7) & 0x7fffffff) % this.dimensions;
      vec[idx] += code / 127;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }
}

// ---------------------------------------------------------------------------
// No-Op Provider — returns zero vectors, used when no model is configured
// ---------------------------------------------------------------------------

export class NoOpEmbeddingProvider extends BaseEmbeddingProvider {
  constructor({ dimensions = 384 } = {}) {
    super({ model: 'noop', dimensions });
  }

  async _embed(texts) {
    return texts.map(() => new Float32Array(this.dimensions));
  }
}

// ---------------------------------------------------------------------------
// Provider Factory — creates the right provider from runtime config
//
// Follows the same convention as agent model settings:
//   config.embedding.provider  →  adapter class
//   config.embedding.model     →  model identifier
//   config.embedding.apiKey    →  API key (with env var fallback)
//   config.embedding.baseUrl   →  custom endpoint
//   config.embedding.dimensions →  vector size
// ---------------------------------------------------------------------------

/**
 * Create an embedding provider from the embedding section of the runtime config.
 *
 * @param {{ provider?: string, model?: string, dimensions?: number, apiKey?: string|null, baseUrl?: string|null }} embeddingConfig
 * @param {{ env?: object }} opts
 * @returns {BaseEmbeddingProvider}
 */
export function createEmbeddingProvider(embeddingConfig = {}, { env = process.env } = {}) {
  const {
    provider = 'openai',
    model,
    dimensions,
    apiKey = null,
    baseUrl = null,
  } = embeddingConfig;

  switch (provider) {
    case 'openai': {
      // Strip provider prefix from model id if present (e.g. "openai/text-embedding-3-small" → "text-embedding-3-small")
      const modelId = model ? model.replace(/^openai\//, '') : 'text-embedding-3-small';
      return new OpenAIEmbeddingProvider({
        model: modelId,
        dimensions: dimensions ?? 1536,
        apiKey: apiKey ?? env.OPENAI_API_KEY ?? null,
        baseUrl: baseUrl ?? 'https://api.openai.com/v1',
      });
    }

    case 'ollama': {
      const modelId = model ? model.replace(/^ollama\//, '') : 'nomic-embed-text';
      return new OllamaEmbeddingProvider({
        model: modelId,
        dimensions: dimensions ?? 768,
        baseUrl: baseUrl ?? env.OLLAMA_HOST ?? 'http://localhost:11434',
      });
    }

    case 'custom': {
      // Custom provider uses OpenAI-compatible API at a custom baseUrl
      if (!baseUrl) {
        throw new Error(
          'embedding.provider "custom" requires embedding.baseUrl to be set.'
        );
      }
      const modelId = model ? model.replace(/^[^/]+\//, '') : 'embedding';
      return new OpenAIEmbeddingProvider({
        model: modelId,
        dimensions: dimensions ?? 384,
        apiKey: apiKey ?? null,
        baseUrl,
      });
    }

    default:
      throw new Error(`Unknown embedding provider: ${provider}. Use one of: openai, ollama, custom.`);
  }
}
