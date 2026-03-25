function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMergeConfig(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay;
  }

  const result = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMergeConfig(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function parseInlineConfig(content, sourceLabel = 'OPENCODE_CONFIG_CONTENT') {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${sourceLabel} must contain valid JSON.`, { cause: error });
  }
}
