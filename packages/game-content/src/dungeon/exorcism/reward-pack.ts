import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { z } from 'zod';
import raw from '../../rewards/data/exorcism.json' with { type: 'json' };

const step = z.strictObject({
  dailyExpFraction: z.number().min(0).max(2),
  stoneHours: z.number().min(0).max(24),
  chance: z.number().min(0).max(1),
});
const grade = step.extend({ insight: z.enum(['full', 'partial', 'none']) });

export const ExorcismRewardPackShape = z.strictObject({
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  poolVersion: z.number().int().positive(),
  /** 灵露、上品灵印等额外奖励概率相对云游奖励表的系数。 */
  bonusScale: z.number().min(0).max(1),
  /** 战败或逃跑时评级结算的折扣；主动收手不打折。 */
  defeatSettlementFactor: z.number().min(0).max(1),
  /** 感悟相对云游同档评级的系数。 */
  insightFactor: z.number().min(0).max(1),
  wins: z.array(step).length(4),
  search: step,
  grades: z.strictObject({ S: grade, A: grade, B: grade, C: grade, D: grade }),
});

export function loadExorcismRewardPack(data: unknown) {
  const result = ExorcismRewardPackShape.superRefine((pack, ctx) => {
    pack.wins.forEach((row, index) => {
      const previous = pack.wins[index - 1];
      if (
        previous &&
        (row.dailyExpFraction <= previous.dailyExpFraction ||
          row.stoneHours <= previous.stoneHours)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['wins', index],
          message: '逐场奖励必须递增',
        });
    });
    const order = [
      pack.grades.D,
      pack.grades.C,
      pack.grades.B,
      pack.grades.A,
      pack.grades.S,
    ];
    order.forEach((row, index) => {
      const previous = order[index - 1];
      if (previous && row.dailyExpFraction <= previous.dailyExpFraction)
        ctx.addIssue({
          code: 'custom',
          path: ['grades', index],
          message: '评级奖励必须递增',
        });
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors('除祟奖励配置', data, result.error.issues),
    );
  return result.data;
}

export const EXORCISM_REWARD_PACK = loadExorcismRewardPack(raw);
