import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AttributeType,
  BuffType,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { describe, expect, it } from 'vitest';
import {
  StandardSectMethodGrowthPolicy,
  withSectBuffMethodGrowth,
  type SectCompiledAbility,
} from '..';

const policy = new StandardSectMethodGrowthPolicy();

function ability(): SectCompiledAbility {
  return {
    config: {
      slug: 'sect.fixture.growth',
      name: '成长测试',
      type: 'active_skill',
      effects: [
        {
          type: 'damage',
          params: {
            value: { attribute: AttributeType.ATK, coefficient: 1.23456 },
            damageType: DamageType.PHYSICAL,
          },
        },
        {
          type: 'apply_buff',
          params: {
            buffConfig: withSectBuffMethodGrowth(
              {
                id: 'fixture.growing-buff',
                name: '成长状态',
                type: BuffType.BUFF,
                duration: 3,
                stackRule: StackRule.REFRESH_DURATION,
                modifiers: [
                  {
                    attrType: AttributeType.ATK,
                    type: ModifierType.ADD,
                    value: 0.1,
                  },
                ],
              },
              { duration: true },
            ),
          },
        },
        {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: 'fixture.fixed-buff',
              name: '固定状态',
              type: BuffType.BUFF,
              duration: 1,
              stackRule: StackRule.REFRESH_DURATION,
            },
          },
        },
      ],
    },
    detailRows: [],
    notes: [],
  };
}

describe('StandardSectMethodGrowthPolicy', () => {
  it.each([
    [0, 1, 1, 0],
    [1, 1, 1, 0],
    [29, 1, 1, 0],
    [30, 1.0833, 1.0667, 0],
    [60, 1.1667, 1.1333, 1],
    [100, 1.25, 1.2, 1],
    [180, 1.5, 1.4, 3],
    [999, 1.5, 1.4, 3],
    [-10, 1, 1, 0],
  ])('等级 %i 使用标准成长档位', (level, magnitude, status, duration) => {
    expect(policy.resolve(level)).toEqual({
      level: Math.max(1, Math.min(180, level)),
      magnitude,
      statusMagnitude: status,
      durationBonus: duration,
    });
  });

  it('组合完成后执行一次最终投影，并区分成长与固定持续时间', () => {
    const once = policy.projectAbility(ability(), 'fixture-method', {
      'fixture-method': 180,
    });
    expect(once.config.effects?.[0]).toMatchObject({
      params: { value: { coefficient: 1.8518 } },
    });
    expect(once.config.effects?.[1]).toMatchObject({
      params: {
        buffConfig: {
          duration: 6,
          modifiers: [{ value: 0.14 }],
        },
      },
    });
    expect(once.config.effects?.[2]).toMatchObject({
      params: { buffConfig: { duration: 1 } },
    });
    expect(JSON.stringify(once.config)).not.toContain('__sectMethodGrowth');
  });
});
