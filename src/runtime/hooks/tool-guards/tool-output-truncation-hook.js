function clampPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function truncateString(value, maxChars) {
  if (typeof value !== 'string') {
    return {
      value,
      changed: false,
      stats: {},
    };
  }

  if (value.length <= maxChars) {
    return {
      value,
      changed: false,
      stats: {
        originalChars: value.length,
        truncatedChars: value.length,
      },
    };
  }

  return {
    value: `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`,
    changed: true,
    stats: {
      originalChars: value.length,
      truncatedChars: maxChars,
      omittedChars: value.length - maxChars,
    },
  };
}

function truncateArray(value, maxItems) {
  if (!Array.isArray(value)) {
    return {
      value,
      changed: false,
      stats: {},
    };
  }

  if (value.length <= maxItems) {
    return {
      value,
      changed: false,
      stats: {
        originalItems: value.length,
        truncatedItems: value.length,
      },
    };
  }

  return {
    value: value.slice(0, maxItems),
    changed: true,
    stats: {
      originalItems: value.length,
      truncatedItems: maxItems,
      omittedItems: value.length - maxItems,
    },
  };
}

export function createToolOutputTruncationHook(config = {}) {
  const maxChars = clampPositiveInteger(config?.maxChars, 12000);
  const maxItems = clampPositiveInteger(config?.maxItems, 200);

  return {
    id: 'hook.tool-output-truncation',
    name: 'Tool Output Truncation Hook',
    stage: 'foundation',
    run({ output }) {
      const arrayResult = truncateArray(output, maxItems);
      const stringResult = truncateString(arrayResult.value, maxChars);
      const truncated = arrayResult.changed || stringResult.changed;

      return {
        output: stringResult.value,
        truncated,
        limits: {
          maxChars,
          maxItems,
        },
        stats: {
          ...arrayResult.stats,
          ...stringResult.stats,
        },
      };
    },
  };
}
