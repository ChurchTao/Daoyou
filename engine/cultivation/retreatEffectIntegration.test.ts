import { applyBreakthroughChanceBonus } from './retreatEffectIntegration';
import type { Cultivator } from '@/types/cultivator';

describe('retreatEffectIntegration', () => {
  it('applies breakthrough_luck bonus without throwing', () => {
    const cultivator = {
      id: 'c1',
      name: '测试道友',
      realm: '炼气',
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      persistent_statuses: [
        {
          instanceId: 'b1',
          configId: 'breakthrough_luck',
          casterId: 'c1',
          currentStacks: 1,
          remainingDuration: -1,
          metadata: {},
        },
      ],
    } as unknown as Cultivator;

    const baseChance = 0.5;
    expect(() => applyBreakthroughChanceBonus(cultivator, baseChance)).not.toThrow();
    expect(applyBreakthroughChanceBonus(cultivator, baseChance)).toBeCloseTo(0.65);
  });

  it('ignores expired persistent buffs', () => {
    const cultivator = {
      id: 'c1',
      name: '测试道友',
      realm: '炼气',
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      persistent_statuses: [
        {
          instanceId: 'b1',
          configId: 'breakthrough_luck',
          casterId: 'c1',
          currentStacks: 1,
          remainingDuration: -1,
          metadata: { expiresAt: Date.now() - 1000 },
        },
      ],
    } as unknown as Cultivator;

    expect(applyBreakthroughChanceBonus(cultivator, 0.5)).toBeCloseTo(0.5);
  });
});
