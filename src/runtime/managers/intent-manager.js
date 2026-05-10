import { IntentExtractionService } from '../analysis/intent-extraction-service.js';

/**
 * IntentManager — manager wrapper around {@link IntentExtractionService}.
 *
 * Owns the long-lived service instance, applies runtime config defaults,
 * and exposes a `triggerBackgroundExtraction` entry point that hooks (e.g.
 * file-save, watcher events) can call to fire-and-forget intent
 * extraction for recently touched files.  Background extraction is gated
 * by the `backgroundEnabled` flag so that opt-in is explicit.
 */
export class IntentManager {
  constructor({ db, config = {}, backgroundEnabled = false } = {}) {
    this.service = new IntentExtractionService({
      db,
      llmProvider: config.llmProvider || 'anthropic',
      model: config.llmModel || 'claude-sonnet-4.5',
      minConfidence: config.minConfidence || 0.6,
    });
    this.backgroundEnabled = backgroundEnabled;
    this.extractorTypes = config.extractors || [
      'business-rule',
      'constraint',
      'edge-case',
    ];
  }

  /**
   * Synchronous wrapper around {@link IntentExtractionService#extractForSymbol}.
   * @param {number} symbolId
   */
  async extractForSymbol(symbolId) {
    return this.service.extractForSymbol(symbolId, this.extractorTypes);
  }

  /**
   * Synchronous wrapper around {@link IntentExtractionService#extractForFiles}.
   * @param {string[]} filePaths
   */
  async extractForFiles(filePaths) {
    return this.service.extractForFiles(filePaths, this.extractorTypes);
  }

  /**
   * Trigger background extraction for the supplied files.  Intentionally
   * fire-and-forget: callers do not await the result, and any failures are
   * surfaced via `console.error` so they do not crash the host hook.
   * No-op when `backgroundEnabled` is false.
   *
   * @param {string[]} filePaths
   */
  async triggerBackgroundExtraction(filePaths) {
    if (!this.backgroundEnabled) return;

    // Run in background (don't await).
    this.extractForFiles(filePaths).catch((err) => {
      console.error('Background intent extraction failed:', err);
    });
  }
}
