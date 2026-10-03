import { GeneratedBeastSchema, type SummonedBeast } from './schema.js';
import { beastPointBudget } from './identity.js';

export function rejuvenateBeast(beast: SummonedBeast): SummonedBeast {
  const reset = {
    ...beast,
    level: 0,
    exp: 0,
    allocatedAttributes: {
      constitution: 0,
      strength: 0,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    unallocatedPoints: beastPointBudget({ ...beast, level: 0 }),
    revision: beast.revision + 1,
  };
  return GeneratedBeastSchema.parse(reset);
}
