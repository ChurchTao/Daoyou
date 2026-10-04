import { createBeastSchema } from '@daoyou/game-domain/beasts';

import {
  BEAST_SKILLS,
  BEAST_SPECIES,
} from '@daoyou/game-content/beasts';

import { beastPointBudget } from './identity.js';

export const BeastSchema = createBeastSchema({
  skills: BEAST_SKILLS,
  species: BEAST_SPECIES,
});

// 点数公式只约束生成、融合和洗炼的结果，不阻断存量个体读取。
export const GeneratedBeastSchema = BeastSchema.refine(
  (beast) =>
    Object.values(beast.allocatedAttributes).reduce((a, b) => a + b, 0) +
      beast.unallocatedPoints ===
    beastPointBudget(beast),
  { path: ['unallocatedPoints'], message: '灵兽属性点总额不符合生成规则' },
);
