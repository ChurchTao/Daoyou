import { seedFactsOf } from './definitions/seeds';

/** Only migration eligibility; retired facts are never repaired or revealed. */
export function legacyMaterialUnavailableReason(material: {
  type: unknown;
  rank: unknown;
  details?: unknown;
}): string | undefined {
  const details = material.details;
  if (details && typeof details === 'object' && 'mystery' in details)
    return '未鉴定材料已弃用，无法取出';
  if (material.type === 'seed') {
    try {
      seedFactsOf(material);
    } catch {
      return '缺少有效生长数据的历史灵种已弃用，无法取出';
    }
  }
}
