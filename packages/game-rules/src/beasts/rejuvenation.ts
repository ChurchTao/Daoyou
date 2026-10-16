import { type SummonedBeast } from '@daoyou/game-domain/beasts';
import { GeneratedBeastSchema } from './schema.js';
import { beastPointBudget } from './identity.js';

export function beastRejuvenationReason(beast: SummonedBeast): string {
  if (Object.values(beast.allocatedAttributes).every((point) => point === 0))
    return '灵兽尚未分配属性点';
  return '';
}

export function rejuvenateBeast(beast: SummonedBeast): SummonedBeast {
  const reset = {
    ...beast,
    allocatedAttributes: {
      constitution: 0,
      strength: 0,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    unallocatedPoints: beastPointBudget(beast),
    revision: beast.revision + 1,
  };
  return GeneratedBeastSchema.parse(reset);
}
