const zhNumberFormatter = new Intl.NumberFormat('zh-CN');

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '');
}

function formatScaledNumber(value: number): string {
  if (value >= 100) return trimTrailingZeros(value.toFixed(0));
  if (value >= 10) return trimTrailingZeros(value.toFixed(1));
  return trimTrailingZeros(value.toFixed(2));
}

/** Formats a value already in percent units, such as 20 for 20%. */
export function formatPercentValue(value: number, maximumFractionDigits = 2): string {
  return `${Number(value.toFixed(maximumFractionDigits))}%`;
}

/** Formats a ratio, such as 0.2 for 20%. */
export function formatRatioPercent(ratio: number, maximumFractionDigits = 2): string {
  return formatPercentValue(ratio * 100, maximumFractionDigits);
}

export function formatCompactGameNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const normalized = Math.trunc(value);
  const abs = Math.abs(normalized);
  const sign = normalized < 0 ? '-' : '';

  if (abs < 10_000) {
    return zhNumberFormatter.format(normalized);
  }

  if (abs >= 100_000_000) {
    return `${sign}${formatScaledNumber(abs / 100_000_000)}亿`;
  }

  return `${sign}${formatScaledNumber(abs / 10_000)}万`;
}

export function formatFullGameNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return zhNumberFormatter.format(Math.trunc(value));
}
