import { describe, expect, it } from 'vitest';
import { DungeonBattlePlanSchema } from './battlePlan';

describe('DungeonBattlePlanSchema', () => {
  it.each(['standard', 'basic_attack_only'] as const)(
    'accepts the supported %s plan',
    (plan) => {
      expect(DungeonBattlePlanSchema.parse(plan)).toBe(plan);
    },
  );

  it('rejects unknown client plans', () => {
    expect(() => DungeonBattlePlanSchema.parse('free_cast')).toThrow();
  });
});
