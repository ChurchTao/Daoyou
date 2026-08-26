import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { DamageSegmentRequestedEvent } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';

function state(pathId: 'mirror-karma' | 'demon-crossing'): CultivatorSectState {
  return {
    membershipId: 'foundation-runtime',
    sectId: 'wuxiang',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    activePathId: pathId,
    methods: {
      'wuxiang-canon': 5,
      'blood-lotus': 180,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    paths: [
      {
        pathId,
        unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
        tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: [], version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ],
    abilityLoadout: [
      'turn-form',
      'blood-tide',
      'three-knocks',
      'observe-calamity',
    ],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.ENDURANCE]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

describe('无相禅宗根基被动', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it.each(['mirror-karma', 'demon-crossing'] as const)(
    '不坏色身在%s中固定投影一次且最大气血提高10%%',
    (pathId) => {
      const sect = state(pathId);
      const detail = resolveSectAbility({
        sect,
        realm: '化神',
        abilityId: 'wuxiang-runtime',
      });
      expect(detail.config.modifiers).toEqual([
        {
          attrType: AttributeType.MAX_HP,
          type: ModifierType.ADD,
          value: 0.1,
        },
      ]);
      expect(detail.detailRows).toEqual([
        '常驻：最大气血+10%',
        '承伤：自身气血低于50%且受到直接伤害时，受到的直接伤害降低10%',
      ]);
      const projection = projectSectCombat({ sect, realm: '化神' })!;
      expect(
        projection.abilities.filter(
          (ability) => ability.slug === 'sect.wuxiang.wuxiang-runtime',
        ),
      ).toHaveLength(1);
    },
  );

  it('只在气血严格低于50%时降低10%直接伤害', () => {
    const config = resolveSectAbility({
      sect: state('mirror-karma'),
      realm: '化神',
      abilityId: 'wuxiang-runtime',
    }).config;
    const owner = unit('owner');
    const enemy = unit('enemy');
    const baseMaxHp = owner.getMaxHp();
    owner.abilities.addAbility(AbilityFactory.create(config));
    expect(owner.getMaxHp()).toBeCloseTo(baseMaxHp * 1.1);

    const request = (
      hpRatio: number,
      damageSource: DamageSource,
    ): DamageSegmentRequestedEvent => {
      owner.setHp(owner.getMaxHp() * hpRatio);
      const event: DamageSegmentRequestedEvent = {
        type: 'DamageSegmentRequestedEvent',
        timestamp: Date.now(),
        caster: enemy,
        target: owner,
        damageSource,
        damageType: DamageType.PHYSICAL,
        baseDamage: 100,
        finalDamage: 100,
      };
      EventBus.instance.publish(event);
      return event;
    };

    expect(
      request(0.49, DamageSource.DIRECT).damageReductionPctBucket,
    ).toBeCloseTo(0.1);
    expect(
      request(0.5, DamageSource.DIRECT).damageReductionPctBucket,
    ).toBeUndefined();
    expect(
      request(0.51, DamageSource.DIRECT).damageReductionPctBucket,
    ).toBeUndefined();
    for (const source of [
      DamageSource.COUNTER,
      DamageSource.FOLLOW_UP,
      DamageSource.DELAYED,
      DamageSource.REFLECT,
    ]) {
      expect(request(0.49, source).damageReductionPctBucket).toBeUndefined();
    }
  });
});
