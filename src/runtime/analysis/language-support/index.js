import path from 'node:path';

import { JS_TS_SOURCE_EXTENSIONS, LIGHTWEIGHT_SOURCE_EXTENSIONS } from '../source-extensions.js';

import { extractLightweightPython } from './python-handler.js';
import { extractLightweightGo } from './go-handler.js';
import { extractLightweightCss } from './css-handler.js';
import { extractLightweightHtml } from './html-handler.js';
import { extractLightweightMarkdown } from './markdown-handler.js';
import { extractLightweightConfig } from './config-handler.js';

const LIGHTWEIGHT_SUPPORTED = new Set(LIGHTWEIGHT_SOURCE_EXTENSIONS);
const JS_TS_SUPPORTED = new Set(JS_TS_SOURCE_EXTENSIONS);

export function isJsTsExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return JS_TS_SUPPORTED.has(ext);
}

export function isLightweightExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return LIGHTWEIGHT_SUPPORTED.has(ext);
}

export function extractLightweightGraph({ source, filePath }) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.py') return extractLightweightPython({ source, filePath });
  if (ext === '.go') return extractLightweightGo({ source, filePath });
  if (ext === '.css') return extractLightweightCss({ source, filePath });
  if (ext === '.html') return extractLightweightHtml({ source, filePath });
  if (ext === '.md' || ext === '.markdown') return extractLightweightMarkdown({ source, filePath });
  if (ext === '.yaml' || ext === '.yml' || ext === '.toml') return extractLightweightConfig({ source, filePath });
  return {
    imports: [],
    exports: [],
    symbols: [],
  };
}
