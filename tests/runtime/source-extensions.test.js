import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTENSION_TO_LANGUAGE,
  SOURCE_EXTENSIONS,
  SOURCE_EXTENSION_SET,
  PARSER_SOURCE_EXTENSIONS,
  JS_TS_SOURCE_EXTENSIONS,
  LIGHTWEIGHT_SOURCE_EXTENSIONS,
} from '../../src/runtime/analysis/source-extensions.js';

describe('source-extensions shared constants', () => {
  it('SOURCE_EXTENSIONS includes all JS/TS variants including .cts and .mts', () => {
    const required = ['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.cts', '.mts'];
    for (const ext of required) {
      assert.ok(SOURCE_EXTENSIONS.includes(ext), `SOURCE_EXTENSIONS missing ${ext}`);
    }
  });

  it('EXTENSION_TO_LANGUAGE maps .cts and .mts to typescript', () => {
    assert.equal(EXTENSION_TO_LANGUAGE.get('.cts'), 'typescript');
    assert.equal(EXTENSION_TO_LANGUAGE.get('.mts'), 'typescript');
  });

  it('EXTENSION_TO_LANGUAGE maps .tsx to tsx (not typescript)', () => {
    assert.equal(EXTENSION_TO_LANGUAGE.get('.tsx'), 'tsx');
  });

  it('SOURCE_EXTENSION_SET is a Set with same entries as SOURCE_EXTENSIONS', () => {
    assert.ok(SOURCE_EXTENSION_SET instanceof Set);
    assert.equal(SOURCE_EXTENSION_SET.size, SOURCE_EXTENSIONS.length);
    for (const ext of SOURCE_EXTENSIONS) {
      assert.ok(SOURCE_EXTENSION_SET.has(ext), `SOURCE_EXTENSION_SET missing ${ext}`);
    }
  });

  it('SOURCE_EXTENSIONS and EXTENSION_TO_LANGUAGE are consistent', () => {
    // Every parser-supported extension should have a language mapping
    for (const ext of PARSER_SOURCE_EXTENSIONS) {
      assert.ok(EXTENSION_TO_LANGUAGE.has(ext), `EXTENSION_TO_LANGUAGE missing mapping for ${ext}`);
    }
    // Every key in the map should be in the parser extension list
    for (const ext of EXTENSION_TO_LANGUAGE.keys()) {
      assert.ok(PARSER_SOURCE_EXTENSIONS.includes(ext), `PARSER_SOURCE_EXTENSIONS missing ${ext} from map`);
    }
  });

  it('SOURCE_EXTENSIONS includes parser + lightweight extensions', () => {
    for (const ext of PARSER_SOURCE_EXTENSIONS) {
      assert.ok(SOURCE_EXTENSIONS.includes(ext), `SOURCE_EXTENSIONS missing parser ext ${ext}`);
    }
    for (const ext of LIGHTWEIGHT_SOURCE_EXTENSIONS) {
      assert.ok(SOURCE_EXTENSIONS.includes(ext), `SOURCE_EXTENSIONS missing lightweight ext ${ext}`);
    }
  });

  it('JS_TS_SOURCE_EXTENSIONS remains limited to JS/TS family', () => {
    assert.ok(JS_TS_SOURCE_EXTENSIONS.includes('.js'));
    assert.ok(JS_TS_SOURCE_EXTENSIONS.includes('.ts'));
    assert.ok(JS_TS_SOURCE_EXTENSIONS.includes('.cts'));
    assert.ok(JS_TS_SOURCE_EXTENSIONS.includes('.mts'));
    assert.ok(!JS_TS_SOURCE_EXTENSIONS.includes('.py'));
    assert.ok(!JS_TS_SOURCE_EXTENSIONS.includes('.md'));
  });
});
