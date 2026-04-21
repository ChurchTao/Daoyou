/**
 * 词缀面向玩家的数值格式化。
 *
 * 与战斗日志 (`effectTextFormat`) 的差异：
 *   - 百分比默认四舍五入到整数（34%而非33.75%），更简洁。
 *   - 数值默认最多保留 1 位小数，去除多余零。
 */

export function formatAffixNumber(value: number, maxDigits = 1): string {
  if (!Number.isFinite(value)) return '0';
  // 对 < 1 的小数保留一位，其它直接整数化
  if (Math.abs(value) >= 1 || value === 0) {
    return Math.round(value).toString();
  }
  return value
    .toFixed(maxDigits)
    .replace(/\.?0+$/, '');
}

/**
 * `0.3375` → `"34%"`；`0.015` → `"1.5%"`
 */
export function formatAffixPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const pct = value * 100;
  // 小于 1% 时保留 1 位小数避免被抹成 0
  if (Math.abs(pct) < 1 && pct !== 0) {
    return `${pct.toFixed(1).replace(/\.?0+$/, '')}%`;
  }
  return `${Math.round(pct)}%`;
}
