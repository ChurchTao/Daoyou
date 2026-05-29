function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableCompactStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function truncateText(
  input: string | null | undefined,
  maxChars: number,
): string {
  const normalized = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized || maxChars <= 0) return '';
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 3) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 3)}...`;
}

export function normalizeFreeformLlmInput(input: string): string {
  let normalized = input.trim();

  normalized = normalized
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(请(?:帮我|给我)?|麻烦你?|拜托你?)\s*/u, '')
    .replace(/\s*(谢谢|多谢|拜托了|辛苦了)\s*$/u, '')
    .replace(/([。！？；，、,.!?;])\1+/g, '$1')
    .trim();

  return normalized;
}

