import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import type { SpiritGardenSeedReward } from '@daoyou/game-domain/spirit-field';
import { getSpiritGardenSeedCandidates } from '../spirit-field/garden.js';

/** Each old seed retains its quality and independently chooses a current species. */
export function drawLegacySeedConversion(
  quality: Quality,
  quantity: number,
  random: () => number,
): (Omit<SpiritGardenSeedReward, 'quantity'> & { quantity: number })[] {
  if (!QUALITY_VALUES.includes(quality))
    throw new Error('旧灵种品质异常，请联系管理员核对');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999)
    throw new Error('转化数量无效');
  const candidates = getSpiritGardenSeedCandidates(quality);
  const quantities = new Map<string, number>();
  for (let index = 0; index < quantity; index++) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
      throw new Error('灵种随机值无效');
    const species = candidates[Math.floor(roll * candidates.length)]!;
    quantities.set(species.id, (quantities.get(species.id) ?? 0) + 1);
  }
  return Array.from(quantities, ([speciesId, amount]) => ({
    speciesId,
    quality,
    quantity: amount,
  }));
}
