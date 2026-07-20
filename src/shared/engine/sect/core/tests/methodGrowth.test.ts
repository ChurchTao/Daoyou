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
    [0, 0, 1, 1, 0],
    [1, 0, 1, 1, 0],
    [29, 0, 1, 1, 0],
    [30, 1, 1.0833, 1.0667, 0],
    [60, 2, 1.1667, 1.1333, 1],
    [100, 3, 1.25, 1.2, 1],
    [180, 6, 1.5, 1.4, 3],
    [999, 6, 1.5, 1.4, 3],
    [-10, 0, 1, 1, 0],
  ])('等级 %i 使用标准成长档位', (level, tier, magnitude, status, duration) => {
    expect(policy.resolve(level)).toEqual({
      level: Math.max(1, Math.min(180, level)),
      tier,
      magnitude,
      statusMagnitude: status,
      durationBonus: duration,
    });
  });

  it.each([
    [0, 1],
    [1, 1],
    [29, 1],
    [30, 2],
    [59, 2],
    [60, 3],
    [89, 3],
    [90, 4],
    [119, 4],
    [120, 5],
    [149, 5],
    [150, 6],
    [179, 6],
    [180, 7],
    [999, 7],
  ])('等级 %i 将基础计数1成长为%i', (level, expected) => {
    expect(policy.growCount(1, level)).toBe(expected);
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

  it('被动固定数值不成长，但会解析内部显式声明的状态成长', () => {
    const passive = {
      slug: 'sect.fixture.passive-growth',
      name: '被动成长测试',
      type: 'passive_skill' as const,
      listeners: [
        {
          id: 'fixture.listener',
          eventType: 'ActionPostEvent',
          scope: 'owner_as_actor',
          priority: 0,
          mapping: { caster: 'owner' as const, target: 'owner' as const },
          effects: [
            {
              type: 'damage' as const,
              params: {
                value: { attribute: AttributeType.ATK, coefficient: 0.4 },
                damageType: DamageType.PHYSICAL,
              },
            },
            {
              type: 'apply_buff' as const,
              params: {
                target: 'target' as const,
                buffConfig: withSectBuffMethodGrowth(
                  {
                    id: 'fixture.passive-mark',
                    name: '被动印记',
                    type: BuffType.DEBUFF,
                    duration: 3,
                    stackRule: StackRule.STACK_LAYER,
                    modifiers: [
                      {
                        attrType: AttributeType.DEF,
                        type: ModifierType.ADD,
                        value: -0.03,
                      },
                    ],
                  },
                  { methodId: 'fixture-method', duration: true },
                ),
              },
            },
          ],
        },
      ],
    };

    const projected = policy.projectAbilityWithoutMethod(
      { config: passive, detailRows: [], notes: [] },
      { 'fixture-method': 180 },
    ).config;
    expect(projected.listeners?.[0].effects[0]).toMatchObject({
      params: { value: { coefficient: 0.4 } },
    });
    expect(projected.listeners?.[0].effects[1]).toMatchObject({
      params: {
        buffConfig: { duration: 6, modifiers: [{ value: -0.042 }] },
      },
    });
    expect(JSON.stringify(projected)).not.toContain('__sectMethodGrowth');
  });
});
