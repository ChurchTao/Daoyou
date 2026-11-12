import { seedFactsOf } from '@daoyou/game-domain/inventory';
import { isSpiritGardenSeed } from '../spirit-field/garden.js';

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
      const facts = seedFactsOf(material);
      if (!isSpiritGardenSeed(facts.seedSpec.plant))
        return '旧版灵种无法播种，请前往旧灵种转化';
    } catch {
      return '旧版灵种无法直接取出，请前往旧灵种转化';
    }
  }
}
